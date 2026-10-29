# Scene config reference

Every scene is `scenes/<slug>/scene.config.js`, which sets `window.SCENE_CONFIG`. The shared engine (`engine/scene-engine.js`) builds the whole screen from it. Paths are relative to the scene folder. Positions are rectangles `{ x, y, w, h }` in the artboard, which is the coordinate space of the background illustration: its SVG `width` and `height`.

## Top level

| Field | Required | What it is |
| --- | --- | --- |
| `title` | yes | Title bar text and browser tab title. |
| `sceneLabel` | no | What the illustration shows, read out by screen readers before the current choices. |
| `headline` | no | Serif headline under the illustration. |
| `body` | no | Paragraph under the headline. |
| `prompt` | no | Heading above the cards. Default: "Let’s work on these considerations:". |
| `artboard` | yes | `{ w, h }`: the background SVG's width and height. |
| `layers` | yes | Back-to-front list of what is drawn in the scene. See [Layers](#layers). |
| `categories` | yes | The cards, in order. See [Categories](#categories). |
| `unlockInOrder` | no | `true` by default: each card unlocks once the previous one has a choice. Set `false` to open all cards at once. |
| `text` | no | Overrides for the fixed wording. See [Text](#text). |
| `references` | no | Mock-ups for the preview script to compare against. See [References](#references). |

## Layers

Listed back to front. Each entry is one of these:

- `{ image, rect }`: a fixed illustration (the background, characters, furniture).
- `{ image, rect, clip }`: the same, cropped with a CSS `clip-path` (see [Layering recipes](#layering-recipes)).
- `{ slot: '<category id>' }`: where that category's box, and later its option art, is drawn.
- `{ front: '<category id>' }`: where that category's options' `front` pieces are drawn. See [Layering recipes](#layering-recipes).

The first layer is normally the background, with `rect: { x: 0, y: 0, w: artboard.w, h: artboard.h }`. A category without a `slot` entry is drawn on top of everything.

## Categories

| Field | Required | What it is |
| --- | --- | --- |
| `id` | yes | Short unique id, such as `specialist`. Used by `slot` and `references`. |
| `title` | yes | Card title. |
| `description` | no | Card text shown until a choice is made. |
| `box` | yes | `{ image, rect }`: the closed box shown by default. Tapping it opens the card. |
| `swap` | no | Animation for switching between options. See [Swap animations](#swap-animations). Default `pop`. |
| `options` | one of these two | Two or more `{ id, label, image, rect?, detail?, description?, front?, accent? }`. |
| `amount` | one of these two | A typed number instead of options. See [Amount cards](#amount-cards). |

Option fields:

- `id`, `label` and `image` are required.
- `rect` is where the option art sits. Leave it out to fit the art inside the box's rectangle, bottom-centred.
- `detail` is a second line under the label, such as a price ("4,800 SGD per month").
- `description` is a short paragraph under that.
- `front` is `{ image, rect }`: a piece of this option's art drawn higher up the layers, at the category's `{ front }` layer. It moves with the option art in every animation. See [Layering recipes](#layering-recipes).
- `accent` is a CSS colour used by the `slam` swap for its coins (gold `#f5b400`, silver `#c9ced6`).

### Amount cards

When the question asks for a number, give the category `amount` instead of `options`:

```js
{
  id: 'debt',
  title: 'Debt repayments',
  description: 'What is your monthly payment towards debts? Consider credit card bills, mortgage, and car loan.',
  box: { image: 'assets/Bill_box.svg', rect: { x: 1074, y: 383, w: 143, h: 107 } },
  amount: {
    label: 'Monthly debt repayments',   // above the field; defaults to the title
    unit: 'SGD per month',              // after the number, and in the card's summary
    image: 'assets/Bills_and_loans.svg',
    rect: { x: 1048, y: 397, w: 181, h: 75 },
  },
},
```

The card shows a number field and a Save button. Saving (the button, Enter, or leaving the field) plays the unbox animation the first time; changing the number later just updates the card. Clearing the field puts the box back. `amount` also takes `placeholder`, and `accent` like an option. In `references`, give an amount category a number: `state: { debt: 1200 }`.

Option art may be drawn at a different scale from the scene. The rect handles that, because the art is stretched to fill it. Keep the rect's aspect ratio equal to the file's, or the art will be letterboxed.

## Animations

The first time a category gets a choice, its box always plays the **unbox** animation: it hops, wobbles, bursts in a puff of confetti, and the option art springs out.

### Swap animations

`swap` sets what happens when the user switches from one option to another:

| `swap` | What happens | Suits |
| --- | --- | --- |
| `pop` | The old art shrinks into a puff and the new art pops up with sparkles. | Anything. The default. |
| `flip` | A quick card flip with a twinkle. | Badges, cards, flat objects. |
| `walk` | One figure strolls off to the right, the other strolls in, skids to a stop and hops. | People and animals. |
| `curtain` | A hospital privacy curtain swishes across from the left and pulls back on the new art. | Rooms, places, big furniture. |
| `slam` | The old art is flicked away; the new art slams down with a shake, a dust ring and coins in the option's `accent` colour. | Money, documents, objects on a surface. |

With *reduce motion* switched on, every animation becomes a short crossfade.

To add a new swap, add a function to `SWAPS` in `engine/scene-engine.js` and a row to this table. It receives `(slot, from, to, opt)` and returns the promise of the incoming art's animation. Then run the preview script on every scene to check nothing else changed.

## Text

`text` overrides any of these strings:

| Key | Default |
| --- | --- |
| `progress` | `{done} of {total} preferences chosen` |
| `allSet` | `All set. You can still change any choice before confirming.` |
| `confirm` | `Confirm my preferences` |
| `confirmed` | `Preferences confirmed` |
| `lockedIn` | `Your preferences are locked in.` |
| `startOver` | `Start over` |
| `close` | `Close` (accessible name of the × button) |
| `amountSave` | `Save` (the button under an amount field) |

## References

```js
references: [
  { image: 'reference/default.png', state: {} },
  { image: 'reference/revealed.png', state: { specialist: 'choice', ward: 'shared' } },
],
```

`state` maps category ids to the option shown in that mock-up. Categories left out stay as boxes. The engine ignores this field; `scripts/preview.cjs` uses it to build the comparison sheets.

Mock-ups must be full-frame exports of the whole artboard. Any size works, as long as the aspect ratio matches.

## Layering recipes

**Something must be both behind and in front of a slot.** In the hospital scene, the doctor stands behind the bed foot but in front of the IV pole, and both are part of `patient.svg`. The fix is to draw the patient twice: once before the slot, and once after it with the pole cropped out using `clip`:

```js
{ image: 'assets/patient.svg', rect: R },
{ slot: 'specialist' },
{ image: 'assets/patient.svg', rect: R, clip: 'polygon(0 0, 54.1% 0, 54.1% 33.75%, 63.64% 33.75%, 63.64% 51.95%, 100% 51.95%, 100% 100%, 0 100%)' },
```

Polygon percentages are relative to the layer's own file: x% = pixel x ÷ file width, y% = pixel y ÷ file height. Keep the cropped-out area to the part that must sit behind.

**A hand on a handle.** In the disability income scene, the caregiver stands behind the wheelchair but their hand grips its handle. The designer supplies the hand as a separate "frontlayer" file. Give each option its hand as `front`, and add a `{ front }` layer after the wheelchair:

```js
{ slot: 'care' },
{ image: 'assets/Wheelchair.svg', rect: W },
{ front: 'care' },
```

The hand shows only while its option is shown, and walks, pops or flips along with it. When options share a hand file but aren't in the mock-ups, stand each figure so its own hand sits under the shared one.

**Overlap with no order shown in a mock-up.** Put the slot where the art will look natural once revealed: usually nearer the front when the option art stands on the floor in front of other things.

## Files

- Use the designer's filenames, but replace spaces with `_`. Filenames are case-sensitive on GitHub Pages, so the config must match exactly.
- SVG is preferred. PNG and WebP also work; export them at 2× so they stay sharp.
- `assets/` holds what the page loads. `reference/` holds mock-ups, which the page never loads.

## Engine extras

- `?static` turns off all animation (used for screenshots).
- `?bare` shows only the illustration at full width (used for comparisons).
- `window.SceneEngine.select(categoryId, optionId)`, `.commit()` and `.reset()` drive the page from the console or a script. For an amount category, pass the number as the second argument.
- A broken config shows a red list of problems on the page and in the console instead of a blank screen.
