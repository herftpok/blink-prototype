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
