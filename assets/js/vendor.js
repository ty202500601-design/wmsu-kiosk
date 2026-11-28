/* Vendor Portal: orders, Pending GCash QR verification queue, menu & stall profile */
const V = PAGES.vendor, vid = () => SES()?.vendorId, PAYN = { cash: 'Cash', gcash: 'GCash QR' };
const myOrd = async () => (await API.list('orders')).filter(o => o.vendorId === vid()).sort((a, b) => new Date(b.time) - new Date(a.time));

const payActHtml = o => {
  if (o.orderStatus === 'Cancelled' || o.pay === 'cash') return '';
  if (o.payStatus === 'submitted' || o.payStatus === 'Pending Verification') {
    return `<div class="d-flex flex-wrap align-items-center gap-1">
      <span class="text-uppercase fw-bold text-muted me-1" style="font-size:.66rem;letter-spacing:.04em">GCash:</span>
      <button type="button" class="btn btn-sm btn-success" data-act="gcVerify" data-id="${o.id}" data-no="${esc(o.no)}" data-amt="${esc(peso(o.total))}" data-ref="${esc(o.ref)}"><i class="bi bi-patch-check-fill" aria-hidden="true"></i> Verify Payment</button>
      <button type="button" class="btn btn-sm btn-outline-danger" data-act="gcReject" data-id="${o.id}" data-no="${esc(o.no)}"><i class="bi bi-x-circle" aria-hidden="true"></i> Reject</button>
    </div>`;
  }
  if (o.payStatus === 'Rejected') return `<div class="small text-danger"><i class="bi bi-x-circle me-1" aria-hidden="true"></i>Rejected${o.rejectReason ? `: ${esc(o.rejectReason)}` : ''}</div>`;
  return '';
};

const orderActHtml = o => {
  if (o.status === 'completed' || o.status === 'rejected') return '';
  const btns = [];
  const isCash = o.pay === 'cash';
  if (o.status === 'pending') {
    if (isCash) {
      btns.push(`<button type="button" class="btn btn-sm btn-wmsu" data-act="setS" data-id="${o.id}" data-s="preparing"><i class="bi bi-check-lg" aria-hidden="true"></i> Confirm Order (Cash)</button>`);
      btns.push(`<button type="button" class="btn btn-sm btn-outline-danger" data-act="setS" data-id="${o.id}" data-s="rejected"><i class="bi bi-x-lg" aria-hidden="true"></i> Reject Order</button>`);
    } else if (o.payStatus === 'Paid') {
      btns.push(`<button type="button" class="btn btn-sm btn-wmsu" data-act="setS" data-id="${o.id}" data-s="preparing"><i class="bi bi-fire" aria-hidden="true"></i> Start Preparing</button>`);
    }
  } else if (o.status === 'preparing') {
    btns.push(`<button type="button" class="btn btn-sm btn-wmsu" data-act="setS" data-id="${o.id}" data-s="ready"><i class="bi bi-bag-check" aria-hidden="true"></i> Mark Ready for Pickup</button>`);
  } else if (o.status === 'ready') {
    if (isCash && o.payStatus === 'Unpaid') {
      btns.push(`<button type="button" class="btn btn-sm btn-success" data-act="cashComplete" data-id="${o.id}" data-amt="${peso(o.total)}"><i class="bi bi-cash-coin" aria-hidden="true"></i> Confirm Cash Received &amp; Complete</button>`);
    } else {
      btns.push(`<button type="button" class="btn btn-sm btn-success" data-act="setS" data-id="${o.id}" data-s="completed"><i class="bi bi-check2-circle" aria-hidden="true"></i> Complete Order</button>`);
    }
  }
  return btns.length ? `<div class="d-flex flex-wrap align-items-center gap-1"><span class="text-uppercase fw-bold text-muted me-1" style="font-size:.66rem;letter-spacing:.04em">Order:</span>${btns.join('')}</div>` : '';
};

/* Reusable "Pending GCash payments" table for stall owner */
function pendingGcashSectionHtml(os) {
  const pending = os.filter(o => o.pay === 'gcash' && ['submitted', 'Pending Verification'].includes(o.payStatus) && o.orderStatus !== 'Cancelled');
  if (!pending.length) return '';
  return `
    <div class="mb-4">
      <div class="d-flex align-items-center gap-2 mb-2">
        <h5 class="fw-bold mb-0"><i class="bi bi-qr-code-scan text-wmsu me-1" aria-hidden="true"></i> Pending GCash Payments</h5>
        <span class="badge-status badge-pending">${pending.length} awaiting verification</span>
      </div>
      <p class="small text-muted mb-3">Check your GCash app for the exact amount, message order code, and 13-digit reference number before verifying. Verifying releases the customer's tracking number.</p>
      ${table([
        ['Order / Code', o => `<a href="order-details.html?id=${o.id}" class="fw-bold">#${esc(o.no)}</a><br><span class="small text-muted">Msg Code:</span> <code class="fw-bold text-wmsu">${esc(o.orderCode || '-')}</code><br><small class="text-muted">${esc(o.customer)}</small>`],
        ['Amount', o => `<strong class="price-ink">${peso(o.total)}</strong>`],
        ['Reference No.', o => `<div class="d-flex align-items-center gap-1"><code>${esc(o.ref || '-')}</code>${o.ref ? `<button type="button" class="btn btn-sm btn-light py-0 px-2" data-act="copy" data-v="${esc(o.ref)}" aria-label="Copy reference ${esc(o.ref)}"><i class="bi bi-clipboard" aria-hidden="true"></i></button>` : ''}</div>`],
        ['Screenshot', o => o.proofPath
          ? `<button type="button" class="proof-thumb-btn" data-act="lightbox" data-src="${esc(o.proofPath)}" data-alt="GCash screenshot for order #${esc(o.no)}" data-cap="Order #${esc(o.no)} · Ref ${esc(o.ref)} · ${peso(o.total)}" aria-label="Enlarge screenshot for order #${esc(o.no)}"><img src="${esc(o.proofPath)}" alt="Proof"></button>`
          : '<span class="text-muted small">None uploaded</span>'],
        ['Verify / Reject', o => `<div class="d-flex flex-wrap gap-1">
          <button type="button" class="btn btn-sm btn-success" data-act="gcVerify" data-id="${o.id}" data-no="${esc(o.no)}" data-amt="${esc(peso(o.total))}" data-ref="${esc(o.ref)}"><i class="bi bi-check-lg" aria-hidden="true"></i> Verify</button>
          <button type="button" class="btn btn-sm btn-outline-danger" data-act="gcReject" data-id="${o.id}" data-no="${esc(o.no)}"><i class="bi bi-x-lg" aria-hidden="true"></i> Reject</button>
        </div>`]
      ], pending)}
    </div>`;
}

acts.gcVerify = async d => {
  const ok = await confirmBox(`Confirm that GCash payment of <b>${esc(d.amt)}</b> (Ref: <code>${esc(d.ref)}</code>) for order <b>#${esc(d.no)}</b> was received? This will generate and release the customer's tracking number.`, 'Verify & Release Code', 'Verify GCash Payment');
  if (!ok) return;
  const r = await API.pay(+d.id, 'verify_gcash');
  toast(`GCash verified! Tracking code ${r.track_code || ''} released.`, 'success');
  refresh();
};

acts.gcReject = async d => {
  const r = await modal(`Reject GCash Payment (#${esc(d.no)})`, `
    <p class="small text-muted mb-2">Select or enter the reason for rejecting this GCash submission. The customer will see this message on their confirmation/tracking screen.</p>
    <label class="form-label small" for="rejPreset">Reason</label>
    <select id="rejPreset" name="preset" class="form-select form-select-sm mb-2">
      <option value="Reference number not found in GCash">Reference number not found in GCash</option>
      <option value="Amount received does not match order total">Amount received does not match order total</option>
      <option value="Invalid or unreadable receipt">Invalid or unreadable receipt</option>
      <option value="">Other (type below)</option>
    </select>
    <label class="form-label small" for="rejCustom">Additional details</label>
    <input id="rejCustom" name="custom" class="form-control form-control-sm" maxlength="180" placeholder="Optional details or custom reason…">
  `, 'Reject Payment', 'btn-danger');
  if (!r) return;
  const reason = (r.custom || '').trim() || r.preset || 'Invalid GCash reference or unverified transfer';
  await API.pay(+d.id, 'reject_gcash', { reason });
  toast('GCash payment rejected', 'success');
  refresh();
};

acts.cashComplete = async d => {
  if (!await confirmBox(`Confirm that you received <b>${esc(d.amt || 'the cash payment')}</b> and handed over the order?`, 'Confirm & Complete')) return;
  await API.pay(+d.id, 'confirm_cash');
  await API.save('orders', { id: +d.id, status: 'completed' });
  toast('Cash received & order completed', 'success');
  refresh();
};

acts.setS = async d => {
  if (d.s === 'rejected') {
    const r = await modal('Reject Order', `<p class="small text-muted mb-2">Tell the customer why this order cannot be fulfilled:</p><label class="form-label small">Reason</label><select name="preset" class="form-select form-select-sm mb-2"><option value="Out of stock">Out of stock</option><option value="Closing early">Closing early</option><option value="Unable to fulfill order">Unable to fulfill order</option><option value="">Other (type below)</option></select><input name="custom" class="form-control form-control-sm" maxlength="180" placeholder="Optional details or custom reason...">`, 'Reject Order', 'btn-danger');
    if (!r) return;
    const reason = (r.custom || '').trim() || r.preset || 'Declined by the vendor';
    await API.save('orders', { id: +d.id, status: d.s, reason });
    toast('Order rejected', 'success'); refresh(); return;
  }
  await API.save('orders', { id: +d.id, status: d.s }); toast('Order updated', 'success'); refresh();
};

const actCell = o => {
  const parts = [payActHtml(o), orderActHtml(o)].filter(Boolean);
  return parts.length ? `<div class="d-flex flex-column gap-1">${parts.join('')}</div>` : '<span class="text-muted small">-</span>';
};

const soundOn = () => store.get('vendor_sound', true);
const playChime = () => { if (!soundOn()) return; try { const ctx = new (window.AudioContext || window.webkitAudioContext)();[[1046.5, 0], [1318.5, 0.14]].forEach(([freq, delay]) => { const osc = ctx.createOscillator(), g = ctx.createGain(); osc.type = 'sine'; osc.frequency.value = freq; g.gain.setValueAtTime(0.001, ctx.currentTime + delay); g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + delay + 0.02); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.35); osc.connect(g); g.connect(ctx.destination); osc.start(ctx.currentTime + delay); osc.stop(ctx.currentTime + delay + 0.36) }) } catch { } };
const checkAlert = os => { const cur = os.filter(o => o.status === 'pending' || o.payStatus === 'submitted' || o.payStatus === 'Pending Verification').map(o => o.id); if (window._knownAtt) { const fresh = cur.some(id => !window._knownAtt.includes(id)); if (fresh) { playChime(); toast('New order or GCash payment received!', 'success') } } window._knownAtt = cur };
acts.tglSound = () => { store.set('vendor_sound', !soundOn()); if (soundOn()) playChime(); refresh() };
const soundBtn = () => `<button type="button" class="btn btn-sm ${soundOn() ? 'btn-outline-wmsu' : 'btn-light'}" data-act="tglSound"><i class="bi bi-volume-${soundOn() ? 'up-fill' : 'mute'}" aria-hidden="true"></i> Sound: ${soundOn() ? 'On' : 'Off'}</button>`;
const poll = () => { clearInterval(window._poll); window._poll = setInterval(() => { if (!document.hidden && !document.querySelector('.modal.show, dialog[open]')) refresh() }, 10000) };

const ocols = [
  ['Order', o => `<a href="order-details.html?id=${o.id}" class="fw-bold">#${esc(o.no)}</a>${o.code ? `<br><small class="badge-status badge-wmsu mt-1">Track: ${esc(o.code)}</small>` : `<br><small class="text-muted" style="font-size:.72rem">${o.pay === 'cash' ? 'Awaiting acceptance' : 'Awaiting QR verify'}</small>`}`],
  ['Customer', o => esc(o.customer)],
  ['Items', o => o.items.map(i => `${i.qty}× ${esc(i.name)}`).join(', ')],
  ['Type', o => esc(o.type)],
  ['Total', o => `<strong class="price-ink">${peso(o.total)}</strong>`],
  ['Payment Status', o => `<div class="d-flex flex-column gap-1"><div><span class="fw-semibold">${PAYN[o.pay] || o.pay}</span> ${badge(o.payStatus)}</div>${o.orderCode ? `<small class="text-muted">Code: <code>${esc(o.orderCode)}</code></small>` : ''}${o.ref ? `<small class="text-muted">Ref: <code>${esc(o.ref)}</code></small>` : ''}${o.proofPath ? `<button type="button" class="btn btn-link btn-sm p-0 text-start text-wmsu" data-act="lightbox" data-src="${esc(o.proofPath)}" data-alt="Receipt screenshot" data-cap="Order #${esc(o.no)} · Ref ${esc(o.ref)}"><i class="bi bi-image" aria-hidden="true"></i> View screenshot</button>` : ''}</div>`],
  ['Order Status', o => `<div class="d-flex flex-column gap-1"><div>${badge(o.status)}</div><small class="text-muted" style="font-size:.73rem">${esc(o.orderStatus)}</small></div>`]
];

V.login = async v => loginPage('vendor', v);

V.dashboard = async v => {
  const [os, r, me] = await Promise.all([myOrd(), API.report('dashboard').catch(() => null), API.list('vendors').then(a => a.find(x => x.id === vid()))]);
  checkAlert(os);
  const n = s => os.filter(o => o.status === s).length;
  const gcSub = os.filter(o => o.pay === 'gcash' && o.payStatus === 'submitted' && o.orderStatus !== 'Cancelled').length;
  const active = os.filter(o => ['pending', 'preparing', 'ready'].includes(o.status));
  v.innerHTML = `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
      <div>
        <div class="d-flex align-items-center gap-2">
          <h4 class="fw-bold mb-0">${esc(me?.name || 'My stall')}</h4>
          ${gcashBadgeHtml(me?.hasGcash)}
        </div>
        <div class="text-muted small mt-1">Live vendor operations dashboard. Auto-refreshes every 10 seconds.</div>
      </div>
      <div class="d-flex align-items-center gap-3">
        ${soundBtn()}
        <div class="form-check form-switch fs-6 m-0">
          <input class="form-check-input" type="checkbox" id="openSw" data-act="openSw" ${me?.open ? 'checked' : ''}>
          <label class="form-check-label fw-semibold" for="openSw">${me?.open ? 'Open for orders' : 'Closed'}</label>
        </div>
      </div>
    </div>
    <div class="row g-3 mb-4">
      ${stat('qr-code-scan', 'Pending GCash', gcSub, gcSub > 0)
    + stat('hourglass-split', 'New orders', n('pending'), n('pending') > 0)
    + stat('fire', 'Preparing', n('preparing'))
    + stat('bag-check', 'Ready for pickup', n('ready'))
    + stat('cash-stack', 'Total sales (paid)', peso(r ? r.total_sales : 0))}
    </div>
    ${pendingGcashSectionHtml(os)}
    <div class="mb-4">
      <h5 class="fw-bold mb-3">Active Kitchen Queue</h5>
      ${table([...ocols, ['Actions', actCell]], active, 'No active orders right now.')}
    </div>
    <h5 class="fw-bold mb-3">Recent Orders</h5>
    ${table(ocols, os.slice(0, 6), 'No orders yet.')}`;
  poll();
};
acts.openSw = async (d, b) => { await API.save('vendors', { id: vid(), open: b.checked }); $('label[for=openSw]').textContent = b.checked ? 'Open for orders' : 'Closed'; toast(b.checked ? 'Stall is now open' : 'Stall is now closed') };

V.orders = async v => {
  const allOs = await myOrd(), f = qs.get('s') || 'all', os = allOs.filter(o => f === 'all' || o.status === f);
  checkAlert(allOs);
  v.innerHTML = `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
      <div>
        <h4 class="fw-bold mb-1">Incoming Orders</h4>
        <p class="text-muted small mb-0">Verify GCash QR submissions and update meal preparation status.</p>
      </div>
      ${soundBtn()}
    </div>
    ${pendingGcashSectionHtml(allOs)}
    <div class="pills mb-4">
      ${['all', 'pending', 'preparing', 'ready', 'completed', 'rejected'].map(s => `<a class="pill text-decoration-none ${s === f ? 'active' : ''}" href="?s=${s}">${s[0].toUpperCase() + s.slice(1)}</a>`).join('')}
    </div>
    ${table([...ocols, ['Actions', actCell]], os, 'No incoming orders in this view.')}`;
  poll();
};

V['order-details'] = async v => {
  const o = (await myOrd()).find(x => x.id === +qs.get('id'));
  if (!o) return v.innerHTML = empty('search', 'Order not found.', '<a class="btn btn-wmsu" href="orders.html">Back to orders</a>');
  v.innerHTML = `
    <a href="orders.html" class="text-wmsu text-decoration-none small fw-semibold d-inline-flex align-items-center gap-1 mb-3">
      <i class="bi bi-arrow-left" aria-hidden="true"></i> Back to orders
    </a>
    <div class="card p-4" style="max-width:660px">
      <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
        <h3 class="fw-bold mb-0">Order <span class="text-wmsu">#${esc(o.no)}</span></h3>
        <div class="d-flex gap-1 align-items-center">${o.code ? `<span class="badge-status badge-wmsu">Track: ${esc(o.code)}</span>` : ''}${badge(o.status)}</div>
      </div>
      <p class="text-muted small mb-3">${fmt(o.time)} · ${esc(o.type)} · Customer: <b>${esc(o.customer)}</b> · ${PAYN[o.pay] || o.pay} ${badge(o.payStatus)}</p>
      ${o.orderCode || o.ref || o.proofPath ? `
        <div class="card bg-light p-3 mb-3 small">
          ${o.orderCode ? `<div class="mb-1"><strong>GCash Message Order Code:</strong> <code class="fs-6 text-wmsu fw-bold">${esc(o.orderCode)}</code></div>` : ''}
          ${o.ref ? `<div class="mb-1"><strong>13-Digit Reference No.:</strong> <code class="fs-6">${esc(o.ref)}</code></div>` : ''}
          ${o.rejectReason ? `<div class="text-danger mb-1"><strong>Rejection Reason:</strong> ${esc(o.rejectReason)}</div>` : ''}
          ${o.proofPath ? `<div class="mt-2"><button type="button" class="btn btn-sm btn-outline-wmsu" data-act="lightbox" data-src="${esc(o.proofPath)}" data-alt="Receipt screenshot" data-cap="Order #${esc(o.no)} · Ref ${esc(o.ref)}"><i class="bi bi-zoom-in" aria-hidden="true"></i> View Uploaded Receipt Screenshot</button></div>` : ''}
        </div>` : ''}
      <hr class="my-3">
      ${o.items.map(i => `<div class="d-flex justify-content-between py-1"><span>${i.qty}× ${esc(i.name)}</span><b>${peso(i.qty * i.price)}</b></div>`).join('')}
      <hr class="my-3">
      <div class="d-flex justify-content-between fs-4 mb-4"><b>Total</b><b class="price-ink">${peso(o.total)}</b></div>
      <div class="pt-2">${actCell(o)}</div>
    </div>`;
};

V.menu = async v => {
  const [fs, cs] = await Promise.all([API.list('foods'), API.list('categories')]), m = fs.filter(f => f.vendorId === vid());
  v.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h4 class="fw-bold mb-1">Food Menu</h4>
        <p class="text-muted small mb-0">Manage items displayed in the canteen kiosk.</p>
      </div>
      <a class="btn btn-wmsu" href="add-food.html"><i class="bi bi-plus-lg" aria-hidden="true"></i> Add Food Item</a>
    </div>
    ${table([
    ['Item', f => `<div class="d-flex align-items-center gap-2">${dishThumbHtml(f)}<b>${esc(f.name)}</b></div>`],
    ['Category', f => esc(cs.find(c => c.id === f.catId)?.name || '-')],
    ['Price', f => peso(f.price)],
    ['Stock', f => f.stockQty == null ? '<span class="text-muted small">Unlimited</span>' : `<span class="badge-status badge-${f.stockQty === 0 ? 'danger' : f.stockQty <= 5 ? 'pending' : 'neutral'}">${f.stockQty} left</span>`],
    ['Available', f => `<div class="form-check form-switch"><input type="checkbox" class="form-check-input" data-act="avail" data-id="${f.id}" ${f.available ? 'checked' : ''}></div>`],
    ['', f => `<div class="d-flex gap-1 justify-content-end"><a class="btn btn-sm btn-light" href="edit-food.html?id=${f.id}"><i class="bi bi-pencil" aria-hidden="true"></i> Edit</a> <button type="button" class="btn btn-sm btn-light text-danger" data-act="delF" data-id="${f.id}"><i class="bi bi-trash" aria-hidden="true"></i> Delete</button></div>`]
  ], m, 'Your menu is empty. Add your first food item.')}`;
};
acts.avail = async (d, b) => { await API.save('foods', { id: +d.id, available: b.checked }); toast('Availability updated') };
acts.delF = async d => { if (await confirmBox('Delete this food item?', 'Delete')) { await API.remove('foods', +d.id); toast('Item deleted'); refresh() } };

V['add-food'] = async v => foodForm(v, vid());
V['edit-food'] = V['add-food'];
V.categories = async v => catPage(v);

V.reports = async v => {
  const r = await API.report('sales'), day = r.by_day.map(d => [new Date(d.day + 'T00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }), +d.sales]), item = r.top_items.slice(0, 5).map(i => [i.name, +i.sales]);
  v.innerHTML = `
    <div class="mb-4">
      <h4 class="fw-bold mb-1">Sales Reports</h4>
      <p class="text-muted small mb-0">Overview of paid orders and stall revenue.</p>
    </div>
    <div class="row g-3 mb-4">
      ${stat('cash-stack', 'Total sales (paid orders)', peso(r.totals.sales)) + stat('receipt', 'Paid orders', r.totals.orders)}
    </div>
    <div class="row g-4">
      <div class="col-lg-6"><div class="card p-4"><h5 class="fw-bold mb-3">Sales by Day</h5>${bars(day)}</div></div>
      <div class="col-lg-6"><div class="card p-4"><h5 class="fw-bold mb-3">Top Selling Items</h5>${bars(item)}</div></div>
    </div>`;
};

V.profile = async v => {
  const x = (await API.list('vendors')).find(a => a.id === vid());
  v.innerHTML = `
    <div class="mb-4">
      <h4 class="fw-bold mb-1">Stall Profile</h4>
      <p class="text-muted small mb-0">Update stall information, canteen banner, and GCash QR configuration.</p>
    </div>
    <form id="pf" class="card p-4" style="max-width:640px" novalidate>
      <div class="mb-3"><label class="form-label" for="vName">Stall name</label><input id="vName" name="name" class="form-control" value="${esc(x.name)}" required></div>
      <div class="mb-3"><label class="form-label" for="vDesc">Description</label><input id="vDesc" name="desc" class="form-control" value="${esc(x.desc)}" required></div>
      <div class="mb-3"><label class="form-label" for="vPhone">Staff contact number <span class="text-muted fw-normal">(internal only, never shown to customers)</span></label><input id="vPhone" name="phone" class="form-control" pattern="[0-9 +]{7,20}" value="${esc(x.phone)}" required><div class="invalid-feedback">Enter a valid phone number.</div></div>
      <div class="card bg-light p-3 mb-3">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h6 class="fw-bold mb-0"><i class="bi bi-image text-wmsu me-1" aria-hidden="true"></i> Canteen Banner</h6>
          ${x.banner ? `<button type="button" class="btn btn-sm btn-outline-danger" data-act="delBanner" data-id="${x.id}"><i class="bi bi-trash" aria-hidden="true"></i> Remove Banner</button>` : ''}
        </div>
        <div id="bannerPreview" class="mb-2">
          ${x.banner ? `<img src="${esc(x.banner)}" alt="Stall banner" style="width:100%;height:140px;object-fit:cover;border-radius:8px;border:1px solid var(--line)">` : `<div class="text-center py-4 bg-white rounded border text-muted small">No custom banner uploaded</div>`}
        </div>
        <input type="file" name="banner" id="bannerInput" accept="image/jpeg,image/png,image/webp" class="form-control form-control-sm">
      </div>
      <div class="card bg-light p-3 mb-3">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h6 class="fw-bold mb-0"><i class="bi bi-qr-code-scan text-wmsu me-1" aria-hidden="true"></i> GCash QR Status</h6>
          ${gcashBadgeHtml(x.hasGcash)}
        </div>
        ${x.gcashQrPath ? `<div class="d-flex align-items-center gap-3 bg-white p-2 rounded border mb-2"><img src="${esc(x.gcashQrPath)}" alt="GCash QR" style="width:72px;height:72px;object-fit:contain"><div class="small"><div><b>Masked Account Name:</b> ${esc(x.gcashAccountName || '-')}</div><div class="text-muted">Customers see QR + masked name only.</div></div></div>` : '<div class="small text-muted">GCash QR is not enabled on this stall (Cash at Counter only).</div>'}
      </div>
      <div class="form-check form-switch mb-4"><input class="form-check-input" type="checkbox" id="vOpen" name="open" ${x.open ? 'checked' : ''}><label class="form-check-label fw-semibold" for="vOpen">Stall is open for orders</label></div>
      <div><button class="btn btn-wmsu px-4">Save Profile</button></div>
    </form>`;
  $('#bannerInput').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 2 * 1024 * 1024) { toast('Banner image must be 2 MB or smaller.', 'danger'); e.target.value = ''; return }
    $('#bannerPreview').innerHTML = `<img src="${URL.createObjectURL(f)}" alt="Banner preview" style="width:100%;height:140px;object-fit:cover;border-radius:8px;border:1px solid var(--line)">`;
  };
  onForm('#pf', async d => {
    if (d.banner && d.banner.size > 2 * 1024 * 1024) return toast('Banner image must be 2 MB or smaller.', 'danger');
    await API.save('vendors', { id: x.id, name: d.name, desc: d.desc, phone: d.phone, open: !!d.open });
    if (d.banner && d.banner.size) await API.uploadBanner(x.id, d.banner);
    toast('Profile saved', 'success');
    refresh();
  });
};
acts.delBanner = async d => { if (await confirmBox('Remove your canteen banner?', 'Remove')) { await API.removeBanner(+d.id); toast('Banner removed'); refresh() } };
