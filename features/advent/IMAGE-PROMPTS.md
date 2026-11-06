# Печенье с предсказанием

## Закрытые карточки итогов года

Встроенный image_gen, новая генерация на прозрачном фоне. Мастер: `renders/recap-cards.png`, рабочий ассет: `renders/recap-cards.webp`. Экспорт с сохранением альфы — `tools/build_assets.py → build_advent_recap()`. Это превью формата личных итогов, без раскрытия темы дня. Исходная звезда остаётся в календаре.

Финальный промпт:

```text
Use case: stylized-concept.
Asset type: transparent 3D illustration for the personal annual recap hero in Blink's black New Year mobile UI, displayed at 140pt.
Primary request: a compact fan of THREE premium thick annual recap cards, suggesting a personal story waiting to be opened, no statistics revealed.
Composition: one coherent object, three cards in a close overlapping fan, front card mostly upright tilted about -8 degrees, rear cards gently offset to the right, front-facing with subtle perspective and visible thickness. Cards portrait proportion about 4:5. Silhouette compact, fully inside frame, transparent background. One main front card.
Materials and palette: glossy deep black face with softly rounded corners, pearlescent silver edge, subtle icy cyan and lavender rim reflections, bright soft studio highlights that read on pure black UI. Lightly frosted corners, very restrained New Year sparkle. No pink panels.
Exact text on front card: "2026" as large bold white geometric rounded sans serif, two rows "20" and "26" taking most of the face. A small subtle embossed abstract chart of three rounded bars beneath the year signifies a recap, no real values. Back cards blank reflective silver and icy cyan edges.
Lighting: tactile collectible sticker quality, polished 3D toy render, soft highlights, substantial rounded thickness, controlled contrast, crisp at small size.
Constraints: this is an illustration of physical recap cards, not a UI screenshot, not a playing card, not credit cards, not a calendar. No mascot, face, gifts, eyes, ribbon, snow globe, hands, other words, logo, watermark, background, ground or rectangular shadow backdrop. True alpha transparency.
```

Создано встроенным image_gen; прозрачность сохранена. Исходники старых three.js-моделей не удалены. Для интерфейса экспортированы `renders/fortune-cookie.webp` и `renders/fortune-cookie-broken.webp`; PNG сохранены как мастер-файлы.

- `renders/fortune-cookie.png`: compact classic fortune cookie, a thin folded circular wafer with a pinched saddle crease and two short rounded lobes; warm golden beige baked dough, toasted amber edges, fine pores, realistic thin crisp edge; tactile stylized 3D product render, elevated three-quarter front view, transparent background; no chocolate, no tubular or banana form, no text, paper or plate.
- `renders/fortune-cookie-broken.png`: edit the same cookie into two fractured halves, preserving camera, material, texture and lighting; visible pale jagged wafer edges, narrow vertical transparent center gap, halves close to original positions, no paper or text; transparent background. CSS clips each half from this matching asset for independent animation.

## Печенья с перевязью

Встроенный image_gen, правка исходного печенья. Мастер-файлы: `renders/fortune-cookie-cyan.png`, `fortune-cookie-violet.png`, `fortune-cookie-pink.png`. WebP с теми же именами собирает `tools/build_assets.py → build_advent_cookies()`. Первые варианты с приклеенным бантом не используются.

Промпт каждого варианта: preserve the exact original cookie, texture, camera and lighting; a continuous closed loop of cyan / lavender violet / pink satin ribbon spans the entire width across both lobes, follows the curved surface, reaches both silhouette edges and turns behind the cookie; a small bow is tied onto the band left of center; visible tension and contact shadows; no short strips stopping on the front, floating ends, text or background. Transparent PNG.


## 05.11.2026 — анимация предоставленного автомата

Основной стиль берётся из оригиналов `НГБЛИНК/`. Встроенный imagegen использован только для подготовки корпуса и подвижной клешни из `Синий аркадный автомат с захватом приза.png`; новые самостоятельные иллюстрации не генерировались. PNG сохранены неразрушающе в `art/`, WebP создаёт `build_advent_journey()`.

1. `art/machine-empty-master.png` — precise-object-edit. Remove only the entire claw assembly, motor and cable from the supplied blue arcade machine. Reconstruct the empty warm-lit rear chamber, preserving the exact 1024×1536 canvas, cabinet scale, front camera, blue/brass materials, controls, hatch, lighting and framing. No added objects or text.
2. `art/claw-hand-master.png` — background-extraction, transparent. Extract only the complete original claw, motor cap, spring and three fingers. Remove the cabinet and blue glass, preserve the front view, brass/silver material and supplied 3D style. Center a fully visible clean cutout with transparent margins.
3. `art/machine-cutout-master.png` — background-extraction, transparent. From the empty machine master remove only the outer studio background and floor; preserve the opaque cabinet and inside chamber, exact canvas, scale, location, controls and feet. Do not crop or reframe. This is the final animated cabinet source.

The full original prompts were passed to the built-in image generation tool with those constraints; no CLI/API fallback was used. Hand transparency and the aligned cabinet were visually inspected at @2x. The provided source images remain intact.


## 05.11.2026 — композиция изнутри, вторая итерация

Встроенный imagegen, без CLI/API fallback. Два производных изображения из предоставленной графики; оригиналы не изменены. PNG-мастера сохранены в `art/`, рабочие WebP пересобирает `build_advent_journey()`.

- `art/winter-panorama-master.png` → `art/winter-panorama.webp`: пейзаж движется только за оконной рамой неподвижного купе
- `art/claw-window-master.png` → `art/claw-window.webp`: полноэкранная витрина, нижняя тумба отсутствует в кадре; клешня и призы отдельные

Финальные запросы:

```text
Use case: stylized-concept. Asset type: looping winter landscape seen through the window of a New Year train. Input image: style and color reference only, specifically the snowy forest OUTSIDE its window. Create a wide horizontal panorama, 3:1 aspect ratio, a blue violet winter night with snow covered pine forests, rolling distant hills and a pale dusky sky. Match exactly the supplied soft low-poly voxel-like painted 3D style, muted indigo atmosphere and snow texture. Horizon near the middle, a few large snow-laden pines in the foreground, smaller pines in the distance. Left and right ends should join seamlessly for a scrolling loop; similar lighting and horizon height at both edges. This is ONLY the exterior landscape, no train interior, no window frames, no glass, no furniture, no typography, no UI, no logos. Avoid yellow highlights or holiday ornaments. The landscape fills the entire image.
```

Reference: `art/train-window.webp`, generated source `exec-87aeb000-7b28-4424-a78c-329382bda4a0.png`.

```text
Use case: precise-object-edit. Asset type: full-screen portrait background for the glass window of this exact blue claw arcade machine. Input image is the edit target and material/style reference. Move the camera very close to the upper glass chamber, frontal and centered. The glass chamber takes almost the entire tall image: roughly 85 percent width and 78 percent height, with narrow blue painted metal side pillars and warm brass inner frame at the edges. Keep the distinctive blue enamel, bronze trim, angular soft 3D render, warm ceiling lighting and blue back panels from the supplied cabinet. Top 10 percent is a simple blue metal fascia, bottom 12 percent a plain blue thin lip for app controls. The floor of the glass chamber is around 82 percent image height, the inner ceiling around 15 percent. The bottom cabinet, legs, delivery slot, joystick, red button and coin slot must all be OUTSIDE the crop, completely invisible. Empty chamber, no claw, no prizes; these will be animated separately in the app. No words, no logos, no UI, no transparency, no external scene, no outer margin. Tall portrait 2:3 framing. The image must fill the whole canvas edge to edge with the machine window.
```

Edit target: `art/machine-empty.webp`, generated source `exec-7842cbe5-3171-464e-a4e8-4e601cf541ac.png`. Оба результата визуально проверены перед включением в композицию.

## 06.11.2026 — стекло и отдельный игровой вагон

Режим: встроенный imagegen, без CLI/API fallback. Оригиналы `НГБЛИНК/` не менялись. Производные мастера сохранены в `art/`, WebP собирает `build_advent_journey()`. Активны **отдельные слои** `arcade-car.webp` и `claw-frame.webp`, у рамы сохранён RGBA без обрезки холста. Непрозрачная версия с купе не используется в интерфейсе.

### Промежуточная стеклянная витрина

`art/claw-glass-master.png` → `art/claw-glass.webp`, source `exec-4c6bd8dc-0d87-4d98-ae14-580dc66ce0d4.png`. Референсы: `art/claw-window.webp` как edit target и `art/train-window.webp` как стиль. Сохранена в архиве; по последующему уточнению фон заменён отдельным игровым вагоном.

```text
Use case: precise-object-edit and compositing. Asset type: edge-to-edge portrait background for a close-up glass claw machine inside the supplied winter train. Input image 1 is the exact edit target: preserve its camera, tall glass chamber geometry, blue outer enamel frame and brass inner structural ribs, ceiling light, floor and bottom blue lip. Input image 2 supplies the style and train interior. CHANGE all opaque blue rear panels and all side wall panels inside the chamber into clear semitransparent glass, with restrained vertical reflections and believable glass edges. THROUGH the glass, show the cozy vintage train passenger carriage from image 2: indigo plaid seats, brass framed large windows, snowy pines at night, warm rectangular ceiling lights. Train corridor recedes with gentle depth behind the chamber; there is NO second claw machine in the carriage. It must feel we are looking through the real glass machine into the surrounding train, not at a printed backdrop or blue cabinet walls. Keep only narrow metal supports opaque. The warm chamber light is restrained and translucent enough that the train is clearly visible. Glass chamber stays empty for separately animated claw and a surprise gift. No claw, no prizes, no text, no logos, no people, no joystick, no lower cabinet, no legs. Match supplied soft stylized 3D toy render, navy/brass/cream and snow-night palette. Preserve tall portrait 2:3 composition, fill entire canvas, no studio margins.
```

### Новый игровой вагон

`art/arcade-car-master.png` → `art/arcade-car.webp`, source `exec-93915e68-594b-49cf-9fd6-749b289ecf07.png`, 1024×1536 RGB. Референсы: `art/train-lounge.webp` и `art/train-window.webp` — только стиль и материалы. Это самостоятельный зал с центральным проходом, новыми автоматами и окнами, без купейных сидений и столика.

```text
Use case: stylized-concept. Asset type: a NEW portrait arcade-car interior background for a New Year train app. Input images are STYLE AND MATERIAL references only, do NOT copy their composition. Create a DIFFERENT carriage, a shared games lounge inside the same cozy vintage winter express. Camera at standing eye height, looking down a central aisle. On BOTH sides of the aisle are several beautifully crafted arcade machines: retro video game cabinets with simple colorful screens, a pinball table, and a small basketball arcade cabinet in the distance. Cabinets navy blue enamel and warm wood, restrained brass trim, round buttons, soft warm lights; no giant central machine hiding the room. Tall train windows BETWEEN the cabinets show snowy pine trees and a violet blue night. Curved carriage ceiling, warm rectangular ceiling lamps, wood floor with reflections, subtle festive string lights near the ceiling. Central glass connecting door at the far end, open airy space, asymmetrical lived-in arrangement of machines. Match the exact supplied soft low-poly stylized 3D toy-render aesthetic, cozy proportions, navy, indigo, brass and warm cream light. Portrait 2:3 framing, full bleed, detailed enough for the background seen through transparent claw-machine glass. NO sleeper compartment, NO facing plaid benches, NO table with food, NO dining setup, NO champagne, NO people, NO text, NO logos, NO floating UI, NO casino slot machines.
```

### Рама с прозрачными стёклами

`art/claw-frame-master.png` → `art/claw-frame.webp`, source `exec-2edb5de5-1f0a-4888-84eb-54c8edcb2696.png`, 1024×1536 RGBA. Edit target: `art/claw-glass-master.png`. Проверены холст, альфа и совпадение геометрии; средняя alpha внутри двух задних панелей около 84/255 и 92/255. Стекло пропускает фон с мягким светлым отражением, металлическая конструкция остаётся почти непрозрачной.

```text
Use case: background-extraction. Asset type: transparent foreground frame/glass layer for this exact claw chamber. Edit this image: REMOVE every part of the train visible behind ALL rear and side glass panes and replace only those glass-view areas with TRUE ALPHA TRANSPARENCY. Preserve exact 1024x1536 portrait canvas, framing, blue outer metal, brass inner ribs, opaque ceiling, floor, center vertical brass divider, and bottom lip, pixel alignment and geometry. Keep just a FEW subtle semitransparent narrow glass reflections over the clear alpha panes; most of each pane is almost transparent. The source train, seats, table, window, forest and ceiling behind the glass must be entirely gone. The transparent apertures must let a separate arcade-train background image show through. Do not paint a checkerboard, solid black, blue or white in the panes. No outside margin, no new objects, no claw, no gifts, no typography. Preserve the supplied warm 3D materials and lighting of the machine itself. Only remove the background behind the glass, change nothing structural.
```

Печенье и две совпадающие половинки повторно используют ранее подготовленные `renders/fortune-cookie.webp` и `renders/fortune-cookie-broken.webp`; новых растровых правок к ним не делали.

## 06.11.2026 — шесть видов за окном экспресса

Режим: встроенный imagegen, без CLI/API fallback. Каждая панорама — отдельный запрос с референсами `art/winter-panorama.webp` (цель вариации) и `art/train-window.webp` (только стиль купе). Оригиналы не менялись. Все выбранные PNG скопированы в проект; WebP экспортирует `build_advent_journey()`. Формат2172×724 RGB, горизонтальная панорама3:1.

Полный финальный набор запросов, исходные имена генераций и имена файлов: [LANDSCAPE-PROMPTS.json](LANDSCAPE-PROMPTS.json). Общие ограничения: только внешний зимний пейзаж; мягкая объёмная низкополигональная стилистика, indigo/violet, снег, горизонт около середины, без окна, поезда, UI, текста и людей.

| Сцена | Мастер | Рабочий файл |
|---|---|---|
| Снежные горы | `art/winter-mountains-master.png` | `art/winter-mountains.webp` |
| Лунное озеро | `art/winter-lake-master.png` | `art/winter-lake.webp` |
| Зимняя деревня | `art/winter-village-master.png` | `art/winter-village.webp` |
| Речная долина | `art/winter-river-master.png` | `art/winter-river.webp` |
| Каменный виадук | `art/winter-viaduct-master.png` | `art/winter-viaduct.webp` |
| Праздничный город | `art/winter-city-master.png` | `art/winter-city.webp` |

Назначение по датам фиксировано в `AV_JOURNEY.landscape()`: 14.12 лес → 15.12 деревня → 16.12 река → 17.12 виадук → 18.12 горы → 19.12 озеро → 20.12 город → 21.12 лес → 22.12 горы → 23.12 деревня → 24.12 озеро → 25.12 река → 26.12 виадук → 27.12 город → 28.12 горы → 29.12 лес → 30.12 деревня → 31.12 город. Повторный визит в тот же день сохраняет пейзаж; соседние дни не повторяются.

Панорамы просмотрены отдельно и через реальную рамку купе на рендерах @2x. На главной интерфейс опущен ниже столика. Корпус хваталки в этой итерации растрово не менялся: нижняя синяя часть существующей `claw-frame.webp` служит материалом увеличенной фронтальной панели, нейтральная тень и маска глубины скрывают прежний пол, трос и захват анимируются отдельно.

## 06.11.2026 — цельный объёмный корпус хваталки

Режим: встроенный imagegen, без CLI/API fallback. Новый RGB-мастер `art/claw-volume-master.png`1024×1536, рабочий `art/claw-volume.webp`. Оригиналы и предыдущие рамы сохранены. Полный финальный запрос и исходное имя генерации — [CLAW-VOLUME-PROMPT.json](CLAW-VOLUME-PROMPT.json).

Референсы: `claw-frame-master.png` задаёт верхнюю геометрию, `arcade-car-master.png` — вагон за стеклом, `machine-empty.webp` — физическую толщину корпуса и наклонную консоль. Сцена перерисована целиком с общей камерой и освещением. Нижняя консоль имеет видимую верхнюю плоскость, толстую бронзовую кромку, боковые скосы и тени. За ней — глубокий затенённый колодец без видимого пола. Сам захват и UI не запечены.

Передний слой — точная нижняя часть нового рендера с68% высоты, без растяжения: рука и приз уходят за объёмный бортик. Кнопки расположены на передней грани ниже80%. Прежняя увеличенная синяя полоса удалена.
