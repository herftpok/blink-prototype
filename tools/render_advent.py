"""
3D-предметы адвента в картинки: features/advent/render.html рендерит модели из av-models.js
(three.js, тот же свет, что у новогодних подарков), скрипт сохраняет их в
features/advent/renders/<имя>.webp с прозрачным фоном, 512 px.

    python3 prototype/tools/render_advent.py                 # все
    python3 prototype/tools/render_advent.py snowflake ice   # только перечисленные
    python3 prototype/tools/render_advent.py --sheet out.png # плюс сводный лист на тёмном фоне

WebGL в безголовом Chromium – через SwiftShader, как в smoke.py.
"""
from __future__ import annotations

import base64
import io
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from compare import serve  # noqa: E402

from PIL import Image  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

OUT = Path(__file__).resolve().parent.parent / "features" / "advent" / "renders"
SIZE = 512


def main() -> int:
    args = sys.argv[1:]
    sheet = None
    if "--sheet" in args:
        i = args.index("--sheet")
        sheet = Path(args[i + 1])
        del args[i:i + 2]
    only = ",".join(args)
    OUT.mkdir(parents=True, exist_ok=True)
    server, port = serve()
    errors: list[str] = []
    images: dict[str, Image.Image] = {}
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
            page = browser.new_page(viewport={"width": 1200, "height": 900})
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            query = f"?only={only}" if only else ""
            page.goto(f"http://127.0.0.1:{port}/features/advent/render.html{query}")
            page.wait_for_function("window.AV_READY === true", timeout=240000)
            renders = page.evaluate("window.AV_RENDERS")
            for name, url in renders.items():
                img = Image.open(io.BytesIO(base64.b64decode(url.split(",", 1)[1]))).convert("RGBA")
                img.save(OUT / f"{name}.webp", "WEBP", quality=88, method=6)
                images[name] = img
                print(f"  {name}")
            browser.close()
    finally:
        server.shutdown()
    if sheet and images:
        cell = 220
        cols = 6
        rows = (len(images) + cols - 1) // cols
        board = Image.new("RGBA", (cols * cell, rows * cell), (14, 14, 16, 255))
        for i, img in enumerate(images.values()):
            thumb = img.resize((cell - 10, cell - 10), Image.LANCZOS)
            board.alpha_composite(thumb, ((i % cols) * cell + 5, (i // cols) * cell + 5))
        board.convert("RGB").save(sheet)
    for error in errors:
        print(f"  ошибка: {error}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
