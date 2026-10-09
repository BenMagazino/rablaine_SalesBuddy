// File previews and the packaged renderer use the same state presentation.
(() => {
  'use strict';
  const root = document.documentElement;
  const params = new URLSearchParams(location.search);
  const states = {
    starting: ['Starting Sales Buddy', 'Waiting for the local backend. This window will open automatically.', 'Starting', 'Checking the local backend automatically'],
    slow: ['Starting Sales Buddy', 'Startup is taking longer than usual. Retrying automatically. Help > Open Logs Folder has details.', 'Still starting', 'Readiness checks continue; no restart needed'],
    reconnecting: ['Reconnecting to Sales Buddy', 'The local backend is unavailable. Retrying automatically. Help > Open Logs Folder has details.', 'Reconnecting', 'Your original page will reopen when the backend is ready'],
    updating: ['Updating Sales Buddy', 'Pulling the latest version. The app will restart automatically.', 'Updating', 'Update in progress; please keep the app open'],
    building: ['Building the desktop app', 'Applying a desktop-app update. This takes a minute or two, then Sales Buddy restarts itself.', 'Building', 'Building the desktop shell before restarting'],
  };
  const requested = params.get('state');
  if (states[requested]) {
    document.body.dataset.state = requested;
    document.getElementById('status-title').textContent = states[requested][0];
    document.getElementById('status-description').textContent = states[requested][1];
  }
  const state = document.body.dataset.state;
  const content = states[state] || states.starting;
  const mode = params.get('mode');
  const family = params.get('family');
  if (['dark', 'light'].includes(mode)) root.dataset.sbMode = mode;
  if (['graphite', 'midnight', 'harbor', 'carbon'].includes(family)) root.dataset.sbFamily = family;
  document.getElementById('status-label').textContent = `Local app / ${content[2]}`;
  document.getElementById('status-detail').textContent = content[3];
  document.querySelector('[role="progressbar"]').setAttribute('aria-label', content[2]);
  const updating = ['updating', 'building'].includes(state);
  if (updating) {
    document.getElementById('status-footer').textContent = 'Sales Buddy restarts automatically when this finishes';
    document.querySelector('.shell-help p').textContent = 'Keep Sales Buddy open until it restarts. Help > Open Logs Folder contains update details. If an update fails, the desktop app reports the error and recovers the current version.';
  }
})();
