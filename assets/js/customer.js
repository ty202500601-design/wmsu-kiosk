/* Customer / student kiosk pages — Zero-CLS SWR rendering, pre-decoded LQIP reveals, fixed non-swapping hero, surgical cart updates */
const C = PAGES.customer, FOODS = {};
const myOrders = () => store.get('myOrders', []).filter(x => x && x.no);
const curV = () => +(qs.get('vendor') || qs.get('v') || store.get('vendorId') || 0);
const PAYS = { cash: ['cash-coin', 'Cash at Counter'], gcash: ['qr-code-scan', 'GCash'] };
const head = (t, s = '') => `<div class="page-header mb-4"><h1 id="page-title" tabindex="-1" class="page-title">${t}</h1>${s ? `<p class="text-muted mb-0">${s}</p>` : ''}</div>`;

const defaultRating = id => +(4.5 + ((id * 7) % 5) * 0.1).toFixed(1);
const defaultPrep = id => `${8 + ((id * 3) % 7)}–${13 + ((id * 3) % 7)} min`;

/* Shared search helpers */
const hl = (t, q) => {
  t = String(t ?? '');
  if (!q) return esc(t);
  const i = t.toLowerCase().indexOf(q);
  return i < 0 ? esc(t) : esc(t.slice(0, i)) + '<mark class="hl">' + esc(t.slice(i, i + q.length)) + '</mark>' + esc(t.slice(i + q.length));
};
const searchBox = (id, ph) => `<div class="search-box"><label for="${id}" class="visually-hidden">${esc(ph)}</label><i class="bi bi-search search-ico" aria-hidden="true"></i><input id="${id}" type="search" class="search-input" placeholder="${esc(ph)}" autocomplete="off" spellcheck="false"><button type="button" class="search-clear" id="${id}Clear" aria-label="Clear search" hidden><i class="bi bi-x-lg" aria-hidden="true"></i></button><kbd class="search-kbd d-none d-md-inline" aria-hidden="true">/</kbd></div>`;
const bindSearch = (id, onChange) => {
  const inp = $('#' + id), clr = $('#' + id + 'Clear'); if (!inp || !clr) return () => {};
  let t;
  const apply = () => { clr.hidden = !inp.value; onChange(inp.value.toLowerCase().trim()) };
  inp.addEventListener('input', () => { clearTimeout(t); clr.hidden = !inp.value; t = setTimeout(apply, 140) });
  clr.onclick = () => { inp.value = ''; apply(); inp.focus() };
  inp.addEventListener('keydown', e => { if (e.key === 'Escape' && inp.value) { inp.value = ''; apply() } });
  document.onkeydown = e => { if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '') && !document.querySelector('.modal.show, dialog[open]')) { e.preventDefault(); inp.focus() } };
  return () => { inp.value = ''; apply() };
};

/* Render order item list with real 480px thumb_path thumbnails (or neutral fallback) */
const orderItemsThumbsHtml = items => `<div class="order-item-chips">${items.map(i => `
  <span class="order-item-chip">
    ${dishThumbHtml(i)}
    <span><strong>${i.qty}×</strong> ${esc(i.name)}</span>
  </span>`).join('')}</div>`;

function compressProofImage(file, maxDim = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width: w, height: h } = img;
      if (w > maxDim || h > maxDim) {
        const ratio = Math.min(maxDim / w, maxDim / h);
        w = Math.max(1, Math.round(w * ratio));
        h = Math.max(1, Math.round(h * ratio));
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error('Could not process screenshot image.'));
        blob.name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
        resolve({ blob, previewUrl: URL.createObjectURL(blob) });
      }, 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Selected file is not a valid image.')) };
    img.src = url;
  });
}

function getStallOrderCode(vid, stallName) {
  const key = 'wmsu_gcash_codes';
  let map = {};
  try { map = JSON.parse(sessionStorage.getItem(key) || '{}') } catch {}
  if (!map[vid]) {
    const pfx = String(stallName || 'WM').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'WMS';
    const rnd = Array.from(crypto.getRandomValues(new Uint8Array(3)), b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    map[vid] = `${pfx}-${rnd}`;
    sessionStorage.setItem(key, JSON.stringify(map));
  }
  return map[vid];
}

/* Surgical dish CTA / inline stepper — updates ONLY the affected card's button/badge, never re-rendering the grid */
const dishActionHtml = f => {
  if (!f.vendorOpen) return `<span class="badge-status badge-neutral">Stall closed</span>`;
  if (!f.available) return `<button type="button" class="btn btn-light btn-sm" disabled>Sold out</button>`;
  const q = cart.qtyOf(f.id);
  return q > 0
    ? `<div class="stepper-inline" role="group" aria-label="Quantity for ${esc(f.name)}">
        <button type="button" data-act="stepDish" data-id="${f.id}" data-d="-1" aria-label="Decrease ${esc(f.name)} quantity">−</button>
        <span aria-live="polite">${q}</span>
        <button type="button" data-act="stepDish" data-id="${f.id}" data-d="1" aria-label="Increase ${esc(f.name)} quantity">+</button>
      </div>`
    : `<button type="button" class="btn btn-wmsu btn-sm px-3" data-act="addDish" data-id="${f.id}" aria-label="Add ${esc(f.name)} to cart"><i class="bi bi-plus-lg" aria-hidden="true"></i> Add</button>`;
};

function syncDishControls(id) {
  const f = FOODS[id];
  if (!f) return;
  document.querySelectorAll(`[data-dish-ctrl="${id}"]`).forEach(box => {
    box.innerHTML = `<span class="price-ink${box.closest('.special-card') ? ' fs-4' : ''}">${peso(f.price)}</span>${dishActionHtml(f)}`;
  });
}

acts.addDish = async d => { const f = FOODS[+d.id]; if (f) { await cart.add(f, 1); syncDishControls(f.id) } };
acts.stepDish = d => { const id = +d.id; cart.setQty(id, +d.d); syncDishControls(id) };
acts.addHome = acts.addDish;
acts.stepHome = acts.stepDish;
acts.quick = d => { const f = FOODS[+d.id]; if (f) { cart.add(f, 1); syncDishControls(f.id) } };

/* ===== 1. Home / Vendors Page ===== */
C.vendors = async v => {
  const cached = getCachedKiosk();
  const renderHome = async (pack, isReval = false) => {
    const { vendors: allVendors, categories: cs, foods: fs, settings } = pack;
    cart.syncMedia(fs);
    const vs = allVendors.filter(x => x.status === 'active');
    fs.forEach(f => {
      const ven = vs.find(x => x.id === f.vendorId);
      if (ven) { f.vendorName = ven.name; f.vendorOpen = ven.open; f.vendorGcash = ven.hasGcash }
      FOODS[f.id] = f;
    });

    const openCount = vs.filter(x => x.open).length;
    const openStr = fmtTime12(settings?.open || KC.campus?.defaultOpen || '07:00');
    const closeStr = fmtTime12(settings?.close || KC.campus?.defaultClose || '18:00');
    const sharedCats = cs.filter(c => c.vendorId === null || fs.some(f => f.catId === c.id));
    let q = '', onlyOpen = false, onlyGcash = false, selCat = 0, prevGridSig = '';

    const candidates = fs.filter(f => f.available && f.vendorOpen && f.price <= 500);
    const special = candidates.find(f => f.isFeatured)
      || candidates.find(f => /chicken adobo|pork sinigang|tapsilog/i.test(f.name))
      || candidates[0] || fs[0] || null;

    const heroMosaicDishes = fs.filter(f => f.thumbPath || f.imagePath).slice(0, 4);
    if (heroMosaicDishes[0]) preloadImageHead(heroMosaicDishes[0].thumbPath || heroMosaicDishes[0].imagePath);

    /* Pre-decode above-the-fold hero mosaic + first row of stall covers (~600ms cap) before revealing */
    if (!isReval) {
      const aboveUrls = [
        ...heroMosaicDishes.map(d => d.thumbPath || d.imagePath),
        ...vs.slice(0, 3).map(st => stallCoverUrl(st, fs.filter(f => f.vendorId === st.id), false))
      ];
      await predecodeUrls(aboveUrls, 600);
    }

    const liveCombos = (KC.combos || []).map(cb => {
      const matched = cb.matchNames.map(n => candidates.find(f => f.name.toLowerCase().includes(n))).filter(Boolean);
      if (matched.length < 2) return null;
      const total = matched.reduce((s, f) => s + f.price, 0);
      const stalls = [...new Set(matched.map(f => f.vendorName))];
      return { ...cb, items: matched, total, stallLabel: stalls.join(' + ') };
    }).filter(Boolean);

    const trending = [...fs]
      .filter(f => f.price <= 500)
      .sort((a, b) => (b.orderCount - a.orderCount) || (+Boolean(b.imagePath) - +Boolean(a.imagePath)) || (+b.vendorOpen - +a.vendorOpen) || a.id - b.id)
      .slice(0, 8);
    const promos = KC.promos || [];

    v.innerHTML = `
      <div class="${isReval ? '' : 'content-fade-in'}">
        <section class="canteen-hero" aria-labelledby="page-title">
          <div class="canteen-hero-grid">
            <div class="canteen-hero-body">
              <div class="hero-eyebrow">
                <span class="hero-dot" aria-hidden="true"></span>
                <span>${openCount} of ${vs.length} campus stalls open · ${esc(openStr)} – ${esc(closeStr)}</span>
              </div>
              <h1 id="page-title" tabindex="-1">Good Food, <em>Fresh From</em> Your Campus</h1>
              <p>Combine rice meals, burgers, snacks, and cold drinks from multiple WMSU stalls in one cart. Pay Cash at Counter or scan GCash QR on participating stalls.</p>
              <div class="hero-actions">
                <a href="#stalls-section" class="btn btn-warm btn-lg px-4">Order Now <i class="bi bi-arrow-right" aria-hidden="true"></i></a>
                <a href="#how-it-works" class="btn btn-hero-ghost btn-lg px-4"><i class="bi bi-play-circle" aria-hidden="true"></i> How It Works</a>
              </div>
            </div>
            ${heroMosaicDishes.length ? `
            <div class="hero-mosaic d-none d-md-grid" aria-label="Featured campus dishes">
              ${heroMosaicDishes.map((d, idx) => `<span class="lqip-frame"${lqipStyleAttr(d.avgColor, d.lqip)}><img class="smooth-img" data-smooth-img src="${esc(d.thumbPath || d.imagePath)}" alt="${esc(d.name)}" width="480" height="360" ${idx === 0 ? 'fetchpriority="high"' : ''} data-neutral-fallback="tile"></span>`).join('')}
            </div>` : ''}
          </div>
        </section>

        <section class="home-sec" aria-labelledby="catSecHeading">
          <div class="sec-head">
            <div>
              <h2 id="catSecHeading">Explore <span>Categories</span></h2>
              <p>Filter campus stalls and dishes by what you're craving today.</p>
            </div>
          </div>
          <div class="cat-tile-grid" id="catTiles"></div>
        </section>

        <section class="home-sec" id="stalls-section" aria-labelledby="stallsHeading">
          <div class="sec-head">
            <div>
              <h2 id="stallsHeading">Campus <span>Food Stalls</span></h2>
              <p>Tap any stall to browse its menu — check each stall's badge for GCash QR or Cash at Counter.</p>
            </div>
            <span class="small text-muted fw-semibold" id="vcount" aria-live="polite"></span>
          </div>
          <div class="search-bar mb-4">
            ${searchBox('vq', 'Search stalls or dishes (e.g. adobo, burger, halo-halo)…')}
            <button type="button" class="chip" id="openOnly" aria-pressed="false"><i class="bi bi-door-open" aria-hidden="true"></i> Open now</button>
            <button type="button" class="chip" id="gcashOnly" aria-pressed="false"><i class="bi bi-check-circle-fill" aria-hidden="true"></i> GCash available</button>
            <button type="button" class="btn btn-light d-none" id="clearAllFilters"><i class="bi bi-x-circle" aria-hidden="true"></i> Reset filters</button>
          </div>
          <div class="stall-grid" id="vgrid" aria-busy="false"></div>
          <div id="dishFilterResults" class="mt-4"></div>
        </section>

        ${special || liveCombos.length ? `
        <section class="home-sec" aria-labelledby="specialsHeading">
          <div class="sec-head">
            <div>
              <h2 id="specialsHeading">Today's <span>Specials &amp; Combos</span></h2>
              <p>Handpicked campus favorites and multi-item student bundles.</p>
            </div>
          </div>
          <div class="showcase-split">
            ${special ? `
            <article class="special-card" id="specialBox">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="badge-accent"><i class="bi bi-stars" aria-hidden="true"></i> Today's Special</span>
                <span class="small text-muted"><i class="bi bi-clock" aria-hidden="true"></i> ${special.prepMinutes ? `~${special.prepMinutes} min` : defaultPrep(special.id)}</span>
              </div>
              <a href="food-details.html?id=${special.id}" class="special-media">
                ${dishTileHtml(special, { full: true, sizes: '(max-width: 991px) 100vw, 480px' })}
              </a>
              <div class="small text-muted fw-semibold mb-1"><i class="bi bi-shop text-wmsu me-1" aria-hidden="true"></i>${esc(special.vendorName)}</div>
              <h3 class="h4 fw-bold mb-1"><a href="food-details.html?id=${special.id}" class="text-dark">${esc(special.name)}</a></h3>
              <p class="text-muted small mb-3 flex-grow-1">${esc(special.desc || 'Prepared fresh daily at the campus food court.')}</p>
              <div class="d-flex justify-content-between align-items-center pt-2 border-top" data-dish-ctrl="${special.id}">
                <span class="price-ink fs-4">${peso(special.price)}</span>
                ${dishActionHtml(special)}
              </div>
            </article>` : ''}
            ${liveCombos.length ? `
            <div>
              <div class="combo-grid">
                ${liveCombos.map(cb => `
                  <article class="combo-card">
                    <div class="combo-media">
                      ${comboMediaHtml(cb)}
                    </div>
                    <div class="combo-body">
                      <div class="d-flex justify-content-between align-items-center gap-1 mb-1">
                        <span class="badge-accent">${esc(cb.badge)}</span>
                        <small class="text-muted text-truncate"><i class="bi bi-shop" aria-hidden="true"></i> ${esc(cb.stallLabel)}</small>
                      </div>
                      <h3 class="h6 fw-bold mb-1">${esc(cb.title)}</h3>
                      <p class="text-muted small mb-2">${esc(cb.items.map(i => i.name).join(' + '))}</p>
                      <div class="d-flex justify-content-between align-items-center mt-auto pt-2 border-top">
                        <span class="price-ink">${peso(cb.total)}</span>
                        <button type="button" class="btn btn-outline-wmsu btn-sm" data-act="addCombo" data-cid="${esc(cb.id)}" aria-label="Add ${esc(cb.title)} combo to cart"><i class="bi bi-plus-lg" aria-hidden="true"></i> Add Combo</button>
                      </div>
                    </div>
                  </article>`).join('')}
              </div>
            </div>` : ''}
          </div>
        </section>` : ''}

        ${trending.length ? `
        <section class="home-sec" aria-labelledby="trendHeading">
          <div class="sec-head">
            <div>
              <h2 id="trendHeading">Trending <span>Dishes</span></h2>
              <p>Most ordered meals and snacks across WMSU stalls.</p>
            </div>
            <div class="d-flex gap-2">
              <button type="button" class="btn btn-light btn-sm" id="trPrev" aria-label="Scroll trending dishes left"><i class="bi bi-chevron-left" aria-hidden="true"></i></button>
              <button type="button" class="btn btn-light btn-sm" id="trNext" aria-label="Scroll trending dishes right"><i class="bi bi-chevron-right" aria-hidden="true"></i></button>
            </div>
          </div>
          <div class="trending-rail" id="trendRail">
            ${trending.map(f => {
              const r = (f.ratingAvg || defaultRating(f.id)).toFixed(1);
              return `
              <article class="trend-card">
                <a href="food-details.html?id=${f.id}" class="trend-media">
                  ${dishTileHtml(f)}
                </a>
                <div class="p-3 d-flex flex-column flex-grow-1">
                  <div class="d-flex justify-content-between align-items-center small text-muted mb-1">
                    <span class="text-truncate"><i class="bi bi-shop text-wmsu me-1" aria-hidden="true"></i>${esc(f.vendorName)}</span>
                    <span class="fw-semibold text-dark"><i class="bi bi-star-fill text-warning" aria-hidden="true"></i> ${r}</span>
                  </div>
                  <h3 class="h6 fw-bold mb-1 text-truncate"><a href="food-details.html?id=${f.id}" class="text-dark">${esc(f.name)}</a></h3>
                  <div class="small text-muted mb-2">${f.orderCount > 0 ? `<span class="text-accent fw-semibold">${f.orderCount} ordered</span> · ` : ''}${f.prepMinutes ? `~${f.prepMinutes} min` : defaultPrep(f.id)}</div>
                  <div class="d-flex justify-content-between align-items-center mt-auto pt-2 border-top" data-dish-ctrl="${f.id}">
                    <span class="price-ink">${peso(f.price)}</span>
                    ${dishActionHtml(f)}
                  </div>
                </div>
              </article>`;
            }).join('')}
          </div>
        </section>` : ''}

        <section class="home-sec how-band" id="how-it-works" aria-labelledby="howHeading">
          <div class="d-flex justify-content-between align-items-end flex-wrap gap-3">
            <div>
              <span class="badge-accent mb-2">Fast Campus Pickup</span>
              <h2 id="howHeading" class="mb-1">How Kiosk Ordering Works</h2>
              <p class="mb-0 opacity-85 small">One cart across all stalls — choose GCash QR or Cash per stall at checkout.</p>
            </div>
            <a href="tracking.html" class="btn btn-warm"><i class="bi bi-geo-alt-fill" aria-hidden="true"></i> Track Existing Order</a>
          </div>
          <ol class="how-steps" role="list">
            <li class="how-step"><div class="how-step-ico" aria-hidden="true"><i class="bi bi-basket2-fill"></i></div><h3>1. Placed</h3><p>Pick dishes across stalls, then pay Cash at Counter or scan the stall's GCash QR.</p></li>
            <li class="how-step"><div class="how-step-ico" aria-hidden="true"><i class="bi bi-fire"></i></div><h3>2. Preparing</h3><p>Once verified or accepted, each stall releases your tracking code and cooks fresh.</p></li>
            <li class="how-step"><div class="how-step-ico" aria-hidden="true"><i class="bi bi-bell-fill"></i></div><h3>3. Ready</h3><p>Watch your 6-character tracking code turn Ready for Pickup on the live tracker.</p></li>
            <li class="how-step"><div class="how-step-ico" aria-hidden="true"><i class="bi bi-bag-check-fill"></i></div><h3>4. Completed</h3><p>Show your tracking code at the stall counter and pick up your meal.</p></li>
          </ol>
        </section>

        ${promos.length ? `
        <section class="home-sec mb-2" aria-label="Canteen highlights">
          <div class="promo-grid">
            ${promos.map(p => `
              <article class="promo-card tone-${esc(p.tone || 'maroon')}">
                <div>
                  <div class="promo-eyebrow"><i class="bi bi-${esc(p.icon || 'stars')} me-1" aria-hidden="true"></i>${esc(p.eyebrow)}</div>
                  <h3>${esc(p.title)}</h3>
                  <p>${esc(p.body)}</p>
                </div>
                <div><a href="${esc(p.href || '#stalls-section')}" class="btn ${p.tone === 'warm' ? 'btn-wmsu' : 'btn-light'} btn-sm px-3">${esc(p.cta || 'Learn more')} <i class="bi bi-arrow-right" aria-hidden="true"></i></a></div>
              </article>`).join('')}
          </div>
        </section>` : ''}
      </div>`;

    let initialStallPass = !isReval;
    const draw = () => {
      $('#catTiles').innerHTML = [
        { id: 0, name: 'All Stalls', icon: '🍽️', count: `${vs.length} stalls` },
        ...sharedCats.map(c => {
          const dishCnt = fs.filter(f => f.catId === c.id).length;
          return { id: c.id, name: c.name, icon: c.icon, count: `${dishCnt} dish${dishCnt === 1 ? '' : 'es'}` };
        })
      ].map(c => `
        <button type="button" class="cat-tile" aria-pressed="${selCat === c.id}" data-act="homeCat" data-id="${c.id}">
          <span class="cat-tile-ico" aria-hidden="true">${c.icon}</span>
          <span class="cat-tile-name">${esc(c.name)}</span>
          <span class="cat-tile-sub">${esc(c.count)}</span>
        </button>`).join('');

      const hasFilters = !!(q || onlyOpen || onlyGcash || selCat);
      $('#clearAllFilters').classList.toggle('d-none', !hasFilters);

      const stallFoods = vid => fs.filter(f => f.vendorId === vid);
      const filteredStalls = vs.filter(x => {
        if (onlyOpen && !x.open) return false;
        if (onlyGcash && !x.hasGcash) return false;
        const myF = stallFoods(x.id);
        if (selCat && !myF.some(f => f.catId === selCat)) return false;
        if (q) {
          const matchStall = x.name.toLowerCase().includes(q) || x.desc.toLowerCase().includes(q);
          const matchDish = myF.some(f => f.name.toLowerCase().includes(q) || f.desc.toLowerCase().includes(q));
          if (!matchStall && !matchDish) return false;
        }
        return true;
      });

      $('#vcount').textContent = hasFilters
        ? `Showing ${filteredStalls.length} of ${vs.length} stalls`
        : `${vs.length} campus stalls (${openCount} open now)`;

      const nextSig = `${q}|${onlyOpen}|${onlyGcash}|${selCat}|` + filteredStalls.map(s => `${s.id}:${s.open}:${s.hasGcash}`).join(',');
      if (nextSig !== prevGridSig) {
        prevGridSig = nextSig;
        $('#vgrid').innerHTML = filteredStalls.length ? filteredStalls.map((x, idx) => {
          const myF = stallFoods(x.id);
          const catNames = [...new Set(myF.map(f => f.catName).filter(Boolean))].slice(0, 3);
          const cov = stallCoverMeta(x, myF, false);
          const rating = (x.ratingAvg || defaultRating(x.id)).toFixed(1);
          const prep = defaultPrep(x.id);
          const openAt = x.openTime ? fmtTime12(x.openTime) : '8:00 AM';
          const minP = myF.length ? Math.min(...myF.map(f => f.price)) : null;
          const above = idx < 3;
          const staggerCls = initialStallPass ? ' stagger-card' : '';
          const staggerStyle = initialStallPass ? ` style="--stagger-i:${Math.min(idx, 7)}"` : '';
          return `
            <article class="stall-card ${x.open ? '' : 'is-closed'}${staggerCls}"${staggerStyle}>
              <div class="stall-cover">
                ${cov.url
                  ? `<span class="lqip-frame ratio-16x9"${lqipStyleAttr(cov.avgColor, cov.lqip)}><img class="stall-cover-img smooth-img" data-smooth-img src="${esc(cov.url)}" alt="${esc(x.name)} stall cover" width="480" height="270" ${above ? '' : 'loading="lazy" decoding="async"'} data-neutral-fallback="cover"></span>`
                  : `<div class="stall-neutral-cover" aria-hidden="true"><i class="bi bi-shop-window"></i></div>`}
                <div class="stall-cover-badges">
                  <div class="stall-cover-left">
                    ${x.open
                      ? `<span class="badge-status badge-success">Open now</span>`
                      : `<span class="stall-closed-ribbon"><i class="bi bi-clock-history me-1" aria-hidden="true"></i>Closed · Opens at ${esc(openAt)}</span>`}
                    ${gcashBadgeHtml(x.hasGcash)}
                  </div>
                  <span class="stall-rating-pill"><i class="bi bi-star-fill" aria-hidden="true"></i> ${rating}</span>
                </div>
              </div>
              <div class="stall-body">
                <div class="stall-head-row">
                  <div class="stall-avatar" aria-hidden="true">
                    ${x.logo ? `<img src="${esc(x.logo)}" width="54" height="54" alt="">` : esc(stallInitials(x.name))}
                  </div>
                  <h3 class="stall-title text-truncate">
                    <a class="card-link" href="menu.html?vendor=${x.id}" aria-label="View menu for ${esc(x.name)}, ${x.hasGcash ? 'GCash available' : 'Cash only'}">${hl(x.name, q)}</a>
                  </h3>
                </div>
                <p class="stall-desc">${hl(x.desc, q)}</p>
                <div class="stall-meta-row">
                  <span><i class="bi bi-clock text-wmsu" aria-hidden="true"></i> ${prep}</span>
                  <span><i class="bi bi-journal-text text-wmsu" aria-hidden="true"></i> ${myF.length} dish${myF.length === 1 ? '' : 'es'}</span>
                  ${minP !== null ? `<span>From <strong class="text-dark">${peso(minP)}</strong></span>` : ''}
                </div>
                <div class="stall-tags">
                  ${catNames.length ? catNames.map(cn => `<span class="stall-tag">${esc(cn)}</span>`).join('') : '<span class="stall-tag">Campus Specials</span>'}
                </div>
              </div>
            </article>`;
        }).join('') : empty('search', q ? `No stalls match “${esc(q)}”.` : 'No stalls match the selected filters.', `<button type="button" class="btn btn-wmsu mt-2" data-act="vClear"><i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i> Clear filters</button>`);
        initialStallPass = false;
        hydrateSmoothImages($('#vgrid'));
      }

      const dishBox = $('#dishFilterResults');
      if (selCat || q) {
        const matchedDishes = fs.filter(f => {
          if (onlyOpen && !f.vendorOpen) return false;
          if (onlyGcash && !f.vendorGcash) return false;
          if (selCat && f.catId !== selCat) return false;
          if (q && !f.name.toLowerCase().includes(q) && !f.desc.toLowerCase().includes(q) && !f.catName.toLowerCase().includes(q)) return false;
          return true;
        }).slice(0, 8);
        dishBox.innerHTML = matchedDishes.length ? `
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h3 class="h5 fw-bold mb-0">Matching Dishes (${matchedDishes.length})</h3>
          </div>
          <div class="combo-grid">
            ${matchedDishes.map(f => `
              <article class="combo-card">
                <a href="food-details.html?id=${f.id}" class="combo-media">
                  ${dishTileHtml(f)}
                </a>
                <div class="combo-body">
                  <small class="text-muted mb-1"><i class="bi bi-shop text-wmsu me-1" aria-hidden="true"></i>${esc(f.vendorName)}</small>
                  <h4 class="h6 fw-bold mb-1"><a href="food-details.html?id=${f.id}" class="text-dark">${hl(f.name, q)}</a></h4>
                  <div class="d-flex justify-content-between align-items-center mt-auto pt-2 border-top" data-dish-ctrl="${f.id}">
                    <span class="price-ink">${peso(f.price)}</span>
                    ${dishActionHtml(f)}
                  </div>
                </div>
              </article>`).join('')}
          </div>` : '';
        hydrateSmoothImages(dishBox);
      } else {
        dishBox.innerHTML = '';
      }
    };

    const resetSearch = bindSearch('vq', s => { q = s; draw() });
    $('#openOnly').onclick = e => {
      onlyOpen = !onlyOpen;
      e.currentTarget.setAttribute('aria-pressed', String(onlyOpen));
      draw();
    };
    $('#gcashOnly').onclick = e => {
      onlyGcash = !onlyGcash;
      e.currentTarget.setAttribute('aria-pressed', String(onlyGcash));
      draw();
    };
    const clearAll = () => {
      onlyOpen = false; onlyGcash = false; selCat = 0;
      $('#openOnly').setAttribute('aria-pressed', 'false');
      $('#gcashOnly').setAttribute('aria-pressed', 'false');
      resetSearch();
    };
    $('#clearAllFilters').onclick = clearAll;
    acts.vClear = clearAll;
    acts.homeCat = d => { selCat = selCat === +d.id ? 0 : +d.id; draw() };
    acts.addCombo = d => {
      const cb = liveCombos.find(x => x.id === d.cid);
      if (cb) { cart.addMany(cb.items, cb.title); cb.items.forEach(i => syncDishControls(i.id)) }
    };

    const rail = $('#trendRail');
    if (rail) {
      $('#trPrev').onclick = () => rail.scrollBy({ left: -290, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      $('#trNext').onclick = () => rail.scrollBy({ left: 290, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
    draw();
    hydrateSmoothImages(v);
  };

  if (cached) {
    await renderHome(cached, false);
    API.kioskData({ force: true }).then(fresh => {
      if (B.page === 'vendors' && fresh.sig !== cached.sig && !$('#vq')?.value) {
        renderHome(fresh, true);
      }
    }).catch(() => {});
  } else {
    const fresh = await API.kioskData();
    await renderHome(fresh, false);
  }
};

acts.pickV = d => { store.set('vendorId', +d.id); location = 'menu.html?vendor=' + d.id };

/* ===== 2. Menu Page — Non-Swapping Cached Hero + Pre-Decoded Staggered Grid ===== */
C.menu = async v => {
  const vid = curV(); if (!vid) return location = 'vendors.html';
  store.set('vendorId', vid);

  const heroBannerHtml = (ven, heroCover) => {
    const payLine = ven.hasGcash
      ? 'Pay with GCash or cash at the counter.'
      : 'This stall accepts cash at the counter only.';
    const heroVars = [];
    if (heroCover.avgColor) heroVars.push(`--hero-bg:${heroCover.avgColor}`);
    if (heroCover.lqip) heroVars.push(`--hero-lqip:url('${heroCover.lqip}')`);
    const styleAttr = heroVars.length ? ` style="${esc(heroVars.join(';'))}"` : '';
    return `
      <div class="storefront-banner" id="menuHero"${styleAttr}>
        ${heroCover.url ? `<img class="storefront-banner-img smooth-img" id="menuHeroImg" data-smooth-img src="${esc(heroCover.url)}" alt="${esc(ven.name)} banner" width="960" height="720" fetchpriority="high" data-neutral-fallback="cover">` : ''}
        <div class="storefront-banner-body">
          <div class="d-flex flex-wrap align-items-center gap-2 mb-2" id="menuHeroBadges">
            ${badge(ven.open ? 'Open now' : 'Closed')}
            ${gcashBadgeHtml(ven.hasGcash)}
          </div>
          <h1 id="page-title" tabindex="-1" class="page-title mb-1">${esc(ven.name)}</h1>
          <p class="mb-1" id="menuHeroDesc">${esc(ven.desc)}</p>
          <p class="small mb-0 fw-semibold opacity-90" id="menuHeroPay"><i class="bi bi-${ven.hasGcash ? 'qr-code-scan' : 'cash-coin'} me-1" aria-hidden="true"></i>${esc(payLine)}</p>
        </div>
      </div>`;
  };

  /* Cache per-vendor hero metadata in sessionStorage for instant repeat paint (stale-while-revalidate) */
  const heroCacheKey = `wmsu_hero_${vid}`;
  const cachedHero = sstore.get(heroCacheKey, null);
  const cachedPack = getCachedKiosk();

  if (cachedHero && !cachedPack) {
    if (cachedHero.cover?.url) preloadImageHead(cachedHero.cover.url);
    const skelCount = getLastKnownMenuCount(vid);
    v.innerHTML = `
      <div class="mb-3">
        <a href="vendors.html" class="text-wmsu text-decoration-none small fw-semibold d-inline-flex align-items-center gap-1 mb-2">
          <i class="bi bi-arrow-left" aria-hidden="true"></i> All Stalls
        </a>
        ${heroBannerHtml(cachedHero.ven, cachedHero.cover || { url: '' })}
      </div>
      <div class="search-bar mb-3">
        ${searchBox('q', 'Search dishes, ingredients or categories…')}
        <button type="button" class="pill" id="availOnly" aria-pressed="false"><i class="bi bi-check2-circle" aria-hidden="true"></i> In stock only</button>
      </div>
      <div class="pills mb-3" id="pills"><div class="skel skel-pill" style="width:84px"></div><div class="skel skel-pill" style="width:124px"></div></div>
      <div class="small text-muted mb-3" id="mcount" aria-live="polite"></div>
      <div class="row g-4" id="grid" aria-busy="true">${menuCardSkeletons(skelCount)}</div>`;
    hydrateSmoothImages(v);
  }

  let cat = 0, q = '', avail = false, curGridSig = '';

  const applyPack = async (pack, isBackgroundUpdate = false) => {
    const { vendors: vs, categories: cs, foods: fs } = pack;
    cart.syncMedia(fs);
    const ven = vs.find(x => x.id === vid);
    if (!ven) {
      v.innerHTML = head('Stall not found') + empty('shop', 'We could not find this campus stall.', '<a class="btn btn-wmsu mt-2" href="vendors.html"><i class="bi bi-arrow-left" aria-hidden="true"></i> Back to all stalls</a>');
      return;
    }

    const all = fs.filter(f => f.vendorId === vid);
    all.forEach(f => { f.vendorOpen = ven.open; FOODS[f.id] = f });
    const mine = cs.filter(c => all.some(f => f.catId === c.id));
    const heroCover = stallCoverMeta(ven, all, true);
    sstore.set(heroCacheKey, { ven, cover: heroCover });
    if (heroCover.url) preloadImageHead(heroCover.url);

    /* Pre-decode hero + first row (up to 4) of 480px card thumbnails with ~600ms cap so cards reveal together */
    if (!isBackgroundUpdate) {
      const firstRowThumbs = all.slice(0, 4).map(f => f.thumbPath || f.imagePath).filter(Boolean);
      await predecodeUrls([heroCover.url, ...firstRowThumbs], 600);
    }

    /* Mount shell once — never swap or rebuild the hero container if it is already in the DOM */
    if (!$('#menuHero')) {
      v.innerHTML = `
        <div class="content-fade-in">
          <div class="mb-3">
            <a href="vendors.html" class="text-wmsu text-decoration-none small fw-semibold d-inline-flex align-items-center gap-1 mb-2">
              <i class="bi bi-arrow-left" aria-hidden="true"></i> All Stalls
            </a>
            ${heroBannerHtml(ven, heroCover)}
          </div>
          <div class="search-bar mb-3">
            ${searchBox('q', 'Search dishes, ingredients or categories…')}
            <button type="button" class="pill" id="availOnly" aria-pressed="false"><i class="bi bi-check2-circle" aria-hidden="true"></i> In stock only</button>
          </div>
          <div class="pills mb-3" id="pills"></div>
          <div class="small text-muted mb-3" id="mcount" aria-live="polite"></div>
          <div class="row g-4" id="grid" aria-busy="true"></div>
        </div>`;
      hydrateSmoothImages($('#menuHero'));
    } else {
      /* Stale-while-revalidate: update hero fields in place ONLY if something changed */
      const titleEl = $('#page-title'), descEl = $('#menuHeroDesc'), badgesEl = $('#menuHeroBadges'), payEl = $('#menuHeroPay'), heroEl = $('#menuHero');
      if (titleEl && titleEl.textContent !== ven.name) titleEl.textContent = ven.name;
      if (descEl && descEl.textContent !== ven.desc) descEl.textContent = ven.desc;
      const newBadges = `${badge(ven.open ? 'Open now' : 'Closed')}${gcashBadgeHtml(ven.hasGcash)}`;
      if (badgesEl && badgesEl.innerHTML.trim() !== newBadges.trim()) badgesEl.innerHTML = newBadges;
      const payLine = ven.hasGcash ? 'Pay with GCash or cash at the counter.' : 'This stall accepts cash at the counter only.';
      const newPayHtml = `<i class="bi bi-${ven.hasGcash ? 'qr-code-scan' : 'cash-coin'} me-1" aria-hidden="true"></i>${esc(payLine)}`;
      if (payEl && payEl.innerHTML !== newPayHtml) payEl.innerHTML = newPayHtml;
      const curImg = $('#menuHeroImg');
      if (heroCover.url && (!curImg || curImg.getAttribute('src') !== heroCover.url)) {
        if (curImg) curImg.remove();
        heroEl.classList.remove('hero-img-ready');
        heroEl.insertAdjacentHTML('afterbegin', `<img class="storefront-banner-img smooth-img" id="menuHeroImg" data-smooth-img src="${esc(heroCover.url)}" alt="${esc(ven.name)} banner" width="960" height="720" fetchpriority="high" data-neutral-fallback="cover">`);
        hydrateSmoothImages(heroEl);
      }
    }

    const catName = id => cs.find(c => c.id === id)?.name || '';
    let firstGridReveal = !isBackgroundUpdate;

    const draw = () => {
      $('#pills').innerHTML = [{ id: 0, name: 'All', icon: '🍽️' }, ...mine].map(c => `<button type="button" class="pill ${c.id === cat ? 'active' : ''}" aria-pressed="${c.id === cat}" data-act="cat" data-id="${c.id}">${c.icon} ${esc(c.name)}</button>`).join('');
      const l = all.filter(f => (!cat || f.catId === cat) && (!avail || f.available) && (!q || f.name.toLowerCase().includes(q) || (f.desc || '').toLowerCase().includes(q) || catName(f.catId).toLowerCase().includes(q)));
      const countTxt = q || cat || avail ? `${l.length} of ${all.length} item${all.length === 1 ? '' : 's'}` : `${all.length} item${all.length === 1 ? '' : 's'} on the menu`;
      if ($('#mcount').textContent !== countTxt) $('#mcount').textContent = countTxt;

      const sig = `${cat}|${avail}|${q}|${ven.open}|` + l.map(f => `${f.id}:${f.price}:${f.available}:${f.stockQty}:${f.thumbPath}`).join(',');
      const gridEl = $('#grid');
      gridEl.setAttribute('aria-busy', 'false');
      if (sig === curGridSig) return;
      curGridSig = sig;

      gridEl.innerHTML = l.length ? l.map((f, idx) => {
        const isFirstRow = idx < 4;
        const staggerCls = firstGridReveal ? ' stagger-card' : '';
        const staggerStyle = firstGridReveal ? ` style="--stagger-i:${Math.min(idx, 7)}"` : '';
        return `
        <div class="col-6 col-lg-4 col-xl-3${staggerCls}"${staggerStyle}>
          <article class="card fcard h-100 ${f.available ? '' : 'opacity-75'}">
            <a href="food-details.html?id=${f.id}" class="fimg">${dishTileHtml(f, { priority: isFirstRow, aboveFold: isFirstRow })}</a>
            <div class="p-3 d-flex flex-column flex-grow-1">
              <h2 class="h6 fw-bold mb-1 text-truncate" title="${esc(f.name)}"><a href="food-details.html?id=${f.id}" class="text-dark">${hl(f.name, q)}</a></h2>
              <p class="text-muted small mb-2 text-truncate">${hl(f.desc || '', q)}</p>
              ${f.available && f.stockQty != null && f.stockQty <= 10 ? `<div class="mb-2"><span class="badge-status badge-pending">${f.stockQty} left</span></div>` : ''}
              <div class="d-flex justify-content-between align-items-center mt-auto pt-2 border-top" data-dish-ctrl="${f.id}">
                <span class="price-ink">${peso(f.price)}</span>
                ${dishActionHtml(f)}
              </div>
            </div>
          </article>
        </div>`;
      }).join('') : `<div class="col-12">${empty('search', q ? `No dishes match “${esc(q)}”.` : 'No items in this view.', `<button type="button" class="btn btn-light mt-2" data-act="mClear"><i class="bi bi-x-circle me-1" aria-hidden="true"></i> Clear search &amp; filters</button>`)}</div>`;

      firstGridReveal = false;
      hydrateSmoothImages(gridEl);
    };

    if (!$('#q').dataset.bound) {
      $('#q').dataset.bound = '1';
      const reset = bindSearch('q', s => { q = s; draw() });
      $('#availOnly').onclick = e => { avail = !avail; e.currentTarget.classList.toggle('active', avail); e.currentTarget.setAttribute('aria-pressed', avail); draw() };
      acts.cat = d => { cat = +d.id; draw() };
      acts.mClear = () => { cat = 0; avail = false; $('#availOnly').classList.remove('active'); $('#availOnly').setAttribute('aria-pressed', 'false'); reset() };
    }
    draw();
  };

  if (cachedPack) {
    await applyPack(cachedPack, false);
    API.kioskData({ force: true }).then(fresh => {
      if (B.page === 'menu' && fresh.sig !== cachedPack.sig) {
        applyPack(fresh, true);
      }
    }).catch(() => {});
  } else {
    const fresh = await API.kioskData();
    await applyPack(fresh, false);
  }
};

/* ===== 3. Food Details Page — 960px Preload + Pre-Decode + Zero Footer Jump ===== */
C['food-details'] = async v => {
  const fid = +qs.get('id');
  const cachedPack = getCachedKiosk();
  let renderedSig = '';

  const renderDetail = async (pack, isReval = false) => {
    const fs = pack.foods;
    cart.syncMedia(fs);
    const f = fs.find(x => x.id === fid);
    if (!f) {
      v.innerHTML = empty('search', 'This food item was not found.', '<a class="btn btn-wmsu" href="vendors.html">Back to stalls</a>');
      return;
    }
    FOODS[f.id] = f;
    const sig = `${f.id}|${f.name}|${f.price}|${f.available}|${f.stockQty}|${f.imagePath}`;
    if (sig === renderedSig) return;
    renderedSig = sig;

    if (f.imagePath) {
      preloadImageHead(f.imagePath);
      if (!isReval) await predecodeUrls([f.imagePath], 600);
    }

    let n = 1;
    v.innerHTML = `
      <div class="${isReval ? '' : 'content-fade-in'}">
        <a href="menu.html?vendor=${f.vendorId}" class="text-wmsu text-decoration-none small fw-semibold d-inline-flex align-items-center gap-1 mb-3">
          <i class="bi bi-arrow-left" aria-hidden="true"></i> Back to ${esc(f.vendorName)}
        </a>
        <div class="row g-4">
          <div class="col-lg-6">
            <div class="fimg big">${dishTileHtml(f, { full: true, sizes: '(max-width: 991px) 100vw, 640px', priority: true })}</div>
          </div>
          <div class="col-lg-6 d-flex flex-column justify-content-center">
            <div class="small text-muted fw-semibold mb-1"><i class="bi bi-shop text-wmsu me-1" aria-hidden="true"></i>${esc(f.vendorName)} · ${esc(f.catName)}</div>
            <h1 id="page-title" tabindex="-1" class="fw-bold mb-2">${esc(f.name)}</h1>
            <div class="price-ink fs-3 mb-2">${peso(f.price)}</div>
            ${f.stockQty != null ? `<div class="mb-3"><span class="badge-status badge-${f.stockQty > 5 ? 'neutral' : f.stockQty > 0 ? 'pending' : 'danger'}">${f.stockQty > 0 ? f.stockQty + ' serving(s) remaining' : 'Sold out'}</span></div>` : ''}
            <p class="lead text-muted mb-4">${esc(f.desc)}</p>
            <div class="d-flex align-items-center gap-3 mb-4">
              <span class="fw-semibold">Quantity:</span>
              <div class="qty"><button type="button" data-act="dq" data-d="-1" aria-label="Decrease quantity">−</button><span id="n" class="fs-4" aria-live="polite">1</span><button type="button" data-act="dq" data-d="1" aria-label="Increase quantity">+</button></div>
            </div>
            <div>
              <button type="button" class="btn btn-wmsu btn-lg px-4" id="add" ${f.available && f.vendorOpen ? '' : 'disabled'}>
                <i class="bi bi-cart-plus me-1" aria-hidden="true"></i> ${!f.vendorOpen ? 'Stall closed' : f.available ? 'Add to cart' : 'Sold out'}
              </button>
            </div>
          </div>
        </div>
      </div>`;
    hydrateSmoothImages(v);
    const maxQ = f.stockQty != null ? Math.max(1, Math.min(20, f.stockQty)) : 20;
    acts.dq = d => { n = Math.max(1, Math.min(maxQ, n + +d.d)); $('#n').textContent = n };
    $('#add').onclick = async () => { if (await cart.add(f, n)) location = 'cart.html' };
  };

  if (cachedPack) {
    await renderDetail(cachedPack, false);
    API.kioskData({ force: true }).then(fresh => {
      if (B.page === 'food-details' && fresh.sig !== cachedPack.sig) renderDetail(fresh, true);
    }).catch(() => {});
  } else {
    const fresh = await API.kioskData();
    await renderDetail(fresh, false);
  }
};

/* ===== 4. Cart Page — Single Cached Kiosk Data + Surgical Quantity Updates ===== */
C.cart = async v => {
  const { vendors: vs, foods: fs } = await API.kioskData();
  const c = cart.syncMedia(fs);
  if (!c.items.length) {
    v.innerHTML = `<div class="content-fade-in">${head('Your cart')}${empty('cart-x', 'Your cart is empty.', '<a class="btn btn-wmsu btn-lg mt-3" href="vendors.html"><i class="bi bi-shop me-1" aria-hidden="true"></i> Start ordering</a>')}</div>`;
    return;
  }

  const groups = {};
  c.items.forEach(i => {
    if (!groups[i.vendorId]) groups[i.vendorId] = [];
    groups[i.vendorId].push(i);
  });
  const stallEntries = Object.entries(groups).map(([vid, items]) => {
    const ven = vs.find(x => x.id === +vid) || { id: +vid, name: 'Campus Stall', open: true, hasGcash: false };
    const sub = items.reduce((s, i) => s + i.price * i.qty, 0);
    return { ven, items, sub };
  });
  const anyClosed = stallEntries.some(g => !g.ven.open);

  v.innerHTML = `<div class="content-fade-in">${head('Your cart', `Items grouped across ${stallEntries.length} campus stall${stallEntries.length === 1 ? '' : 's'}. Payment method is chosen per stall at checkout.`)}
    ${anyClosed ? `<div class="alert alert-warning d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4" role="alert"><div><i class="bi bi-exclamation-triangle-fill me-1" aria-hidden="true"></i> <b>One or more stalls in your cart are currently closed.</b> Remove items from closed stalls to continue to checkout.</div></div>` : ''}
    <div class="row g-4">
      <div class="col-lg-8">
        ${stallEntries.map(({ ven, items, sub }) => `
          <section class="cart-stall-card" data-stall-card="${ven.id}" aria-label="${esc(ven.name)} items">
            <div class="cart-stall-head">
              <div class="d-flex align-items-center flex-wrap gap-2">
                <a href="menu.html?vendor=${ven.id}" class="fw-bold text-dark fs-6 text-decoration-none"><i class="bi bi-shop text-wmsu me-1" aria-hidden="true"></i>${esc(ven.name)}</a>
                ${badge(ven.open ? 'Open now' : 'Closed')}
                ${gcashBadgeHtml(ven.hasGcash)}
              </div>
              ${!ven.open ? `<button type="button" class="btn btn-sm btn-outline-danger" data-act="rmStall" data-vid="${ven.id}"><i class="bi bi-trash" aria-hidden="true"></i> Remove stall</button>` : ''}
            </div>
            <div class="p-3">
              ${items.map((i, idx) => `
                <div class="d-flex align-items-center gap-3 flex-wrap ${idx < items.length - 1 ? 'pb-3 mb-3 border-bottom' : ''}" data-cart-row="${i.id}">
                  <a href="food-details.html?id=${i.id}">${dishThumbHtml(i)}</a>
                  <div class="flex-grow-1">
                    <h2 class="h6 fw-bold mb-0"><a href="food-details.html?id=${i.id}" class="text-dark">${esc(i.name)}</a></h2>
                    <div class="text-muted small fw-semibold">${peso(i.price)} each</div>
                  </div>
                  <div class="qty">
                    <button type="button" data-act="cq" data-id="${i.id}" data-d="-1" aria-label="Decrease ${esc(i.name)} quantity">−</button>
                    <span aria-live="polite" data-cart-qty="${i.id}">${i.qty}</span>
                    <button type="button" data-act="cq" data-id="${i.id}" data-d="1" aria-label="Increase ${esc(i.name)} quantity">+</button>
                  </div>
                  <b style="min-width:92px" class="text-end price-ink" data-cart-line="${i.id}">${peso(i.price * i.qty)}</b>
                  <button type="button" class="btn btn-light text-danger" aria-label="Remove ${esc(i.name)}" data-act="cr" data-id="${i.id}"><i class="bi bi-trash" aria-hidden="true"></i></button>
                </div>`).join('')}
            </div>
            <div class="cart-stall-foot">
              <span class="small text-muted fw-semibold" data-stall-cnt="${ven.id}">Stall Subtotal (${items.reduce((s, x) => s + x.qty, 0)} item${items.reduce((s, x) => s + x.qty, 0) === 1 ? '' : 's'})</span>
              <strong class="price-ink" data-stall-sub="${ven.id}">${peso(sub)}</strong>
            </div>
          </section>`).join('')}
        <button type="button" class="btn btn-light text-danger" data-act="cclear"><i class="bi bi-trash me-1" aria-hidden="true"></i> Clear entire cart</button>
      </div>
      <div class="col-lg-4">
        <div class="card p-4" style="position:sticky;top:96px">
          <h2 class="h5 fw-bold mb-3">Order Summary</h2>
          ${stallEntries.map(g => `<div class="d-flex justify-content-between small mb-2"><span class="text-muted">${esc(g.ven.name)}</span><span class="fw-semibold" data-sum-stall="${g.ven.id}">${peso(g.sub)}</span></div>`).join('')}
          ${stallEntries.length > 1 ? `<div class="small text-muted bg-light rounded p-2 mt-1 mb-2"><i class="bi bi-info-circle me-1" aria-hidden="true"></i> Paid separately per stall at checkout (GCash QR where available, or Cash at Counter).</div>` : ''}
          <hr class="my-3">
          <div class="d-flex justify-content-between align-items-center mb-4"><b class="fs-5">Grand Total</b><b class="price-ink fs-4" id="cartGrandTotal">${peso(cart.total())}</b></div>
          ${anyClosed
            ? `<button type="button" class="btn btn-wmsu btn-lg w-100 mb-2" disabled>Remove Closed Stall Items First</button>`
            : `<a href="checkout.html" class="btn btn-wmsu btn-lg w-100 mb-2">Proceed to Checkout <i class="bi bi-arrow-right" aria-hidden="true"></i></a>`}
          <a href="vendors.html" class="btn btn-light w-100"><i class="bi bi-plus-lg me-1" aria-hidden="true"></i> Add items from other stalls</a>
        </div>
      </div>
    </div>
  </div>`;
  hydrateSmoothImages(v);
};

/* Surgical cart stepper update when qty remains >= 1; full refresh only when an item is removed */
acts.cq = d => {
  const curItem = cart.get().items.find(x => x.id == d.id);
  if (!curItem) return;
  if (curItem.qty + +d.d < 1) {
    cart.setQty(d.id, +d.d);
    return refresh();
  }
  cart.setQty(d.id, +d.d);
  const updated = cart.get();
  const it = updated.items.find(x => x.id == d.id);
  if (!it) return refresh();
  const qEl = $(`[data-cart-qty="${it.id}"]`), lEl = $(`[data-cart-line="${it.id}"]`);
  if (qEl) qEl.textContent = it.qty;
  if (lEl) lEl.textContent = peso(it.qty * it.price);
  const stallItems = updated.items.filter(x => x.vendorId === it.vendorId);
  const stallCnt = stallItems.reduce((s, x) => s + x.qty, 0);
  const stallSub = stallItems.reduce((s, x) => s + x.qty * x.price, 0);
  const cEl = $(`[data-stall-cnt="${it.vendorId}"]`), sEl = $(`[data-stall-sub="${it.vendorId}"]`), sumEl = $(`[data-sum-stall="${it.vendorId}"]`), gEl = $('#cartGrandTotal');
  if (cEl) cEl.textContent = `Stall Subtotal (${stallCnt} item${stallCnt === 1 ? '' : 's'})`;
  if (sEl) sEl.textContent = peso(stallSub);
  if (sumEl) sumEl.textContent = peso(stallSub);
  if (gEl) gEl.textContent = peso(cart.total());
};
acts.cr = async d => {
  const c = cart.get(), removed = c.items.find(i => i.id == d.id);
  if (!removed) return;
  c.items = c.items.filter(i => i.id != d.id);
  cart.save(c);
  refresh();
  toast(`${removed.name} removed`, 'dark', () => { const cur = cart.get(); cur.items.push(removed); cart.save(cur, true); refresh() });
};
acts.rmStall = d => {
  const c = cart.get();
  c.items = c.items.filter(i => i.vendorId !== +d.vid);
  cart.save(c);
  refresh();
};
acts.cclear = async () => { if (await confirmBox('Remove everything from your cart?', 'Clear cart')) { cart.clear(); refresh() } };

/* ===== 5. Checkout Page ===== */
C.checkout = async v => {
  if (!cart.count()) return location = 'cart.html';
  const [{ vendors: vs, foods: fs }, o] = await Promise.all([API.kioskData(), Promise.resolve(store.get('draft', { type: 'Dine-In', customer: '' }))]);
  const c = cart.syncMedia(fs);
  v.innerHTML = `<div class="content-fade-in">${head('Checkout', 'Tell us how you want to receive your order.')}
    <form id="cf" novalidate class="row g-4">
      <div class="col-lg-7">
        <fieldset class="mb-4">
          <legend class="form-label mb-2">Dining preference</legend>
          <div class="pay-method-grid">
            ${[['Dine-In', 'cup-hot', 'Served on a tray for campus food court seating.'], ['Take-Out', 'bag', 'Packed in a bag ready for grab-and-go pickup.']].map(t => `
              <label class="pay-choice">
                <input type="radio" class="visually-hidden" name="type" value="${t[0]}" ${o.type === t[0] ? 'checked' : ''}>
                <span class="pay-choice-ico" aria-hidden="true"><i class="bi bi-${t[1]}"></i></span>
                <span>
                  <strong class="d-block">${t[0]}</strong>
                  <small class="text-muted">${t[2]}</small>
                </span>
                <i class="bi bi-check-circle-fill pay-choice-check" aria-hidden="true"></i>
              </label>`).join('')}
          </div>
        </fieldset>
        <div class="mb-3">
          <label class="form-label" for="custName">Customer Name <span class="text-danger" aria-hidden="true">*</span></label>
          <input id="custName" name="customer" class="form-control form-control-lg" placeholder="Enter your full name" value="${esc(sessionStorage.getItem('kiosk_cname') || '')}" autocomplete="name" minlength="2" maxlength="60" required>
          <div class="invalid-feedback">Please enter your name (at least 2 characters).</div>
        </div>
      </div>
      <div class="col-lg-5">
        <div class="card p-4">
          <h2 class="h5 fw-bold mb-3">Order Summary</h2>
          ${c.items.map(i => {
            const ven = vs.find(x => x.id === i.vendorId);
            return `<div class="d-flex align-items-center gap-2 mb-3">${dishThumbHtml(i)}<div class="flex-grow-1"><div class="fw-semibold">${i.qty}× ${esc(i.name)}</div>${ven ? `<small class="text-muted"><i class="bi bi-shop" aria-hidden="true"></i> ${esc(ven.name)}</small>` : ''}</div><b>${peso(i.qty * i.price)}</b></div>`;
          }).join('')}
          <hr class="my-3">
          <div class="d-flex justify-content-between fs-4 mb-4"><b>Total</b><b class="price-ink fs-4">${peso(cart.total())}</b></div>
          <button type="submit" class="btn btn-wmsu btn-lg w-100">Continue to Payment <i class="bi bi-arrow-right" aria-hidden="true"></i></button>
        </div>
      </div>
    </form></div>`;
  hydrateSmoothImages(v);
  $('#custName').addEventListener('input', e => sessionStorage.setItem('kiosk_cname', e.target.value));
  onForm('#cf', async d => {
    sessionStorage.setItem('kiosk_cname', d.customer.trim());
    store.set('draft', { ...d, customer: d.customer.trim() });
    location = 'payment.html';
  });
};

/* ===== 6. Payment Page ===== */
C.payment = async v => {
  if (!cart.count()) return location = 'cart.html';
  const { settings: s, vendors: vs, foods: fs } = await API.kioskData();
  const cSync = cart.syncMedia(fs);
  const gcashGlobalOn = !!s?.gcash;
  const dr = store.get('draft', { type: 'Dine-In', customer: sessionStorage.getItem('kiosk_cname') || '' });
  if (!dr.customer || dr.customer.trim().length < 2) return location = 'checkout.html';

  const byV = {};
  cSync.items.forEach(i => {
    if (!byV[i.vendorId]) byV[i.vendorId] = { items: [], tot: 0 };
    byV[i.vendorId].items.push(i);
    byV[i.vendorId].tot += i.price * i.qty;
  });

  const stalls = Object.entries(byV).map(([vid, g]) => {
    const ven = vs.find(x => x.id === +vid) || { id: +vid, name: 'Campus Stall', hasGcash: false };
    const canGcash = gcashGlobalOn && ven.hasGcash && !!ven.gcashQrPath;
    const orderCode = canGcash ? getStallOrderCode(+vid, ven.name) : '';
    return { vid: +vid, ven, items: g.items, tot: g.tot, canGcash, orderCode };
  });

  const state = {};
  stalls.forEach(st => {
    state[st.vid] = { method: 'cash', ref: '', touched: false, proofBlob: null, proofPreview: '' };
  });

  v.innerHTML = `<div class="content-fade-in">${head('Choose payment per stall', `Grand Total: <b class="price-ink">${peso(cart.total())}</b> · Customer: <b>${esc(dr.customer)}</b> (${esc(dr.type)})`)}
    <form id="pf" novalidate class="row g-4">
      <div class="col-lg-8">
        <div id="stallPayList"></div>
      </div>
      <div class="col-lg-4">
        <div class="card p-4" style="position:sticky;top:96px">
          <h2 class="h5 fw-bold mb-3">Payment Summary</h2>
          <div id="paySummaryRows" class="mb-3"></div>
          <hr class="my-3">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <b class="fs-5">Grand Total</b>
            <b class="price-ink fs-4">${peso(cart.total())}</b>
          </div>
          <div id="payGateHint" class="small text-muted mb-3" aria-live="polite"></div>
          <div id="submitErrBox" class="mb-3" aria-live="assertive"></div>
          <div class="d-grid gap-2">
            <button type="submit" class="btn btn-wmsu btn-lg" id="placeOrderBtn">Place Order</button>
            <a href="checkout.html" class="btn btn-light">Back to Checkout</a>
          </div>
        </div>
      </div>
    </form></div>`;

  const renderSummaryAndGate = () => {
    $('#paySummaryRows').innerHTML = stalls.map(st => {
      const m = state[st.vid].method;
      return `<div class="d-flex justify-content-between align-items-center small mb-2">
        <div>
          <div class="fw-semibold text-dark">${esc(st.ven.name)}</div>
          <span class="text-muted">${m === 'gcash' ? '<i class="bi bi-qr-code-scan text-success" aria-hidden="true"></i> GCash QR' : '<i class="bi bi-cash-coin" aria-hidden="true"></i> Cash at Counter'}</span>
        </div>
        <b class="price-ink">${peso(st.tot)}</b>
      </div>`;
    }).join('');

    const gcashStalls = stalls.filter(st => state[st.vid].method === 'gcash');
    const missingRefs = gcashStalls.filter(st => !/^\d{13}$/.test(state[st.vid].ref));
    const refs = gcashStalls.map(st => state[st.vid].ref).filter(Boolean);
    const hasDupInForm = new Set(refs).size !== refs.length;
    const btn = $('#placeOrderBtn');
    const hint = $('#payGateHint');

    if (missingRefs.length > 0) {
      btn.disabled = true;
      hint.innerHTML = `<i class="bi bi-info-circle text-wmsu me-1" aria-hidden="true"></i> Enter the 13-digit GCash Reference No. for <b>${esc(missingRefs.map(x => x.ven.name).join(', '))}</b> to enable Place Order.`;
    } else if (hasDupInForm) {
      btn.disabled = true;
      hint.innerHTML = `<span class="text-danger"><i class="bi bi-exclamation-circle me-1" aria-hidden="true"></i> Each GCash stall payment must have a unique 13-digit Reference No.</span>`;
    } else {
      btn.disabled = false;
      hint.innerHTML = gcashStalls.length
        ? `<span class="text-success fw-semibold"><i class="bi bi-check-circle-fill me-1" aria-hidden="true"></i> GCash reference ready — your order will be sent for stall verification.</span>`
        : `<i class="bi bi-cash-coin me-1" aria-hidden="true"></i> Pay directly at the stall counter(s) when called.`;
    }
  };

  const renderStallCards = () => {
    $('#stallPayList').innerHTML = stalls.map(st => {
      const stState = state[st.vid];
      const isG = stState.method === 'gcash';
      const amtNum = Number(st.tot).toFixed(2);
      const refInvalid = stState.touched && !/^\d{13}$/.test(stState.ref);
      const dlSlug = st.ven.name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'Stall';

      return `
        <section class="stall-pay-card" aria-labelledby="spHead_${st.vid}">
          <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 pb-3 mb-3 border-bottom">
            <div>
              <div class="d-flex align-items-center flex-wrap gap-2 mb-2">
                <h2 class="h5 fw-bold mb-0" id="spHead_${st.vid}"><i class="bi bi-shop text-wmsu me-1" aria-hidden="true"></i>${esc(st.ven.name)}</h2>
                ${gcashBadgeHtml(st.canGcash)}
              </div>
              ${orderItemsThumbsHtml(st.items)}
            </div>
            <div class="text-end">
              <div class="small text-muted">Stall Subtotal</div>
              <div class="price-ink fs-4">${peso(st.tot)}</div>
            </div>
          </div>

          <fieldset>
            <legend class="form-label mb-2">Payment method for ${esc(st.ven.name)}</legend>
            <div class="pay-method-grid">
              <label class="pay-choice">
                <input type="radio" class="visually-hidden" name="pm_${st.vid}" value="cash" data-vid="${st.vid}" ${!isG ? 'checked' : ''}>
                <span class="pay-choice-ico" aria-hidden="true"><i class="bi bi-cash-coin"></i></span>
                <span>
                  <strong class="d-block">Cash at Counter</strong>
                  <small class="text-muted">Pay ${peso(st.tot)} when your order is called.</small>
                </span>
                <i class="bi bi-check-circle-fill pay-choice-check" aria-hidden="true"></i>
              </label>

              <label class="pay-choice ${st.canGcash ? '' : 'is-locked'}">
                <input type="radio" class="visually-hidden" name="pm_${st.vid}" value="gcash" data-vid="${st.vid}" ${isG ? 'checked' : ''} ${st.canGcash ? '' : 'disabled'}>
                <span class="pay-choice-ico" aria-hidden="true"><i class="bi bi-qr-code-scan"></i></span>
                <span>
                  <strong class="d-block">GCash</strong>
                  <small class="text-muted">${st.canGcash ? 'Scan InstaPay QR & enter 13-digit ref no.' : 'Unavailable for this stall.'}</small>
                </span>
                <i class="bi bi-check-circle-fill pay-choice-check" aria-hidden="true"></i>
              </label>
            </div>
          </fieldset>

          ${!st.canGcash ? `
            <div class="small text-muted mt-2 pt-1">
              <i class="bi bi-info-circle me-1" aria-hidden="true"></i> GCash isn't available for this stall — pay at the counter.
            </div>` : ''}

          ${st.canGcash && isG ? `
            <div class="gcash-qr-panel">
              <div class="gcash-qr-layout">
                <div class="qr-frame">
                  <button type="button" class="qr-frame-btn" data-act="lightbox" data-src="${esc(st.ven.gcashQrPath)}" data-alt="GCash QR code for ${esc(st.ven.name)}" data-cap="GCash QR — ${esc(st.ven.name)} (${peso(st.tot)})" aria-label="Enlarge GCash QR code for ${esc(st.ven.name)}">
                    <img class="qr-frame-img" src="${esc(st.ven.gcashQrPath)}" alt="GCash QR code for ${esc(st.ven.name)}" width="256" height="256">
                  </button>
                  <div class="small text-muted mt-2"><i class="bi bi-zoom-in me-1" aria-hidden="true"></i>Tap QR to enlarge</div>
                  <div class="d-flex justify-content-center gap-2 mt-2">
                    <button type="button" class="btn btn-sm btn-light" data-act="lightbox" data-src="${esc(st.ven.gcashQrPath)}" data-alt="GCash QR code for ${esc(st.ven.name)}" data-cap="GCash QR — ${esc(st.ven.name)}"><i class="bi bi-arrows-fullscreen" aria-hidden="true"></i> Enlarge</button>
                    <a class="btn btn-sm btn-outline-wmsu" href="${esc(st.ven.gcashQrPath)}" download="${esc(dlSlug)}-GCash-QR.png"><i class="bi bi-download" aria-hidden="true"></i> Download QR</a>
                  </div>
                </div>

                <div>
                  <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
                    <div>
                      <div class="small text-muted">GCash Account Name</div>
                      <strong class="fs-5 text-dark">${esc(st.ven.gcashAccountName || 'Verified Stall')}</strong>
                    </div>
                    <div class="text-sm-end">
                      <div class="small text-muted">Amount to Pay</div>
                      <div class="d-flex align-items-center gap-2">
                        <strong class="price-ink fs-3">${peso(st.tot)}</strong>
                        <button type="button" class="btn btn-sm btn-light" data-act="copy" data-v="${esc(amtNum)}" aria-label="Copy exact amount ${esc(amtNum)}"><i class="bi bi-clipboard" aria-hidden="true"></i> Copy amount</button>
                      </div>
                    </div>
                  </div>

                  <div class="gcash-code-box mb-3">
                    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                      <div>
                        <span class="small text-muted d-block">Order Code (put in GCash message)</span>
                        <code class="fs-5 fw-bold text-wmsu">${esc(st.orderCode)}</code>
                      </div>
                      <button type="button" class="btn btn-sm btn-light" data-act="copy" data-v="${esc(st.orderCode)}" aria-label="Copy order code ${esc(st.orderCode)}"><i class="bi bi-clipboard" aria-hidden="true"></i> Copy code</button>
                    </div>
                  </div>

                  <div class="alert alert-light border small py-2 px-3 mb-2">
                    <strong>How to pay:</strong> Open GCash &gt; Scan QR &gt; enter exactly <b>${peso(st.tot)}</b> &gt; put your order code (<b>${esc(st.orderCode)}</b>) in the message.
                  </div>
                  <div class="small text-muted mb-3">
                    <i class="bi bi-exclamation-circle text-warning me-1" aria-hidden="true"></i> <strong>Notice:</strong> Transfer fees may apply (InstaPay QR).
                  </div>

                  <div class="mb-3">
                    <div class="d-flex justify-content-between align-items-center">
                      <label class="form-label mb-1" for="ref_${st.vid}">Reference No. (13 digits) <span class="text-danger" aria-hidden="true">*</span></label>
                      <small class="text-muted" id="refCnt_${st.vid}">${stState.ref.length}/13 digits</small>
                    </div>
                    <input
                      type="text"
                      id="ref_${st.vid}"
                      class="form-control ${refInvalid ? 'is-invalid' : ''}"
                      inputmode="numeric"
                      autocorrect="off"
                      autocapitalize="none"
                      spellcheck="false"
                      maxlength="13"
                      pattern="\\d{13}"
                      placeholder="Enter 13-digit GCash Ref. No."
                      value="${esc(stState.ref)}"
                      aria-invalid="${refInvalid}"
                      aria-describedby="refErr_${st.vid}"
                      data-ref-vid="${st.vid}"
                      required>
                    <div id="refErr_${st.vid}" class="invalid-feedback">Enter all 13 digits from your GCash receipt (numbers only).</div>
                  </div>

                  <div>
                    <label class="form-label mb-1" for="proof_${st.vid}">GCash Receipt Screenshot <span class="text-muted fw-normal">(optional, max 5 MB)</span></label>
                    <input type="file" id="proof_${st.vid}" class="form-control" accept="image/jpeg,image/png,image/webp" data-proof-vid="${st.vid}">
                    <div id="proofBox_${st.vid}" class="mt-2">
                      ${stState.proofPreview ? `
                        <div class="proof-preview-card">
                          <button type="button" class="proof-thumb-btn" data-act="lightbox" data-src="${esc(stState.proofPreview)}" data-alt="Uploaded GCash receipt preview" data-cap="Receipt Screenshot Preview" aria-label="Enlarge uploaded receipt screenshot">
                            <img src="${esc(stState.proofPreview)}" width="56" height="56" alt="Receipt thumbnail">
                          </button>
                          <div class="small">
                            <div class="fw-semibold text-success"><i class="bi bi-check-circle-fill me-1" aria-hidden="true"></i>Screenshot ready</div>
                            <button type="button" class="btn btn-link btn-sm text-danger p-0 text-decoration-none" data-rm-proof="${st.vid}">Remove screenshot</button>
                          </div>
                        </div>` : ''}
                    </div>
                  </div>
                </div>
              </div>
            </div>` : ''}
        </section>`;
    }).join('');

    hydrateSmoothImages($('#stallPayList'));

    document.querySelectorAll('#stallPayList input[type="radio"][data-vid]').forEach(r => {
      r.onchange = e => {
        const vid = +e.target.dataset.vid;
        state[vid].method = e.target.value;
        $('#submitErrBox').innerHTML = '';
        renderStallCards();
        renderSummaryAndGate();
      };
    });

    document.querySelectorAll('#stallPayList input[data-ref-vid]').forEach(inp => {
      const vid = +inp.dataset.refVid;
      inp.oninput = () => {
        const cleaned = inp.value.replace(/\D+/g, '').slice(0, 13);
        if (inp.value !== cleaned) inp.value = cleaned;
        state[vid].ref = cleaned;
        const cnt = $(`#refCnt_${vid}`); if (cnt) cnt.textContent = `${cleaned.length}/13 digits`;
        if (/^\d{13}$/.test(cleaned)) {
          inp.classList.remove('is-invalid');
          inp.setAttribute('aria-invalid', 'false');
        }
        $('#submitErrBox').innerHTML = '';
        renderSummaryAndGate();
      };
      inp.onblur = () => {
        state[vid].touched = true;
        const bad = !/^\d{13}$/.test(state[vid].ref);
        inp.classList.toggle('is-invalid', bad);
        inp.setAttribute('aria-invalid', String(bad));
      };
    });

    document.querySelectorAll('#stallPayList input[data-proof-vid]').forEach(fInp => {
      const vid = +fInp.dataset.proofVid;
      fInp.onchange = async () => {
        const file = fInp.files?.[0];
        if (!file) return;
        if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
          toast('Only JPG, PNG, or WebP images are allowed.', 'danger');
          fInp.value = '';
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          toast('Screenshot must be 5 MB or smaller.', 'danger');
          fInp.value = '';
          return;
        }
        try {
          const { blob, previewUrl } = await compressProofImage(file);
          if (state[vid].proofPreview) URL.revokeObjectURL(state[vid].proofPreview);
          state[vid].proofBlob = blob;
          state[vid].proofPreview = previewUrl;
          renderStallCards();
        } catch (err) {
          toast(err.message || 'Could not process image.', 'danger');
          fInp.value = '';
        }
      };
    });

    document.querySelectorAll('#stallPayList [data-rm-proof]').forEach(btn => {
      btn.onclick = () => {
        const vid = +btn.dataset.rmProof;
        if (state[vid].proofPreview) URL.revokeObjectURL(state[vid].proofPreview);
        state[vid].proofBlob = null;
        state[vid].proofPreview = '';
        renderStallCards();
      };
    });
  };

  let submitting = false;
  const submitOrder = async () => {
    if (submitting) return;
    const gcashStalls = stalls.filter(st => state[st.vid].method === 'gcash');
    for (const st of gcashStalls) {
      if (!/^\d{13}$/.test(state[st.vid].ref)) {
        state[st.vid].touched = true;
        renderStallCards();
        $(`#ref_${st.vid}`)?.focus();
        return;
      }
    }
    submitting = true;
    const btn = $('#placeOrderBtn');
    const origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Placing Order…`;
    $('#submitErrBox').innerHTML = '';

    try {
      const stallPayments = {}, proofs = {};
      stalls.forEach(st => {
        const stS = state[st.vid];
        stallPayments[st.vid] = stS.method === 'gcash'
          ? { method: 'gcash', reference: stS.ref, order_code: st.orderCode }
          : { method: 'cash' };
        if (stS.method === 'gcash' && stS.proofBlob) proofs[st.vid] = stS.proofBlob;
      });
      const o = await API.place({
        items: cSync.items,
        type: dr.type,
        customer: dr.customer,
        stallPayments,
        proofs
      });
      store.set('myOrders', [{ no: o.no, token: o.token, code: o.code || '' }, ...myOrders()]);
      store.set('lastOrder', { no: o.no, token: o.token, code: o.code || '' });
      localStorage.removeItem('draft');
      sessionStorage.removeItem('kiosk_cname');
      sessionStorage.removeItem('wmsu_gcash_codes');
      cart.clear();
      location = 'confirmation.html?no=' + encodeURIComponent(o.no) + '&token=' + encodeURIComponent(o.token);
    } catch (err) {
      submitting = false;
      btn.innerHTML = origHtml;
      renderSummaryAndGate();
      $('#submitErrBox').innerHTML = `
        <div class="alert alert-danger small mb-0" role="alert">
          <div class="fw-bold mb-1"><i class="bi bi-exclamation-triangle-fill me-1" aria-hidden="true"></i> Could not place order</div>
          <div class="mb-2">${esc(err.message)}</div>
          <div class="d-flex flex-wrap gap-2">
            <button type="button" class="btn btn-sm btn-danger" id="retryOrderBtn"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Retry</button>
            <button type="button" class="btn btn-sm btn-light" id="switchCashBtn"><i class="bi bi-cash-coin" aria-hidden="true"></i> Pay with cash instead</button>
          </div>
        </div>`;
      $('#retryOrderBtn').onclick = submitOrder;
      $('#switchCashBtn').onclick = () => {
        stalls.forEach(st => { state[st.vid].method = 'cash' });
        $('#submitErrBox').innerHTML = '';
        renderStallCards();
        renderSummaryAndGate();
        toast('Switched all stalls to Cash at Counter.');
      };
    }
  };

  $('#pf').addEventListener('submit', e => {
    e.preventDefault();
    submitOrder();
  });

  renderStallCards();
  renderSummaryAndGate();
};

/* ===== 7. Confirmation, Receipt, Track Order & History ===== */
const cleanK = s => { const v = String(s || '').trim(); return (!v || v.toLowerCase() === 'null' || v.toLowerCase() === 'undefined') ? '' : v.toUpperCase() };
const findKey = no => { const m = myOrders().find(x => x.no === no); return m ? (cleanK(m.token) || cleanK(m.code)) : '' };
const findCode = no => cleanK(myOrders().find(x => x.no === no)?.code);
const syncCodes = orders => {
  const first = orders.find(o => o.code);
  if (!first) return;
  const mine = myOrders().map(m => orders.some(o => o.no === m.no) ? { ...m, code: orders.find(o => o.no === m.no).code || m.code } : m);
  store.set('myOrders', mine);
  const last = store.get('lastOrder', null);
  if (last && orders.some(o => o.no === last.no)) store.set('lastOrder', { ...last, code: first.code });
};
const getOrders = async () => {
  const no = cleanK(qs.get('no') || store.get('lastOrder', {}).no);
  const key = cleanK(qs.get('token')) || cleanK(qs.get('code')) || findKey(no) || cleanK(store.get('lastOrder', {}).token) || cleanK(store.get('lastOrder', {}).code);
  if (!no) return null;
  try {
    const r = await API.order(no, key);
    const list = Array.isArray(r) ? r : [r];
    syncCodes(list);
    return list;
  } catch { return null }
};
const orderLink = (page, o) => { const k = qs.get('token') || findKey(o.no) || o.code || ''; return `${page}.html?no=${encodeURIComponent(o.no)}&${k.length > 6 ? 'token' : 'code'}=${encodeURIComponent(k)}` };

const stallPaySummaryText = o => {
  if (o.pay === 'cash') {
    if (o.payStatus === 'Paid') return 'Cash payment received at counter.';
    return o.code
      ? 'Cash order accepted! Please pay at the stall counter when called.'
      : 'Waiting for stall to accept your cash order and release your tracking code.';
  }
  if (o.payStatus === 'Paid') return `GCash verified by stall${o.ref ? ` (Ref: ${o.ref})` : ''}. Tracking number released!`;
  if (o.payStatus === 'Rejected') return `GCash payment rejected${o.rejectReason ? `: ${o.rejectReason}` : '.'}`;
  return `Waiting for stall to confirm your GCash payment${o.ref ? ` (Ref: ${o.ref})` : ''}. Tracking code unlocks once verified.`;
};

C.confirmation = async v => {
  clearInterval(window._confPoll);
  const orders = await getOrders();
  if (!orders || !orders.length) return v.innerHTML = empty('receipt', 'No order found.', '<a class="btn btn-wmsu" href="vendors.html">Order now</a>');
  const primary = orders[0];
  const grandTotal = orders.reduce((sum, o) => sum + o.total, 0);
  const released = orders.filter(o => o.code);
  const waitingAny = orders.some(o => !o.code && o.orderStatus !== 'Cancelled' && o.payStatus !== 'Rejected');

  v.innerHTML = `
    <div class="text-center card p-4 p-md-5 mx-auto content-fade-in" style="max-width:720px" aria-live="polite">
      <i class="bi bi-${released.length === orders.length ? 'check-circle-fill text-success' : 'hourglass-split text-wmsu'}" style="font-size:3.8rem" aria-hidden="true"></i>
      <h1 id="page-title" tabindex="-1" class="h3 fw-bold mt-2">${released.length === orders.length ? 'Order Confirmed!' : 'Order Submitted!'}</h1>
      <p class="text-muted small mb-4">${esc(primary.type)} · Customer: <b>${esc(primary.customer)}</b> · Grand Total: <b class="price-ink">${peso(grandTotal)}</b></p>

      <div class="text-start mb-4">
        <h2 class="h6 fw-bold mb-2">Stall Orders (${orders.length}):</h2>
        ${orders.map(o => `
          <div class="card bg-light p-3 mb-3 border">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 pb-2 border-bottom">
              <div>
                <span class="badge-status badge-neutral me-1">#${esc(o.no)}</span>
                <strong class="fs-6"><i class="bi bi-shop text-wmsu me-1" aria-hidden="true"></i>${esc(cleanStallName(o.vendorName || 'Stall'))}</strong>
              </div>
              <div class="d-flex align-items-center gap-2">
                <span class="small fw-semibold text-muted">${o.pay === 'gcash' ? 'GCash QR' : 'Cash at Counter'}</span>
                ${badge(o.payStatus)}
                <b class="price-ink">${peso(o.total)}</b>
              </div>
            </div>
            <div class="py-2">${orderItemsThumbsHtml(o.items)}</div>

            ${o.code ? `
              <div class="bg-white border rounded p-3 d-flex justify-content-between align-items-center flex-wrap gap-2 mt-1">
                <div>
                  <span class="small text-muted d-block">Tracking Number</span>
                  <strong class="order-no" style="font-size:2rem">${esc(o.code)}</strong>
                </div>
                <button type="button" class="btn btn-sm btn-outline-wmsu" data-act="copy" data-v="${esc(o.code)}" aria-label="Copy tracking code ${esc(o.code)}"><i class="bi bi-clipboard" aria-hidden="true"></i> Copy code</button>
              </div>` : o.payStatus === 'Rejected' || o.status === 'rejected' ? `
              <div class="alert alert-danger small py-2 mb-0 mt-1">
                <i class="bi bi-x-circle-fill me-1" aria-hidden="true"></i> <b>${esc(o.cancelReason || stallPaySummaryText(o))}</b>
              </div>` : `
              <div class="alert alert-warning small py-2 mb-0 mt-1">
                <i class="bi bi-hourglass-split me-1" aria-hidden="true"></i> <b>Waiting for stall to confirm:</b> ${esc(stallPaySummaryText(o))}
                ${o.orderCode ? `<div class="mt-1">GCash Order Code: <code>${esc(o.orderCode)}</code></div>` : ''}
              </div>`}
          </div>`).join('')}
      </div>

      <div class="d-grid gap-2">
        <a class="btn btn-wmsu btn-lg" href="${orderLink('tracking', primary)}"><i class="bi bi-geo-alt me-1" aria-hidden="true"></i> Track Order</a>
        <a class="btn btn-light" href="${orderLink('receipt', primary)}"><i class="bi bi-receipt me-1" aria-hidden="true"></i> View Receipt</a>
      </div>
      <div class="mt-4 pt-3 border-top d-flex justify-content-between align-items-center flex-wrap gap-2 small text-muted" id="kioskBar">
        <span id="kioskTimer">${waitingAny ? 'Auto-checking verification status every 10 seconds…' : ''}</span>
        <button type="button" class="btn btn-sm btn-light" id="kioskReset"><i class="bi bi-arrow-repeat me-1" aria-hidden="true"></i> New Customer (Clear Session)</button>
      </div>
    </div>`;
  hydrateSmoothImages(v);

  const clearKiosk = () => {
    localStorage.removeItem('cart2'); localStorage.removeItem('draft'); localStorage.removeItem('lastOrder'); localStorage.removeItem('myOrders');
    sessionStorage.removeItem('kiosk_cname'); sessionStorage.removeItem('wmsu_gcash_codes');
    location = 'vendors.html';
  };
  $('#kioskReset').onclick = clearKiosk;
  clearInterval(window._kioskT);
  if (waitingAny) {
    window._confPoll = setInterval(() => { if (!document.hidden) refresh() }, 10000);
  } else {
    let sec = 60;
    const tick = () => { const el = $('#kioskTimer'); if (!el) return clearInterval(window._kioskT); el.innerHTML = `Kiosk privacy reset in <b>${sec}s</b> · <a href="#" id="kioskStay">Keep open</a>`; $('#kioskStay').onclick = e => { e.preventDefault(); clearInterval(window._kioskT); el.textContent = 'Auto-reset paused.' }; if (sec-- <= 0) { clearInterval(window._kioskT); clearKiosk() } };
    tick(); window._kioskT = setInterval(tick, 1000);
  }
};

C.receipt = async v => {
  const orders = await getOrders();
  if (!orders || !orders.length) return v.innerHTML = empty('receipt', 'Receipt not found.');
  const primary = orders[0];
  const grandTotal = orders.reduce((sum, o) => sum + o.total, 0);
  v.innerHTML = `
    <div class="receipt card p-4 content-fade-in">
      <div class="text-center"><h1 id="page-title" tabindex="-1" class="h6 fw-bold mb-0">WMSU CAMPUS CANTEEN</h1><small class="text-muted">${fmt(primary.time)}</small></div>
      <hr>
      <div>Customer: <b>${esc(primary.customer)}</b></div>
      <div>Order Type: ${esc(primary.type)}</div>
      <hr>
      ${orders.map(o => `
        <div class="mb-3">
          <div class="d-flex justify-content-between border-bottom pb-1">
            <strong>${esc(cleanStallName(o.vendorName || 'Stall'))}</strong>
            <small class="text-muted">#${esc(o.no)}</small>
          </div>
          <div class="small text-muted py-1">Method: ${o.pay === 'gcash' ? 'GCash QR' : 'Cash at Counter'} · ${esc(SLBL[o.payStatus] ? SLBL[o.payStatus]() : o.payStatus)}${o.code ? ` · Track: <b>${esc(o.code)}</b>` : ''}</div>
          ${o.ref ? `<div class="small text-muted">Ref No.: <code>${esc(o.ref)}</code></div>` : ''}
          ${o.items.map(i => `<div class="d-flex justify-content-between ps-2 pt-1"><span>${i.qty}× ${esc(i.name)}</span><span>${peso(i.qty * i.price)}</span></div>`).join('')}
          <div class="text-end small fw-semibold text-muted pt-1">Stall Total: ${peso(o.total)}</div>
        </div>`).join('')}
      <hr>
      <div class="d-flex justify-content-between fs-5"><b>GRAND TOTAL</b><b>${peso(grandTotal)}</b></div>
      <hr>
      <div class="text-center small text-muted">Thank you! Please keep this receipt.</div>
    </div>
    <div class="text-center mt-3 no-print">
      <button type="button" class="btn btn-wmsu" onclick="print()"><i class="bi bi-printer me-1" aria-hidden="true"></i> Print Receipt</button>
    </div>`;
};

const STEPS = [['pending', 'hourglass-split', 'Placed'], ['preparing', 'fire', 'Preparing'], ['ready', 'bag-check', 'Ready'], ['completed', 'emoji-smile', 'Completed']];
let poll;
C.tracking = async v => {
  clearInterval(poll);
  const no0 = (qs.get('no') || store.get('lastOrder', {}).no || '').toUpperCase();
  const code0 = (qs.get('code') || findCode(no0)).toUpperCase();
  const tok0 = (qs.get('token') || findKey(no0) || store.get('lastOrder', {}).token || '').toUpperCase();
  v.innerHTML = `<div class="content-fade-in">${head('Track my order', 'Updates automatically every 10 seconds. Tracking numbers appear once your stall confirms the order.')}
    <form id="tf" class="row g-2 mb-4" style="max-width:700px" novalidate>
      <div class="col-sm-5"><label for="tNo" class="visually-hidden">Order number</label><input id="tNo" name="no" class="form-control form-control-lg" placeholder="Order no. (e.g. WM...)" value="${esc(no0)}" required></div>
      <div class="col-sm-4"><label for="tCode" class="visually-hidden">Tracking or access code</label><input id="tCode" name="code" class="form-control form-control-lg" placeholder="Tracking code" maxlength="16" value="${esc(code0 || tok0)}" required></div>
      <div class="col-sm-3"><button class="btn btn-wmsu btn-lg w-100">Track</button></div>
    </form>
    <div id="tr" aria-live="polite"></div></div>`;
  let cur = null, prevTrackSig = '';
  const show = async () => {
    try {
      const r = await API.order(...cur);
      const orders = Array.isArray(r) ? r : [r];
      if (!orders.length) return $('#tr').innerHTML = empty('search', 'No orders found.');
      syncCodes(orders);
      const nextSig = orders.map(o => `${o.id}:${o.status}:${o.payStatus}:${o.code}:${o.queueAhead}:${o.estMinutes}`).join('|');
      if (nextSig === prevTrackSig) return;
      prevTrackSig = nextSig;
      const primary = orders[0];
      const released = orders.filter(o => o.code);
      $('#tr').innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <div>
            <h2 class="h4 mb-0 fw-bold">${released.length ? `Tracking Code${released.length > 1 ? 's' : ''}: <span class="text-wmsu">${released.map(o => esc(o.code)).filter((x, i, a) => a.indexOf(x) === i).join(' · ')}</span>` : `<span class="badge-status badge-pending"><i class="bi bi-hourglass-split me-1" aria-hidden="true"></i> Waiting for stall to confirm</span>`}</h2>
            <small class="text-muted">${orders.length} stall(s) in this order · Customer: ${esc(primary.customer)}</small>
          </div>
          <a class="btn btn-light btn-sm" href="${orderLink('receipt', primary)}"><i class="bi bi-receipt me-1" aria-hidden="true"></i> View receipt</a>
        </div>
        ${orders.map(o => `
          <div class="card p-4 mb-3 ${o.status === 'ready' ? 'border-success border-2' : ''}">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div>
                <h3 class="h5 fw-bold mb-0"><i class="bi bi-shop me-1" aria-hidden="true"></i> ${esc(cleanStallName(o.vendorName || 'Stall'))}</h3>
                <small class="text-muted">Order <strong class="text-wmsu">#${esc(o.no)}</strong> · ${peso(o.total)} · ${o.pay === 'gcash' ? 'GCash QR' : 'Cash at Counter'}${o.code ? ` · Track: <strong class="text-wmsu">${esc(o.code)}</strong>` : ''}</small>
              </div>
              <div class="d-flex gap-1 align-items-center flex-wrap">
                ${badge(o.status)} ${o.pay === 'cash' && o.payStatus === 'Unpaid' ? '' : badge(o.payStatus)}
              </div>
            </div>
            ${!o.code && o.status !== 'rejected' && o.payStatus !== 'Rejected' ? `
              <div class="alert alert-warning small py-2 mt-3 mb-0">
                <i class="bi bi-hourglass-split me-1" aria-hidden="true"></i> <b>Waiting for stall to confirm:</b> ${esc(stallPaySummaryText(o))}
                ${o.orderCode ? ` · Order Code: <code>${esc(o.orderCode)}</code>` : ''}
              </div>` : ''}
            <div class="stepper my-3">
              ${STEPS.map((s, i) => `<div class="step ${i <= STEPS.findIndex(x => x[0] === o.status) ? 'done' : ''}"><i class="bi bi-${s[1]}" aria-hidden="true"></i>${s[2]}</div>`).join('')}
            </div>
            ${o.status === 'ready' ? `<div class="alert alert-success small py-2 mb-2"><i class="bi bi-bell-fill me-1" aria-hidden="true"></i> <b>Ready for pickup!</b> Present tracking code <b>${esc(o.code)}</b> at ${esc(cleanStallName(o.vendorName))}.</div>` : ''}
            ${o.status === 'rejected' || o.payStatus === 'Rejected' ? `<div class="alert alert-danger small py-2 mb-2"><i class="bi bi-x-circle-fill me-1" aria-hidden="true"></i> <b>${esc(o.cancelReason || stallPaySummaryText(o))}</b></div>` : o.estMinutes != null && (o.status === 'pending' || o.status === 'preparing') ? `<div class="small text-wmsu fw-semibold mb-2"><i class="bi bi-clock me-1" aria-hidden="true"></i> Est. prep time: ~${o.estMinutes} mins${o.queueAhead > 0 ? ` (${o.queueAhead} order${o.queueAhead > 1 ? 's' : ''} ahead)` : ' (next in queue)'}</div>` : ''}
            <div class="pt-2 border-top">${orderItemsThumbsHtml(o.items)}</div>
          </div>`).join('')}`;
      hydrateSmoothImages($('#tr'));
    } catch (e) { clearInterval(poll); $('#tr').innerHTML = empty('search', esc(e.message)) }
  };
  const go = async () => { clearInterval(poll); await show(); poll = setInterval(() => { if (!document.hidden) show() }, 10000) };
  onForm('#tf', async d => { cur = [d.no.trim().toUpperCase(), d.code.trim().toUpperCase()]; prevTrackSig = ''; history.replaceState(0, '', '?no=' + encodeURIComponent(cur[0]) + '&code=' + encodeURIComponent(cur[1])); await go() });
  if (no0 && (code0 || tok0)) { cur = [no0, code0 || tok0]; await go() }
};

C.history = async v => {
  const mine = myOrders();
  const results = await Promise.all(mine.map(m => API.order(m.no, m.token || m.code).catch(() => null)));
  const orders = results.flat().filter(Boolean);
  syncCodes(orders);
  v.innerHTML = `<div class="content-fade-in">${head('Order history', 'Orders placed from this browser.')}${table([
    ['Order', o => `<b>#${esc(o.no)}</b>${o.code ? ` <span class="badge-status badge-wmsu">${esc(o.code)}</span>` : ''}<br><small class="text-muted"><i class="bi bi-shop" aria-hidden="true"></i> ${esc(cleanStallName(o.vendorName || ''))}</small>`],
    ['Date', o => fmt(o.time)],
    ['Items', o => orderItemsThumbsHtml(o.items)],
    ['Total', o => `<b class="price-ink">${peso(o.total)}</b>`],
    ['Payment', o => `${o.pay === 'gcash' ? 'GCash QR' : 'Cash'} ${badge(o.payStatus)}`],
    ['Status', o => badge(o.status)],
    ['Actions', o => `<div class="d-flex gap-1 justify-content-end"><a class="btn btn-sm btn-light" href="${orderLink('tracking', o)}"><i class="bi bi-geo-alt" aria-hidden="true"></i> Track</a> <a class="btn btn-sm btn-light" href="${orderLink('receipt', o)}"><i class="bi bi-receipt" aria-hidden="true"></i> Receipt</a></div>`]
  ], orders, 'You have not placed any orders yet.')}</div>`;
  hydrateSmoothImages(v);
};
