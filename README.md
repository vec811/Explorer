# Preference scenes

Interactive mobile screens where users pick their preferences. Each choice opens a box in an illustration and reveals matching art. Every scene is its own page, and a gallery page at the site root lists them all.

## Making a new scene (designers)

The illustrated guide at [`guide/`](guide/index.html) (live at `https://vec811.github.io/Explorer/guide/`) summarises the whole workflow.

1. Open this repository in [Claude Code](https://claude.ai/code).
2. Type `/scene-builder`, or just say "I want to make a new scene".
3. Claude asks for things one step at a time:
   - **Words:** the screen title, headline and body copy. A screenshot of the current app screen is enough.
   - **Illustrations:**
     - the empty background
     - everything shown before any choice: characters, furniture, and one box per question
     - one illustration per option
   - **Mock-ups:** full-frame images of the whole scene. One shows the default state with the boxes; one or more show options revealed. Claude uses them to work out where everything goes.
   - **Questions and options:** each card's title, description and options, and which illustration each option reveals.
   - **Animation style:** what plays when someone switches option. People walk, rooms get a privacy curtain, money slams down with coins, or a general pop.
4. Claude builds the scene and sends screenshots. These show the screen, your mock-ups side by side with the build, and the animations frame by frame. Ask for changes in plain words.
5. Once the change is merged, the scene is live at `https://vec811.github.io/Explorer/scenes/<name>/`.

Attach files in the chat, or upload them on GitHub into `scenes/<name>/incoming/`. Filenames don't matter.

**Tips**
- Export mock-ups as the whole scene (any size), not cropped.
- Option illustrations can be drawn at any scale; Claude measures them against the mock-ups.
- An option missing from the mock-ups is placed by hand, and Claude will say so.

## How it's built

```
index.html                    gallery of all scenes
guide/                        illustrated guide to the workflow and the skill
engine/                       shared code and styles for every scene
scenes/scenes.js              list of scenes shown in the gallery
scenes/<name>/index.html      the scene's page (loads the engine)
scenes/<name>/scene.config.js copy, options, positions, layer order, animations
scenes/<name>/assets/         illustrations
scenes/<name>/reference/      mock-ups (only used for measuring and checks)
.claude/skills/scene-builder/ the Claude skill: steps, config reference, scripts
```

The fields in `scene.config.js` are documented in [.claude/skills/scene-builder/reference.md](.claude/skills/scene-builder/reference.md).

To view a scene on your own computer, run `python3 -m http.server` in the repository folder and open `http://localhost:8000`. Or open a scene's `index.html` directly in your browser.
