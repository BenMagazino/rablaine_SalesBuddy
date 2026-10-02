let screenshotState = 'workspace';

function previewUrl(theme, menu = null) {
  return `preview.html?theme=${theme}${menu ? `&menu=${menu}` : ''}`;
}

document.querySelector('#study-grid').innerHTML = themes.map((theme) => `
  <article class="study-card">
    <a class="study-image" href="${previewUrl(theme.id)}" aria-label="Try ${theme.name}">
      <img src="${theme.id}.png" alt="${theme.name} workspace" data-theme-id="${theme.id}" width="1587" height="1087">
    </a>
    <div class="study-copy">
      <p class="eyebrow">${theme.number} / ${theme.tone.toUpperCase()}</p>
      <div class="study-title"><h2><a href="${previewUrl(theme.id)}">${theme.name}</a></h2></div>
      <p>${theme.description}</p>
      <div class="theme-swatches" data-theme="${theme.palette}" data-note-surface="${theme.surface}" aria-label="${theme.name} note surface and status rails">${['note-fill', 'plain-rail', 'milestone-rail', 'task-rail', 'hva-rail'].map((token) => `<span class="theme-swatch" style="background:var(--${token})" title="${token}"></span>`).join('')}</div>
      <p class="distinction">${theme.distinction}</p>
      <a class="open-menu-link" href="${previewUrl(theme.id, 'reports')}" data-theme-id="${theme.id}">Open with Reports menu</a>
    </div>
  </article>
`).join('');

document.querySelectorAll('[data-state]').forEach((button) => {
  button.addEventListener('click', () => {
    screenshotState = button.dataset.state;
    const menu = screenshotState === 'workspace' ? null : screenshotState;
    document.querySelectorAll('[data-state]').forEach((control) => {
      control.setAttribute('aria-pressed', String(control === button));
    });
    document.querySelectorAll('.study-image img').forEach((image) => {
      image.src = `${image.dataset.themeId}${menu ? `-${menu}` : ''}.png`;
      image.alt = `${themes.find((theme) => theme.id === image.dataset.themeId).name}, ${menu ? `${menu} flyout open` : 'workspace'}`;
      image.closest('a').href = previewUrl(image.dataset.themeId, menu);
    });
    document.querySelectorAll('.open-menu-link').forEach((link) => {
      link.href = previewUrl(link.dataset.themeId, menu || 'reports');
      link.textContent = `Open with ${menu === 'browse' ? 'Browse' : 'Reports'} menu`;
    });
  });
});
