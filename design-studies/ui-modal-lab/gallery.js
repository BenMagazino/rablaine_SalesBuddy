let screenshotState = 'milestone';
const modalStates = ['action', 'milestone', 'note'];

function previewUrl(theme, state = screenshotState) {
  const query = state === 'workspace' ? '' :
    `&${modalStates.includes(state) ? 'modal' : 'menu'}=${state}`;
  return `preview.html?theme=${theme}${query}`;
}

document.querySelector('#study-grid').innerHTML = themes.map((theme) => `
  ${theme.mode === 'dark' ? `<header class="pair-heading"><p class="eyebrow">${theme.number} / ${theme.tone.toUpperCase()}</p><h2>${theme.family === 'graphite' ? 'Graphite - default' : theme.name.split(' / ')[0]}</h2></header>` : ''}
  <article class="study-card">
    <a class="study-image" href="${previewUrl(theme.id)}" aria-label="Try ${theme.name} modals">
      <img src="${theme.id}-milestone.png" alt="${theme.name} milestone modal" data-theme-id="${theme.id}" width="1587" height="1087">
    </a>
    <div class="study-copy">
      <div class="study-title"><h2><a href="${previewUrl(theme.id)}">${theme.name}</a></h2></div>
      <p>The same centered modal system in ${theme.name.toLowerCase()}: a restrained title bar, readable body, and quiet footer actions.</p>
      <a class="open-menu-link" href="${previewUrl(theme.id, 'action')}" data-theme-id="${theme.id}">Try the action item modal and its editor</a>
    </div>
  </article>
`).join('');

document.querySelectorAll('[data-state]').forEach((button) => {
  button.addEventListener('click', () => {
    screenshotState = button.dataset.state;
    document.querySelectorAll('[data-state]').forEach((control) => {
      control.setAttribute('aria-pressed', String(control === button));
    });
    document.querySelectorAll('.study-image img').forEach((image) => {
      image.src = `${image.dataset.themeId}${screenshotState === 'workspace' ? '' : `-${screenshotState}`}.png`;
      image.alt = `${themes.find(theme => theme.id === image.dataset.themeId).name}, ${screenshotState} preview`;
      image.closest('a').href = previewUrl(image.dataset.themeId);
      image.closest('.study-card').querySelector('.study-title a').href =
        previewUrl(image.dataset.themeId);
    });
  });
});
