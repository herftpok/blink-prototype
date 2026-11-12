"""Снять кадр 3D-острова Парка Горького для шапки страницы места.

Открывает features/gorky-park/render.html?still и сохраняет холст в art/hero-master.png (@3x,
прозрачный фон). Веб-копию собирает build_assets.py --gorky-building.

    python3 prototype/tools/render_gorky.py
"""
import base64
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PORT = 8791


def main() -> None:
    server = subprocess.Popen([sys.executable, str(ROOT / "tools/serve.py"), str(PORT)],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(1.2)
        with sync_playwright() as p:
            browser = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
            page = browser.new_page(viewport={"width": 390, "height": 240}, device_scale_factor=3)
            page.goto(f"http://127.0.0.1:{PORT}/features/gorky-park/render.html?still")
            page.wait_for_selector("#shot[data-ready]", timeout=60000)
            page.wait_for_timeout(400)
            data = page.evaluate("document.getElementById('shot').toDataURL('image/png')")
            browser.close()
        out = ROOT / "features/gorky-park/art/hero-master.png"
        out.write_bytes(base64.b64decode(data.split(",", 1)[1]))
        print(f"hero-master.png: {out.stat().st_size // 1024} KB")
    finally:
        server.terminate()


if __name__ == "__main__":
    main()
