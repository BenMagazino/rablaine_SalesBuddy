const galleryStudies = [studies[0], studies[3], studies[1], studies[4], studies[2], studies[5]];
let screenshotState = 'workspace';

document.querySelector('#study-grid').innerHTML = galleryStudies.map((study) => `
  <article class="study-card">
    <a class="study-image" href="preview.html?style=${study.id}" aria-label="Try ${study.name}">
      <img src="${study.id}.png" alt="${study.name} connected workspace" data-style="${study.id}" width="1587" height="1080">
    </a>
    <div class="study-copy">
      <p class="eyebrow">${study.number} / ${study.idea.toUpperCase()}</p>
      <div class="study-title"><h2><a href="preview.html?style=${study.id}">${study.name}</a></h2><span>${study.verdict}</span></div>
      <p>${study.description}</p>
      <p class="distinction">${study.distinction}</p>
      <a class="open-menu-link" href="preview.html?style=${study.id}&menu=reports">Open with Reports menu</a>
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
      image.src = `${image.dataset.style}${screenshotState === 'workspace' ? '' : `-${screenshotState}`}.png`;
      image.alt = `${studies.find((study) => study.id === image.dataset.style).name}, ${screenshotState === 'workspace' ? 'workspace' : screenshotState + ' flyout open'}`;
      image.closest('a').href = `preview.html?style=${image.dataset.style}${screenshotState === 'workspace' ? '' : `&menu=${screenshotState}`}`;
    });
    document.querySelectorAll('.open-menu-link').forEach((link, index) => {
      const menu = screenshotState === 'workspace' ? 'reports' : screenshotState;
      link.href = `preview.html?style=${galleryStudies[index].id}&menu=${menu}`;
      link.textContent = `Open with ${menu === 'reports' ? 'Reports' : 'Browse'} menu`;
    });
  });
});
