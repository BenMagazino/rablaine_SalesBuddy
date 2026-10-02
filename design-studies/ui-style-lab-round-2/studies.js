const studies = [
  {
    id: 'docked', name: 'Workbench / Docked', number: '01',
    idea: 'The direct combination',
    description: 'Workbench graphite, the calendar-first layout from Studio, and three properly enclosed cards on the right. Familiar top menus keep the app chrome compact.',
    distinction: 'Framed cards with strong header bars. No permanent navigation sidebar.',
    verdict: 'My first pick for your brief',
    nav: 'top', order: ['tasks', 'milestones', 'alerts']
  },
  {
    id: 'navigator', name: 'Workbench / Navigator', number: '02',
    idea: 'A quiet, navigable workspace',
    description: 'A slim, labeled sidebar creates a stable place for navigation. Deep navy surfaces pick up the logo, while the calendar and separate attention cards stay central.',
    distinction: 'Labeled navigation on the left; grouped attention on the right.',
    verdict: 'Best for growing the rest of the app',
    nav: 'side', order: ['tasks', 'milestones', 'alerts']
  },
  {
    id: 'panes', name: 'Workbench / Split Panes', number: '03',
    idea: 'The desktop-tool treatment',
    description: 'An activity rail, compact document tab, and a dock divided into three explicit tool panes. The boundaries are structural, like an IDE, rather than relying on color.',
    distinction: 'Hard pane edges, section dividers, and independent scroll areas.',
    verdict: 'Closest to an IDE',
    nav: 'rail', order: ['tasks', 'milestones', 'alerts']
  },
  {
    id: 'focus', name: 'Workbench / Focus Desk', number: '04',
    idea: 'A softer dark workspace',
    description: 'A charcoal canvas with quieter navigation and slightly softer cards. A wider right dock gives long customer and milestone titles more room without hiding the month.',
    distinction: 'Wider attention column, rounded enclosures, and more breathing room within rows.',
    verdict: 'Best for readability',
    nav: 'top', order: ['tasks', 'milestones', 'alerts']
  },
  {
    id: 'reverse', name: 'Workbench / Priority Left', number: '05',
    idea: 'Attention first, then the calendar',
    description: 'The same calendar-first proportions, reversed: milestones lead the left dock, followed by action items and revenue alerts. The wide calendar remains the main workspace.',
    distinction: 'Left-side attention dock, deadline-first order, and crisp blue-gray surfaces.',
    verdict: 'An alternate scanning pattern',
    nav: 'top', order: ['milestones', 'tasks', 'alerts']
  }
];
