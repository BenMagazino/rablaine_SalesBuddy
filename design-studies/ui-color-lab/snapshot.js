/* Entirely fictional offline fixture. No customer records. */
const snapshot = {
  "date": "Tuesday, April 29, 2031",
  "tasks": [
    {
      "title": "Review the sample renewal checklist",
      "customer": "Fictional Customer 01",
      "kind": "Project task"
    },
    {
      "title": "Prototype a support assistant in Teams",
      "customer": "Fictional Customer 02",
      "kind": "No milestone linked"
    },
    {
      "title": "Plan the analytics discovery workshop",
      "customer": "Fictional Customer 03",
      "kind": "No milestone linked"
    },
    {
      "title": "Assess a sample database migration",
      "customer": "Fictional Customer 04",
      "kind": "No milestone linked"
    },
    {
      "title": "Review database lifecycle options",
      "customer": "Fictional Customer 05",
      "kind": "No milestone linked"
    },
    {
      "title": "Explore a reporting platform pilot",
      "customer": "Fictional Customer 06",
      "kind": "No milestone linked"
    },
    {
      "title": "Draft the lakehouse onboarding plan",
      "customer": "Fictional Customer 07",
      "kind": "No milestone linked"
    },
    {
      "title": "Test a sample knowledge-search assistant",
      "customer": "Fictional Customer 08",
      "kind": "No milestone linked"
    }
  ],
  "milestones": [
    {
      "title": "Analytics workspace pilot",
      "customer": "Fictional Customer 09",
      "workload": "Azure Databricks",
      "due": "May 02",
      "value": "$1,250/mo"
    },
    {
      "title": "Reporting proof of concept",
      "customer": "Fictional Customer 03",
      "workload": "Fabric - P2F, PBI Compete, Copilot",
      "due": "May 02",
      "value": "$2,000/mo"
    },
    {
      "title": "Lakehouse foundation workshop",
      "customer": "Fictional Customer 10",
      "workload": "Fabric - Lakehouse, Warehouse",
      "due": "May 02",
      "value": "$2,750/mo"
    },
    {
      "title": "Document-search prototype",
      "customer": "Fictional Customer 11",
      "workload": "Foundry IQ and Search",
      "due": "May 02",
      "value": "$3,500/mo"
    },
    {
      "title": "Warehouse modeling pilot",
      "customer": "Fictional Customer 11",
      "workload": "Fabric - Lakehouse, Warehouse",
      "due": "May 02",
      "value": "$4,250/mo"
    },
    {
      "title": "Assistant evaluation checkpoint",
      "customer": "Fictional Customer 11",
      "workload": "OpenAI Models (Standard)",
      "due": "May 02",
      "value": "$5,000/mo"
    },
    {
      "title": "Database migration rehearsal",
      "customer": "Fictional Customer 12",
      "workload": "SQL On-prem to SQL MI (PaaS)",
      "due": "May 14",
      "value": "$5,750/mo"
    }
  ],
  "alerts": [
    {
      "title": "Fictional Customer 13",
      "customer": "Sample database review (illustrative)",
      "kind": "Declining",
      "value": "$1,850"
    },
    {
      "title": "Fictional Customer 14",
      "customer": "Sample database review (illustrative)",
      "kind": "Volatile",
      "value": "$2,450"
    }
  ],
  "events": [
    {
      "day": 1,
      "time": "9:15 AM",
      "customer": "Fictional Customer 15",
      "kind": "Ghost meeting"
    },
    {
      "day": 2,
      "time": "10:45 AM",
      "customer": "Fictional Customer 05",
      "kind": "Ghost meeting"
    },
    {
      "day": 2,
      "time": "11:15 AM",
      "customer": "Fictional Customer 11",
      "kind": "Ghost meeting"
    },
    {
      "day": 8,
      "time": "9:45 AM",
      "customer": "Fictional Customer 15",
      "kind": "Ghost meeting"
    },
    {
      "day": 9,
      "time": "10:15 AM",
      "customer": "Fictional Customer 05",
      "kind": "Note",
      "has_engagement": true
    },
    {
      "day": 11,
      "time": "11:45 AM",
      "customer": "Fictional Customer 16",
      "kind": "Ghost meeting"
    },
    {
      "day": 18,
      "time": "9:15 AM",
      "customer": "Fictional Customer 03",
      "kind": "Ghost meeting"
    },
    {
      "day": 21,
      "time": "10:45 AM",
      "customer": "Fictional Customer 17",
      "kind": "Note",
      "has_milestone": true,
      "has_engagement": true
    },
    {
      "day": 21,
      "time": "11:15 AM",
      "customer": "Fictional Customer 18",
      "kind": "Note",
      "has_engagement": true
    },
    {
      "day": 21,
      "time": "9:45 AM",
      "customer": "Fictional Customer 06",
      "kind": "Note",
      "has_engagement": true
    },
    {
      "day": 22,
      "time": "10:15 AM",
      "customer": "Fictional Customer 04",
      "kind": "Note",
      "has_task": true,
      "has_engagement": true
    },
    {
      "day": 22,
      "time": "11:45 AM",
      "customer": "Fictional Customer 07",
      "kind": "Note",
      "has_task": true,
      "has_hva": true,
      "has_engagement": true
    },
    {
      "day": 22,
      "time": "9:15 AM",
      "customer": "Fictional Customer 19",
      "kind": "Ghost meeting"
    },
    {
      "day": 23,
      "time": "10:45 AM",
      "customer": "Fictional Customer 20",
      "kind": "Ghost meeting",
      "unmatched": true
    },
    {
      "day": 24,
      "time": "11:15 AM",
      "customer": "Fictional Customer 21",
      "kind": "Note"
    },
    {
      "day": 24,
      "time": "9:45 AM",
      "customer": "Fictional Customer 04",
      "kind": "Ghost meeting"
    },
    {
      "day": 24,
      "time": "10:15 AM",
      "customer": "Fictional Customer 22",
      "kind": "Ghost meeting",
      "unmatched": true
    },
    {
      "day": 30,
      "time": "11:45 AM",
      "customer": "Fictional Customer 23",
      "kind": "Ghost meeting"
    }
  ],
  "engagementCount": 24,
  "projectCount": 3
};

const concepts = [
  { id: 'workbench', name: 'Workbench', kicker: '01 / THE DEVELOPER TOOL', tone: 'Dark, focused, architectural',
    summary: 'A graphite workspace with an activity rail, quiet status bar, and precise pane boundaries. The closest to the VS Code feeling, without dressing a CRM up as a code editor.',
    tradeoff: 'Best for long sessions and keyboard-first habits. Deliberately less airy.',
    recommendation: 'Closest to your brief' },
  { id: 'fluent', name: 'Fluent Workspace', kicker: '02 / THE NATIVE FEEL', tone: 'Light, familiar, understated',
    summary: 'A Windows-native direction: a stable navigation sidebar, soft neutral canvas, controlled blue accents, and an attention queue beside the calendar. Clean without being sterile.',
    tradeoff: 'The safest whole-app foundation. More space per item than Workbench.',
    recommendation: 'Best all-around foundation' },
  { id: 'editorial', name: 'Field Notes', kicker: '03 / THE QUIET NOTEBOOK', tone: 'Warm, considered, typographic',
    summary: 'A restrained editorial workspace with a notebook-like rhythm, ink-blue actions, and typography doing the organizing instead of boxes. Professional does not have to mean gray.',
    tradeoff: 'Best for a calmer personal tool. Less like a conventional enterprise console.',
    recommendation: 'Most distinctive without rebranding' },
  { id: 'operations', name: 'Operations', kicker: '04 / THE HIGH-DENSITY CONSOLE', tone: 'Exact, compact, utilitarian',
    summary: 'An instrument-panel approach: fictional milestone rows, right-aligned values, explicit risk states, and a chronological activity ledger. Built for scanning, not admiring cards.',
    tradeoff: 'Best for a large portfolio. Higher density asks for more visual attention.',
    recommendation: 'Best for maximum information' },
  { id: 'studio', name: 'Calendar Studio', kicker: '05 / THE TIME-FIRST WORKSPACE', tone: 'Spacious, structured, purposeful',
    summary: 'The calendar becomes the main workspace, with action items and deadlines in a single side dock. A dark masthead gives it a strong silhouette without turning the entire app dark.',
    tradeoff: 'Best if your day starts with calls and notes. Milestones are secondary, not hidden.',
    recommendation: 'Best for the daily call workflow' },
  { id: 'lcars', name: 'LCARS / Sales Command', kicker: '06 / THE OFF-DUTY EXPERIMENT', tone: 'Starship operations, obviously',
    summary: 'An original LCARS-inspired experiment: sweeping elbows, segmented control strips, warm peach, lilac, and orange. Your pipeline is now a matter of shipboard efficiency.',
    tradeoff: 'For amusement first. No claim that this is the sensible production choice.',
    recommendation: 'Captain-approved diversion' }
];
