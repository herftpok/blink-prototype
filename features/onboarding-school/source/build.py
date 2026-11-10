"""Собрать только QuestionsApp из локального blink-schools с адаптером онбординга."""
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from PIL import Image

HERE = Path(__file__).resolve().parent
schools = Path(sys.argv[1]).expanduser().resolve() if len(sys.argv) > 1 else Path.home() / 'Downloads/schools'
output = HERE.parent / 'webview'
with tempfile.TemporaryDirectory() as directory:
    stage = Path(directory)
    shutil.copytree(schools / 'src', stage / 'src')
    (stage / 'node_modules').symlink_to(schools / 'node_modules', target_is_directory=True)
    shutil.copy(HERE / 'entry.jsx', stage)
    # В ячейке портрет до 48 pt. Ограничиваем разрешение именно копий для стенда.
    for file in (stage / 'src/assets/faces').glob('*.jpg'):
        with Image.open(file) as source:
            face = source.convert('RGB')
        face.thumbnail((144, 144))
        face.save(file, quality=82)
    subprocess.run(['patch', '-p1', '-i', str(HERE / 'onboarding.patch')], cwd=stage, check=True)
    shutil.copy(HERE / 'bundle.mjs', stage)
    subprocess.run(['node', 'bundle.mjs', str(output)], cwd=stage, check=True)
    shutil.copytree(schools / 'public/reactions', output / 'reactions', dirs_exist_ok=True)
