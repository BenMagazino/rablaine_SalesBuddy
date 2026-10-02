const themeFamilies = [
  { family: 'graphite', name: 'Graphite', number: '01', tone: 'Default / blue graphite',
    description: 'The approved Graphite / Muted dark workspace, paired with a cool, soft-white equivalent.',
    distinction: 'Default choice. Dark mode preserves the approved colors exactly; light mode translates the same hierarchy without a white glare or washed-out status markers.' },
  { family: 'midnight', name: 'Midnight', number: '02', tone: 'Navy / cool porcelain',
    description: 'Deeper navy surfaces at night, pale blue porcelain by day. The familiar muted-blue controls remain.',
    distinction: 'For users who prefer a more distinctly blue workspace. Both modes keep clear pane boundaries without increasing visual noise.' },
  { family: 'harbor', name: 'Harbor', number: '03', tone: 'Petrol / sea glass',
    description: 'Muted petrol surfaces and restrained ocean-blue controls, paired with a pale sea-glass light mode.',
    distinction: 'Draws on the teal center of the logo without turning the interface neon. Customer colors and work statuses keep their independent meaning.' },
  { family: 'carbon', name: 'Carbon', number: '04', tone: 'Warm charcoal / soft paper',
    description: 'Warm charcoal with blue controls, paired with soft paper surfaces instead of stark white.',
    distinction: 'A warmer alternative, not a sepia filter. The logo and blue interaction language stay intact while the surrounding neutrals feel less cool.' }
];
const themes = themeFamilies.flatMap((family) => ['dark', 'light'].map((mode) => ({
  ...family,
  id: `${family.family}-${mode}`,
  palette: 'graphite-blue',
  control: 'muted',
  mode,
  name: `${family.name} / ${mode === 'dark' ? 'Dark' : 'Light'}`,
  shortName: `${family.name} ${mode === 'dark' ? 'D' : 'L'}`
})));
