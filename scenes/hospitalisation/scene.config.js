// Scene config for the Hospitalisation preferences screen.
// Field reference: .claude/skills/scene-builder/reference.md
// Positions are { x, y, w, h } in the artboard of the background illustration.
window.SCENE_CONFIG = {
  title: 'Hospitalisation',
  sceneLabel: 'Hospital room illustration',
  headline: 'Find the right coverage to support your care preferences',
  body: 'Hospitalisation costs vary according to choice of treatment and hospital. With medical inflation at 10%, work out the coverage that best meets your preferences.',
  prompt: 'Let’s work on these considerations:',

  artboard: { w: 2500, h: 1412 },

  // Back to front. `{ slot }` marks where a category's box and options sit.
  layers: [
    { image: 'assets/hospitalisation-empty.svg', rect: { x: 0, y: 0, w: 2500, h: 1412 } },
    { image: 'assets/patient.svg', rect: { x: 501, y: 324, w: 1257, h: 1126 } },
    { slot: 'specialist' },
    // The patient again, minus the IV pole and bag (x > 680 above y 380, x > 800
    // above y 585 in patient.svg), so the bed foot sits in front of the doctor
    // while the drip stays behind him.
    {
      image: 'assets/patient.svg',
      rect: { x: 501, y: 324, w: 1257, h: 1126 },
      clip: 'polygon(0 0, 54.1% 0, 54.1% 33.75%, 63.64% 33.75%, 63.64% 51.95%, 100% 51.95%, 100% 100%, 0 100%)',
    },
    { slot: 'ward' },
    { slot: 'coverage' },
  ],

  categories: [
    {
      id: 'specialist',
      title: 'Specialist',
      description: 'Consider whether you’d like to have a preferred medical specialist or one who’s assigned by the hospital.',
      box: { image: 'assets/Doctor_box.svg', rect: { x: 1318, y: 321, w: 527, h: 943 } },
      swap: 'walk',
      options: [
        { id: 'assigned', label: 'Accept any specialist', image: 'assets/Doctor_assigned.svg', rect: { x: 1143, y: 55, w: 603, h: 1254 } },
        { id: 'choice', label: 'Choose my preferred specialist', image: 'assets/Doctor_choice.svg', rect: { x: 1143, y: 55, w: 603, h: 1254 } },
      ],
    },
    {
      id: 'ward',
      title: 'Hospital and ward',
      description: 'Get treated in a hospital ward of your choice, with options ranging from single-bedder to shared room.',
      box: { image: 'assets/Ward_box.svg', rect: { x: 34, y: 799, w: 564, h: 543 } },
      swap: 'curtain',
      options: [
        { id: 'shared', label: 'Shared room', image: 'assets/Shared_room.svg', rect: { x: 0, y: 546, w: 938, h: 860 } },
        // Not in the reference mock-up: same scale as the other option art, standing where the box was.
        { id: 'private', label: 'Private room', image: 'assets/Armchair.svg', rect: { x: 12, y: 748, w: 608, h: 594 } },
      ],
    },
    {
      id: 'coverage',
      title: 'Bill coverage',
      description: 'Obtain additional support to keep your out-of-pocket expenses in check.',
      box: { image: 'assets/Coverage_box.svg', rect: { x: 2085, y: 605, w: 235, h: 177 } },
      swap: 'slam',
      options: [
        { id: 'shield', label: 'Use Integrated Shield Plan only', image: 'assets/pay_silver.svg', rect: { x: 2092, y: 546, w: 301, h: 349 }, accent: '#c9ced6' },
        { id: 'supplementary', label: 'Through adding supplementary coverage', image: 'assets/pay_gold.svg', rect: { x: 2092, y: 546, w: 301, h: 349 }, accent: '#f5b400' },
      ],
    },
  ],

  // Used by the preview script to compare renders against the mock-ups.
  references: [
    { image: 'reference/default.webp', state: {} },
    { image: 'reference/revealed.png', state: { specialist: 'choice', ward: 'shared', coverage: 'supplementary' } },
  ],
};
