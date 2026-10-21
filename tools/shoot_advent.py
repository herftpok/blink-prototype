"""
Снимки всех экранов адвента для раскладки features/advent/states.html.

Открывает стенд, по очереди включает каждое состояние из states.js (AV.showState) и снимает
телефон: features/advent/states/<id>.webp («:» в id → «-»), 585 px по ширине (390 pt @1.5x).

    python3 prototype/tools/shoot_advent.py                 # все состояния
    python3 prototype/tools/shoot_advent.py home tree       # только перечисленные
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from compare import serve  # noqa: E402  (тот же локальный сервер, что у сверки)

from PIL import Image  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

FEATURE = Path(__file__).resolve().parent.parent / "features" / "advent"
OUT = FEATURE / "states"
WIDTH = 585
WAIT_MS = 900                       # картинки догрузились, шторка доехала


def main() -> int:
    only = set(sys.argv[1:])
    OUT.mkdir(parents=True, exist_ok=True)
    server, port = serve()
    errors: list[str] = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": 1100, "height": 1000}, device_scale_factor=1.5)
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.goto(f"http://127.0.0.1:{port}/features/advent/index.html")
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(800)
            # на снимке – конечное состояние, а не середина анимации; стенд без zoom
            page.add_style_tag(content=".app *,.app *::before,.app *::after{transition:none!important;animation-duration:0s!important;animation-delay:0s!important}")
            page.evaluate("document.documentElement.style.setProperty('--stage-zoom','1')")
            states = page.evaluate("import('./states.js').then((m) => m.STATES.map((s) => s.id))")
            for sid in states:
                if only and sid not in only and sid.split(":")[0] not in only:
                    continue
                if not page.evaluate(f"AV.showState({sid!r})"):
                    errors.append(f"нет состояния {sid}")
                    continue
                page.wait_for_timeout(WAIT_MS)
                name = sid.replace(":", "-")
                tmp = OUT / f".{name}.png"
                page.locator("#app").screenshot(path=tmp)
                img = Image.open(tmp).convert("RGB")
                img = img.resize((WIDTH, round(img.height * WIDTH / img.width)), Image.LANCZOS)
                img.save(OUT / f"{name}.webp", "WEBP", quality=82, method=6)
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
