"""Собрать данные 3D-ансамбля Парка Горького из выгрузки OSM.

Те же единицы и проекция, что у подложки (build_gorky_map.py): 1 pt ≈ 1.4 м.
Деревья, ряды деревьев, клумбы партера, фонтан, причал и точечные объекты берутся
по реальным координатам – сцена ничего не выдумывает.

    python3 prototype/tools/build_assets.py --gorky-scene /путь/к/map.osm
"""
import json
from pathlib import Path
from xml.etree import ElementTree as ET

# Окно вокруг главной оси: вход – партер – фонтан – Пионерский пруд.
WINDOW = (585, 610, 965, 985)


def build(source):
    art = Path(__file__).resolve().parents[1] / 'features/gorky-park/art'
    root = ET.parse(source).getroot()

    def project(lon, lat):
        return (round((lon - 37.5855) * 45000, 1), round((55.7407 - lat) * 80000, 1))

    def inside(point, pad=0):
        x0, y0, x1, y1 = WINDOW
        return x0 - pad <= point[0] <= x1 + pad and y0 - pad <= point[1] <= y1 + pad

    def tags(el):
        return {x.get('k'): x.get('v') for x in el.findall('tag')}

    nodes = {e.get('id'): project(float(e.get('lon')), float(e.get('lat'))) for e in root.findall('node')}
    node_tags = {e.get('id'): tags(e) for e in root.findall('node') if e.find('tag') is not None}

    def points(way):
        return [nodes[x.get('ref')] for x in way.findall('nd') if x.get('ref') in nodes]

    def centre(pts):
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        return [round((min(xs) + max(xs)) / 2, 1), round((min(ys) + max(ys)) / 2, 1)]

    trees, lamps, benches, named = [], [], [], {}
    for ident, t in node_tags.items():
        point = nodes[ident]
        if not inside(point):
            continue
        if t.get('natural') == 'tree':
            trees.append(list(point))
        elif t.get('highway') == 'street_lamp':
            lamps.append(list(point))
        elif t.get('amenity') == 'bench':
            benches.append(list(point))
        elif t.get('historic') == 'memorial' and 'Горьк' in t.get('name', ''):
            named['memorial'] = list(point)

    rows, beds, fountain, pier, pond = [], [], None, None, None
    for way in root.findall('way'):
        t, pts = tags(way), points(way)
        if len(pts) < 2 or not inside(centre(pts)):
            continue
        if t.get('natural') == 'tree_row':
            # Дерево каждые ~9 pt (12 м) вдоль ряда.
            for (ax, ay), (bx, by) in zip(pts, pts[1:]):
                length = ((bx - ax) ** 2 + (by - ay) ** 2) ** .5
                steps = max(1, round(length / 9))
                for i in range(steps):
                    f = (i + .5) / steps
                    rows.append([round(ax + (bx - ax) * f, 1), round(ay + (by - ay) * f, 1)])
        elif t.get('landuse') == 'flowerbed' and len(pts) >= 4:
            beds.append([list(p) for p in pts[:-1]])
        elif t.get('natural') == 'water' and way.get('id') == '96487814':
            xs = [p[0] for p in pts]
            fountain = {'at': centre(pts), 'radius': round((max(xs) - min(xs)) / 2, 1)}
        elif t.get('natural') == 'water' and t.get('name') == 'Пионерский пруд':
            pond = [list(p) for p in pts[:-1]]
        elif t.get('man_made') == 'pier':
            pier = [list(p) for p in pts]
        elif t.get('man_made') == 'telescope':
            named['observatory'] = centre(pts)
        elif t.get('building') == 'gazebo':
            named['gazebo'] = centre(pts)

    scene = {
        'trees': trees, 'rows': rows, 'beds': beds, 'lamps': lamps, 'benches': benches,
        'fountain': fountain, 'pier': pier, 'pond': pond, **named,
    }
    body = json.dumps(scene, ensure_ascii=False, separators=(',', ':'))
    (art / 'scene-data.js').write_text(
        '// Собрано build_gorky_scene.py из OpenStreetMap (ODbL). Руками не править.\n'
        'export const parkSceneData = ' + body + ';\n', encoding='utf-8')
    print('scene-data.js:', ', '.join(f'{k} {len(v) if isinstance(v, list) else 1}' for k, v in scene.items() if v))
