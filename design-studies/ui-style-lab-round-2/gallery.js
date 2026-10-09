document.querySelector('#study-grid').innerHTML = studies.map((study) => `
  <article class="study-card">
    <a class="study-image" href="preview.html?style=${study.id}" aria-label="Open ${study.name}">
      <img src="${study.id}.png" alt="${study.name} desktop mockup" width="1488" height="1247">
    </a>
    <div class="study-copy">
      <p class="eyebrow">${study.number} / ${study.idea.toUpperCase()}</p>
      <div class="study-title"><h2><a href="preview.html?style=${study.id}">${study.name}</a></h2><span>${study.verdict}</span></div>
      <p>${study.description}</p>
      <p class="distinction">${study.distinction}</p>
    </div>
  </article>
`).join('');
