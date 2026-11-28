/* Customer / student kiosk pages */
const C = PAGES.customer, FOODS = {}, fImg = f => f.img ? `<img src="${esc(f.img)}" alt="${esc(f.name)}" width="320" height="160" loading="lazy" decoding="async">` : `<span aria-hidden="true">${f.emoji}</span>`;
const fmt12 = t => { if (!t) return ''; const [h, m] = String(t).split(':'); const hr = +h; return `${hr % 12 || 12}:${m || '00'} ${hr >= 12 ? 'PM' : 'AM'}` };
const myOrders = () => store.get('myOrders', []).filter(x => x && x.no), curV = () => +(qs.get('v') || store.get('vendorId') || 0);
const PAYS = { cash: ['cash-coin', 'Cash at Counter'], gcash: ['phone', 'GCash'] };
const head = (t, s = '') => `<div class="page-header mb-4"><h2 class="page-title">${t}</h2>${s ? `<p class="text-muted mb-0">${s}</p>` : ''}</div>`;

/* Shared search helpers */
const hl = (t, q) => { t = String(t ?? ''); if (!q) return esc(t); const i = t.toLowerCase().indexOf(q); return i < 0 ? esc(t) : esc(t.slice(0, i)) + '<mark class="hl">' + esc(t.slice(i, i + q.length)) + '</mark>' + esc(t.slice(i + q.length)) };
const searchBox = (id, ph) => `<div class="search-box"><i class="bi bi-search search-ico"></i><input id="${id}" type="search" class="search-input" placeholder="${ph}" autocomplete="off" aria-label="${ph}" spellcheck="false"><button type="button" class="search-clear" id="${id}Clear" aria-label="Clear search" hidden><i class="bi bi-x-lg"></i></button><kbd class="search-kbd d-none d-md-inline">/</kbd></div>`;
const bindSearch = (id, onChange) => {
  const inp = $('#' + id), clr = $('#' + id + 'Clear'); let t;
  const apply = () => { clr.hidden = !inp.value; onChange(inp.value.toLowerCase().trim()) };
  inp.addEventListener('input', () => { clearTimeout(t); clr.hidden = !inp.value; t = setTimeout(apply, 120) });
  clr.onclick = () => { inp.value = ''; apply(); inp.focus() };
  inp.addEventListener('keydown', e => { if (e.key === 'Escape' && inp.value) { inp.value = ''; apply() } });
  document.onkeydown = e => { if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && !document.querySelector('.modal.show')) { e.preventDefault(); inp.focus() } };
  return () => { inp.value = ''; apply() }
};

C.vendors = async v => {
  const [allVs, [cfg], fs] = await Promise.all([API.list('vendors'), API.list('settings').catch(() => [{}]), API.list('foods').catch(() => [])]);
  const vs = allVs.filter(x => x.status === 'active');
  let q = '', onlyOpen = false;
  v.innerHTML = head('Choose a vendor', cfg?.close ? `Browse campus stalls · Canteen hours ${fmt12(cfg.open)} – ${fmt12(cfg.close)}` : 'Select a campus food stall to browse their menu and start ordering.') + (vs.length ? `
    <div class="search-bar mb-4">
      ${searchBox('vq', 'Search stalls by name or description…')}
      <button type="button" class="pill" id="openOnly" aria-pressed="false"><i class="bi bi-door-open" aria-hidden="true"></i> Open now</button>
    </div>
    <div class="d-flex justify-content-between align-items-center mb-3"><span class="small text-muted" id="vcount" aria-live="polite"></span></div>
    <div class="vendor-grid no-anim-children" id="vgrid"></div>`: empty('shop', 'No vendors are open right now.'));
  if (!vs.length) return;
  const draw = () => {
    const l = vs.filter(x => (!onlyOpen || x.open) && (!q || x.name.toLowerCase().includes(q) || (x.desc || '').toLowerCase().includes(q)));
    $('#vcount').textContent = q || onlyOpen ? `${l.length} of ${vs.length} stall${vs.length > 1 ? 's' : ''}` : `${vs.length} stall${vs.length > 1 ? 's' : ''} available`;
    $('#vgrid').innerHTML = l.length ? l.map(x => {
      const vfoods = fs.filter(f => f.vendorId === x.id);
      const prices = vfoods.map(f => f.price);
      const meta = vfoods.length ? `${vfoods.length} item${vfoods.length > 1 ? 's' : ''} · ₱${Math.min(...prices)}–₱${Math.max(...prices)}` : 'Menu coming soon';
      const hasGcash = !!String(x.gcashNumber || '').trim();
      return `
        <div class="card vcard h-100 ${x.open ? 'is-open' : ''}" ${x.open ? `data-act="pickV" data-id="${x.id}"` : ''}>
          <div class="vcard-banner">${x.banner ? `<img src="${esc(x.banner)}" alt="${esc(x.name)} banner" width="400" height="92" loading="lazy" decoding="async">` : ''}</div>
          <div class="vcard-avatar" aria-hidden="true">${x.emoji || '🍽️'}</div>
          <div class="p-4 pt-2 d-flex flex-column flex-grow-1 text-center">
            <h5 class="fw-bold mb-1 text-truncate" title="${esc(x.name)}">${hl(x.name, q)}</h5>
            <p class="text-muted small vcard-desc mb-2">${hl(x.desc || 'Campus food stall', q)}</p>
            <div class="small text-muted mb-2">${esc(meta)}</div>
            <div class="d-flex justify-content-center flex-wrap gap-1 mb-3">
              ${badge(x.open ? 'Open now' : 'Closed')}
              <span class="badge-status badge-${hasGcash ? 'wmsu' : 'neutral'}">${hasGcash ? 'Cash & GCash' : 'Cash only'}</span>
            </div>
            <button type="button" class="btn btn-wmsu w-100 mt-auto" aria-label="View menu for ${esc(x.name)}" data-act="pickV" data-id="${x.id}" ${x.open ? '' : 'disabled'}>
              <i class="bi bi-menu-app me-1" aria-hidden="true"></i> View Menu
            </button>
          </div>
        </div>`;
    }).join('') : `<div style="grid-column:1/-1">${empty('search', q ? `No stalls match “${esc(q)}”.` : 'No stalls are open right now.', `<button class="btn btn-light mt-2" data-act="vClear"><i class="bi bi-x-circle me-1" aria-hidden="true"></i> Clear filters</button>`)}</div>`;
  };
  const reset = bindSearch('vq', s => { q = s; draw() });
  $('#openOnly').onclick = e => { onlyOpen = !onlyOpen; e.currentTarget.classList.toggle('active', onlyOpen); e.currentTarget.setAttribute('aria-pressed', onlyOpen); draw() };
  acts.vClear = () => { onlyOpen = false; $('#openOnly').classList.remove('active'); reset() };
  draw();
};
acts.pickV = d => { store.set('vendorId', +d.id); location = 'menu.html?v=' + d.id };
acts.quick = async d => { const f = FOODS[d.id]; if (!f) return; if (f.stockQty != null) { const cur = cart.get().items.find(i => i.id === f.id)?.qty || 0; if (cur >= f.stockQty) return toast(`Only ${f.stockQty} left in stock.`, 'danger') } await cart.add(f); C._redrawMenu?.() };
acts.menuQty = d => { const f = FOODS[d.id]; if (f && +d.d > 0 && f.stockQty != null) { const cur = cart.get().items.find(i => i.id === f.id)?.qty || 0; if (cur >= f.stockQty) return toast(`Only ${f.stockQty} left in stock.`, 'danger') } cart.setQty(+d.id, +d.d); C._redrawMenu?.() };

C.menu = async v => {
  const vid = curV(); if (!vid) return location = 'vendors.html';
  const [vs, { cs, foods: all }] = await Promise.all([API.list('vendors'), API.foodsByVendor(vid)]);
  const ven = vs.find(x => x.id === vid);
  if (!ven) {
    C._redrawMenu = null;
    return v.innerHTML = empty('shop', 'This stall was not found or is currently unavailable.', '<a class="btn btn-wmsu mt-2" href="vendors.html"><i class="bi bi-arrow-left me-1" aria-hidden="true"></i> Back to All Vendors</a>');
  }
  store.set('vendorId', vid);
  all.forEach(f => FOODS[f.id] = f);
  const mine = cs.filter(c => all.some(f => f.catId === c.id)); let cat = 0, q = '', avail = false;
  v.innerHTML = `
    <div class="mb-3">
      <a href="vendors.html" class="text-wmsu text-decoration-none small fw-semibold d-inline-flex align-items-center gap-1 mb-2">
        <i class="bi bi-arrow-left" aria-hidden="true"></i> All Vendors
      </a>
      <div class="storefront-banner ${ven.banner ? 'has-img' : ''}">
        ${ven.banner ? `<img class="storefront-banner-img" src="${esc(ven.banner)}" alt="${esc(ven.name)} banner" width="1200" height="180" decoding="async">` : ''}
        <div class="storefront-banner-body">
          <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
            <h2 class="page-title mb-0">${esc(ven.name)}</h2>
            ${badge(ven.open ? 'Open now' : 'Closed')}
          </div>
          <p class="text-muted mb-0">${esc(ven.desc || 'Pick your meal.')}</p>
        </div>
      </div>
    </div>
    ${!ven.open ? `<div class="alert alert-warning d-flex align-items-center gap-2 mb-3"><i class="bi bi-door-closed-fill fs-5" aria-hidden="true"></i><div><b>This stall is currently closed.</b> You can browse the menu, but ordering is disabled until the stall reopens.</div></div>` : ''}
    <div class="search-bar mb-3">
      ${searchBox('q', 'Search dishes, ingredients or categories…')}
      <button type="button" class="pill" id="availOnly" aria-pressed="false"><i class="bi bi-check2-circle" aria-hidden="true"></i> In stock only</button>
    </div>
    <div class="pills mb-3" id="pills" role="toolbar" aria-label="Menu categories"></div>
    <div class="small text-muted mb-3" id="mcount" aria-live="polite"></div>
    <div id="grid" class="no-anim-children"></div>`;
  const catName = id => cs.find(c => c.id === id)?.name || 'Other Items';
  const cardHtml = f => {
    const inCart = cart.get().items.find(i => i.id === f.id)?.qty || 0;
    const cta = !ven.open ? '<span class="badge-status badge-neutral">Closed</span>'
      : !f.available ? '<span class="badge-status badge-neutral">Sold out</span>'
      : inCart ? `<div class="qty"><button type="button" data-act="menuQty" data-id="${f.id}" data-d="-1" aria-label="Decrease ${esc(f.name)} quantity">−</button><span>${inCart}</span><button type="button" data-act="menuQty" data-id="${f.id}" data-d="1" aria-label="Increase ${esc(f.name)} quantity">+</button></div>`
      : `<button type="button" class="btn btn-wmsu btn-sm px-3" aria-label="Add ${esc(f.name)} to cart" data-act="quick" data-id="${f.id}"><i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Add</button>`;
    return `
      <div class="card fcard h-100 ${f.available && ven.open ? '' : 'opacity-75'}">
        <a href="food-details.html?id=${f.id}" class="fimg" aria-label="View details for ${esc(f.name)}">${fImg(f)}</a>
        <div class="p-3 d-flex flex-column flex-grow-1">
          <h6 class="fw-bold mb-1 text-truncate" title="${esc(f.name)}">${hl(f.name, q)}</h6>
          <p class="text-muted small mb-2 text-truncate">${hl(f.desc || '', q)}</p>
          ${f.available && f.stockQty != null && f.stockQty <= 10 ? `<div class="mb-2"><span class="badge-status badge-pending">${f.stockQty} left</span></div>` : ''}
          <div class="d-flex justify-content-between align-items-center mt-auto pt-2 border-top">
            <strong class="text-dark fs-5">${peso(f.price)}</strong>
            ${cta}
          </div>
        </div>
      </div>`;
  };
  const draw = () => {
    $('#pills').innerHTML = [{ id: 0, name: 'All', icon: '🍽️' }, ...mine].map(c => `<button type="button" class="pill ${c.id === cat ? 'active' : ''}" aria-pressed="${c.id === cat}" data-act="cat" data-id="${c.id}"><span aria-hidden="true">${c.icon}</span> ${esc(c.name)}</button>`).join('');
    const l = all.filter(f => (!cat || f.catId === cat) && (!avail || f.available) && (!q || f.name.toLowerCase().includes(q) || (f.desc || '').toLowerCase().includes(q) || catName(f.catId).toLowerCase().includes(q)));
    $('#mcount').textContent = q || cat || avail ? `${l.length} of ${all.length} item${all.length > 1 ? 's' : ''}` : `${all.length} item${all.length > 1 ? 's' : ''} on the menu`;
    if (!l.length) {
      $('#grid').innerHTML = empty('search', q ? `No dishes match “${esc(q)}”.` : 'No items in this view.', `<button class="btn btn-light mt-2" data-act="mClear"><i class="bi bi-x-circle me-1" aria-hidden="true"></i> Clear search &amp; filters</button>`);
      return;
    }
    if (!cat && !q && mine.length > 1) {
      const groups = [...mine, ...(l.some(f => !f.catId) ? [{ id: null, name: 'Other Items', icon: '🍽️' }] : [])]
        .map(c => ({ c, items: l.filter(f => f.catId === c.id) })).filter(g => g.items.length);
      $('#grid').innerHTML = groups.map(g => `<section class="mb-4"><h3 class="cat-section-title"><span aria-hidden="true">${g.c.icon}</span> ${esc(g.c.name)} <small class="text-muted fw-normal">(${g.items.length})</small></h3><div class="menu-grid">${g.items.map(cardHtml).join('')}</div></section>`).join('');
    } else {
      $('#grid').innerHTML = `<div class="menu-grid">${l.map(cardHtml).join('')}</div>`;
    }
  };
  C._redrawMenu = draw;
  const reset = bindSearch('q', s => { q = s; draw() });
  $('#availOnly').onclick = e => { avail = !avail; e.currentTarget.classList.toggle('active', avail); e.currentTarget.setAttribute('aria-pressed', avail); draw() };
  acts.cat = d => { cat = +d.id; draw() };
  acts.mClear = () => { cat = 0; avail = false; $('#availOnly').classList.remove('active'); reset() };
  draw();
};

C['food-details'] = async v => {
  const f = (await API.list('foods')).find(x => x.id === +qs.get('id'));
  if (!f) return v.innerHTML = empty('search', 'This food item was not found.', '<a class="btn btn-wmsu" href="vendors.html">Back to vendors</a>');
  let n = 1;
  v.innerHTML = `
    <a href="menu.html?v=${f.vendorId}" class="text-wmsu text-decoration-none small fw-semibold d-inline-flex align-items-center gap-1 mb-3">
      <i class="bi bi-arrow-left"></i> Back to menu
    </a>
    <div class="row g-4">
      <div class="col-lg-6">
        <div class="fimg big">${fImg(f)}</div>
      </div>
      <div class="col-lg-6 d-flex flex-column justify-content-center">
        <h1 class="fw-bold mb-2">${esc(f.name)}</h1>
        <h3 class="text-wmsu fw-bold mb-2">${peso(f.price)}</h3>
        ${f.stockQty != null ? `<div class="mb-3"><span class="badge-status badge-${f.stockQty > 5 ? 'neutral' : f.stockQty > 0 ? 'pending' : 'danger'}">${f.stockQty > 0 ? f.stockQty + ' serving(s) remaining' : 'Sold out'}</span></div>` : ''}
        <p class="lead text-muted mb-4">${esc(f.desc)}</p>
        <div class="d-flex align-items-center gap-3 mb-4">
          <span class="fw-semibold">Quantity:</span>
          <div class="qty"><button data-act="dq" data-d="-1" aria-label="Less">−</button><span id="n" class="fs-4">1</span><button data-act="dq" data-d="1" aria-label="More">+</button></div>
        </div>
        <div>
          <button class="btn btn-wmsu btn-lg px-4" id="add" ${f.available ? '' : 'disabled'}>
            <i class="bi bi-cart-plus me-1"></i> ${f.available ? 'Add to cart' : 'Sold out'}
          </button>
        </div>
      </div>
    </div>`;
  const maxQ = f.stockQty != null ? Math.max(1, Math.min(20, f.stockQty)) : 20;
  acts.dq = d => { n = Math.max(1, Math.min(maxQ, n + +d.d)); $('#n').textContent = n };
  $('#add').onclick = async () => { if (await cart.add(f, n)) location = 'cart.html' };
};

C.cart = async v => {
  const vs = await API.list('vendors');
  const renderCart = () => {
    const c = cart.get();
    if (!c.items.length) { v.innerHTML = head('Your cart') + empty('cart-x', 'Your cart is empty.', '<a class="btn btn-wmsu btn-lg mt-3" href="vendors.html"><i class="bi bi-shop me-1" aria-hidden="true"></i> Start ordering</a>'); return }
    v.innerHTML = head('Your cart', 'Review order items from all selected stalls.') + `
      <div class="row g-4 no-anim-children">
        <div class="col-lg-8">
          ${c.items.map(i => {
      const ven = vs.find(x => x.id === i.vendorId);
      return `
              <div class="card p-3 mb-3 d-flex flex-row align-items-center gap-3">
                <span style="font-size:2.4rem" aria-hidden="true">${i.emoji || '🍽️'}</span>
                <div class="flex-grow-1">
                  <h5 class="fw-bold mb-0">${esc(i.name)}</h5>
                  <div class="d-flex align-items-center gap-2 mt-1">
                    <span class="text-muted fw-semibold">${peso(i.price)}</span>
                    ${ven ? `<span class="badge-status badge-wmsu"><i class="bi bi-shop" aria-hidden="true"></i> ${esc(ven.name)}</span>` : ''}
                  </div>
                </div>
                <div class="qty">
                  <button type="button" data-act="cq" data-id="${i.id}" data-d="-1" aria-label="Decrease ${esc(i.name)} quantity">−</button>
                  <span>${i.qty}</span>
                  <button type="button" data-act="cq" data-id="${i.id}" data-d="1" aria-label="Increase ${esc(i.name)} quantity">+</button>
                </div>
                <b style="width:90px" class="text-end text-dark fs-5">${peso(i.price * i.qty)}</b>
                <button type="button" class="btn btn-light text-danger" aria-label="Remove ${esc(i.name)} from cart" data-act="cr" data-id="${i.id}"><i class="bi bi-trash" aria-hidden="true"></i></button>
              </div>`;
    }).join('')}
          <button type="button" class="btn btn-link text-danger p-0 mt-2 text-decoration-none" data-act="cclear"><i class="bi bi-trash me-1" aria-hidden="true"></i> Clear cart</button>
        </div>
        <div class="col-lg-4">
          <div class="card p-4">
            <h5 class="fw-bold mb-3">Order Summary</h5>
            <div class="d-flex justify-content-between text-muted mb-2"><span>Subtotal</span><b>${peso(cart.total())}</b></div>
            <hr class="my-3">
            <div class="d-flex justify-content-between fs-4 mb-4"><b>Total</b><b class="text-dark">${peso(cart.total())}</b></div>
            <a href="checkout.html" class="btn btn-wmsu btn-lg w-100 mb-2">Proceed to Checkout</a>
            <a href="vendors.html" class="btn btn-light w-100"><i class="bi bi-plus-lg me-1" aria-hidden="true"></i> Add items from other stalls</a>
          </div>
        </div>
      </div>`;
  };
  C._redrawCart = renderCart;
  renderCart();
};
acts.cq = d => { cart.setQty(d.id, +d.d); C._redrawCart ? C._redrawCart() : refresh() };
acts.cr = async d => { if (await confirmBox('Remove this item?', 'Remove')) { const c = cart.get(); c.items = c.items.filter(i => i.id != d.id); cart.save(c); C._redrawCart ? C._redrawCart() : refresh() } };
acts.cclear = async () => { if (await confirmBox('Remove everything from your cart?', 'Clear cart')) { sessionStorage.removeItem('kiosk_cname'); cart.clear(); C._redrawCart ? C._redrawCart() : refresh() } };

C.checkout = async v => {
  if (!cart.count()) return location = 'cart.html';
  const [vs, o] = await Promise.all([API.list('vendors'), store.get('draft', { type: 'Dine-In' })]);
  const savedName = sessionStorage.getItem('kiosk_cname') || '';
  v.innerHTML = head('Checkout', 'Tell us how you want to receive your order.') + `
    <form id="cf" novalidate class="row g-4">
      <div class="col-lg-7">
        <label class="form-label mb-2">Dining preference</label>
        <div class="row g-3 mb-4">
          ${[['Dine-In', 'cup-hot'], ['Take-Out', 'bag']].map(t => `
            <div class="col-6">
              <label class="w-100 h-100">
                <input type="radio" class="visually-hidden" name="type" value="${t[0]}" ${o.type === t[0] ? 'checked' : ''}>
                <span class="opt">
                  <i class="bi bi-${t[1]}" aria-hidden="true"></i>
                  <h5 class="mt-2 mb-0 fw-bold">${t[0]}</h5>
                </span>
              </label>
            </div>`).join('')}
        </div>
        <div class="mb-3">
          <label class="form-label" for="custName">Customer Name</label>
          <input id="custName" name="customer" class="form-control form-control-lg" placeholder="Enter your full name" value="${esc(savedName)}" autocomplete="off" minlength="2" required>
          <div class="invalid-feedback">Please enter your name.</div>
        </div>
      </div>
      <div class="col-lg-5">
        <div class="card p-4">
          <h5 class="fw-bold mb-3">Order Summary</h5>
          ${cart.get().items.map(i => {
    const ven = vs.find(x => x.id === i.vendorId);
    return `<div class="d-flex justify-content-between align-items-center mb-2"><div><div>${i.qty}× ${esc(i.name)}</div>${ven ? `<small class="text-muted"><i class="bi bi-shop" aria-hidden="true"></i> ${esc(ven.name)}</small>` : ''}</div><b>${peso(i.qty * i.price)}</b></div>`;
  }).join('')}
          <hr class="my-3">
          <div class="d-flex justify-content-between fs-4 mb-4"><b>Total</b><b class="text-dark">${peso(cart.total())}</b></div>
          <button class="btn btn-wmsu btn-lg w-100">Continue to Payment</button>
        </div>
      </div>
    </form>`;
  onForm('#cf', async d => { sessionStorage.setItem('kiosk_cname', d.customer); store.set('draft', { type: d.type }); location = 'payment.html' });
};

C.payment = async v => {
  if (!cart.count()) return location = 'cart.html';
  const [[s], vs] = await Promise.all([API.list('settings'), API.list('vendors')]), on = Object.keys(PAYS).filter(k => s[k]);
  const byV = {};
  cart.get().items.forEach(i => { if (!byV[i.vendorId]) byV[i.vendorId] = 0; byV[i.vendorId] += i.price * i.qty });
  const stallTotals = Object.entries(byV).map(([vid, tot]) => ({ ven: vs.find(x => x.id === +vid) || {}, tot }));
  const missingGcash = stallTotals.filter(x => !String(x.ven.gcashNumber || '').trim()).map(x => x.ven.name || 'this vendor');
  const underMinGcash = stallTotals.filter(x => x.tot < 20).map(x => `${x.ven.name || 'Stall'} (min ₱20.00)`);
  let reqSet = false;
  v.innerHTML = head('Choose payment', `Total to pay: <b class="text-dark">${peso(cart.total())}</b>`) + `
    <form id="pf" novalidate>
      <div class="row g-3 mb-3">
        ${on.map(k => {
    const missing = k === 'gcash' ? [...missingGcash, ...underMinGcash] : [];
    const isDis = missing.length > 0;
    const req = !isDis && !reqSet ? (reqSet = true, 'required') : '';
    return `
            <div class="col-6 col-lg-4">
              <label class="w-100 h-100">
                <input type="radio" class="visually-hidden" name="pay" value="${k}" ${isDis ? 'disabled' : req}>
                <span class="opt ${isDis ? 'disabled' : ''}">
                  <i class="bi bi-${PAYS[k][0]}" aria-hidden="true"></i>
                  <h6 class="mt-2 mb-0 fw-bold">${PAYS[k][1]}</h6>
                  ${isDis ? `<div class="small text-danger mt-1" style="font-size:.75rem;line-height:1.2">GCash unavailable (${esc(missing.join(', '))})</div>` : ''}
                </span>
              </label>
            </div>`;
  }).join('')}
      </div>
      <div id="pinfo" class="mb-4"></div>
      <div class="text-danger small mb-3 d-none" id="perr">Please select a payment method.</div>
      <div class="d-flex gap-2">
        <a href="checkout.html" class="btn btn-light btn-lg">Back</a>
        <button class="btn btn-wmsu btn-lg px-5">Place Order</button>
      </div>
    </form>`;
  const updateInfo = m => {
    if (m === 'cash') $('#pinfo').innerHTML = `<div class="alert alert-light border small mb-0"><i class="bi bi-info-circle text-wmsu me-1" aria-hidden="true"></i> Pay <b>${peso(cart.total())}</b> directly at the stall counter(s) when your order is called.</div>`;
    else if (m === 'gcash') {
      $('#pinfo').innerHTML = `<div class="card bg-light p-3 border small"><div class="fw-bold mb-2"><i class="bi bi-phone text-wmsu me-1" aria-hidden="true"></i> Automated GCash Checkout (${stallTotals.length} stall${stallTotals.length > 1 ? 's' : ''})</div>${stallTotals.map(({ ven, tot }) => `<div class="d-flex justify-content-between align-items-center py-1 border-bottom"><span><b>${esc(ven.name || 'Stall')}</b> (${esc(ven.gcashNumber)})</span><b class="text-dark">${peso(tot)}</b></div>`).join('')}<div class="text-muted mt-2">You will be redirected to GCash Checkout to complete payment. Once verified, your tracking number is generated automatically.</div></div>`;
    } else $('#pinfo').innerHTML = '';
  };
  document.querySelectorAll('input[name="pay"]').forEach(el => el.addEventListener('change', e => { $('#perr').classList.add('d-none'); updateInfo(e.target.value); }));
  onForm('#pf', async d => {
    if (!d.pay) return $('#perr').classList.remove('d-none');
    const c = cart.get(), dr = store.get('draft', {}), cname = sessionStorage.getItem('kiosk_cname') || '';
    const o = await API.save('orders', { items: c.items, type: dr.type || 'Dine-In', customer: cname, pay: d.pay });
    store.set('myOrders', [{ no: o.no, token: o.token, code: o.code || '' }, ...myOrders()]);
    store.set('lastOrder', { no: o.no, token: o.token, code: o.code || '' });
    localStorage.removeItem('draft');
    sessionStorage.removeItem('kiosk_cname');
    cart.clear();
    location = 'confirmation.html?no=' + encodeURIComponent(o.no) + '&token=' + encodeURIComponent(o.token);
  });
};

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
const payNote = o => o.pay === 'cash' ? (o.payStatus === 'Paid' ? 'Payment received.' : o.code ? 'Cash order accepted. Please pay at the stall counter when called.' : 'Awaiting vendor acceptance. Tracking number will be released once accepted.') : o.payStatus === 'Paid' ? 'GCash payment verified & tracking released.' : 'Complete your GCash checkout below. Your tracking number will be generated automatically once paid.';

C.confirmation = async v => {
  clearInterval(window._confPoll);
  const orders = await getOrders();
  if (!orders || !orders.length) return v.innerHTML = empty('receipt', 'No order found.', '<a class="btn btn-wmsu" href="vendors.html">Order now</a>');
  const primary = orders[0];
  const grandTotal = orders.reduce((sum, o) => sum + o.total, 0);
  const isGcash = primary.pay === 'gcash';
  const released = orders.filter(o => o.code);
  const anyUnpaidGcash = isGcash && orders.some(o => o.payStatus !== 'Paid' && o.orderStatus !== 'Cancelled');
  v.innerHTML = `
    <div class="text-center card p-4 p-md-5 mx-auto" style="max-width:680px">
      <i class="bi bi-${released.length ? 'check-circle-fill text-success' : 'hourglass-split text-wmsu'}" style="font-size:4rem"></i>
      <h3 class="fw-bold mt-2">${released.length ? 'Order Confirmed!' : 'Order Placed!'}</h3>
      ${released.length ? `<p class="text-muted mb-1">Released Tracking Code${released.length > 1 ? 's' : ''}</p><div class="order-no mb-2">${released.map(o => esc(o.code)).filter((x, i, a) => a.indexOf(x) === i).join(' · ')}</div>` : `<div class="my-2"><span class="badge-status badge-pending fs-6 px-3 py-2"><i class="bi bi-lock me-1"></i> ${isGcash ? 'Awaiting Payment Confirmation' : 'Awaiting Vendor Acceptance'}</span></div><p class="small text-muted mb-2">${isGcash ? 'No tracking number has been generated yet. Complete your GCash payment below and your tracking number will be released automatically.' : 'Your tracking number will be generated once the vendor accepts your cash order.'}</p>`}
      <p class="text-muted small mb-4">${esc(primary.type)} · ${PAYS[primary.pay]?.[1] || esc(primary.pay)} · Grand Total: <b class="text-wmsu">${peso(grandTotal)}</b></p>

      <div class="text-start mb-4">
        <div class="fw-bold mb-2">Stall Orders & Payment (${orders.length}):</div>
        ${orders.map(o => {
    const needPay = isGcash && ['Pending', 'Unpaid', 'Failed'].includes(o.payStatus) && o.orderStatus !== 'Cancelled';
    return `
            <div class="card bg-light p-3 mb-3 border">
              <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 pb-2 border-bottom">
                <div>
                  <span class="badge-status badge-neutral me-1">#${esc(o.no)}</span>
                  <strong class="fs-6"><i class="bi bi-shop text-wmsu me-1"></i>${esc(o.vendorName || 'Stall')}</strong>
                  ${o.code ? `<span class="badge-status badge-wmsu ms-1">Track: ${esc(o.code)}</span>` : `<span class="badge-status badge-pending ms-1">${isGcash ? 'Awaiting Payment Confirmation' : 'Awaiting Acceptance'}</span>`}
                </div>
                <div class="d-flex align-items-center gap-2">
                  ${badge(o.payStatus)}
                  <b class="text-wmsu fs-5">${peso(o.total)}</b>
                </div>
              </div>
              <div class="small text-muted py-2">
                ${o.items.map(i => `${i.qty}× ${esc(i.name)}`).join(', ')}
              </div>
              ${needPay ? `
                <div class="card p-3 bg-white border mt-1">
                  ${o.payStatus === 'Failed' ? '<div class="alert alert-danger py-2 small mb-2">GCash payment was not completed or failed. Please try again.</div>' : ''}
                  <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <div class="small">
                      <div class="fw-bold text-dark">GCash Checkout Ready</div>
                      <div class="text-muted">Amount due: <b class="text-wmsu">${peso(o.total)}</b></div>
                    </div>
                    ${o.checkoutUrl ? `<a class="btn btn-wmsu" href="${esc(o.checkoutUrl)}"><i class="bi bi-phone me-1"></i> Pay with GCash</a>` : '<span class="text-danger small">Checkout link unavailable</span>'}
                  </div>
                </div>` :
        isGcash && o.payStatus === 'Paid' ? `<div class="small text-success fw-semibold mt-1"><i class="bi bi-patch-check-fill me-1"></i> GCash payment verified automatically${o.ref ? ` (Ref: <code>${esc(o.ref)}</code>)` : ''}${o.code ? ` · Tracking Code: <b>${esc(o.code)}</b>` : ''}</div>` :
          `<div class="small text-muted mt-1"><i class="bi bi-cash-coin me-1"></i> ${payNote(o)}</div>`}
            </div>`;
  }).join('')}
      </div>

      <div class="d-grid gap-2">
        <a class="btn btn-wmsu btn-lg" href="${orderLink('tracking', primary)}"><i class="bi bi-geo-alt me-1"></i> Track Order Status</a>
        <a class="btn btn-light" href="${orderLink('receipt', primary)}"><i class="bi bi-receipt me-1"></i> View Receipt</a>
      </div>
      <div class="mt-4 pt-3 border-top d-flex justify-content-between align-items-center flex-wrap gap-2 small text-muted" id="kioskBar">
        <span id="kioskTimer"></span>
        <button type="button" class="btn btn-sm btn-light" id="kioskReset"><i class="bi bi-arrow-repeat me-1"></i> New Customer (Clear Session)</button>
      </div>
    </div>`;
  const clearKiosk = () => { localStorage.removeItem('cart2'); localStorage.removeItem('draft'); localStorage.removeItem('lastOrder'); localStorage.removeItem('myOrders'); sessionStorage.removeItem('kiosk_cname'); location = 'vendors.html' };
  $('#kioskReset').onclick = clearKiosk;
  clearInterval(window._kioskT);
  if (anyUnpaidGcash) {
    window._confPoll = setInterval(() => { if (!document.hidden) refresh() }, 4000);
  } else {
    let sec = 60;
    const tick = () => { const el = $('#kioskTimer'); if (!el) return clearInterval(window._kioskT); el.innerHTML = `Kiosk privacy reset in <b>${sec}s</b> · <a href="#" id="kioskStay">Keep open</a>`; $('#kioskStay').onclick = e => { e.preventDefault(); clearInterval(window._kioskT); el.textContent = 'Auto-reset paused.' }; if (sec-- <= 0) { clearInterval(window._kioskT); clearKiosk() } };
    tick(); window._kioskT = setInterval(tick, 1000);
  }
};


C['gcash-pay'] = async v => {
  const no = cleanK(qs.get('no')), tok = cleanK(qs.get('token')), cid = qs.get('cid') || '';
  if (!no || !cid) return v.innerHTML = empty('exclamation-triangle', 'Invalid GCash checkout session.', '<a class="btn btn-wmsu" href="vendors.html">Back to vendors</a>');
  let orders; try { orders = await API.order(no, tok) } catch { orders = null }
  const o = orders && orders.find(x => x.no === no);
  if (!o) return v.innerHTML = empty('receipt', 'Order not found.', '<a class="btn btn-wmsu" href="vendors.html">Back to vendors</a>');
  if (o.payStatus === 'Paid') { location = orderLink('confirmation', o); return }
  v.innerHTML = `
    <div class="card p-4 p-md-5 mx-auto" style="max-width:460px;border-top:4px solid #007dfe">
      <div class="text-center mb-3">
        <div class="d-inline-flex align-items-center justify-content-center rounded-circle mb-2" style="width:56px;height:56px;background:#e6f2ff;color:#007dfe;font-size:1.7rem"><i class="bi bi-phone"></i></div>
        <h4 class="fw-bold mb-0">GCash Checkout</h4>
        <div class="small text-muted">Automated Payment Gateway</div>
      </div>
      <div class="card bg-light p-3 mb-4 small">
        <div class="d-flex justify-content-between mb-1"><span class="text-muted">Merchant</span><b>${esc(o.vendorName || 'WMSU Canteen')}</b></div>
        <div class="d-flex justify-content-between mb-1"><span class="text-muted">GCash Account</span><span>${esc(o.gcashNumber || '-')}</span></div>
        <div class="d-flex justify-content-between mb-1"><span class="text-muted">Order No.</span><b>#${esc(o.no)}</b></div>
        <hr class="my-2">
        <div class="d-flex justify-content-between fs-5"><b>Amount Due</b><b style="color:#007dfe">${peso(o.total)}</b></div>
      </div>
      <div class="d-grid gap-2">
        <button class="btn btn-lg text-white fw-bold" style="background:#007dfe;border-color:#007dfe" id="gcPay"><i class="bi bi-shield-check me-1"></i> Authorize &amp; Pay ${peso(o.total)}</button>
        <button class="btn btn-light text-danger" id="gcFail">Cancel / Simulate Failed Payment</button>
      </div>
    </div>`;
  const run = async outcome => {
    $('#gcPay').disabled = true; $('#gcFail').disabled = true;
    try {
      await API.f('gcash_checkout', { m: 'POST', b: { order_no: o.no, token: tok, checkout_id: cid, outcome } });
      toast(outcome === 'paid' ? 'GCash payment verified! Tracking number generated.' : 'Payment failed/cancelled.', outcome === 'paid' ? 'success' : 'danger');
      location = `confirmation.html?no=${encodeURIComponent(o.no)}&token=${encodeURIComponent(tok)}`;
    } catch (x) { toast(x.message, 'danger'); $('#gcPay').disabled = false; $('#gcFail').disabled = false }
  };
  $('#gcPay').onclick = () => run('paid');
  $('#gcFail').onclick = () => run('failed');
};

C.receipt = async v => {
  const orders = await getOrders();
  if (!orders || !orders.length) return v.innerHTML = empty('receipt', 'Receipt not found.');
  const primary = orders[0];
  const grandTotal = orders.reduce((sum, o) => sum + o.total, 0);
  v.innerHTML = `
    <div class="receipt card p-4">
      <div class="text-center"><b>WMSU CAMPUS CANTEEN</b><br><small class="text-muted">${fmt(primary.time)}</small></div>
      <hr>
      <div>Tracking Code: <b>${orders.some(o => o.code) ? orders.map(o => o.code ? esc(o.code) : 'Pending').filter((x, i, a) => a.indexOf(x) === i).join(', ') : 'Awaiting Payment Confirmation'}</b></div>
      <div>Customer: <b>${esc(primary.customer)}</b></div>
      <div>Order Type: ${esc(primary.type)}</div>
      <hr>
      ${orders.map(o => `
        <div class="mb-3">
          <div class="d-flex justify-content-between border-bottom pb-1">
            <strong><i class="bi bi-shop"></i> ${esc(o.vendorName || 'Stall')}</strong>
            <small class="text-muted">#${esc(o.no)}</small>
          </div>
          ${o.items.map(i => `<div class="d-flex justify-content-between ps-2 pt-1"><span>${i.qty}× ${esc(i.name)}</span><span>${peso(i.qty * i.price)}</span></div>`).join('')}
          <div class="text-end small fw-semibold text-muted pt-1">Stall Total: ${peso(o.total)}</div>
        </div>`).join('')}
      <hr>
      <div class="d-flex justify-content-between fs-5"><b>GRAND TOTAL</b><b>${peso(grandTotal)}</b></div>
      <div class="mt-1">Paid via: ${PAYS[primary.pay]?.[1] || esc(primary.pay)} (${esc(primary.payStatus)})</div>
      ${primary.ref ? `<div>Reference: <code>${esc(primary.ref)}</code></div>` : ''}
      <hr>
      <div class="text-center small text-muted">Thank you! Please keep this receipt.</div>
    </div>
    <div class="text-center mt-3 no-print">
      <button class="btn btn-wmsu" onclick="print()"><i class="bi bi-printer me-1"></i> Print Receipt</button>
    </div>`;
};

const STEPS = [['pending', 'hourglass-split', 'Received'], ['preparing', 'fire', 'Preparing'], ['ready', 'bag-check', 'Ready'], ['completed', 'emoji-smile', 'Picked up']];
let poll;
C.tracking = async v => {
  clearInterval(poll);
  const no0 = (qs.get('no') || store.get('lastOrder', {}).no || '').toUpperCase();
  const code0 = (qs.get('code') || findCode(no0)).toUpperCase();
  const tok0 = (qs.get('token') || findKey(no0) || store.get('lastOrder', {}).token || '').toUpperCase();
  v.innerHTML = head('Track my order', 'Enter your order number and 6-character tracking code (released after payment confirmation).') + `
    <form id="tf" class="row g-2 mb-4" style="max-width:700px" novalidate>
      <div class="col-sm-5"><input name="no" class="form-control form-control-lg" placeholder="Order no. (e.g. WM...)" value="${esc(no0)}" required></div>
      <div class="col-sm-4"><input name="code" class="form-control form-control-lg" placeholder="Tracking code" maxlength="16" value="${esc(code0)}" required></div>
      <div class="col-sm-3"><button class="btn btn-wmsu btn-lg w-100">Track</button></div>
    </form>
    <div id="tr"></div>`;
  let cur = null;
  const show = async () => {
    try {
      const r = await API.order(...cur);
      const orders = Array.isArray(r) ? r : [r];
      if (!orders.length) return $('#tr').innerHTML = empty('search', 'No orders found.');
      syncCodes(orders);
      const primary = orders[0];
      const needPay = primary.pay === 'gcash' && orders.some(o => ['Pending', 'Unpaid', 'Failed'].includes(o.payStatus) && o.orderStatus !== 'Cancelled');
      const released = orders.filter(o => o.code);
      $('#tr').innerHTML = `
        ${needPay ? `<div class="alert alert-warning d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3"><div><i class="bi bi-exclamation-triangle-fill me-1"></i> <b>GCash payment pending:</b> Complete your GCash payment so your tracking number can be released automatically.</div><a class="btn btn-sm btn-wmsu" href="${orderLink('confirmation', primary)}">Pay with GCash</a></div>` : ''}
        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <div>
            <h4 class="mb-0 fw-bold">${released.length ? `Tracking: <span class="text-wmsu">${released.map(o => esc(o.code)).filter((x, i, a) => a.indexOf(x) === i).join(' · ')}</span>` : `<span class="badge-status badge-pending"><i class="bi bi-lock me-1"></i> ${primary.pay === 'cash' ? 'Awaiting Vendor Acceptance' : 'Awaiting Payment Confirmation'}</span>`}</h4>
            <small class="text-muted">${orders.length} stall(s) in this order · Customer: ${esc(primary.customer)}</small>
          </div>
          <a class="btn btn-light btn-sm" href="${orderLink('receipt', primary)}"><i class="bi bi-receipt me-1"></i> View receipt</a>
        </div>
        ${orders.map(o => `
          <div class="card p-4 mb-3">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div>
                <h5 class="fw-bold mb-0"><i class="bi bi-shop me-1"></i> ${esc(o.vendorName || 'Stall')}</h5>
                <small class="text-muted">Order <strong class="text-wmsu">#${esc(o.no)}</strong> · ${peso(o.total)}${o.code ? ` · Track: <strong class="text-wmsu">${esc(o.code)}</strong>` : ''}</small>
              </div>
              <div class="d-flex gap-1 align-items-center">
                ${badge(o.status)} ${o.pay === 'cash' && o.payStatus === 'Unpaid' ? '' : badge(o.payStatus)}
              </div>
            </div>
            ${!o.code && o.status !== 'rejected' ? `<div class="alert alert-light border small py-2 mt-2 mb-0"><i class="bi bi-lock text-wmsu me-1"></i> <b>${o.pay === 'cash' ? 'Awaiting Vendor Acceptance' : 'Awaiting Payment Confirmation'}:</b> Your tracking number will be generated and displayed here once the vendor ${o.pay === 'cash' ? 'accepts your cash order' : 'confirms your payment'}.</div>` : ''}
            <div class="stepper my-3">
              ${STEPS.map((s, i) => `<div class="step ${i <= STEPS.findIndex(x => x[0] === o.status) ? 'done' : ''}"><i class="bi bi-${s[1]}"></i>${s[2]}</div>`).join('')}
            </div>
            ${o.status === 'rejected' ? `<div class="alert alert-danger small py-2 mb-2"><i class="bi bi-x-circle-fill me-1" aria-hidden="true"></i> <b>Order declined:</b> ${esc(o.cancelReason || 'Declined by stall.')}${o.payStatus === 'Refunded' ? ` · <b>Refunded</b> — please approach <b>${esc(o.vendorName || 'this stall')}</b> if you need assistance.` : o.payStatus === 'Paid' ? ` Please approach <b>${esc(o.vendorName || 'this stall')}</b> at the counter for your refund.` : ''}</div>` : o.estMinutes != null && (o.status === 'pending' || o.status === 'preparing') ? `<div class="small text-wmsu fw-semibold mb-2"><i class="bi bi-clock me-1" aria-hidden="true"></i> Est. prep time: ~${o.estMinutes} mins${o.queueAhead > 0 ? ` (${o.queueAhead} order${o.queueAhead > 1 ? 's' : ''} ahead)` : ' (next in queue)'}</div>` : ''}
            <div class="small text-muted pt-2 border-top"><strong>Items:</strong> ${o.items.map(i => `${i.qty}× ${esc(i.name)}`).join(', ')}</div>
          </div>`).join('')}`;
    } catch (e) { clearInterval(poll); $('#tr').innerHTML = empty('search', esc(e.message)) };
  };
  const go = async () => { clearInterval(poll); await show(); poll = setInterval(show, 5000) };
  onForm('#tf', async d => { cur = [d.no.trim().toUpperCase(), d.code.trim().toUpperCase()]; history.replaceState(0, '', '?no=' + encodeURIComponent(cur[0]) + '&code=' + encodeURIComponent(cur[1])); await go() });
  if (no0 && (code0 || tok0)) { cur = [no0, code0 || tok0]; await go() };
};

C.history = async v => {
  const mine = myOrders();
  const results = await Promise.all(mine.map(m => API.order(m.no, m.token || m.code).catch(() => null)));
  const orders = results.flat().filter(Boolean);
  syncCodes(orders);
  v.innerHTML = head('Order history', 'Orders placed from this browser.') + table([
    ['Order', o => `<b>#${esc(o.no)}</b>${o.code ? ` <span class="badge-status badge-wmsu">${esc(o.code)}</span>` : ''}<br><small class="text-muted"><i class="bi bi-shop" aria-hidden="true"></i> ${esc(o.vendorName || '')}</small>`],
    ['Date', o => fmt(o.time)],
    ['Items', o => o.items.map(i => `${i.qty}× ${esc(i.name)}`).join(', ')],
    ['Total', o => `<b class="text-dark">${peso(o.total)}</b>`],
    ['Status', o => badge(o.status)],
    ['', o => `<div class="d-flex gap-1 justify-content-end flex-wrap"><button class="btn btn-sm btn-outline-wmsu" data-act="reorder" data-id="${o.id}" aria-label="Reorder items from order #${esc(o.no)}"><i class="bi bi-arrow-repeat" aria-hidden="true"></i> Reorder</button> <a class="btn btn-sm btn-light" href="${orderLink('tracking', o)}" aria-label="Track order #${esc(o.no)}"><i class="bi bi-geo-alt" aria-hidden="true"></i> Track</a> <a class="btn btn-sm btn-light" href="${orderLink('receipt', o)}" aria-label="View receipt for order #${esc(o.no)}"><i class="bi bi-receipt" aria-hidden="true"></i> Receipt</a></div>`]
  ], orders, 'You have not placed any orders yet.');
  acts.reorder = async b => {
    const o = orders.find(x => x.id === +b.dataset.id);
    if (!o) return;
    b.disabled = true;
    try {
      const [vs, { foods }] = await Promise.all([API.list('vendors'), API.foodsByVendor(o.vendorId)]);
      const stall = vs.find(x => x.id === o.vendorId);
      if (!stall || !stall.open) { toast(`${o.vendorName || 'This stall'} is currently closed.`, 'warning'); b.disabled = false; return }
      const c = cart.get();
      let added = 0, skipped = 0;
      for (const it of o.items) {
        const f = foods.find(x => x.id === +it.id);
        if (!f || !f.available || (f.stockQty != null && f.stockQty < 1)) { skipped++; continue }
        const ex = c.items.find(x => x.id === f.id);
        const want = (ex ? ex.qty : 0) + it.qty;
        const finalQty = f.stockQty != null ? Math.min(f.stockQty, want) : want;
        if (ex) ex.qty = finalQty;
        else c.items.push({ id: f.id, vendorId: f.vendorId, name: f.name, price: f.price, emoji: f.emoji, qty: finalQty });
        added++;
      }
      if (!added) { toast('None of the items from this order are currently available.', 'warning'); b.disabled = false; return }
      cart.save(c);
      if (skipped) toast(`Added ${added} item(s); ${skipped} sold-out item(s) skipped.`, 'warning');
      location = 'cart.html';
    } catch (e) { toast(e.message, 'danger'); b.disabled = false }
  };
};
