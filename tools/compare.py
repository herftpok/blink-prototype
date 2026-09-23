#!/usr/bin/env python3
"""
Сверка прототипа с референсными скриншотами.

Рендерит экраны прототипа в Chromium на 390×844 @3x (как у скриншотов в
папках проекта) и собирает для каждого:
  • <name>-side.png   – референс | прототип рядом (50 %)
  • <name>-blend.png  – наложение 50/50: съехавшие элементы видны „двоением“
  • <name>-render.png – чистый рендер прототипа 1170×2532
и печатает долю пикселей, заметно отличающихся от референса.

Запуск:  python3 prototype/tools/compare.py [map friends chats chat profile]
         python3 prototype/tools/compare.py --route "#/chat/natashka" --name natashka
Нужно:   pip install playwright pillow numpy && python3 -m playwright install chromium
Результат по умолчанию – в prototype/tools/.compare/ (папка в .gitignore).
"""
from __future__ import annotations

import argparse
import functools
import http.server
import socketserver
import threading
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PROTOTYPE = ROOT / "prototype"

SCREENS = {
    "map": ("#/map", "Map/map_with_ui.png"),
    "friends": ("#/friends", "Friends/Друзья.png"),
    "chats": ("#/chats", "messanger/chat list/Список чатов.png"),
    "chat": ("#/chat/masha", "messanger/chat inside/основной.png"),
    "profile": ("#/profile", "profile/profile.png"),
    "profile-full": ("#/profile", "profile/profile_without_nav.png"),   # низ профиля без таб-бара
}

# экранам, у которых референс снят без части интерфейса, эту часть прячем
EXTRA_CSS = {
    "profile-full": ".tabbar{visibility:hidden}",
}

# Состояния пина: эталон pin/*.png (снят @3x, если не сказано иначе), где в нём кадр 52 (x, y в pt),
# параметры пина и, четвёртым полем, масштаб эталона.
# Человек на эталонах не из пака, поэтому аватарку не сравниваем – только всё вокруг неё.
PIN_STATES = {
    "staying_offline": ("pin/staying_offline.png", (5, 11.33), {"state": "staying", "minutes": 22}),
    "staying_online": ("pin/staying_online.png", (24, 24), {"state": "staying", "online": True, "minutes": 22}),
    "home_offline": ("pin/home_offline.png", (6, 11.33), {"state": "home", "minutes": 22}),
    "home_online": ("pin/home_online.png", (24, 24), {"state": "home", "online": True, "minutes": 22}),
    "moving_offline": ("pin/moving_offline.png", (70, 9.67), {"state": "moving", "speed": 120}),
    "moving_online": ("pin/moving_onine.png", (70, 24), {"state": "moving", "online": True, "speed": 120}),
    # делится геопозицией: имя с обводкой над пином, плашка заряда под ним. Эталон снят @4x
    "sharing": ("pin/other_pin_sharing.png", (21.125, 38.5), {"state": "staying", "title": "наташа", "battery": 12}, 4),
}


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args) -> None:
        pass


def serve() -> tuple[socketserver.TCPServer, int]:
    handler = functools.partial(QuietHandler, directory=str(PROTOTYPE))
    server = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, server.server_address[1]


def render(routes: dict[str, str], out: Path) -> dict[str, Path]:
    from playwright.sync_api import sync_playwright

    server, port = serve()
    shots: dict[str, Path] = {}
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": 520, "height": 960}, device_scale_factor=3)
            for name, route in routes.items():
                page.goto(f"http://127.0.0.1:{port}/index.html{route}")
                page.wait_for_load_state("networkidle")
                page.evaluate("document.fonts.ready")
                page.add_style_tag(content="*,*::before,*::after{transition:none!important;animation:none!important}"
                                   + EXTRA_CSS.get(name, ""))
                page.wait_for_timeout(400)
                path = out / f"{name}-render.png"
                page.locator("#app").screenshot(path=str(path))
                shots[name] = path
            browser.close()
    finally:
        server.shutdown()
    return shots


def compare(name: str, render_path: Path, reference: str, out: Path) -> float:
    ref = Image.open(ROOT / reference).convert("RGB")
    got = Image.open(render_path).convert("RGB").resize(ref.size)
    side = Image.new("RGB", (ref.width * 2 + 30, ref.height), (255, 0, 160))
    side.paste(ref, (0, 0))
    side.paste(got, (ref.width + 30, 0))
    side.resize((side.width // 2, side.height // 2), Image.LANCZOS).save(out / f"{name}-side.png")
    Image.blend(ref, got, 0.5).resize((ref.width // 2, ref.height // 2), Image.LANCZOS).save(out / f"{name}-blend.png")
    diff = np.abs(np.asarray(ref, np.int16) - np.asarray(got, np.int16)).max(axis=2)
    return float((diff > 48).mean())


def compare_pins(out: Path) -> None:
    """Пин во всех состояниях против pin/*.png: лист „эталон | прототип | наложение“ – pins-side.png."""
    import json
    import urllib.parse

    from playwright.sync_api import sync_playwright

    server, port = serve()
    rows = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": 400, "height": 300}, device_scale_factor=3)
            for name, (ref_path, (fx, fy), pin, *rest) in PIN_STATES.items():
                scale = rest[0] if rest else 3
                ref = Image.open(ROOT / ref_path).convert("RGBA")
                cfg = {"w": ref.width / scale, "h": ref.height / scale, "fx": fx, "fy": fy, "pin": pin}
                # своя строка запроса на каждое состояние: смена одного # страницу не перезагружает
                page.goto(f"http://127.0.0.1:{port}/tools/pin-states.html?state={name}#" + urllib.parse.quote(json.dumps(cfg)))
                page.wait_for_load_state("networkidle")
                page.evaluate("document.fonts.ready")
                page.add_style_tag(content="*,*::before,*::after{transition:none!important;animation:none!important}")
                page.wait_for_timeout(200)
                shot = out / f"pin-{name}-render.png"
                page.locator("#cell").screenshot(path=str(shot))
                land = Image.new("RGBA", ref.size, (0xEC, 0xEB, 0xE3, 255))      # эталон – на цвете суши карты
                land.alpha_composite(ref)
                a = land.convert("RGB")
                b = Image.open(shot).convert("RGB").resize(ref.size)
                diff = np.abs(np.asarray(a, np.int16) - np.asarray(b, np.int16)).max(axis=2) > 48
                yy, xx = np.mgrid[0:ref.height, 0:ref.width] / scale
                avatar = (xx > fx - 5) & (xx < fx + 57) & (yy > fy - 31.5) & (yy < fy + 48.5)
                rows.append((name, a, b, float(diff[~avatar].mean())))
            browser.close()
    finally:
        server.shutdown()

    k, gap = 2, 16
    cell_w = max(r[1].width for r in rows) * k
    sheet = Image.new("RGB", (cell_w * 3 + gap * 4, sum(r[1].height * k + gap for r in rows) + gap), (40, 40, 44))
    y = gap
    for name, a, b, share in rows:
        size = (a.width * k, a.height * k)
        for i, im in enumerate([a, b, Image.blend(a, b, 0.5)]):
            sheet.paste(im.resize(size, Image.LANCZOS), (gap + i * (cell_w + gap), y))
        y += size[1] + gap
        print(f"pin {name:16s} вне аватарки отличается {share:6.1%}")
    sheet.save(out / "pins-side.png")
    print(f"лист: {out / 'pins-side.png'} (эталон | прототип | наложение)")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("screens", nargs="*", default=list(SCREENS))
    parser.add_argument("--route", help="свой маршрут, например '#/chat/natashka'")
    parser.add_argument("--name", default="custom")
    parser.add_argument("--out", default=str(PROTOTYPE / "tools" / ".compare"))
    args = parser.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    if args.screens == ["pins"]:
        compare_pins(out)
        return
    if args.route:
        shots = render({args.name: args.route}, out)
        print(f"{args.name}: {shots[args.name]}")
        return

    shots = render({s: SCREENS[s][0] for s in args.screens}, out)
    for name in args.screens:
        share = compare(name, shots[name], SCREENS[name][1], out)
        print(f"{name:8s} отличается {share:6.1%} пикселей → {out / (name + '-side.png')}")


if __name__ == "__main__":
    main()
