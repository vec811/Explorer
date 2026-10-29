// Scene config for the Disability Income preferences screen.
// Field reference: .claude/skills/scene-builder/reference.md
// Positions are { x, y, w, h } in the artboard of the background illustration.
window.SCENE_CONFIG = {
  title: 'Disability Income',
  sceneLabel: 'Park illustration of a man in a wheelchair',
  // Placeholder copy until the designer sends the overview screen's text.
  headline: 'Plan for the support you’d need if you couldn’t work',
  body: 'A disability can stop your income while caregiving, living costs and debts carry on. Work out the monthly support that would keep you and your family on track.',

  artboard: { w: 1360, h: 765 },

  // Back to front. `{ slot }` marks where a category's box and options sit;
  // `{ front }` is where its options' front pieces (the hands on the handle) go.
  layers: [
    { image: 'assets/bg.svg', rect: { x: 0, y: 0, w: 1360, h: 765 } },
    { slot: 'care' },
    { image: 'assets/Wheelchair.svg', rect: { x: 519, y: 182, w: 456, h: 532 } },
    { front: 'care' },
    { slot: 'expenses' },
    // The armrest and seat side again, in front of whatever sits on his lap.
    { image: 'assets/Wheelchair-frontlayer.svg', rect: { x: 626, y: 428, w: 150, h: 186 } },
    { slot: 'debt' },
  ],

  categories: [
    {
      id: 'care',
      title: 'Caregiving arrangement',
      description: 'Financial support for caregiving to help with tasks like feeding, rehabilitation, and essentials like medical supplies can aid your recovery.',
      box: { image: 'assets/Family_box.svg', rect: { x: 319, y: 109, w: 287, h: 511 } },
      swap: 'walk',
      options: [
        {
          id: 'family',
          label: 'Rely on a family member',
          detail: '4,800 SGD per month',
          description: 'Cover your family member’s income loss and rest time.',
          image: 'assets/Family.svg',
          rect: { x: 286, y: 58, w: 396, h: 605 },
          front: { image: 'assets/Nurse_and_family_hand-frontlayer.svg', rect: { x: 518, y: 289, w: 32, h: 59 } },
        },
        // Helper and nurse are not in the mock-ups. Each has their own hand
        // cropped off (clip) and stands so the front hand joins the sleeve
        // and grips the handle like the mother's.
        {
          id: 'helper',
          label: 'Hire a domestic helper',
          detail: '4,330 SGD per month',
          description: 'Cover the helper’s salary, government levy, and living expenses.',
          image: 'assets/Helper.svg',
          rect: { x: 274, y: 95, w: 290, h: 601 },
          clip: 'polygon(0 0, 100% 0, 100% 34.11%, 87.31% 34.11%, 77% 43.59%, 100% 43.59%, 100% 100%, 0 100%)',
          front: { image: 'assets/Helper_hand-frontlayer.svg', rect: { x: 508, y: 307, w: 59, h: 45 } },
        },
        {
          id: 'nurse',
          label: 'Engage a home nursing service',
          detail: '6,400 SGD per month',
          description: 'Cover the cost of home-based care from a nurse or professional caregiver.',
          image: 'assets/Nurse.svg',
          rect: { x: 278, y: 44, w: 293, h: 615 },
          clip: 'polygon(0 0, 100% 0, 100% 36.59%, 89.15% 36.59%, 75.7% 48.78%, 100% 48.78%, 100% 100%, 0 100%)',
          front: { image: 'assets/Nurse_and_family_hand-frontlayer.svg', rect: { x: 518, y: 289, w: 32, h: 59 } },
        },
      ],
    },
    {
      id: 'expenses',
      title: 'Monthly expenses',
      // Placeholder copy until the designer sends this question's screen.
      description: 'What are your monthly living expenses? Consider food, utilities, transport, and insurance premiums.',
      box: { image: 'assets/Cash_box.svg', rect: { x: 708, y: 347, w: 155, h: 119 } },
      amount: {
        label: 'Monthly expenses',
        unit: 'SGD per month',
        image: 'assets/Stacks_of_cash.svg',
        rect: { x: 704, y: 370, w: 174, h: 104 },
      },
    },
    {
      id: 'debt',
      title: 'Debt repayments',
      description: 'What is your monthly payment towards debts? Consider credit card bills, mortgage, and car loan.',
      box: { image: 'assets/Bill_box.svg', rect: { x: 1074, y: 383, w: 143, h: 107 } },
      amount: {
        label: 'Monthly debt repayments',
        unit: 'SGD per month',
        image: 'assets/Bills_and_loans.svg',
        rect: { x: 1048, y: 397, w: 181, h: 75 },
      },
    },
  ],

  // Used by the preview script to compare renders against the mock-ups.
  // Amount categories take a number.
  references: [
    { image: 'reference/default.png', state: {} },
    { image: 'reference/revealed.png', state: { care: 'family', expenses: 2500, debt: 1200 } },
  ],
};
