"""
Снимки всех состояний новогодней фичи для раскладки features/new-year/states.html.

Открывает стенд, по очереди включает каждое состояние из states.js (NY.showState) и снимает
нужный телефон: features/new-year/states/<id>.webp, 585 px по ширине (390 pt @1.5x).
WebGL в безголовом Chromium – через SwiftShader, как в smoke.py.

    python3 prototype/tools/shoot_states.py            # все состояния
    python3 prototype/tools/shoot_states.py arrival    # только перечисленные
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from compare import serve  # noqa: E402  (тот же локальный сервер, что у сверки)

from PIL import Image  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

OUT = Path(__file__).resolve().parent.parent / "features" / "new-year" / "states"
WIDTH = 585
# сколько ждать после включения: камере – доехать до места
WAIT_MS = 1300
# Программный WebGL медленный: пока стенд пересобирается и снимается, снег после тряски успевает
# осесть, а конфетти – ещё не долететь до экрана. Перед снимком запускаем их заново: вихрь
# подольше, конфетти сразу в кадре
REPLAY = {
    "running": "NY.phones.right.globe.globe(60000)",
    "sent": "NY.phones.left.globe.confetti(colors(NY.phones.left.root), 44, true)",
    "sent-anon": "NY.phones.left.globe.confetti(colors(NY.phones.left.root), 44, true)",
    "arrival": "NY.phones.right.globe.confetti(colors(NY.phones.right.root), 44, true)",
    "arrival-sack": "NY.phones.right.globe.confetti(colors(NY.phones.right.root), 44, true)",
}
COLORS_JS = "const colors = (root) => getComputedStyle(root).getPropertyValue('--confetti-colors').split(',').map((c) => c.trim());"


def main() -> int:
    only = set(sys.argv[1:])
    OUT.mkdir(parents=True, exist_ok=True)
    server, port = serve()
    errors: list[str] = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
            page = browser.new_page(viewport={"width": 1500, "height": 1000}, device_scale_factor=2)
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(f"http://127.0.0.1:{port}/features/new-year/index.html")
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(1500)
            # переходы шторок выключены: на снимке – конечное состояние, а не середина анимации
            page.add_style_tag(content=".ny-phone *,.ny-phone *::before,.ny-phone *::after{transition:none!important}")
            page.evaluate("NY.sim.pushMs = 3600000")          # пуш не уходит, пока снимаем
            states = page.evaluate("NY.states")
            for state in states:
                if only and state["id"] not in only:
                    continue
                if not page.evaluate(f"NY.showState({state['id']!r})"):
                    errors.append(f"нет состояния {state['id']}")
                    continue
                page.wait_for_timeout(WAIT_MS)
                if state["id"] in REPLAY:
                    page.evaluate(f"(() => {{ {COLORS_JS} {REPLAY[state['id']]}; }})()")
                    page.wait_for_timeout(500)
                tmp = OUT / f".{state['id']}.png"
                page.locator(f"#phone-{state['phone']} .ny-phone").screenshot(path=tmp)
                img = Image.open(tmp).convert("RGB")
                img = img.resize((WIDTH, round(img.height * WIDTH / img.width)), Image.LANCZOS)
                img.save(OUT / f"{state['id']}.webp", "WEBP", quality=82, method=6)
                tmp.unlink()
                print(f"  {state['id']}")
            browser.close()
    finally:
        server.shutdown()
    for error in errors:
        print(f"  ошибка: {error}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
