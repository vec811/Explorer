# Hospitalisation preferences prototype

A mobile screen where the user picks three care preferences. Each choice opens one of the brown boxes in the hospital-room illustration to show the matching art.

Open `index.html` through any static server, for example `python3 -m http.server`, then visit `http://localhost:8000`.

## How it works

- The default scene is `hospitalisation-empty.svg` with `patient.svg`, `Ward_box.svg`, `Doctor_box.svg` and `Coverage_box.svg` placed on top. Positions are in the 2500 × 1412 artboard and match the reference mock-up.
- The cards unlock in order: Specialist, then Hospital and ward, then Bill coverage. You choose one option per card.
- The title bar and illustration stay pinned to the top while the cards scroll, so every transition stays in view.
- The first choice in a category plays the unboxing animation: the box hops and wobbles, bursts in a puff of confetti, and the illustration springs out.
- Switching to the other option plays an animation specific to that category, set by `swap` in `CATEGORIES`:
  - **Specialist:** one doctor strolls off, the other strolls in, skids to a stop and hops.
  - **Hospital and ward:** a privacy curtain swishes across and pulls back on the other room.
  - **Bill coverage:** the old clipboard is flicked away, and the new one slams down with a shake and a burst of silver or gold coins.
- Every choice can be changed until **Confirm my preferences** is pressed. After that the choices are locked. **Start over** resets the prototype.
- Tapping a box in the illustration opens its card.
- With *reduce motion* switched on, the animations become a simple crossfade.

## Adding the final illustrations

The six option illustrations live in `assets/illustrations/`. To update one, overwrite the file and keep the same filename. Filenames are case-sensitive on GitHub Pages:

| Category | Option | File |
| --- | --- | --- |
| Specialist | Accept any specialist | `Doctor_assigned.svg` |
| Specialist | Choose my preferred specialist | `Doctor_choice.svg` |
| Hospital and ward | Shared room | `Shared_room.svg` |
| Hospital and ward | Private room | `Armchair.svg` |
| Bill coverage | Use Integrated Shield Plan only | `pay_silver.svg` |
| Bill coverage | Through adding supplementary coverage | `pay_gold.svg` |

The option illustrations are exported at 1360/2500 of the scene (the scale of the revealed mock-up), so each option in `CATEGORIES` in `app.js` has a `rect: { x, y, w, h }` in artboard coordinates: its native size × 1.838, placed where the mock-up shows it. If you re-export one at a different size or want to move it, edit its `rect`. An option without a `rect` is fitted into its box's rectangle.

Stacking order, from back to front: background, patient, specialist slot, bed (drawn again without the drip so it stays in front of the doctor while the IV pole and bag stay behind), ward slot, coverage slot.
