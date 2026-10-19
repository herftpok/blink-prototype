"""
Снимки всех состояний стилей карты для раскладки features/map-styles/states.html.

Открывает стенд в каждом состоянии из features/map-styles/states.js (index.html?state=<id>),
ждёт, пока доедут шторки и загрузятся картинки, и снимает телефон:
features/map-styles/states/<id>.webp, 780 px по ширине (390 pt @2x).

    python3 prototype/tools/shoot_map_styles.py              # все состояния
    python3 prototype/tools/shoot_map_styles.py style-dark   # только перечисленные
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from compare import serve  # noqa: E402  (тот же локальный сервер, что у сверки)

from PIL import Image  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

FEATURE = Path(__file__).resolve().parent.parent / "features" / "map-styles"
OUT = FEATURE / "states"
WIDTH = 780


def state_ids() -> list[str]:
    """id состояний по порядку – из states.js, без браузера."""
    text = (FEATURE / "states.js").read_text("utf-8")
    return re.findall(r'\{ id: "([a-z0-9-]+)", group:', text)


def main() -> int:
    only = set(sys.argv[1:])
    OUT.mkdir(parents=True, exist_ok=True)
    server, port = serve()
    errors: list[str] = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            # окно с запасом: стенд не уменьшается, телефон снимается в 390 × 844
            page = browser.new_page(viewport={"width": 760, "height": 1100}, device_scale_factor=2)
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            for sid in state_ids():
                if only and sid not in only:
                    continue
                page.goto(f"http://127.0.0.1:{port}/features/map-styles/index.html?state={sid}")
                page.wait_for_load_state("networkidle")
                page.evaluate("document.fonts.ready")
                # шторки и экран стиля доезжают 0.38 s; картинки превью – декодированы
                page.wait_for_timeout(900)
                page.evaluate("Promise.all([...document.querySelectorAll('#app img')].map((img) => img.decode().catch(() => {})))")
                page.wait_for_timeout(200)
                tmp = OUT / f".{sid}.png"
                page.locator("#app").screenshot(path=tmp)
                img = Image.open(tmp).convert("RGB")
                if img.width != WIDTH:
                    img = img.resize((WIDTH, round(img.height * WIDTH / img.width)), Image.LANCZOS)
                img.save(OUT / f"{sid}.webp", "WEBP", quality=84, method=6)
                tmp.unlink()
                print(f"  {sid}")
            browser.close()
    finally:
        server.shutdown()
    for error in errors:
        print(f"  ошибка: {error}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
