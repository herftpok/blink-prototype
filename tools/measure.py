#!/usr/bin/env python3
"""
Замеры по референсным скриншотам – чтобы не подбирать размеры на глаз.
Скриншоты в проекте сняты в @3x (1170×2532), всё выводится в pt холста 390×844.

  rows      вертикальные полосы контента: где начинается и кончается каждый блок
            python3 prototype/tools/measure.py rows "Friends/Друзья.png" --box 40,50,377,700
            python3 prototype/tools/measure.py rows "Friends/Друзья.png" --render prototype/tools/.compare/friends-render.png

  color     цвета в точках (pt)
            python3 prototype/tools/measure.py color "profile/profile.png" 195,45 386,110

  find      где на скриншоте лежит ассет (сопоставление по альфе, можно с масштабом)
            python3 prototype/tools/measure.py find "profile/profile.png" "profile/avatar.png" --region 60,90,330,290

  fit-text  какой кегль даёт нужную ширину надписи (рендер в Chromium тем же шрифтом)
            python3 prototype/tools/measure.py fit-text "друзья" --font ui --weight 600 --tracking -0.02 --target 125.3

  fit-font  начертание, кегль и трекинг по форме букв: рендерит варианты и сравнивает
            попиксельно с надписью на скриншоте. Ширина одна не отличает жирный шрифт
            поменьше от обычного побольше – поэтому вес подбираем только так.
            python3 prototype/tools/measure.py fit-font "Friends/Друзья.png" "друзья" --box 12,74,150,112 --sizes 32-40

Ширину надписи на референсе даёт rows с --axis x по рамке вокруг текста.
Нужно: Pillow, numpy, scipy (find), playwright (fit-text).
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SCALE = 3


def load(path: str) -> np.ndarray:
    p = Path(path)
    if not p.is_absolute():
        p = ROOT / p
    return np.asarray(Image.open(p).convert("RGB")).astype(np.int16)


def box_px(box: str | None, shape) -> tuple[int, int, int, int]:
    if not box:
        return 0, 0, shape[1], shape[0]
    x0, y0, x1, y1 = (float(v) for v in box.split(","))
    return int(x0 * SCALE), int(y0 * SCALE), int(x1 * SCALE), int(y1 * SCALE)


def bands(a: np.ndarray, box, axis: str, tol: int) -> list[tuple[float, float]]:
    x0, y0, x1, y1 = box
    sub = a[y0:y1, x0:x1]
    bg = np.median(np.concatenate([sub[:, :2].reshape(-1, 3), sub[:, -2:].reshape(-1, 3)]), axis=0)
    mask = np.abs(sub - bg).max(axis=2) > tol
    line = mask.any(axis=1 if axis == "y" else 0)
    offset = y0 if axis == "y" else x0
    out, start = [], None
    for i, v in enumerate(line):
        if v and start is None:
            start = i
        if not v and start is not None:
            out.append(((offset + start) / SCALE, (offset + i) / SCALE))
            start = None
    if start is not None:
        out.append(((offset + start) / SCALE, (offset + len(line)) / SCALE))
    return out


def cmd_rows(args) -> None:
    ref = load(args.screenshot)
    box = box_px(args.box, ref.shape)
    a = bands(ref, box, args.axis, args.tol)
    if not args.render:
        for s, e in a:
            print(f"  {s:7.1f} – {e:7.1f}   {e - s:6.1f} pt")
        return
    got = load(args.render)
    if got.shape != ref.shape:
        got = np.asarray(Image.fromarray(got.astype(np.uint8)).resize((ref.shape[1], ref.shape[0]))).astype(np.int16)
    b = bands(got, box, args.axis, args.tol)
    for i in range(max(len(a), len(b))):
        ra = a[i] if i < len(a) else None
        rb = b[i] if i < len(b) else None
        delta = f"сдвиг {rb[0] - ra[0]:+5.1f}  размер {(rb[1] - rb[0]) - (ra[1] - ra[0]):+5.1f}" if ra and rb else ""
        fa = f"{ra[0]:7.1f}–{ra[1]:7.1f}" if ra else " " * 15
        fb = f"{rb[0]:7.1f}–{rb[1]:7.1f}" if rb else " " * 15
        print(f"  референс {fa}   прототип {fb}   {delta}")


def cmd_color(args) -> None:
    a = load(args.screenshot)
    for point in args.points:
        x, y = (float(v) for v in point.split(","))
        r, g, b = a[int(y * SCALE), min(int(x * SCALE), a.shape[1] - 1)]
        print(f"  ({x:g}, {y:g})  #{r:02X}{g:02X}{b:02X}")


def cmd_find(args) -> None:
    from scipy.signal import fftconvolve

    img = load(args.screenshot).astype(np.float32) / 255
    ox = oy = 0
    if args.region:
        x0, y0, x1, y1 = box_px(args.region, img.shape)
        img, ox, oy = img[y0:y1, x0:x1], x0, y0
    best = None
    for scale in (float(s) for s in args.scales.split(",")):
        asset = Image.open(ROOT / args.asset).convert("RGBA")
        if scale != 1:
            asset = asset.resize((max(1, int(asset.width * scale)), max(1, int(asset.height * scale))), Image.LANCZOS)
        t = np.asarray(asset).astype(np.float32) / 255
        tpl, mask = t[:, :, :3], (t[:, :, 3] > 0.6).astype(np.float32)
        if tpl.shape[0] > img.shape[0] or tpl.shape[1] > img.shape[1]:
            continue
        ssd = np.zeros((img.shape[0] - tpl.shape[0] + 1, img.shape[1] - tpl.shape[1] + 1), np.float32)
        flipped = mask[::-1, ::-1]
        for c in range(3):
            ic, tc = img[:, :, c], tpl[:, :, c]
            ssd += fftconvolve(ic * ic, flipped, "valid") - 2 * fftconvolve(ic, (mask * tc)[::-1, ::-1], "valid") + (mask * tc * tc).sum()
        ssd /= mask.sum() * 3
        y, x = np.unravel_index(np.argmin(ssd), ssd.shape)
        cand = (float(ssd[y, x]), scale, (ox + x) / SCALE, (oy + y) / SCALE, tpl.shape[1] / SCALE, tpl.shape[0] / SCALE)
        if best is None or cand[0] < best[0]:
            best = cand
    err, scale, x, y, w, h = best
    trust = "надёжно" if err < 0.02 else "проверь глазами" if err < 0.08 else "сомнительно"
    print(f"  x {x:.1f}  y {y:.1f}  размер {w:.1f}×{h:.1f} pt  масштаб {scale:g}  ошибка {err:.4f} ({trust})")


def cmd_fit_text(args) -> None:
    from playwright.sync_api import sync_playwright

    family = "Montserrat" if args.font == "ui" else "'SF Pro Text', -apple-system, Inter"
    sizes = [s / 2 for s in range(20, 121)]            # 10–60 px с шагом 0.5
    rows = "".join(
        f"<div style=\"position:absolute;left:10px;top:{10 + i * 70}px;white-space:nowrap;font-family:{family};"
        f"font-weight:{args.weight};font-style:{'italic' if args.italic else 'normal'};font-size:{s}px;"
        f"line-height:1;letter-spacing:{args.tracking}em\">{args.text}</div>"
        for i, s in enumerate(sizes)
    )
    html = ("<html><head><link rel='stylesheet' href='https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@"
            "0,500;0,600;0,700;0,800;0,900;1,700;1,800;1,900&family=Inter:wght@400;500;600;700&display=swap'></head>"
            f"<body style='margin:0;background:#000;color:#fff'>{rows}</body></html>")
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1400, "height": 10 + len(sizes) * 70}, device_scale_factor=SCALE)
        page.set_content(html)
        page.wait_for_load_state("networkidle")
        page.evaluate("document.fonts.ready")
        shot = np.asarray(Image.open(__import__("io").BytesIO(page.screenshot(full_page=True))).convert("L"))
        browser.close()
    results = []
    for i, s in enumerate(sizes):
        band = shot[(10 + i * 70) * SCALE:(10 + i * 70 + 65) * SCALE]
        xs = np.where((band > 60).any(axis=0))[0]
        results.append((s, (xs[-1] - xs[0] + 1) / SCALE if len(xs) else 0))
    best = min(results, key=lambda r: abs(r[1] - args.target))
    near = "  ".join(f"{s:g}px→{w:.1f}" for s, w in results if abs(w - args.target) <= args.target * 0.04)
    print(f"  лучший кегль {best[0]:g}px (ширина {best[1]:.1f} pt при цели {args.target})")
    print(f"  рядом: {near}")


def coverage(crop: np.ndarray, fg=None) -> np.ndarray:
    """Покрытие текстом 0…1: проекция пикселя на ось фон → цвет текста."""
    border = np.concatenate([crop[:2].reshape(-1, 3), crop[-2:].reshape(-1, 3),
                             crop[:, :2].reshape(-1, 3), crop[:, -2:].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    diff = crop.astype(np.float32) - bg
    if fg is None:
        dist = np.linalg.norm(diff, axis=2)
        fg = crop[np.unravel_index(np.argmax(dist), dist.shape)]
    axis = np.asarray(fg, np.float32) - bg
    alpha = np.clip((diff * axis).sum(axis=2) / max(float(axis @ axis), 1.0), 0, 1)
    alpha[alpha < 0.08] = 0
    return alpha


def tight(alpha: np.ndarray, thr: float = 0.35) -> np.ndarray:
    ys, xs = np.where(alpha > thr)
    return alpha[ys.min():ys.max() + 1, xs.min():xs.max() + 1] if len(ys) else alpha


def cmd_fit_font(args) -> None:
    """Подбирает начертание, кегль и трекинг надписи по форме букв на скриншоте."""
    from playwright.sync_api import sync_playwright

    ref_img = load(args.screenshot)
    x0, y0, x1, y1 = box_px(args.box, ref_img.shape)
    fg = tuple(int(args.fg[i:i + 2], 16) for i in (1, 3, 5)) if args.fg else None
    ref = tight(coverage(ref_img[y0:y1, x0:x1], fg))
    rh, rw = ref.shape

    family = "Montserrat" if args.font == "ui" else "'SF Pro Text', -apple-system, Inter"
    weights = [int(w) for w in args.weights.split(",")]
    lo, hi = (float(v) for v in args.sizes.split("-"))
    sizes = [lo + i * 0.5 for i in range(int((hi - lo) / 0.5) + 1)]
    trackings = [float(t) for t in args.trackings.split(",")]
    combos = [(w, s, t) for w in weights for s in sizes for t in trackings]
    cell_w = int(rw / SCALE * 1.4) + 40                     # колонка с запасом под самый широкий вариант
    cell_h = int(hi * 1.6) + 10
    cols = max(1, 1500 // cell_w)
    head = ("<html><head><link rel='stylesheet' href='https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@"
            "0,400;0,500;0,600;0,700;0,800;0,900;1,500;1,600;1,700;1,800;1,900&family=Inter:wght@400;500;600;700&display=swap'>"
            "</head><body style='margin:0;background:#000;color:#fff'>")
    scored = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": cols * cell_w + 20, "height": 800}, device_scale_factor=SCALE)
        for start in range(0, len(combos), cols * 12):
            chunk = combos[start:start + cols * 12]
            html = head
            for i, (w, s, t) in enumerate(chunk):
                html += (f"<div style=\"position:absolute;left:{10 + (i % cols) * cell_w}px;top:{10 + (i // cols) * cell_h}px;"
                         f"white-space:nowrap;font-family:{family};font-weight:{w};"
                         f"font-style:{'italic' if args.italic else 'normal'};font-size:{s}px;line-height:1.2;"
                         f"letter-spacing:{t}em;transform:rotate({args.rotate}deg);transform-origin:0 50%\">{args.text}</div>")
            page.set_content(html + "</body></html>")
            page.wait_for_load_state("networkidle")
            page.evaluate("document.fonts.ready")
            shot = np.asarray(Image.open(__import__("io").BytesIO(page.screenshot(full_page=True))).convert("L")).astype(np.float32) / 255
            for i, (w, s, t) in enumerate(chunk):
                cx, cy = 10 + (i % cols) * cell_w, 10 + (i // cols) * cell_h
                cell = shot[cy * SCALE:(cy + cell_h - 4) * SCALE, cx * SCALE:(cx + cell_w - 4) * SCALE]
                cand = tight(np.where(cell > 0.08, cell, 0))
                ch, cw = cand.shape
                if abs(cw - rw) > rw * 0.12 or abs(ch - rh) > rh * 0.2:
                    continue
                H, W = max(ch, rh), max(cw, rw)
                a = np.zeros((H, W), np.float32)
                b = np.zeros((H, W), np.float32)
                a[:rh, :rw] = ref
                b[:ch, :cw] = cand
                score = float(np.abs(a - b).mean()) + (abs(cw - rw) + abs(ch - rh)) / (rw + rh)
                scored.append((score, w, s, t, cw / SCALE, ch / SCALE))
        browser.close()

    scored.sort()
    print(f"  эталон: {rw / SCALE:.1f} × {rh / SCALE:.1f} pt")
    for score, w, s, t, cw, ch in scored[:args.top]:
        print(f"  {w} {s:g}px трекинг {t:+g}em → {cw:.1f} × {ch:.1f} pt   расхождение {score:.3f}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("rows")
    p.add_argument("screenshot")
    p.add_argument("--render", help="рендер прототипа того же размера – покажет сдвиги")
    p.add_argument("--box", help="x0,y0,x1,y1 в pt")
    p.add_argument("--axis", choices=["y", "x"], default="y")
    p.add_argument("--tol", type=int, default=18)
    p.set_defaults(func=cmd_rows)

    p = sub.add_parser("color")
    p.add_argument("screenshot")
    p.add_argument("points", nargs="+", help="x,y в pt")
    p.set_defaults(func=cmd_color)

    p = sub.add_parser("find")
    p.add_argument("screenshot")
    p.add_argument("asset")
    p.add_argument("--region", help="x0,y0,x1,y1 в pt – где искать")
    p.add_argument("--scales", default="1.0")
    p.set_defaults(func=cmd_find)

    p = sub.add_parser("fit-text")
    p.add_argument("text")
    p.add_argument("--font", choices=["ui", "text"], default="ui", help="ui – Montserrat, text – SF Pro")
    p.add_argument("--weight", type=int, default=700)
    p.add_argument("--italic", action="store_true")
    p.add_argument("--tracking", type=float, default=0.0, help="в em")
    p.add_argument("--target", type=float, required=True, help="ширина надписи на референсе, pt")
    p.set_defaults(func=cmd_fit_text)

    p = sub.add_parser("fit-font")
    p.add_argument("screenshot")
    p.add_argument("text")
    p.add_argument("--box", required=True, help="x0,y0,x1,y1 в pt – рамка вокруг одной строки текста")
    p.add_argument("--font", choices=["ui", "text"], default="ui")
    p.add_argument("--fg", help="цвет текста #RRGGBB, если фон неоднородный")
    p.add_argument("--weights", default="500,600,700,800,900")
    p.add_argument("--sizes", default="12-24", help="диапазон кеглей, шаг 0.5")
    p.add_argument("--trackings", default="-0.04,-0.02,0,0.02")
    p.add_argument("--italic", action="store_true")
    p.add_argument("--rotate", type=float, default=0.0, help="поворот надписи на эталоне, градусы")
    p.add_argument("--top", type=int, default=5)
    p.set_defaults(func=cmd_fit_font)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
