document.querySelector('#concept-grid').innerHTML = concepts.map((concept) => `
  <article class="concept-card">
    <a class="concept-preview" href="preview.html?style=${concept.id}" aria-label="Open ${concept.name} full-size">
      <img src="${concept.id}.png" alt="${concept.name} rendered desktop mockup" loading="lazy" width="1488" height="1247">
    </a>
    <p class="eyebrow">${concept.kicker}</p>
    <div class="concept-title"><h2><a href="preview.html?style=${concept.id}">${concept.name}</a></h2><span>${concept.recommendation}</span></div>
    <p class="tone">${concept.tone}</p>
    <p class="description">${concept.summary}</p>
    <p class="tradeoff">${concept.tradeoff}</p>
  </article>
`).join('');
