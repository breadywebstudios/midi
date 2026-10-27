const grid = document.getElementById("product-grid");
document.getElementById("year").textContent = new Date().getFullYear();
fetch("/api/products")
  .then(r => r.json())
  .then(products => {
    if (!products.length) { grid.innerHTML = '<p class="loading">No songs yet.</p>'; return; }
    grid.innerHTML = products.map(p =>
      '<a class="card" href="/song.html?id=' + p.id + '">' +
        '<h2>' + p.title + '</h2>' +
        '<p class="artist">by ' + p.artist + '</p>' +
        '<p class="card-prices">' +
          '<span>Free preview</span>' +
          '<span>$' + (p.tiers.chorus.price / 100).toFixed(2) + ' chorus</span>' +
          '<span>$' + (p.tiers.full.price / 100).toFixed(2) + ' full</span>' +
        '</p>' +
        '<span class="card-cta">View tutorial &amp; download &rarr;</span>' +
      '</a>'
    ).join("");
  })
  .catch(() => { grid.innerHTML = '<p class="error">Could not load songs.</p>'; });