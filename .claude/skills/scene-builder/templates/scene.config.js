// Scene config for the {{TITLE}} preferences screen.
// Field reference: .claude/skills/scene-builder/reference.md
// Positions are { x, y, w, h } in the artboard of the background illustration.
window.SCENE_CONFIG = {
  title: '{{TITLE}}',
  sceneLabel: 'TODO: what the illustration shows, for screen readers',
  headline: 'TODO',
  body: 'TODO',
  prompt: 'Let’s work on these considerations:',

  artboard: { w: 0, h: 0 }, // TODO: the background SVG's width and height

  // Back to front. `{ slot }` marks where a category's box and options sit.
  layers: [
    { image: 'assets/TODO-background.svg', rect: { x: 0, y: 0, w: 0, h: 0 } },
  ],

  categories: [
    // {
    //   id: 'short-id',
    //   title: 'Card title',
    //   description: 'Card description',
    //   box: { image: 'assets/Box.svg', rect: { x, y, w, h } },
    //   swap: 'pop',
    //   options: [
    //     { id: 'a', label: 'Option A', image: 'assets/A.svg', rect: { x, y, w, h } },
    //     { id: 'b', label: 'Option B', image: 'assets/B.svg', rect: { x, y, w, h } },
    //   ],
    // },
  ],

  // Used by the preview script to compare renders against the mock-ups.
  references: [
    // { image: 'reference/default.png', state: {} },
    // { image: 'reference/revealed.png', state: { 'short-id': 'a' } },
  ],
};
