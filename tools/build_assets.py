#!/usr/bin/env python3
"""
Собирает prototype/assets и prototype/styles/icons.css из исходных папок проекта.

Оригиналы (папки Buttons, Friends, Map, profile, messanger, pin, avatars, 3D stickers)
никогда не меняются. Всё, что лежит в prototype/assets, – производное: пережатое,
уменьшенное или вырезанное из референсных скриншотов. Перезапуск скрипта
пересобирает всё с нуля, поэтому руками в prototype/assets ничего не правим.

Запуск:  python3 prototype/tools/build_assets.py
Нужно:   Python 3.9+, Pillow, numpy, scipy, segno (QR-код профиля)

Каждый элемент ниже записан с источником (файл + рамка в пикселях @3x),
чтобы по любому ассету можно было найти, откуда он взят.
"""
from __future__ import annotations

import base64
import io
import re
import shutil
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]          # папка Blink DS
OUT = ROOT / "prototype" / "assets"
ICONS_CSS = ROOT / "prototype" / "styles" / "icons.css"

SCREEN_FRIENDS = "Friends/Друзья.png"
SCREEN_CHATS = "messanger/chat list/Список чатов.png"
SCREEN_CHAT = "messanger/chat inside/основной.png"
SCREEN_PROFILE = "profile/profile.png"


# ─────────────────────────────── helpers ────────────────────────────────

def src(path: str) -> Path:
    p = ROOT / path
    if not p.exists():
        raise FileNotFoundError(p)
    return p


def rgba(path: str) -> np.ndarray:
    return np.array(Image.open(src(path)).convert("RGBA")).astype(np.float32)


def save_png(arr: np.ndarray, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA").save(dest, optimize=True)


def save_webp(img: Image.Image, dest: Path, quality: int = 88) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, "WEBP", quality=quality, method=6)


def trim(arr: np.ndarray, pad: int = 0) -> np.ndarray:
    """Обрезает прозрачные поля, оставляя pad пикселей."""
    alpha = arr[:, :, 3] > 4
    ys, xs = np.where(alpha.any(axis=1))[0], np.where(alpha.any(axis=0))[0]
    if not len(ys):
        return arr
    y0, y1 = max(ys[0] - pad, 0), min(ys[-1] + 1 + pad, arr.shape[0])
    x0, x1 = max(xs[0] - pad, 0), min(xs[-1] + 1 + pad, arr.shape[1])
    return arr[y0:y1, x0:x1]


def square(arr: np.ndarray, size: int | None = None) -> np.ndarray:
    """Кладёт глиф по центру квадратного прозрачного холста."""
    h, w = arr.shape[:2]
    side = size or max(h, w)
    canvas = np.zeros((side, side, 4), np.float32)
    y, x = (side - h) // 2, (side - w) // 2
    canvas[y:y + h, x:x + w] = arr
    return canvas


def unblend(path: str, box: tuple[int, int, int, int], bg, fg=None) -> np.ndarray:
    """
    Снимает одноцветный глиф с фона.
    alpha = проекция (пиксель − фон) на (цвет глифа − фон). Если цвет глифа
    не задан, берётся самый „далёкий“ от фона цвет в рамке.
    bg="rows" – фон меняется сверху вниз (градиент): для каждой строки он
    берётся по крайним столбцам рамки, поэтому рамка должна быть с полями.
    Альфа нормализуется, чтобы глиф был плотным (серый исходник → белая маска).
    Возвращает белый глиф с альфой – перекрашивается через CSS-маску.
    """
    a = rgba(path)[box[1]:box[3], box[0]:box[2], :3]
    if isinstance(bg, str) and bg == "rows":
        edges = np.concatenate([a[:, :3], a[:, -3:]], axis=1)
        bgmap = np.median(edges, axis=1)[:, None, :]
    else:
        bgmap = np.array(bg, np.float32)[None, None, :]
    diff = a - bgmap
    if fg is None:
        dist = np.linalg.norm(diff, axis=2)
        idx = np.unravel_index(np.argmax(dist), dist.shape)
        fg = a[idx]
    axis = np.array(fg, np.float32) - bgmap
    alpha = (diff * axis).sum(axis=2) / np.maximum((axis * axis).sum(axis=2), 1)
    alpha = np.clip(alpha, 0, 1)
    peak = np.percentile(alpha[alpha > 0.05], 99) if (alpha > 0.05).any() else 1
    alpha = np.clip(alpha / max(peak, 0.2), 0, 1)
    alpha[alpha < 0.06] = 0
    out = np.zeros((*alpha.shape, 4), np.float32)
    out[:, :, :3] = 255
    out[:, :, 3] = alpha * 255
    return out


def alpha_glyph(path: str, box, low: float, high: float, color_test=None) -> np.ndarray:
    """Глиф, который в исходнике отличается от подложки только альфой (кнопки профиля)."""
    a = rgba(path)[box[1]:box[3], box[0]:box[2]]
    alpha = np.clip((a[:, :, 3] - low) / (high - low), 0, 1)
    if color_test is not None:
        alpha = alpha * color_test(a[:, :, :3])
    out = np.zeros(a.shape, np.float32)
    out[:, :, :3] = 255
    out[:, :, 3] = alpha * 255
    return out


def rounded_mask(h: int, w: int, r: float) -> np.ndarray:
    """Антиалиасная маска скруглённого прямоугольника (для вырезки плашек и аватаров)."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32) + 0.5
    cx = np.clip(xx, r, w - r)
    cy = np.clip(yy, r, h - r)
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    return np.clip(r - d + 0.5, 0, 1)


def crop_photo(path: str, box, radius_px: float, dest: Path, size: int | None = None) -> None:
    """Вырезает фото (аватар, превью) из скриншота и скругляет углы по форме оригинала."""
    a = rgba(path)[box[1]:box[3], box[0]:box[2]].copy()
    a[:, :, 3] *= rounded_mask(a.shape[0], a.shape[1], radius_px)
    img = Image.fromarray(a.astype(np.uint8), "RGBA")
    if size:
        img = img.resize((size, size), Image.LANCZOS)
    save_webp(img, dest, 92)


def resize_to(path: str, dest: Path, max_side: int, quality: int = 88, fmt: str = "webp") -> None:
    img = Image.open(src(path))
    img = img.convert("RGBA") if img.mode in ("RGBA", "LA", "P") else img.convert("RGB")
    if max(img.size) > max_side:
        img.thumbnail((max_side, max_side), Image.LANCZOS)
    if fmt == "webp":
        save_webp(img, dest, quality)
    else:
        dest.parent.mkdir(parents=True, exist_ok=True)
        img.save(dest, optimize=True)


def data_uri(path: Path) -> str:
    mime = "image/svg+xml" if path.suffix == ".svg" else "image/png"
    if mime == "image/svg+xml":
        svg = path.read_text("utf-8")
        svg = re.sub(r"\s+", " ", svg).strip()
        return "data:image/svg+xml;base64," + base64.b64encode(svg.encode()).decode()
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode()


def svg_as_mask(source: str, dest: Path) -> None:
    """Копия SVG из проекта, где все заливки сделаны сплошными – для CSS-маски.
    Контуры не трогаем: форма иконки остаётся ровно такой, как в библиотеке."""
    svg = src(source).read_text("utf-8")
    svg = re.sub(r'fill="(?!none)[^"]*"', 'fill="#000"', svg)
    svg = re.sub(r'stroke="(?!none)[^"]*"', 'stroke="#000"', svg)
    svg = re.sub(r'\s(fill|stroke)-opacity="[^"]*"', "", svg)
    svg = re.sub(r"<clipPath.*?</clipPath>", "", svg, flags=re.S)
    svg = re.sub(r'\sclip-path="[^"]*"', "", svg)
    svg = re.sub(r'\sclip-rule="[^"]*"', "", svg)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(svg, "utf-8")


# ─────────────────────────────── specs ─────────────────────────────────

# Одноцветные иконки из библиотеки проекта (SVG, контуры не меняются).
SVG_ICONS = {
    "pin":           "messanger/icons/glyph.svg",          # таб „карта“
    "friends":       "messanger/icons/nav.svg",            # таб „друзья“
    "chat":          "messanger/icons/message.svg",        # таб „чаты“, кнопка „написать“ в строке друга
    "checkin":       "messanger/icons/glyph-1.svg",        # чекины: место с отметкой (таба больше нет – вход из профиля)
    "market":        "Map/market_icon.svg",                # таб „маркет“ (Map/tab bar@3x.png)
    "compose":       "messanger/icons/create_chat.svg",    # новый чат
    "pinned":        "messanger/icons/glyph_pin_24.svg",   # закреплённый чат
    "orb":           "messanger/icons/glyph_orb_16.svg",   # тип сообщения „шар“
    "reply-checkin": "messanger/icons/ChatIcon.svg",       # „ответ на чекин“
    "bump":          "Friends/bump_glyph.svg",             # „трях“
    "phone":         "Friends/phone_glyph.svg",            # „номер“, звонок в шапке чата
    "link":          "Friends/link_glyph.svg",             # „ссылка“
    "contacts":      "Friends/contact_glyph.svg",          # „тел книга“
    "badge-star":    "Friends/star_counter.svg",           # звезда-счётчик (заявки, непрочитанные)
    "school":        "profile/glyph_school.svg",           # вход в школы „где учишься?“
}

# Иконки, которых нет в SVG: вырезаны из PNG-ассетов и референсных скриншотов.
# (источник, рамка x0,y0,x1,y1 в пикселях @3x, способ)
RASTER_ICONS = {
    # мессенджер: шапка и композер
    "back":       (SCREEN_CHAT, (84, 238, 151, 296), dict(bg=(0, 0, 0), fg=(255, 255, 255))),
    "keyboard":   ("messanger/chat inside/Button_M.png", (24, 30, 111, 102), dict(bg=(65, 65, 65), fg=(255, 255, 255))),
    "sticker":    ("messanger/chat inside/Button_M-1.png", (27, 27, 105, 105), dict(bg=(65, 65, 65), fg=(255, 255, 255))),
    "mic":        ("messanger/chat inside/Button_M-3.png", (33, 27, 99, 111), dict(bg=(65, 65, 65), fg=(255, 255, 255))),
    "close":      ("messanger/chat inside/close_button.png", (35, 35, 97, 97), dict(bg=(65, 65, 65), fg=(255, 255, 255))),
    # ночлеги: контурный месяц у числа ночей (overnight.jpg, строка „85“, плитка #262626)
    "moon":       ("overnight.jpg", (950, 546, 1011, 607), dict(bg=(38, 38, 38), fg=(255, 255, 255))),
    "text-style": ("messanger/chat inside/style_button.png", (23, 38, 109, 94), dict(bg=(65, 65, 65), fg=(255, 255, 255))),
    "send":       ("messanger/chat inside/Button_M-4.png", (29, 29, 107, 104), dict(bg=(255, 255, 255), fg=(0, 0, 0))),
    # список чатов
    "folder":     (SCREEN_CHATS, (45, 426, 111, 480), dict(bg=(0, 0, 0), fg=(255, 255, 255))),
    "reply":      (SCREEN_CHATS, (231, 1656, 285, 1705), dict(bg=(0, 0, 0))),
    # друзья
    "chevron":    (SCREEN_FRIENDS, (1089, 1297, 1122, 1346), dict(bg=(0, 0, 0))),
    "check":      (SCREEN_FRIENDS, (559, 1824, 610, 1860), dict(bg=(36, 36, 36), fg=(255, 255, 255))),
    # карта
    "places":     ("Map/toolbar.png", (72, 27, 156, 105), dict(bg=(0, 0, 0), fg=(255, 255, 255))),
    "space":      ("Map/toolbar.png", (74, 195, 154, 261), dict(bg=(0, 0, 0), fg=(255, 255, 255))),
    "games":      ("Map/toolbar.png", (75, 365, 153, 415), dict(bg=(0, 0, 0), fg=(255, 255, 255))),
    "globe":      ("Map/tools_2_row.png", (435, 54, 519, 138), dict(bg=(255, 255, 255), fg=(0, 0, 0))),
    "crosshair":  ("Map/tools_2_row.png", (1002, 55, 1083, 136), dict(bg=(255, 255, 255), fg=(0, 0, 0))),
    "steps":      ("Map/top.png", (68, 309, 124, 363), dict(bg=(255, 255, 255), fg=(0, 0, 0))),
    # профиль
    "location":   (SCREEN_PROFILE, (353, 1211, 397, 1265), dict(bg="rows")),
    # маркет: плюс на белой кнопке у баланса (market/Coin balance.png снят @4x)
    "plus":       ("market/Coin balance.png", (546, 50, 606, 110), dict(bg=(255, 255, 255), fg=(0, 0, 0))),
}

ALPHA_ICONS = {
    # кнопки профиля: чёрная иконка поверх подложки rgba(0,0,0,.25) – отличаются только альфой
    "palette":  ("profile/SquareBtn40.png", (24, 31, 96, 89)),
    "edit":     ("profile/SquareBtn40-1.png", (32, 29, 92, 88)),
    "settings": ("profile/SquareBtn40-2.png", (24, 24, 96, 96)),
}

# Готовые одноцветные PNG из проекта (уже с прозрачностью)
PNG_ICONS = {
    "photo": "messanger/chat inside/glyph.png",     # 28 pt, белый
}

# 3D-стикеры: уменьшаем до 360 px (120 pt @3x) – хватает до стикера-героя
STICKERS_SIZE = 360


def build_icons() -> dict[str, Path]:
    icons: dict[str, Path] = {}
    idir = OUT / "icons"

    for name, source in SVG_ICONS.items():
        dest = idir / f"{name}.svg"
        svg_as_mask(source, dest)
        icons[name] = dest

    for name, (path, box, opts) in RASTER_ICONS.items():
        bg = opts.get("bg")
        if isinstance(bg, str) and bg.startswith("sample:"):
            x, y = map(int, bg[len("sample:("):-1].split(","))
            bg = tuple(rgba(path)[y, x, :3])
        glyph = unblend(path, box, bg, opts.get("fg"))
        dest = idir / f"{name}.png"
        save_png(square(trim(glyph, 2)), dest)
        icons[name] = dest

    for name, (path, box) in ALPHA_ICONS.items():
        glyph = alpha_glyph(path, box, low=64, high=255)
        dest = idir / f"{name}.png"
        save_png(square(trim(glyph, 2)), dest)
        icons[name] = dest

    # „поделиться“: белая стрелка на тёмном вертикальном градиенте Icon.png. Кнопка снята с плашки
    # ника, повёрнутой на −3°, и глиф в ней тоже наклонён: низ лотка поднимается вправо на 3°.
    # Выпрямляем – иконка ровная, а наклон даёт плашка в профиле, как на эталоне
    share = unblend("profile/Icon.png", (22, 22, 86, 86), bg="rows", fg=(255, 255, 255))
    share = np.asarray(
        Image.fromarray(share.astype(np.uint8), "RGBA").rotate(-3, resample=Image.BICUBIC, expand=True),
        np.float32,
    )
    save_png(square(trim(share, 2)), idir / "share.png")
    icons["share"] = idir / "share.png"

    # „поиск“: в SearchField.png лупа отличается от заливки поля только альфой (0.49 против 0.15)
    search = alpha_glyph("messanger/chat list/SearchField.png", (30, 28, 125, 112), low=38, high=125)
    save_png(square(trim(search, 2)), idir / "search.png")
    icons["search"] = idir / "search.png"

    # „маршрут“: белая стрелка 50 % в GeoButton.png, рамку кнопки отсекаем
    geo = alpha_glyph("Friends/GeoButton.png", (40, 28, 98, 86), low=0, high=128,
                      color_test=lambda c: (c.min(axis=2) > 180).astype(np.float32))
    save_png(square(trim(geo, 2)), idir / "navigate.png")
    icons["navigate"] = idir / "navigate.png"

    for name, path in PNG_ICONS.items():
        a = rgba(path)
        a[:, :, :3] = 255
        save_png(square(trim(a, 2)), idir / f"{name}.png")
        icons[name] = idir / f"{name}.png"

    # Многоцветные SVG – копируем как есть, используются через <img>
    for name, source in {
        "ambassador": "messanger/icons/Ambassador Badge.svg",
        "audio-note": "messanger/icons/ChatIcon-1.svg",
        "star-pink": "messanger/icons/Star 1.svg",
        "star-pattern": "Friends/star_pattern.svg",
        "map-pin": "pin/Pin.svg",
        "map-pin-selected": "pin/_Pin_states.svg",
    }.items():
        shutil.copyfile(src(source), idir / f"{name}.svg")
    return icons


def write_icons_css(icons: dict[str, Path]) -> None:
    lines = [
        "/* СГЕНЕРИРОВАНО prototype/tools/build_assets.py – руками не править.",
        "   Одноцветные иконки проекта как CSS-маски: цвет задаётся через color.",
        "   Использование: <i class=\"icon icon--chat\" aria-hidden=\"true\"></i> */",
        "",
        ".icon {",
        "  display: inline-block;",
        "  flex-shrink: 0;",
        "  width: var(--icon-size, 24px);",
        "  height: var(--icon-size, 24px);",
        "  background-color: currentColor;",
        "  -webkit-mask: var(--icon) center / contain no-repeat;",
        "          mask: var(--icon) center / contain no-repeat;",
        "}",
        "",
    ]
    for name in sorted(icons):
        lines.append(f".icon--{name} {{ --icon: url(\"{data_uri(icons[name])}\"); }}")
    ICONS_CSS.parent.mkdir(parents=True, exist_ok=True)
    ICONS_CSS.write_text("\n".join(lines) + "\n", "utf-8")


def build_stickers() -> None:
    for p in sorted(src("3D stickers").glob("*.png")):
        name = "zzz" if p.stem.startswith("Group") else p.stem.replace("_", "-")
        resize_to(str(p.relative_to(ROOT)), OUT / "stickers" / f"{name}.webp", STICKERS_SIZE, 90)


def build_people() -> None:
    d = OUT / "people"
    # пак аватаров: вырезки p1–p5 и фото Image*.jpg
    for i in range(1, 6):
        resize_to(f"avatars/p{i}.png", d / f"cutout-{i}.webp", 384, 90)
    for i, name in enumerate(["Image.jpg", "Image-1.jpg", "Image-2.jpg", "Image-3.jpg", "Image-4.jpg"], 1):
        resize_to(f"avatars/{name}", d / f"photo-{i}.webp", 384, 88)
    # вырезка пользователя (профиль, карточка „возможные“, аватар таба „ты“)
    resize_to("profile/avatar.png", d / "me-cutout.webp", 396, 92)
    # аватары из референсных скриншотов (сквиркл 46 pt, радиус 16 pt → 48 px @3x)
    crop_photo(SCREEN_CHATS, (48, 987, 186, 1125), 48, d / "valentin.webp")
    crop_photo(SCREEN_CHATS, (48, 1371, 186, 1509), 48, d / "tarakanus.webp")
    crop_photo(SCREEN_CHATS, (48, 1581, 186, 1719), 48, d / "alesya.webp")
    crop_photo(SCREEN_CHATS, (48, 1803, 186, 1941), 48, d / "kekova.webp")
    crop_photo(SCREEN_CHATS, (48, 1173, 186, 1311), 48, d / "kapibar.webp")
    crop_photo(SCREEN_CHAT, (351, 198, 462, 309), 36, d / "masha.webp")
    crop_photo(SCREEN_FRIENDS, (57, 1056, 195, 1194), 48, d / "natashka.webp")
    # превью фото в строке чата („фото · 7.05“)
    crop_photo(SCREEN_CHATS, (234, 1877, 282, 1925), 12, d / "thumb-photo.webp")


def build_screens_art() -> None:
    # профиль
    p = OUT / "profile"
    for name in ["ProfileFriends", "ProfileViews", "ProfileCheckins", "BeautifulProfileCounter",
                 "image_stars_profile", "image_stars_profile_light"]:
        dest = re.sub(r"(?<!^)(?=[A-Z])", "-", name).lower().replace("_", "-")
        resize_to(f"profile/{name}.png", p / f"{dest}.webp", 600, 90)
    gifts = ["_gift-profile.png", "_gift-profile-1.png", "_gift-profile-2.png",
             "_gift-profile-3.png", "_gift-profile-4.png", "_gift-profile-5.png"]
    for i, g in enumerate(gifts):
        resize_to(f"profile/{g}", p / f"gift-{i}.webp", 300, 92)
    rebuild_profile_theme(p / "theme-glow.webp")
    # монета из плашки „маркет“: круг 60 px
    coin = rgba("profile/market.png")[38:101, 256:319].copy()
    h, w = coin.shape[:2]
    coin[:, :, 3] *= rounded_mask(h, w, min(h, w) / 2)
    save_png(coin, p / "coin.png")

    # друзья
    f = OUT / "friends"
    resize_to("Friends/online_avatar_background.png", f / "glow-online.webp", 192, 92)
    resize_to("Friends/offline_avatar_background.png", f / "glow-offline.webp", 192, 92)
    rim("Friends/online_avatar_background.png", f / "rim-online.png", low=172, high=186)
    rim("Friends/offline_avatar_background.png", f / "rim-offline.png", low=228, high=250)
    resize_to("Friends/image_eyes_sticker.png", f / "eyes.webp", 192, 92)

    # карта
    m = OUT / "map"
    resize_to("Map/map_background.png", m / "map.webp", 1170, 82)
    # та же подложка в полном разрешении: для фич, где карту двигают и приближают (features/geo-share)
    resize_to("Map/map_background.png", m / "map-hd.webp", 2532, 82)

    # список чатов: свечение под таб-баром и баннер „др“
    c = OUT / "chat"
    resize_to("messanger/chat list/Group 2.png", c / "bottom-glow.webp", 1170, 85)
    # арт баннера „др“: аватар друга + 3D-подарок. Сам баннер в PNG полупрозрачный
    # (заливка белая 10 %, рамка #242424) – оставляем только непрозрачный арт.
    banner = rgba("messanger/chat list/ChatListBanner.png")[8:148, 38:168].copy()
    border = np.abs(banner[:, :, :3] - 36).max(axis=2) < 4
    banner[:, :, 3] = np.where(border, 0, np.clip((banner[:, :, 3] - 26) / (255 - 26), 0, 1) * 255)
    save_png(banner, c / "birthday-gift.png")


def rim(path: str, dest: Path, low: float, high: float) -> None:
    """
    Светлая дуга внизу свечения аватара (Friends/*_avatar_background.png, строки 166–181 из 192)
    отдельным слоем: лежит поверх вырезки и закрывает её прямой нижний край. Дуга светлее
    свечения по красному каналу (серое 220 → белая 253, салатовое 165 → 190): по нему и
    отделяем, low → прозрачно, high → полная альфа исходника.
    """
    a = rgba(path).copy()
    k = np.clip((a[:, :, 0] - low) / (high - low), 0, 1)
    k[:160] = 0                                                  # только низ: выше дуги её нет
    a[:, :, 3] *= k
    save_png(a, dest)


def live_avatar(path: str, dest: Path, size: int = 320, person: float = 54 / 80) -> None:
    """
    Живая аватарка для пина: квадрат с запасом над головой. Вырезки из пака сняты вплотную
    к голове, а в пине маска 62×80 pt, и голова должна выходить над кадром всего на ~3 pt
    (pin/staying_*.png). Поэтому человек занимает 54 из 80 pt по ширине и стоит внизу
    по центру. В маске квадрат заполняет высоту и обрезается по бокам (object-fit: cover).
    size – сторона в px (320 = 80 pt @4x).
    """
    img = Image.open(src(path)).convert("RGBA")
    w = round(size * person)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(img.resize((w, w), Image.LANCZOS), ((size - w) // 2, size - w))
    save_webp(canvas, dest, 90)


def build_browser() -> None:
    """
    Рамка мобильного Safari для веб-страниц: browser.png снят @4x (1560×3376 → 390×844 pt).
    Берём нижнюю панель с адресной строкой (711–844 pt). Домен „figma.com“ и замок из поля
    адреса стираем цветом поля: страница пишет свой домен текстом, замок вырезан отдельно.
    Статус-бар сверху у рамки такой же, как у превью, – он общий для всех телефонов.
    """
    w = OUT / "web"
    a = rgba("browser.png")
    panel = a[2844:].copy()
    panel[2932 - 2844:3016 - 2844, 576:1004, :3] = (250, 249, 247)    # замок и домен → фон поля
    save_png(panel, w / "safari-toolbar.png")
    lock = unblend("browser.png", (578, 2938, 618, 2994), bg=(250, 249, 247), fg=(141, 139, 143))
    lock[:, :, :3] = (142, 142, 147)                                  # серый замок Safari
    save_png(trim(lock, 2), w / "lock.png")


def build_share() -> None:
    """QR-код ссылки на профиль для шторки „поделиться“ (наташка из демо шеринга).
    Коррекция ошибок H (30 %): в центре кода лежит аватар, код всё равно читается."""
    import segno   # pip install segno

    d = OUT / "share"
    d.mkdir(parents=True, exist_ok=True)
    qr = segno.make("https://blinkmap.com/@natashka", error="h")
    qr.save(str(d / "qr-natashka.svg"), scale=1, border=0, dark="#000", light=None, xmldecl=False, nl=False)


def svg_path_mask(source: str, size: int, scale: float, offset: tuple[float, float], ss: int = 8) -> np.ndarray:
    """
    Растр одноцветного SVG-глифа без внешних библиотек: абсолютные команды M L H V C Z,
    кривые разбиваются на отрезки, заливка сглаживается суперсэмплингом ss×.
    scale – px на единицу viewBox, offset – сдвиг глифа в px. Возвращает альфу 0…1.
    """
    from PIL import ImageDraw

    d = " ".join(re.findall(r'\sd="([^"]+)"', src(source).read_text("utf-8")))
    tokens = re.findall(r"[MLHVCZ]|-?\d*\.?\d+(?:e-?\d+)?", d)
    polys, poly, cur, cmd, i = [], [], (0.0, 0.0), None, 0
    while i < len(tokens):
        t = tokens[i]
        if t in "MLHVCZ":
            cmd, i = t, i + 1
            if cmd == "Z":
                if poly:
                    polys.append(poly)
                poly = []
            continue
        num = lambda k: float(tokens[i + k])
        if cmd == "M":
            if poly:
                polys.append(poly)
            cur, poly, i, cmd = (num(0), num(1)), [(num(0), num(1))], i + 2, "L"
        elif cmd == "L":
            cur, i = (num(0), num(1)), i + 2
            poly.append(cur)
        elif cmd == "H":
            cur, i = (num(0), cur[1]), i + 1
            poly.append(cur)
        elif cmd == "V":
            cur, i = (cur[0], num(0)), i + 1
            poly.append(cur)
        elif cmd == "C":
            p0, p1, p2, p3 = cur, (num(0), num(1)), (num(2), num(3)), (num(4), num(5))
            for k in range(1, 17):
                u = k / 16
                poly.append(tuple((1 - u) ** 3 * a + 3 * (1 - u) ** 2 * u * b + 3 * (1 - u) * u ** 2 * c + u ** 3 * e
                                  for a, b, c, e in zip(p0, p1, p2, p3)))
            cur, i = p3, i + 6
    if poly:
        polys.append(poly)
    img = Image.new("L", (size * ss, size * ss), 0)
    draw = ImageDraw.Draw(img)
    for pts in polys:
        draw.polygon([((x * scale + offset[0]) * ss, (y * scale + offset[1]) * ss) for x, y in pts], fill=255)
    return np.asarray(img.resize((size, size), Image.LANCZOS), np.float32) / 255


def outlined_badge(alpha: np.ndarray, outline_px: float) -> np.ndarray:
    """Чёрный глиф со скруглённой белой обводкой – как стрелки „в пути“ (pin/arrows.png)."""
    from scipy.ndimage import distance_transform_edt

    dist = distance_transform_edt(alpha < 0.5)
    ring = np.clip(outline_px + 0.5 - dist, 0, 1)
    out = np.zeros((*alpha.shape, 4), np.float32)
    out[:, :, :3] = 255
    out[:, :, 3] = np.maximum(ring, alpha) * 255
    out[:, :, :3] *= (1 - alpha)[:, :, None]                     # глиф чёрный поверх белой обводки
    return out


def build_overnights() -> None:
    """
    Ночлеги (features/overnights): 3D-домик с месяцем nighthouse.png и ночная карта.
    Ночная карта – та же подложка Map/map_background.png: суша почти чёрная, дороги –
    приглушённые сине-фиолетовые (чем светлее дорога днём, тем светлее ночью), вода – глубокий
    синий, парки темнее суши; подписи и значки гасим – ночью карта без текста.
    """
    d = OUT / "overnights"
    resize_to("nighthouse.png", d / "nighthouse.webp", 264, 92)
    resize_to("home_on_map.png", d / "home.webp", 176, 92)        # твой дом в списке мест
    resize_to("car.png", d / "car.webp", 132, 92)                  # города: машина
    resize_to("airplane.png", d / "airplane.webp", 132, 92)        # города: самолёт
    resize_to("logo.png", OUT / "brand" / "logo.png", 540, fmt="png")   # логотип BLINK, белый – на сторис
    # бейдж пина „ночёвка“: домик с месяцем 20 pt с белой скруглённой обводкой – как домик
    # и стрелки в pin/ (24 pt, 72 px @3x)
    art = Image.open(src("nighthouse.png")).convert("RGBA").resize((60, 60), Image.LANCZOS)
    canvas = Image.new("RGBA", (72, 72), (0, 0, 0, 0))
    canvas.alpha_composite(art, (6, 6))
    arr = np.asarray(canvas, np.float32)
    from scipy.ndimage import distance_transform_edt
    ring = np.clip(6.5 - distance_transform_edt(arr[:, :, 3] < 128), 0, 1)
    base = np.zeros_like(arr)
    base[:, :, :3] = 255
    base[:, :, 3] = ring * 255
    a_art = arr[:, :, 3:4] / 255
    out = base.copy()
    out[:, :, :3] = arr[:, :, :3] * a_art + base[:, :, :3] * (1 - a_art)
    out[:, :, 3] = np.maximum(base[:, :, 3], arr[:, :, 3])
    save_png(out, OUT / "pin" / "overnight.png")
    a = rgba("Map/map_background.png")[:, :, :3] / 255
    lum = a @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    sat = (a.max(axis=2) - a.min(axis=2)) / np.maximum(a.max(axis=2), 1e-3)
    t = np.clip((lum - 0.80) / 0.20, 0, 1) ** 1.5
    base = np.array([0.020, 0.022, 0.045], np.float32)
    road = np.array([0.20, 0.21, 0.36], np.float32)
    out = base + t[..., None] * (road - base)
    water = (a[..., 2] > a[..., 0] + 0.08) & (sat > 0.2)
    park = (a[..., 1] > a[..., 0] + 0.04) & (a[..., 1] > a[..., 2]) & (sat > 0.15)
    out[water] = (0.035, 0.07, 0.16)
    out[park] = out[park] * 0.6 + np.array([0.02, 0.045, 0.04], np.float32)
    out[lum < 0.45] = base * 1.3
    img = Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8), "RGB")
    save_webp(img.resize((780, round(img.height * 780 / img.width)), Image.LANCZOS), d / "map-night.webp", 80)


SCREEN_MARKET = "market/market_full_screen.png"


def cutout_on_black(path: str, box_pt: tuple[float, float, float, float], dest: Path,
                    body_threshold: float = 22, width_px: int | None = None, quality: int = 90,
                    hull: bool = False) -> None:
    """Предмет со скриншота на чистом чёрном фоне → PNG/WebP с прозрачностью.
    Звёзды фона (мелкие точки) убираем. Тело предмета (всё, что заметно светлее чёрного, с залитыми
    дырами) – непрозрачное: тёмное нутро упаковки не просвечивает. Снаружи тела – мягкое свечение:
    альфа по яркости, цвет распремножаем, чтобы на чёрном выглядело как на скриншоте.
    box_pt – рамка x0, y0, x1, y1 в pt (@3x → ×3). hull=True – тело по выпуклой оболочке: у карточек
    коллекции тонкая тёмная рамка не везде замкнута, а форма – наклонённый прямоугольник."""
    from scipy import ndimage
    x0, y0, x1, y1 = (round(v * 3) for v in box_pt)
    arr = rgba(path)[y0:y1, x0:x1].copy()
    rgb = arr[:, :, :3]
    lum = rgb.max(axis=2)
    lab, n = ndimage.label(lum > 24)
    if n:
        sizes = ndimage.sum(np.ones_like(lum), lab, range(1, n + 1))
        stars = np.isin(lab, np.where(sizes < 80)[0] + 1)
        rgb[ndimage.binary_dilation(stars, iterations=2)] = 0
        lum = rgb.max(axis=2)
    body = lum > body_threshold
    lab, n = ndimage.label(body)
    if n:
        sizes = ndimage.sum(body, lab, range(1, n + 1))
        body = np.isin(lab, np.where(sizes >= sizes.max() * 0.04)[0] + 1)
    if hull:
        # наименьший по площади повёрнутый прямоугольник вокруг рамки и содержимого – сама карточка
        from PIL import ImageDraw
        from scipy.spatial import ConvexHull
        pts = np.argwhere(body)[:, ::-1].astype(np.float64)
        hull_pts = pts[ConvexHull(pts).vertices]
        best = None
        for i in range(len(hull_pts)):
            edge = hull_pts[(i + 1) % len(hull_pts)] - hull_pts[i]
            ang = np.arctan2(edge[1], edge[0])
            rot = np.array([[np.cos(ang), np.sin(ang)], [-np.sin(ang), np.cos(ang)]])
            r = hull_pts @ rot.T
            lo, hi = r.min(axis=0), r.max(axis=0)
            area = np.prod(hi - lo)
            if best is None or area < best[0]:
                best = (area, rot, lo, hi)
        _, rot, lo, hi = best
        corners = np.array([[lo[0], lo[1]], [hi[0], lo[1]], [hi[0], hi[1]], [lo[0], hi[1]]]) @ rot
        poly = Image.new("L", body.shape[::-1], 0)
        ImageDraw.Draw(poly).polygon([tuple(c) for c in corners], fill=255)
        body = ndimage.binary_erosion(np.asarray(poly) > 0, iterations=2)
    else:
        body = ndimage.binary_erosion(ndimage.binary_fill_holes(ndimage.binary_closing(body, iterations=3)), iterations=2)
    alpha = np.clip(lum / 255 * 1.4, 0, 1)
    alpha[body] = 1
    out = np.zeros_like(arr)
    out[:, :, :3] = np.clip(rgb / np.maximum(alpha[:, :, None], 1 / 255), 0, 255)
    out[:, :, 3] = alpha * 255
    img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA")
    if width_px:
        img = img.resize((width_px, round(img.height * width_px / img.width)), Image.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.suffix == ".webp":
        img.save(dest, "WEBP", quality=quality, method=6)
    else:
        img.save(dest, optimize=True)


def package_without_price(path: str, dest: Path, width_px: int) -> None:
    """Упаковка из market/items (снята @4x) без вшитого ценника: ценник рисует вёрстка,
    цена у каждого предмета своя. Режем по пустой строке между упаковкой и ценником."""
    arr = rgba(path)
    rows = (arr[:, :, 3] > 8).sum(axis=1)
    h = arr.shape[0]
    empty = [y for y in range(int(h * 0.6), h) if rows[y] == 0]
    # пустой строки нет – ценник касается упаковки: режем по самой узкой строке между ними
    cut = empty[0] if empty else int(h * 0.75) + int(np.argmin(rows[int(h * 0.75):]))
    ys, xs = np.where(arr[:cut, :, 3] > 8)
    part = arr[ys.min():cut, xs.min():xs.max() + 1]
    img = Image.fromarray(part.astype(np.uint8), "RGBA")
    img = img.resize((width_px, round(img.height * width_px / img.width)), Image.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, "WEBP", quality=90, method=6)


def market_ring(dest: Path) -> None:
    """Кольцо-градиент в углу маркета (market/gradient.png). Подобрано по эталону
    market_full_screen.png: кольцо шириной 553 pt, центр в (376, −160) pt, поворот 89.5°, размытие
    8.2 pt – на экране видна только его нижняя дуга. Размытие запекаем: в CSS кольцо только вращается.
    Картинка 1 px = 1 pt, с полями 26 под размытие: итог 605 px по ширине."""
    from scipy import ndimage
    size, pad, sigma = 553, 26, 8.2
    ring = Image.open(src("market/gradient.png")).convert("RGBA")
    ring = ring.resize((size, round(ring.height * size / ring.width)), Image.LANCZOS)
    arr = np.array(ring).astype(np.float32) / 255
    canvas = np.zeros((arr.shape[0] + 2 * pad, arr.shape[1] + 2 * pad, 4), np.float32)
    canvas[pad:pad + arr.shape[0], pad:pad + arr.shape[1]] = arr
    pm = canvas[..., :3] * canvas[..., 3:4]                      # размываем в премультиплицированном виде
    pm = np.stack([ndimage.gaussian_filter(pm[..., k], sigma) for k in range(3)], -1)
    alpha = ndimage.gaussian_filter(canvas[..., 3], sigma)
    out = np.zeros_like(canvas)
    out[..., :3] = pm / np.maximum(alpha[..., None], 1e-4)
    out[..., 3] = alpha
    dest.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray((np.clip(out, 0, 1) * 255).round().astype(np.uint8), "RGBA").save(dest, "WEBP", quality=86, method=6)


def newyear_gift(dest: Path, width_px: int = 360) -> None:
    """Подарок пункта отправки (gift.png в корне проекта) в цветах 3D-подарка на крыше пункта:
    коробка розовая #FF75E1, лента салатовая #96E732 (--color-pink и --color-online).
    Не сдвиг тона – он сжимал тени, и подарок выходил плоским. Карта градиента: светлота каждой
    точки оригинала (у коробки 0.21…0.73, у ленты 0.48…0.97 – 1-й и 99-й перцентили) растянута
    на 0…1, тени углублены (степень 1.5) и разложены по палитре от глубокой тени до блика.
    Форма, складки ленты и блики – от оригинала, объём – контрастнее."""
    img = np.array(Image.open(src("gift.png")).convert("RGBA")).astype(np.float32) / 255
    rgb, a = img[..., :3], img[..., 3]
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(-1), rgb.min(-1)
    d = mx - mn
    h = np.zeros_like(mx)
    m = d > 1e-6
    rr = m & (mx == r)
    gg = m & (mx == g) & ~rr
    bb = m & ~rr & ~gg
    h[rr] = ((g - b)[rr] / d[rr]) % 6
    h[gg] = (b - r)[gg] / d[gg] + 2
    h[bb] = (r - g)[bb] / d[bb] + 4
    h = h * 60
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b

    def ramp(t: np.ndarray, stops: list[tuple[float, str]]) -> np.ndarray:
        pos = np.array([p for p, _ in stops], np.float32)
        cols = np.array([[int(c[i:i + 2], 16) / 255 for i in (1, 3, 5)] for _, c in stops], np.float32)
        return np.stack([np.interp(t, pos, cols[:, k]) for k in range(3)], -1)

    parts = [
        ((h > 300) | (h < 18), (0.214, 0.727),                  # коробка: коралловая → розовая
         [(0, "#4a0636"), (0.3, "#9c1a7c"), (0.62, "#e04cc4"), (0.8, "#ff75e1"), (0.93, "#ffb3ef"), (1, "#fff0fb")]),
        ((h >= 18) & (h < 90), (0.482, 0.968),                  # лента: золотая → салатовая
         [(0, "#1f4504"), (0.3, "#4f8a0e"), (0.6, "#7fcc22"), (0.78, "#96e732"), (0.92, "#c9ff72"), (1, "#f4ffdf")]),
    ]
    out = rgb.copy()
    for mask, (lo, hi), stops in parts:
        t = np.clip((lum[mask] - lo) / (hi - lo), 0, 1) ** 1.5
        out[mask] = ramp(t, stops)
    res = Image.fromarray((np.dstack([out, a]) * 255).round().astype(np.uint8), "RGBA")
    if res.width != width_px:
        res = res.resize((width_px, round(res.height * width_px / res.width)), Image.LANCZOS)
    save_webp(res, dest, 90)


def build_market() -> None:
    """
    Маркет (market/*): эталон – market/market_full_screen.png (390×2450 pt @3x, длинный скриншот).
    Упаковки хвостов, карточки коллекции и архива, лента „архив“ вырезаны со скриншота
    (фон чистый чёрный) – рамки в pt @3x. Упаковки стикеров – market/items/*.png (@4x) без
    вшитого ценника. Монета, свечения – ассеты папки как есть, пережатые.
    """
    d = OUT / "market"
    # хвосты: главный (SALE, огонь) и сетка – pt, рамка вокруг упаковки со свечением, без ценника
    tails = {
        "tail-fire-sale": (108, 192, 281, 392),       # главный, над ценником „300“
        "tail-cat": (37, 456, 176, 618),              # PARTNER, кот на волне
        "tail-fire": (216, 456, 353, 618),            # огонь, „бесплатно“
        "tail-fire-2": (37, 684, 174, 846),
        "tail-shadow-sale": (214, 684, 357, 847),     # SALE, тень-рука
        "tail-pixel": (126, 912, 265, 1074),          # PARTNER, пиксели – „скоро“
    }
    for name, box in tails.items():
        cutout_on_black(SCREEN_MARKET, box, d / f"{name}.webp", width_px=round((box[2] - box[0]) * 3))
    # коллекция „уже у тебя“ и архив: карточки хвоста без упаковки, у каждой свой наклон
    # рамки – с тёмно-серой рамкой карточки (#1C1C1C, светлее фона на 28)
    cards = {
        "owned-1": (46, 1275, 170, 1423), "owned-2": (225, 1276, 348, 1422), "owned-3": (135, 1496, 258, 1642),
        "archive-1": (46, 2031, 170, 2179), "archive-2": (225, 2032, 348, 2178),
    }
    for name, box in cards.items():
        cutout_on_black(SCREEN_MARKET, box, d / f"{name}.webp", body_threshold=10,
                        width_px=round((box[2] - box[0]) * 3), hull=True)
    # лента „архив“ во всю ширину: чёрные полосы – это фон, их не восстанавливаем
    cutout_on_black(SCREEN_MARKET, (0, 1712, 390, 1872), d / "tape.webp", body_threshold=255)
    # стикеры и хвосты из market/items (@4x) → @3x без ценника
    items = {
        "item box.png": "shadow-sale", "item box-1.png": "jewelry-limited", "item box-2.png": "shadow-limited",
        "item box-3.png": "bat-box-sale", "item box-4.png": "ghost-box-new", "item box-5.png": "zombie-box-new",
        "item box-6.png": "bat-sale", "item box-7.png": "ghost", "item box-8.png": "pumpkin",
        "item box-9.png": "zombie-new", "Item (large).png": "fire-new",
    }
    for file, name in items.items():
        package_without_price(f"market/items/{file}", d / "items" / f"{name}.webp", 390)
    resize_to("market/coin_icon.png", d / "coin.png", 84, fmt="png")                 # 28 pt @3x
    market_ring(d / "ring.webp")                                                     # вращается в углу маркета
    newyear_gift(d / "gift.webp")                                                 # пункт отправки подарков
    resize_to("market/_background_glow.png", d / "glow-top.webp", 1170, 88)          # свечение над шторкой
    resize_to("market/map_for_tale.png", d / "map-tail.webp", 1026, 86)              # карта в карточке хвоста
    resize_to("market/tale_package.png", d / "package-box.webp", 429, 90)            # пустые упаковки
    resize_to("market/sticker_package.png", d / "package-bag.webp", 429, 90)


def build_pins() -> None:
    """Пин друга на карте: детали из pin/ (сняты @3x) как есть, только пережатые."""
    d = OUT / "pin"
    resize_to("pin/Pin_online.png", d / "online.png", 156, fmt="png")     # подложка „в сети“, 52 pt
    resize_to("pin/Trail.png", d / "trail.webp", 270, 90)                  # хвост „в пути“, 90×60 pt
    resize_to("pin/arrows.png", d / "arrows.png", 72, fmt="png")           # стрелки „в пути“, 24 pt
    resize_to("pin/home_icon.png", d / "home.png", 72, fmt="png")          # домик „дома“, 24 pt
    # „гео перестало приходить“: pin/geo_approximate.svg (белый глиф 20×20) в стиле стрелок –
    # чёрный, с белой скруглённой обводкой 3 pt, бейдж 24 pt (72 px @3x)
    glyph = svg_path_mask("pin/geo_approximate.svg", 72, 2.7, (9, 9))
    save_png(outlined_badge(glyph, 9), d / "approximate.png")
    # плашка заряда под пином того, кто делится геопозицией (pin/other_pin_sharing.png, @4x):
    # Map/Battery.png снят тоже @4x – 36.75×16.5 pt. Берём целиком и без изменений, „12%“ в ней свой
    resize_to("Map/Battery.png", d / "battery.png", 147, fmt="png")
    for i in range(1, 6):
        live_avatar(f"avatars/p{i}.png", OUT / "people" / f"live-{i}.webp")


def rebuild_profile_theme(dest: Path) -> None:
    """
    Фон-тема профиля (свечение лайм → голубой → фиолетовый) есть только на
    референсе profile/profile.png, поверх него лежит контент. Восстанавливаем фон:
    маскируем контент по альфе самих ассетов в их координатах на скриншоте
    (аватар, подарки) и по рамкам текстов и кнопок, дыры заполняем
    нормализованной свёрткой в двух масштабах. Поле гладкое, поэтому результат
    неотличим от исходного фона.
    """
    from scipy.ndimage import binary_dilation, gaussian_filter

    H, W = 450, 390
    img = rgba(SCREEN_PROFILE)[: H * 3, :, :3]
    content = np.zeros((H * 3, W * 3), bool)

    def stamp(asset: str, x: float, y: float) -> None:
        a = rgba(asset)[:, :, 3] > 20
        X, Y = int(round(x * 3)), int(round(y * 3))
        h, w = a.shape
        y1, x1 = min(Y + h, H * 3), min(X + w, W * 3)
        content[Y:y1, X:x1] |= a[: y1 - Y, : x1 - X]

    def box(x0: float, y0: float, x1: float, y1: float) -> None:
        content[int(y0 * 3):int(y1 * 3), int(x0 * 3):int(x1 * 3)] = True

    stamp("profile/avatar.png", 120, 126)
    for name, x, y in [("_gift-profile.png", 61, 115.3), ("_gift-profile-1.png", 263, 109.3),
                       ("_gift-profile-2.png", 323.7, 164), ("_gift-profile-3.png", 4.7, 164),
                       ("_gift-profile-4.png", 50.3, 208), ("_gift-profile-5.png", 277, 208)]:
        stamp(f"profile/{name}", x, y)
    for b in [(30, 14, 80, 40), (150, 8, 240, 40), (280, 14, 370, 40),      # статус-бар
              (14, 54, 160, 98), (215, 50, 380, 102),                       # кнопки, маркет
              (124, 234, 268, 284), (78, 292, 312, 322), (32, 331, 360, 394), (115, 403, 278, 424)]:
        box(*b)
    yy, xx = np.mgrid[0:H * 3, 0:W * 3]
    r = 55 * 3                                                              # скруглённые углы скриншота
    content |= (yy < r) & (xx < r) & ((xx - r) ** 2 + (yy - r) ** 2 > r * r)
    content |= (yy < r) & (xx > W * 3 - r) & ((xx - (W * 3 - r)) ** 2 + (yy - r) ** 2 > r * r)
    content = binary_dilation(content, iterations=6)

    small = np.array(Image.fromarray(img.astype(np.uint8)).resize((W, H), Image.BOX)).astype(np.float32)
    known = np.array(Image.fromarray((~content).astype(np.uint8) * 255).resize((W, H), Image.BOX)) > 250

    def fill(sigma: float):
        weight = gaussian_filter(known.astype(np.float32), sigma)
        chan = [gaussian_filter(small[:, :, c] * known, sigma) for c in range(3)]
        return np.stack(chan, axis=2) / np.maximum(weight, 1e-5)[..., None], weight

    coarse, _ = fill(45)
    fine, weight = fill(10)
    k = np.clip(weight / 0.35, 0, 1)[..., None]
    result = np.where(known[..., None], small, fine * k + coarse * (1 - k))
    result = gaussian_filter(result, (6, 6, 0))
    img_out = Image.fromarray(np.clip(result, 0, 255).astype(np.uint8)).resize((W * 3, H * 3), Image.BICUBIC)
    save_webp(img_out, dest, 90)


def build_system() -> None:
    """Статус-бар iOS – только для десктопного превью в рамке телефона, в разработку не идёт."""
    s = OUT / "system"
    for name, box in {"status-time": (100, 52, 224, 104), "status-icons": (850, 50, 1099, 103)}.items():
        g = unblend(SCREEN_FRIENDS, box, bg=(0, 0, 0), fg=(255, 255, 255))
        save_png(trim(g, 1), s / f"{name}.png")
    island = rgba(SCREEN_FRIENDS)[33:111, 462:708].copy()
    island[:, :, 3] *= rounded_mask(island.shape[0], island.shape[1], island.shape[0] / 2)
    save_png(island, s / "live-activity.png")
    # иконка приложения для пушей (blink-icon.png, квадрат во весь кадр – скругление iOS даёт вёрстка):
    # 38 pt @3x
    resize_to("blink-icon.png", s / "app-icon.png", 114, fmt="png")


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    icons = build_icons()
    write_icons_css(icons)
    build_stickers()
    build_people()
    build_pins()
    build_browser()
    build_share()
    build_overnights()
    build_market()
    build_screens_art()
    build_system()
    total = sum(p.stat().st_size for p in OUT.rglob("*") if p.is_file())
    print(f"assets: {sum(1 for p in OUT.rglob('*') if p.is_file())} files, {total / 1024:.0f} KB")
    print(f"icons.css: {ICONS_CSS.stat().st_size / 1024:.0f} KB, {len(icons)} icons")


if __name__ == "__main__":
    main()
