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
