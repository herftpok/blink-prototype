#!/usr/bin/env python3
"""
Проверяет, что каждый файл-ассет проекта описан в ASSETS.md.

Новый экран или иконка появились в папках, а в каталоге их нет – нейросеть
их не найдёт. Скрипт перечисляет такие файлы; добавь их в ASSETS.md
(что это, размер в pt, где использовано, веб-копия).

Запуск: python3 prototype/tools/check_assets.py
"""
from __future__ import annotations

import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "ASSETS.md"
SKIP_DIRS = {"prototype", ".git", ".claude", "humanizer", "node_modules"}
SKIP_FILES = {".DS_Store", "ASSETS.md", "CLAUDE.md", "blink-design.md"}
EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif", ".md", ".fig", ".pdf", ".mp4", ".mov"}


def main() -> int:
    nfc = lambda value: unicodedata.normalize("NFC", value)   # macOS хранит „й“ в именах файлов разложенным
    text = nfc(CATALOG.read_text("utf-8"))
    missing = []
    for path in sorted(ROOT.rglob("*")):
        rel = path.relative_to(ROOT)
        if path.is_dir() or rel.parts[0] in SKIP_DIRS or path.name in SKIP_FILES:
            continue
        if path.suffix.lower() not in EXTENSIONS:
            continue
        if nfc(path.name) not in text and nfc(str(rel)) not in text:
            missing.append(rel)
    if missing:
        print("Нет в ASSETS.md:")
        for rel in missing:
            print(f"  {rel}")
        return 1
    print("ASSETS.md описывает все файлы проекта")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
