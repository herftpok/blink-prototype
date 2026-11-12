"""Собрать подложку и геозону из одной выгрузки OSM (bbox в README фичи)."""
import json
from pathlib import Path
from xml.etree import ElementTree as ET

from shapely.geometry import LineString, Point, box
from shapely.ops import polygonize, unary_union


def build(source):
    art = Path(__file__).resolve().parents[1] / 'features/gorky-park/art'
    root = ET.parse(source).getroot()
    # Локальная проекция в pt. В этом масштабе 1 pt соответствует примерно 1.4 м.
    def project(lon, lat):
        return (round((lon - 37.5855) * 45000, 1), round((55.7407 - lat) * 80000, 1))

    nodes = {e.get('id'): project(float(e.get('lon')), float(e.get('lat'))) for e in root.findall('node')}
    ways = {e.get('id'): e for e in root.findall('way')}
    def points(way):
        return [nodes[x.get('ref')] for x in way.findall('nd') if x.get('ref') in nodes]
    def tags(el):
        return {x.get('k'): x.get('v') for x in el.findall('tag')}

    width, height = 1330, 1650
    bounds = box(0, 0, width, height)
    layers = {name: [] for name in ['park', 'grass', 'trees', 'water', 'plaza', 'buildings', 'foot', 'street', 'avenue', 'bridge']}
    road = {'primary', 'secondary', 'tertiary', 'trunk', 'primary_link', 'secondary_link'}
    paths = {'footway', 'pedestrian', 'cycleway', 'steps', 'path', 'track', 'bridleway'}

    def shape(layer, coords, closed=False):
        if len(coords) < 2:
            return
        path = 'M' + ' '.join(f'{x:.1f},{y:.1f}' for x,y in coords) + ('Z' if closed else '')
        layers[layer].append(path)

    for e in root.findall('relation'):
        if e.get('id') not in ('222973', '2791365'):
            continue
        is_park = e.get('id') == '2791365'
        lines = [LineString(points(ways[m.get('ref')])) for m in e.findall('member')
                 if m.get('role') == 'outer' and m.get('ref') in ways]
        if is_park:
            polys = list(polygonize(lines))
            park = max(polys, key=lambda p: p.area).simplify(0.7)
            (art / 'boundary.js').write_text('window.parkBoundary = ' + json.dumps(list(park.exterior.coords),separators=(',', ':')) + ';\n')
            shape('park', list(park.exterior.coords), True)
        else:
            # Линия реки открыта на краях выгрузки. Замкнуть берега по рамке и выбрать русло.
            sections = [line.intersection(bounds) for line in lines]
            polygons = polygonize(unary_union([bounds.boundary, *sections]))
            river_point = Point(project(37.5958, 55.7320))
            river = next(p for p in polygons if p.covers(river_point))
            shape('water', list(river.exterior.coords), True)

    for way in ways.values():
        t = tags(way)
        pts = points(way)
        if len(pts) < 2 or t.get('tunnel') in ('yes', 'building_passage') or t.get('indoor') == 'yes':
            continue
        hw = t.get('highway')
        layer = None
        closed = pts[0] == pts[-1]
        if closed and t.get('natural') == 'water':
            layer = 'water'
        elif closed and 'building' in t and t['building'] != 'no':
            layer = 'buildings'
        elif closed and (t.get('natural') in ('wood', 'scrub') or t.get('landuse') == 'forest'):
            layer = 'trees'
        elif closed and (t.get('landuse') in ('grass', 'meadow', 'flowerbed') or t.get('leisure') in ('garden', 'park', 'pitch')):
            layer = 'grass'
        elif closed and (t.get('area:highway') or (hw and t.get('area') == 'yes')):
            layer = 'plaza'
        elif hw in road or hw in paths or hw in ('service', 'residential', 'unclassified', 'living_street'):
            layer = 'bridge' if hw in road and 'bridge' in t else 'avenue' if hw in road else 'foot' if hw in paths else 'street'
        if layer:
            shape(layer, pts, closed)
    # Цвета карты по Map/map_background.png. Группа пути одной заливки сокращает размер SVG.
    styles = {'park': ('#c7dfa5',None,0),'grass':('#c2dda1',None,0),'trees':('#b1d496',None,0),
              'water':('#80d1e8',None,0),'plaza':('#ebeadf',None,0),'buildings':('#dedbd6','#d2cfc9',0.8),
              'foot':('none','#f8f6ee',2.4),'street':('none','#fff',5),'avenue':('none','#fff',11),'bridge':('none','#fff',11)}
    svg=ET.Element('svg',xmlns='http://www.w3.org/2000/svg',viewBox=f'0 0 {width} {height}')
    ET.SubElement(svg,'rect',width=str(width),height=str(height),fill='#f1eee7')
    for key, (fill,stroke,weight) in styles.items():
        if not layers[key]: continue
        group=ET.SubElement(svg,'g',fill=fill)
        if stroke: group.attrib.update({'stroke':stroke,'stroke-width':str(weight),'stroke-linejoin':'round','stroke-linecap':'round'})
        for path in layers[key]:
            ET.SubElement(group,'path',d=path)
    labels = [
        (37.5971,55.7332,'Москва-река',-41,'#47899e'),
        (37.5981,55.7317,'Пушкинская набережная',-43,'#779561'),
        (37.6055,55.7305,'Пионерский пруд',-14,'#47899e'),
        (37.6028,55.7342,'Крымский Вал',32,'#98968f'),
        (37.6004,55.7285,'Фонтанная площадь',0,'#7e976a'),
        (37.5992,55.7269,'Гараж',0,'#88867e'),
        (37.5957,55.7283,'Голицынский пруд',-21,'#47899e'),
        (37.5927,55.7341,'Фрунзенская набережная',-42,'#88867e'),
        (37.6061,55.7320,'Крымский Вал',35,'#98968f')]
    for lon,lat,label,angle,color in labels:
        x,y=project(lon,lat)
        attrs={'transform':f'translate({x} {y}) rotate({angle})','text-anchor':'middle','font-family':'Arial, sans-serif',
               'font-size':'10','font-weight':'600','fill':color,'stroke':'#ffffff','stroke-width':'2','paint-order':'stroke','stroke-linejoin':'round'}
        ET.SubElement(svg,'text',attrs).text=label
    ET.ElementTree(svg).write(art / 'park-map.svg', encoding='utf-8')
