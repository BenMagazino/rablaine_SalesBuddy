const studies = [
  { id: 'left-icons', number: '01', name: 'Left / Icons', placement: 'left', labels: 'icons',
    idea: 'The activity rail', verdict: 'Most VS Code-like',
    description: 'A narrow activity rail keeps the calendar wide. Hover identifies each icon and opens its flyout; click toggles it. Menu contents always have text.',
    distinction: 'Smallest left navigation footprint, but the icons take some learning.' },
  { id: 'left-text', number: '02', name: 'Left / Text', placement: 'left', labels: 'text',
    idea: 'The quiet list', verdict: 'Least visual noise',
    description: 'Plain labels, no repeated iconography. A horizontal active marker and right-facing chevrons establish navigation. Flyouts open directly beside the selected row.',
    distinction: 'Straightforward labels at the cost of more calendar width than an icon rail.' },
  { id: 'left-mixed', number: '03', name: 'Left / Icons + Text', placement: 'left', labels: 'mixed',
    idea: 'The labeled explorer', verdict: 'Easiest left navigation to learn',
    description: 'Recognizable symbols plus explicit labels. The connected explorer panel has a stable home for each section, with grouped flyouts opening to its right.',
    distinction: 'The clearest left option; also the widest navigation column.' },
  { id: 'top-icons', number: '04', name: 'Top / Icons', placement: 'top', labels: 'icons',
    navigationIds: ['sellers', 'reports', 'browse'],
    idea: 'The compact toolbar', verdict: 'Maximum calendar width',
    description: 'The original Sellers, Reports, and Browse menus sit beside the home logo. Search is centered in the window, with New note and utility controls on the right. Hovering opens a labeled dropdown directly below the icon.',
    distinction: 'Compact but least self-explanatory. The expanded menu supplies the missing labels.' },
  { id: 'top-text', number: '05', name: 'Top / Text', placement: 'top', labels: 'text',
    idea: 'The desktop menu bar', verdict: 'My recommendation',
    description: 'A familiar desktop menu bar: Notes, Sellers, Reports, Browse. Plain text and a thin active rule keep the chrome quiet. Drop-downs align beneath each label.',
    distinction: 'Readable without sacrificing calendar width. The simplest fit for these existing menus.' },
  { id: 'top-mixed', number: '06', name: 'Top / Icons + Text', placement: 'top', labels: 'mixed',
    idea: 'The explicit toolbar', verdict: 'Most immediately recognizable',
    description: 'Icons reinforce the text without carrying the navigation alone. A compact, horizontal toolbar keeps the entire workspace connected below it.',
    distinction: 'Easy to scan, but a little busier than the text-only menu bar.' }
];

const primaryNavigation = [
  { id: 'notes', label: 'Notes', symbol: 'notes', path: '/notes' },
  { id: 'sellers', label: 'Sellers', symbol: 'people' },
  { id: 'reports', label: 'Reports', symbol: 'reports' },
  { id: 'browse', label: 'Browse', symbol: 'folder' }
];

/* Illustrative menu structure with fictional sellers and record identifiers. */
const menuContent = {
  sellers: [
    { group: 'DIRECTORY', items: [{ label: 'All Sellers', path: '/sellers', symbol: 'people' }] },
    { group: 'YOUR SELLERS', items: [
      { label: 'Fictional Seller 01', path: '/seller/101', symbol: 'person' },
      { label: 'Fictional Seller 02', path: '/seller/102', symbol: 'person' },
      { label: 'Fictional Seller 03', path: '/seller/103', symbol: 'person' },
      { label: 'Fictional Seller 04', path: '/seller/104', symbol: 'person' },
      { label: 'Fictional Seller 05', path: '/seller/105', symbol: 'person' },
      { label: 'Fictional Seller 06', path: '/seller/106', symbol: 'person' },
      { label: 'Fictional Seller 07', path: '/seller/107', symbol: 'person' }
    ] }
  ],
  reports: [
    { group: 'OVERVIEW', items: [{ label: 'All Reports', path: '/reports', symbol: 'reports' }] },
    { group: 'PLANNING & REVIEWS', items: [
      { label: 'Manage Dashboards', path: '/reports/dashboards', symbol: 'check' },
      { label: 'Initiative Tracker', path: '/reports/initiative-tracker', symbol: 'grid' },
      { label: '1:1 Report', path: '/reports/one-on-one', symbol: 'chat' },
      { label: 'Connect Impact', path: '/reports/connect-impact', symbol: 'target' }
    ] },
    { group: 'EXECUTION & COVERAGE', items: [
      { label: 'U2C Attainment', path: '/reports/u2c', symbol: 'target' },
      { label: 'Milestone Tracker', path: '/reports/milestone-tracker', symbol: 'flag' },
      { label: 'Activity Coverage', path: '/reports/activity-coverage', symbol: 'calendar' },
      { label: 'Whitespace Analysis', path: '/reports/whitespace', symbol: 'grid' }
    ] },
    { group: 'PIPELINE HEALTH', items: [
      { label: 'Hygiene Report', path: '/reports/hygiene', symbol: 'link' },
      { label: 'MSX Workspace', path: '/reports/msx-workspace', symbol: 'grid' },
      { label: "What's New", path: '/reports/whats-new', symbol: 'notes' }
    ] },
    { group: 'ACCOUNT INSIGHTS', items: [
      { label: 'Revenue Analyzer', path: '/reports/revenue', symbol: 'reports' },
      { label: 'Workload Report', path: '/reports/workload', symbol: 'tag' },
      { label: 'Marketing Insights', path: '/reports/marketing-insights', symbol: 'reports' },
      { label: 'Synapse Customers', path: '/reports/synapse-customers', symbol: 'database' }
    ] }
  ],
  browse: [
    { group: 'PEOPLE & ACCOUNTS', items: [
      { label: 'Customers', path: '/customers', symbol: 'building' },
      { label: 'Partners', path: '/partners', symbol: 'folder' },
      { label: 'Solution Engineers', path: '/solution-engineers', symbol: 'settings' },
      { label: 'Internal Contacts', path: '/internal-contacts', symbol: 'person' }
    ] },
    { group: 'WORK', items: [
      { label: 'Notes', path: '/notes', symbol: 'notes' },
      { label: 'Engagements & Projects', path: '/engagements', symbol: 'folder' },
      { label: 'Action Items', path: '/action-items', symbol: 'check' },
      { label: 'Opportunities', path: '/reports/msx-workspace?tab=opps', symbol: 'folder' },
      { label: 'Milestones', path: '/reports/milestone-tracker', symbol: 'flag' }
    ] },
    { group: 'ORGANIZATION', items: [
      { label: 'Territories', path: '/territories', symbol: 'building' },
      { label: 'PODs', path: '/pods', symbol: 'people' },
      { label: 'Topics', path: '/topics', symbol: 'tag' },
      { label: 'Products', path: '/products', symbol: 'grid' },
      { label: 'Revenue Import', path: '/revenue/import', symbol: 'database' },
      { label: 'Connect Export', path: '/connect-export', symbol: 'notes' }
    ] },
    { group: 'EXPLORE', items: [
      { label: 'Search', path: '/search', symbol: 'search' },
      { label: 'Analytics', path: '/analytics', symbol: 'reports' }
    ] }
  ]
};
