---
name: scene-builder
description: Build or update an interactive preference scene in this repo. A scene is a mobile screen where picking an option opens a box in an illustration and reveals matching art. Use when a designer wants to create a new scene, add illustrations, mock-ups, questions or options to one, change a scene's copy, art or animations, or asks how scenes are set up.
---

# Scene builder

Guide a designer from their files to a working scene page, one step at a time. Designers are not expected to write code or know the file layout. They give you illustrations, mock-ups and copy; you do the rest and show them screenshots.

## How a scene works

- `engine/scene-engine.js` and `engine/scene-engine.css` are shared by every scene. Do not change them for a single scene.
- `scenes/<slug>/` holds one scene:
  - `index.html` loads the engine. It is the same for every scene apart from its title.
  - `scene.config.js` holds everything else: copy, layer order, positions, categories, options and animations. Field reference: [reference.md](reference.md).
  - `assets/` holds the illustrations, and `reference/` holds the mock-ups.
- `scenes/scenes.js` lists the scenes on the gallery page (`index.html` at the root).
- `scenes/hospitalisation/` is a finished example. Read its config before writing a new one.

Scripts live in `scripts/` next to this file. Run them from the repository root. They need Playwright: it is preinstalled in Claude Code on the web; elsewhere, run `npm i -D playwright && npx playwright install chromium` first.

| Script | Does |
| --- | --- |
| `node <skill>/scripts/new-scene.cjs <slug> "<Title>" "<description>"` | Creates `scenes/<slug>/` from the templates and adds it to the gallery. |
| `node <skill>/scripts/look.cjs --out <sheet.png> <files...>` | Renders files into one labelled sheet with their sizes, so you can see SVGs. |
| `node <skill>/scripts/measure.cjs --artboard <bg.svg> --ref <mock-up> [--ref ...] <files...>` | Finds each file's position in the mock-ups, in artboard units. |
| `node <skill>/scripts/preview.cjs scenes/<slug> [--frames]` | Screenshots, comparison sheets against mock-ups, animation frames, and a check for errors and missing files. |

`<skill>` is `.claude/skills/scene-builder`. Scratch output belongs in `.preview/`, which git ignores.

## Ground rules

- Ask for one step's worth of information at a time. Ask only for what you cannot work out from the files. For example, read the copy off an app screenshot instead of asking for it to be typed.
- When there is a real choice, such as an animation style, use AskUserQuestion with your recommendation first.
- Speak the designer's language: "box", "option art", "mock-up". Avoid "slot", "rect" and "config".
- Show, don't describe. After building, send the screenshots.
- Never guess silently. Anything placed by hand rather than measured gets mentioned in the final summary.
- The repository and its GitHub Pages site may be public. Before committing mock-ups or art for the first time, say so in one line.

## Step 1: Name and words

Collect:
- The scene's name, shown in the title bar (for example, "Hospitalisation").
- The headline and body copy under the illustration.
- The heading above the cards, if it isn't the default "Let’s work on these considerations:".

If the designer shares a screenshot of the current app screen, read all of these from it, and the card titles and descriptions too, then ask them to confirm.

Propose a slug: lowercase words joined by hyphens, such as `critical-illness`. Check that `scenes/<slug>/` doesn't already exist. If it does, switch to [Updating a scene](#updating-a-scene).

## Step 2: Files

Ask for these. Any filenames are fine.

1. **Background**: the empty scene with no boxes and no option art. Its size defines the artboard.
2. **Default-state pieces**: everything drawn on top of the background before any choice, including characters, furniture and **one box per category**.
3. **Option art**: one illustration per option.
4. **Mock-ups**: full-frame images of the whole scene. One shows the default state with the boxes; one or more show options revealed. These are only used to measure positions, and are never shown to users.

Designers can attach files in the chat, or upload them on GitHub into `scenes/<slug>/incoming/` on the working branch. Chat uploads arrive as file paths in their message. Copy everything into `scenes/<slug>/assets/` (art) and `scenes/<slug>/reference/` (mock-ups). Replace spaces in filenames with `_`, and otherwise keep the designer's names. Delete `incoming/` once its files are copied.

Run `look.cjs` on all the files and read the sheet. Then tell the designer which file you think is which: the background, each box, each option's art, each mock-up. Ask them to correct anything wrong. Flag missing pieces, for example a category with a box but only one option's art. It's fine to build with placeholders and swap in the real art later.

## Step 3: Questions and options

For each category, in the order the cards should appear, collect:
- **Title** and **description** for the card.
- **Options**: each label, and which art it reveals.
- **Box**: which box it opens. Propose this from the art and mock-ups; ask only if unclear.
- **Swap animation**: what plays when the user switches between options. Ask with AskUserQuestion, listing the styles from [reference.md](reference.md#swap-animations) and recommending one by subject:
  - People: `walk`.
  - Rooms or places: `curtain`.
  - Money, documents or objects on a surface: `slam`. For `slam`, also ask for each option's coin colour, or suggest gold and silver.
  - Anything else: `pop`.

Cards unlock in order by default. Only ask about this if the designer mentions it.

## Step 4: Build

1. Run `new-scene.cjs`, then copy the files in (Step 2).
2. Fill in `scene.config.js`:
   - The copy from Step 1.
   - `artboard`, set to the background SVG's `width` and `height`. `look.cjs` prints these.
   - The categories from Step 3, with ids made from short words (`specialist`, `ward`).
   - `references`: each mock-up with the options it shows. The default mock-up gets `state: {}`.
3. Set the scene's `thumbnail` in `scenes/scenes.js` to its revealed mock-up (a path from the site root).

## Step 5: Place the art

Run `measure.cjs` with the background as `--artboard`, every mock-up as `--ref`, and every other art file. Each result is marked:

- **✓ found**: use the rect as given.
- **~ check**: probably right. Use it, and confirm it in the comparison sheets in Step 7.
- **✗ not found**: the art isn't in any mock-up. This is common for one of a pair of options.
  - For option art: if another option in the same category was found, give this one the same rect when the files are the same size. Otherwise, use the same `artScale`: w = file width × artScale, h = file height × artScale. Centre it on the box horizontally and stand it on the box's bottom edge: x = box.x + box.w / 2 − w / 2, y = box.y + box.h − h. Tell the designer it's a guess.
  - For default-state pieces: ask the designer, because every default piece should appear in the default mock-up.

If the script warns that a mock-up's aspect ratio differs from the artboard, it is probably cropped. Ask for a full-frame export before trusting the results.

Option art is often drawn at a different scale from the background (in the hospital scene, ×1.838). That's expected: the rect handles it.

## Step 6: Layer order

Write `layers` back to front: the background, then default-state pieces and `{ slot }` entries, ordered the way the mock-ups show overlaps. Look for where things overlap in the mock-ups:

- What covers what between each box (or its option art) and the pieces around it decides whether the slot goes before or after that piece.
- If a single file must be partly behind and partly in front of a slot, draw it twice with `clip`, as in the patient example in [reference.md](reference.md#layering-recipes).
- Watch for art that is larger than its box once revealed. It may now overlap things the box didn't. Check those overlaps against the revealed mock-up.

## Step 7: Check

Run `preview.cjs scenes/<slug> --frames` and look at every image it writes:

- `compare-*.png`: in the difference panel, black means the build matches the mock-up. A bright outline that's offset means misplaced art. A whole shape lit up means wrong layer order, or art that differs from the mock-up (expected when the designer changed the art since the mock-up).
- `phone-default.png` and `phone-option-*.png`: the screen as users see it. Check that the copy is right and nothing is cut off.
- `anim-*.png`: frames of each unbox and swap. Check that nothing flies through something it shouldn't, and that the curtain covers the change.

The script must report no errors and no missing files. Fix anything, then run it again. Stop iterating once the only differences left are ones the designer introduced on purpose.

## Step 8: Share

1. Send the designer `phone-default.png`, the `compare-*.png` sheets and the `anim-*.png` sheets, with one line about each.
2. Commit the scene folder and `scenes/scenes.js` with a message like "Add <Title> scene", and push to the working branch.
3. Give the link: `https://<owner>.github.io/<repo>/scenes/<slug>/`, taking owner and repo from `git remote get-url origin`. It goes live once the change reaches the branch GitHub Pages deploys from, usually `main`. If the work is on another branch, say that it needs merging first, and offer to open a pull request. Don't open one unless they say yes.
4. List anything you guessed: hand-placed art, assumed layer order, placeholder art.

## Updating a scene

- **New version of an art file**: overwrite it in `assets/`. Re-run `measure.cjs` on that file if its size changed, then `preview.cjs`.
- **Copy, options or animation changes**: edit `scene.config.js`, then run `preview.cjs`.
- **A new kind of animation or behaviour**: add it to the engine in a general way, and document it in [reference.md](reference.md) and in the animation library section of `guide/index.html`. Then run `preview.cjs` on **every** scene to check none of them changed.
