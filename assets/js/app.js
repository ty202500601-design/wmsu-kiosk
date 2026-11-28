/* Core: config, single-request SWR/ETag API layer, zero-CLS shell & page skeletons, LQIP/decode smooth media & UI helpers */
const B = document.body.dataset, ROOT = B.root || '', PAGES = { customer: {}, vendor: {}, admin: {} }, acts = {};
const $ = (s, r = document) => r.querySelector(s), sleep = ms => new Promise(r => setTimeout(r, ms)), qs = new URLSearchParams(location.search);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const peso = n => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }, set: (k, v) => localStorage.setItem(k, JSON.stringify(v)) };
const sstore = {
  get: (k, d = null) => { try { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d } },
  set: (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)) } catch { } }
};
const SES = () => sstore.get('wmsu_session', null);
const fmt = t => new Date(t).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
const KC = window.KIOSK_CONFIG || { campus: {}, combos: [], promos: [] };
const relUrl = p => p ? `${ROOT}${String(p).replace(/^\/+/, '')}` : '';
const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const fmtTime12 = hm => {
  if (!hm) return '';
  const [h0, m0] = String(hm).split(':').map(Number);
  if (Number.isNaN(h0)) return hm;
  const ap = h0 >= 12 ? 'PM' : 'AM', h = h0 % 12 || 12;
  return `${h}:${String(m0 || 0).padStart(2, '0')} ${ap}`;
};

const catIcon = (name = '', raw = '') => {
  if (raw && raw !== '?' && !/^\?+$/.test(raw.trim())) return raw;
  const s = name.toLowerCase();
  if (/rice|silog|ulam|meal/.test(s)) return '🍚';
  if (/burger|sandwich|hatdog|bite/.test(s)) return '🍔';
  if (/snack|fries|merienda|chip/.test(s)) return '🍟';
  if (/drink|tea|soda|juice|coffee|beverage/.test(s)) return '🥤';
  if (/dessert|sweet|halo|flan|cake/.test(s)) return '🍨';
  return '🍽️';
};

const stallInitials = name => {
  const words = String(name || 'Stall').replace(/[^A-Za-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  return (words.length >= 2 ? words[0][0] + words[1][0] : (words[0] || 'WM').slice(0, 2)).toUpperCase();
};

const cleanStallName = n => {
  const s = String(n || '').trim();
  if (/^aga('s campus bites?)?$/i.test(s)) return "Aga's Campus Bite";
  if (/^practice vendor$/i.test(s)) return 'Crimson Snack Stop';
  return s || 'Campus Stall';
};

const cleanStallDesc = (d, n = '') => {
  const s = String(d || '').trim();
  if (!s || /^campus food stall$/i.test(s) || /^stall\s*\d+$/i.test(s)) {
    return `Freshly prepared campus meals and snacks from ${cleanStallName(n)}.`;
  }
  return s;
};

const gcashBadgeHtml = hasGcash => hasGcash
  ? `<span class="badge-gcash-yes"><i class="bi bi-check-circle-fill" aria-hidden="true"></i> GCash available</span>`
  : `<span class="badge-cash-only"><i class="bi bi-cash-coin" aria-hidden="true"></i> Cash only</span>`;

/* ---- Preload & Smooth Decoded Image Helpers ---- */
const _preloaded = new Set();
function preloadImageHead(url) {
  if (!url || _preloaded.has(url) || !document.head) return;
  _preloaded.add(url);
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = url;
  link.setAttribute('fetchpriority', 'high');
  document.head.appendChild(link);
}

function lqipStyleAttr(avgColor, lqip) {
  const parts = [];
  if (avgColor && /^#[0-9a-f]{3,8}$/i.test(avgColor)) parts.push(`--img-bg:${avgColor}`);
  if (lqip && String(lqip).startsWith('data:image/')) parts.push(`--img-lqip:url('${lqip}')`);
  return parts.length ? ` style="${esc(parts.join(';'))}"` : '';
}

function resolveFoodPaths(raw) {
  const rawImg = raw?.image_path ? relUrl(raw.image_path) : (raw?.image ? `${ROOT}uploads/foods/${raw.image}` : '');
  const rawThumb = raw?.thumb_path ? relUrl(raw.thumb_path) : rawImg;
  return {
    imagePath: rawImg,
    thumbPath: rawThumb || rawImg,
    avgColor: raw?.avg_color || raw?.avgColor || '',
    lqip: raw?.lqip || ''
  };
}

/*
 * 4:3 dish image or neutral fallback tile:
 * - Cards serve the 480x360 thumbnail (`opts.full` = false).
 * - Food details & hero serve the 960x720 image (`opts.full` = true).
 * - Above-the-fold priority images get `fetchpriority="high"` (never `loading="lazy"`).
 * - Below-the-fold images get `loading="lazy" decoding="async"`.
 */
function dishTileHtml(f, opts = {}) {
  const fullSrc = f?.imagePath || '';
  const thumbSrc = f?.thumbPath || fullSrc;
  const chosen = opts.full ? fullSrc : thumbSrc;
  if (!chosen) {
    return `<div class="dish-fallback-tile" role="img" aria-label="No photo available for ${esc(f?.name || 'this dish')}"><i class="bi bi-image" aria-hidden="true"></i><span>No photo</span></div>`;
  }
  const w = opts.full ? 960 : 480;
  const h = opts.full ? 720 : 360;
  const srcset = opts.full && thumbSrc && thumbSrc !== fullSrc
    ? ` srcset="${esc(thumbSrc)} 480w, ${esc(fullSrc)} 960w" sizes="${esc(opts.sizes || '(max-width: 991px) 100vw, 640px')}"`
    : '';
  const loadAttrs = opts.priority
    ? 'fetchpriority="high"'
    : (opts.aboveFold ? '' : 'loading="lazy" decoding="async"');
  return `<span class="lqip-frame"${lqipStyleAttr(f.avgColor, f.lqip)}><img class="smooth-img" data-smooth-img src="${esc(chosen)}"${srcset} alt="${esc(opts.alt ?? f.name ?? 'Dish photo')}" width="${w}" height="${h}" ${loadAttrs} data-neutral-fallback="tile"></span>`;
}

/* Compact 4:3 thumbnail (480px thumb source, explicit 56x42 box) */
function dishThumbHtml(it) {
  const thumb = it?.thumbPath || it?.imagePath || '';
  if (!thumb) {
    return `<div class="dish-fallback-sm" aria-hidden="true"><i class="bi bi-image"></i></div>`;
  }
  return `<img class="item-thumb smooth-img" data-smooth-img src="${esc(thumb)}" alt="${esc(it.name || '')}" width="56" height="42" loading="lazy" decoding="async" data-neutral-fallback="sm">`;
}

/* Combo visual: explicit local combo photo -> side-by-side collage of 480px item thumbs -> neutral fallback tile */
function comboMediaHtml(cb) {
  if (cb?.photo) {
    const p = relUrl(cb.photo);
    return `<span class="lqip-frame"><img class="smooth-img" data-smooth-img src="${esc(p)}" alt="${esc(cb.title)}" width="480" height="360" loading="lazy" decoding="async" data-neutral-fallback="tile"></span>`;
  }
  const withPhotos = (cb?.items || []).filter(i => i.thumbPath || i.imagePath);
  if (withPhotos.length >= 2) {
    const pickItems = withPhotos.slice(0, 3);
    const bg = pickItems[0]?.avgColor || '#ebe2d6';
    return `<div class="combo-collage cols-${pickItems.length}" style="background-color:${esc(bg)}" role="group" aria-label="Photos of ${esc(pickItems.map(i => i.name).join(', '))}">
      ${pickItems.map(i => `<img class="smooth-img" data-smooth-img src="${esc(i.thumbPath || i.imagePath)}" alt="${esc(i.name)}" width="480" height="360" loading="lazy" decoding="async" data-neutral-fallback="tile">`).join('')}
    </div>`;
  }
  if (withPhotos.length === 1) return dishTileHtml(withPhotos[0], { alt: cb.title });
  return `<div class="dish-fallback-tile" role="img" aria-label="No photo available for ${esc(cb?.title || 'combo')}"><i class="bi bi-image" aria-hidden="true"></i><span>No photo</span></div>`;
}

/* Stall cover metadata: hero uses 960px (`full: true`), stall cards use 480px thumb (`full: false`) */
function stallCoverMeta(v, stallFoods = [], full = false) {
  if (v?.coverImage) return { url: v.coverImage, avgColor: '#3a2024', lqip: '' };
  if (v?.banner) return { url: v.banner, avgColor: '#3a2024', lqip: '' };
  const ownDish = stallFoods.find(f => f.imagePath || f.thumbPath);
  if (!ownDish) return { url: '', avgColor: '#3a2024', lqip: '' };
  return {
    url: full ? (ownDish.imagePath || ownDish.thumbPath) : (ownDish.thumbPath || ownDish.imagePath),
    avgColor: ownDish.avgColor || '#3a2024',
    lqip: ownDish.lqip || ''
  };
}

function stallCoverUrl(v, stallFoods = [], full = false) {
  return stallCoverMeta(v, stallFoods, full).url;
}

/* Pre-decode critical above-the-fold image URLs in memory with a ~600ms cap so cards reveal together */
function predecodeUrls(urls, timeoutMs = 600) {
  const clean = [...new Set((urls || []).filter(Boolean))].slice(0, 6);
  if (!clean.length) return Promise.resolve();
  const jobs = clean.map(u => new Promise(res => {
    const im = new Image();
    im.decoding = 'async';
    im.src = u;
    if (im.complete && im.naturalWidth > 0) return res();
    if (typeof im.decode === 'function') {
      im.decode().then(res).catch(res);
    } else {
      im.onload = res;
      im.onerror = res;
    }
  }));
  return Promise.race([Promise.allSettled(jobs), sleep(timeoutMs)]);
}

/* Activate smooth decode + .3s opacity fade on all rendered [data-smooth-img] elements */
function hydrateSmoothImages(root = document) {
  const imgs = root.querySelectorAll('img[data-smooth-img]');
  imgs.forEach(img => {
    if (img.dataset.smoothBound) return;
    img.dataset.smoothBound = '1';
    const markReady = () => {
      img.classList.add('is-loaded');
      const wrap = img.closest('.lqip-frame');
      if (wrap) wrap.classList.add('is-loaded');
      const hero = img.closest('.storefront-banner');
      if (hero) hero.classList.add('hero-img-ready');
    };
    if (img.complete && img.naturalWidth > 0) {
      markReady();
      return;
    }
    const revealAfterDecode = () => {
      if (typeof img.decode === 'function') {
        img.decode().then(markReady).catch(markReady);
      } else {
        markReady();
      }
    };
    img.addEventListener('load', revealAfterDecode, { once: true });
    img.addEventListener('error', markReady, { once: true });
  });
}

/* ---- API layer: Single-request SWR + ETag + In-Memory Cache ---- */
const STAFF = B.role === 'vendor' || B.role === 'admin';
const ST_IN = { 'Pending Payment': 'pending', 'Confirmed': 'pending', 'Preparing': 'preparing', 'Ready for Pickup': 'ready', 'Completed': 'completed', 'Cancelled': 'rejected' };
const when = t => String(t || '').replace(' ', 'T');
const pick = m => Object.fromEntries(Object.entries(m).filter(([, v]) => v !== undefined));
const SWR_KEY = 'wmsu_kiosk_swr_v2';

function mapVendorRow(x) {
  const rawName = x.name || '';
  const isCust = B.role === 'customer';
  const gAvail = !!(+x.gcash_available || +x.has_gcash);
  return {
    id: +x.id,
    rawName,
    name: isCust ? cleanStallName(rawName) : rawName,
    desc: isCust ? cleanStallDesc(x.description, rawName) : (x.description || ''),
    emoji: catIcon(rawName + ' ' + (x.description || '')),
    status: x.status || 'active',
    open: !!+x.is_open,
    owner: x.owner_name || '',
    phone: isCust ? '' : (x.phone || ''),
    email: x.email || '',
    hasGcash: gAvail,
    gcashEnabled: !!+x.gcash_enabled,
    gcashQrPath: relUrl(x.gcash_qr_path),
    gcashAccountName: x.gcash_account_name || '',
    banner: x.banner ? `${ROOT}uploads/banners/${x.banner}` : '',
    coverImage: x.cover_image ? `${ROOT}uploads/banners/${x.cover_image}` : '',
    logo: x.logo ? `${ROOT}uploads/banners/${x.logo}` : '',
    openTime: x.opening_time || null,
    closeTime: x.closing_time || null,
    ratingAvg: x.rating_avg != null ? +x.rating_avg : null
  };
}

function mapCategoryRow(c) {
  return { id: +c.id, vendorId: c.vendor_id == null ? null : +c.vendor_id, name: c.name, icon: catIcon(c.name, c.icon) };
}

function mapFoodRow(f, cs) {
  const cat = cs.find(c => c.id === +f.category_id);
  const stk = f.stock_qty == null ? null : +f.stock_qty;
  const avail = !!+f.is_available && (stk === null || stk > 0);
  const paths = resolveFoodPaths(f);
  return {
    id: +f.id,
    vendorId: +f.vendor_id,
    vendorName: B.role === 'customer' ? cleanStallName(f.vendor_name || '') : (f.vendor_name || ''),
    vendorOpen: f.vendor_open !== undefined ? !!+f.vendor_open : true,
    catId: f.category_id == null ? null : +f.category_id,
    catName: cat?.name || 'Campus Specials',
    name: f.name,
    desc: f.description || '',
    price: +f.price,
    stockQty: stk,
    emoji: cat?.icon || catIcon(f.name),
    imagePath: paths.imagePath,
    thumbPath: paths.thumbPath,
    avgColor: paths.avgColor,
    lqip: paths.lqip,
    img: paths.imagePath,
    available: avail,
    orderCount: +(f.order_count || 0),
    ratingAvg: f.rating_avg != null ? +f.rating_avg : null,
    prepMinutes: f.prep_minutes != null ? +f.prep_minutes : null,
    isFeatured: !!+(f.is_featured || 0),
    allergens: f.allergens || '',
    tags: f.tags || ''
  };
}

const mapOrder = o => ({
  id: +o.id,
  no: o.order_no,
  code: o.track_code || '',
  orderCode: o.order_code || '',
  vendorId: +o.vendor_id,
  vendorName: o.vendor_name || '',
  gcashAccountName: o.gcash_account_name || '',
  proofPath: relUrl(o.proof_path),
  rejectReason: o.reject_reason || '',
  items: (o.items || []).map(i => {
    const p = resolveFoodPaths(i);
    return { id: i.food_id ? +i.food_id : 0, name: i.name, price: +i.unit_price, qty: +i.qty, imagePath: p.imagePath, thumbPath: p.thumbPath, avgColor: p.avgColor, lqip: p.lqip };
  }),
  type: o.order_type,
  customer: o.customer_name,
  pay: o.payment_method,
  total: +o.total,
  status: ST_IN[o.order_status] || o.order_status,
  orderStatus: o.order_status,
  payStatus: o.payment_status,
  ref: o.payment_ref || o.reference || '',
  cancelReason: o.cancel_reason || '',
  queueAhead: o.queue_ahead ?? null,
  estMinutes: o.est_minutes ?? null,
  time: when(o.created_at)
});

let _csrf = null, _canteenSettings = null, _memKiosk = null, _kioskInflight = null;

function getCachedKiosk() {
  if (_memKiosk) return _memKiosk;
  const saved = sstore.get(SWR_KEY, null);
  if (saved && Array.isArray(saved.vendors) && Array.isArray(saved.foods)) {
    _memKiosk = saved;
    return saved;
  }
  return null;
}

function getLastKnownMenuCount(vid) {
  const c = getCachedKiosk();
  if (c?.counts && c.counts[vid] > 0) return c.counts[vid];
  const counts = sstore.get('wmsu_menu_counts', {});
  return counts[vid] > 0 ? counts[vid] : 4;
}

function applyFooterHours(s) {
  if (!s) return;
  const el = $('#footerHours');
  if (el && s.open && s.close) {
    const txt = `${fmtTime12(s.open)} – ${fmtTime12(s.close)}`;
    if (el.textContent !== txt) el.textContent = txt;
  }
}

const API = {
  async csrf() { if (!_csrf) _csrf = (await this.f('csrf', { noCsrf: true })).csrf; return _csrf },
  async f(t, o = {}) {
    const { m = 'GET', q, b, raw, noCsrf, headers: extraH } = o, h = { ...(extraH || {}) };
    if (b !== undefined && !raw) h['Content-Type'] = 'application/json';
    if (m !== 'GET' && !noCsrf) h['X-CSRF-Token'] = await this.csrf();
    let r; try { r = await fetch(`${ROOT}api/${t}.php` + (q ? '?' + new URLSearchParams(q) : ''), { method: m, headers: h, credentials: 'same-origin', body: b === undefined ? undefined : raw ? b : JSON.stringify(b) }) } catch { throw new Error('Cannot reach the server. Check your connection.') }
    if (r.status === 304 && o.on304) return o.on304();
    let j = null; try { j = await r.json() } catch { }
    if (r.status === 419 && !o.retried) { _csrf = null; return this.f(t, { ...o, retried: true }) }
    if (!r.ok || !j || j.success === false) {
      if (r.status === 401 && STAFF && B.page !== 'login') { sessionStorage.removeItem('wmsu_session'); location = 'login.html'; throw new Error('Please log in.') }
      const fe = j && j.errors && Object.values(j.errors)[0]; throw new Error(((j && j.error) || 'Request failed (' + r.status + ').') + (fe ? ' ' + fe : ''))
    }
    if (o.withMeta) return { data: j.data, etag: r.headers.get('ETag') || '' };
    return j.data
  },

  /* Single combined request for customer pages with ETag + In-Memory + sessionStorage SWR */
  async kioskData(opts = {}) {
    const cached = getCachedKiosk();
    const now = Date.now();
    if (!opts.force && cached && (now - (cached.ts || 0) < 12000)) {
      applyFooterHours(cached.settings);
      return cached;
    }
    if (_kioskInflight) return _kioskInflight;

    _kioskInflight = (async () => {
      try {
        const reqHeaders = cached?.etag ? { 'If-None-Match': cached.etag } : {};
        const res = await this.f('kiosk', {
          headers: reqHeaders,
          withMeta: true,
          on304: () => ({ notModified: true })
        });
        if (res?.notModified && cached) {
          cached.ts = Date.now();
          sstore.set(SWR_KEY, cached);
          applyFooterHours(cached.settings);
          return cached;
        }
        const raw = res.data;
        const categories = (raw.categories || []).map(mapCategoryRow);
        const vendors = (raw.vendors || []).map(mapVendorRow);
        const foods = (raw.foods || []).map(f => mapFoodRow(f, categories));
        const s = raw.settings || {};
        const settings = {
          id: 1,
          canteen: s.canteen_name || 'WMSU Campus Canteen',
          open: s.open_time || '07:00',
          close: s.close_time || '18:00',
          cash: (s.pay_cash ?? '1') === '1',
          gcash: (s.pay_gcash ?? '1') === '1'
        };
        _canteenSettings = settings;

        const counts = {};
        const vendorCovers = {};
        vendors.forEach(v => {
          const vf = foods.filter(f => f.vendorId === v.id);
          counts[v.id] = vf.length;
          vendorCovers[v.id] = stallCoverMeta(v, vf, true);
        });
        sstore.set('wmsu_menu_counts', counts);

        const sig = res.etag || JSON.stringify({
          v: vendors.map(v => [v.id, v.name, v.desc, v.open, v.hasGcash, v.banner]),
          f: foods.map(f => [f.id, f.name, f.price, f.available, f.stockQty, f.imagePath, f.orderCount]),
          s: [settings.open, settings.close, settings.gcash]
        });

        const pack = { vendors, categories, foods, settings, counts, vendorCovers, etag: res.etag || '', sig, ts: Date.now() };
        _memKiosk = pack;
        sstore.set(SWR_KEY, pack);
        applyFooterHours(settings);
        return pack;
      } catch (err) {
        if (cached) return cached;
        throw err;
      } finally {
        _kioskInflight = null;
      }
    })();

    return _kioskInflight;
  },

  invalidateKioskCache() {
    _memKiosk = null;
    try { sessionStorage.removeItem(SWR_KEY) } catch { }
  },

  async me() { return (await this.f('auth')).user },
  async list(t) {
    if (B.role === 'customer' && ['vendors', 'categories', 'foods', 'settings'].includes(t)) {
      const k = await this.kioskData();
      if (t === 'settings') return [k.settings];
      return k[t];
    }
    switch (t) {
      case 'vendors': {
        let rows = await this.f('vendors', B.role === 'admin' ? { q: { scope: 'all' } } : {});
        if (B.role === 'vendor') { const me = await this.f('vendors', { q: { me: 1 } }); rows = rows.filter(x => +x.id !== +me.id); rows.push(me) }
        return rows.map(mapVendorRow);
      }
      case 'applications': return (await this.f('vendors', { q: { scope: 'all' } })).map(x => ({ id: +x.id, stall: x.name, owner: x.owner_name, email: x.email, phone: x.phone, status: x.status === 'pending' ? 'pending' : x.status === 'rejected' ? 'rejected' : 'approved' }));
      case 'categories': return (await this.f('categories', B.role === 'vendor' ? { q: { vendor_id: SES()?.vendorId } } : {})).map(mapCategoryRow);
      case 'foods': {
        const [rows, cs] = await Promise.all([this.f('foods', STAFF ? { q: { manage: 1 } } : {}), this.list('categories')]);
        return rows.map(f => mapFoodRow(f, cs));
      }
      case 'orders': return B.role === 'customer' ? [] : (await this.f('orders')).map(mapOrder);
      case 'payments': return (await this.f('payments')).map(p => ({
        id: +p.id,
        orderId: +p.order_id,
        no: p.order_no,
        orderCode: p.order_code || '',
        customer: p.customer_name || '',
        vendorId: +p.vendor_id,
        method: p.method,
        amount: +p.amount,
        status: p.status,
        ref: p.reference || '',
        proofPath: relUrl(p.proof_path),
        rejectReason: p.reject_reason || '',
        orderStatus: p.order_status,
        trackCode: p.track_code || '',
        time: when(p.created_at)
      }));
      case 'users': return this.f('users');
      case 'settings': { const s = await this.f('settings'); _canteenSettings = { id: 1, canteen: s.canteen_name, open: s.open_time, close: s.close_time, cash: s.pay_cash === '1', gcash: s.pay_gcash === '1' }; return [_canteenSettings] }
    }throw new Error('Unknown resource: ' + t)
  },
  async order(no, code) { const d = await this.f('orders', { q: { order_no: no, code } }); const list = Array.isArray(d) ? d : [d]; return list.map(o => mapOrder(o)) },
  async save(t, it) {
    this.invalidateKioskCache();
    const id = it.id;
    switch (t) {
      case 'categories': { const b = pick({ name: it.name, icon: it.icon }); return id ? this.f('categories', { m: 'PATCH', q: { id }, b }) : this.f('categories', { m: 'POST', b }) }
      case 'foods': {
        const b = pick({ name: it.name, description: it.desc, price: it.price, stock_qty: it.stockQty, is_available: it.available, category_id: it.catId });
        return id ? this.f('foods', { m: 'PATCH', q: { id }, b }) : this.f('foods', { m: 'POST', b: { ...b, vendor_id: it.vendorId } })
      }
      case 'vendors': return id ? this.f('vendors', { m: 'PATCH', q: { id }, b: pick({ name: it.name, description: it.desc, phone: it.phone, is_open: it.open, status: it.status, gcash_enabled: it.gcashEnabled, gcash_account_name: it.gcashAccountName }) }) : this.f('vendors', { m: 'POST', b: it });
      case 'applications': return this.f('vendors', { m: 'PATCH', q: { id }, b: { status: it.status === 'approved' ? 'active' : 'rejected' } });
      case 'users': return id ? this.f('users', { m: 'PATCH', q: { id }, b: pick({ status: it.status, ban_reason: it.ban_reason }) }) : this.f('users', { m: 'POST', b: { name: it.name, email: it.email, password: it.password, role: it.role } });
      case 'settings': return this.f('settings', { m: 'PATCH', b: { canteen_name: it.canteen, open_time: it.open, close_time: it.close, pay_cash: !!it.cash, pay_gcash: !!it.gcash } });
      case 'orders': return id ? this.setStatus(id, it.status, it.reason) : this.place(it);
    }throw new Error('Unknown resource: ' + t)
  },
  async remove(t, id) { this.invalidateKioskCache(); if (!['categories', 'foods', 'users', 'vendors'].includes(t)) throw new Error('Cannot delete ' + t); return this.f(t, { m: 'DELETE', q: { id } }) },
  async place(it) {
    this.invalidateKioskCache();
    const payload = {
      order_type: it.type,
      guest_name: it.customer,
      items: it.items.map(i => ({ food_id: i.id, qty: i.qty })),
      stall_payments: it.stallPayments || {},
      payment_method: it.pay || 'cash'
    };
    const proofs = it.proofs || {};
    const hasFiles = Object.values(proofs).some(Boolean);
    let r;
    if (hasFiles) {
      const fd = new FormData();
      fd.append('payload', JSON.stringify(payload));
      for (const [vid, blob] of Object.entries(proofs)) {
        if (blob) fd.append(`proof_${vid}`, blob, blob.name || `proof_${vid}.jpg`);
      }
      r = await this.f('orders', { m: 'POST', b: fd, raw: true });
    } else {
      r = await this.f('orders', { m: 'POST', b: payload });
    }
    return { id: r.id, no: r.order_no, orders: r.orders || [], code: r.track_code || null, token: r.checkout_token || '', total: +r.total };
  },
  async setStatus(id, s, reason) {
    const o = await this.f('orders', { q: { id } }), patch = b => this.f('orders', { m: 'PATCH', q: { id }, b });
    if (s === 'preparing') { if (o.order_status === 'Pending Payment') await patch({ order_status: 'Confirmed' }); return patch({ order_status: 'Preparing' }) }
    if (s === 'ready') return patch({ order_status: 'Ready for Pickup' });
    if (s === 'completed') return patch({ order_status: 'Completed' });
    if (s === 'rejected') return patch({ order_status: 'Cancelled', cancel_reason: reason || 'Declined by the vendor' });
    throw new Error('Unknown status: ' + s)
  },
  pay(orderId, action, extra = {}) { return this.f('payments', { m: 'PATCH', q: { order_id: orderId }, b: { action, ...extra } }) },
  upload(foodId, file) { this.invalidateKioskCache(); const fd = new FormData(); fd.append('image', file); return this.f('foods', { m: 'POST', q: { action: 'image', id: foodId }, b: fd, raw: true }) },
  uploadBanner(vendorId, file) { this.invalidateKioskCache(); const fd = new FormData(); fd.append('banner', file); return this.f('vendors', { m: 'POST', q: { action: 'banner', id: vendorId }, b: fd, raw: true }) },
  removeBanner(vendorId) { this.invalidateKioskCache(); return this.f('vendors', { m: 'DELETE', q: { action: 'banner', id: vendorId } }) },
  uploadQr(vendorId, file) { this.invalidateKioskCache(); const fd = new FormData(); fd.append('qr', file); return this.f('vendors', { m: 'POST', q: { action: 'qr', id: vendorId }, b: fd, raw: true }) },
  removeQr(vendorId) { this.invalidateKioskCache(); return this.f('vendors', { m: 'DELETE', q: { action: 'qr', id: vendorId } }) },
  report(type, q = {}) { return this.f('reports', { q: { type, from: '2000-01-01', ...q } }) },
  async login(role, email, password) {
    let d; try { d = await this.f('auth', { m: 'POST', q: { action: 'login' }, b: { email, password, role } }) } catch (e) { toast(e.message, 'danger'); return null }
    _csrf = d.csrf;
    if (d.user.role !== role) { await this.f('auth', { m: 'POST', q: { action: 'logout' } }).catch(() => { }); _csrf = null; toast(`This account cannot sign in on the ${role} portal.`, 'danger'); return null }
    const r = { name: d.user.name, email: d.user.email }; if (role === 'vendor') r.vendorId = +(await this.f('vendors', { q: { me: 1 } })).id; return r
  }
};

/* ---- Multi-Stall Cart (localStorage) — Syncs live DB imagePath/thumbPath/LQIP ---- */
const cart = {
  get: () => store.get('cart2', { items: [], notes: {} }),
  save(c, bump = false) { store.set('cart2', c); updateCart(bump) },
  count: () => cart.get().items.reduce((s, i) => s + i.qty, 0),
  total: () => cart.get().items.reduce((s, i) => s + i.qty * i.price, 0),
  qtyOf: id => cart.get().items.find(x => x.id === +id)?.qty || 0,
  syncMedia(foods) {
    const c = cart.get();
    let changed = false;
    c.items.forEach(i => {
      const f = foods.find(x => x.id === +i.id);
      if (f && (i.imagePath !== f.imagePath || i.thumbPath !== f.thumbPath || i.avgColor !== f.avgColor || i.lqip !== f.lqip)) {
        i.imagePath = f.imagePath || '';
        i.thumbPath = f.thumbPath || f.imagePath || '';
        i.avgColor = f.avgColor || '';
        i.lqip = f.lqip || '';
        delete i.img;
        changed = true;
      }
    });
    if (changed) store.set('cart2', c);
    return c;
  },
  async add(f, qty = 1, note = '') {
    const c = cart.get();
    const maxQ = f.stockQty != null ? Math.min(20, f.stockQty) : 20;
    const i = c.items.find(x => x.id === f.id);
    if (i) {
      i.qty = Math.min(maxQ, i.qty + qty);
      i.imagePath = f.imagePath || '';
      i.thumbPath = f.thumbPath || f.imagePath || '';
      i.avgColor = f.avgColor || '';
      i.lqip = f.lqip || '';
      if (note) i.note = note;
    } else {
      c.items.push({ id: f.id, vendorId: f.vendorId, name: f.name, price: f.price, emoji: f.emoji, imagePath: f.imagePath || '', thumbPath: f.thumbPath || f.imagePath || '', avgColor: f.avgColor || '', lqip: f.lqip || '', qty: Math.min(maxQ, qty), note });
    }
    cart.save(c, true);
    toast(`${f.name} added to cart`);
    return true;
  },
  addMany(list, label) {
    const c = cart.get();
    list.forEach(f => {
      const maxQ = f.stockQty != null ? Math.min(20, f.stockQty) : 20;
      const i = c.items.find(x => x.id === f.id);
      if (i) {
        i.qty = Math.min(maxQ, i.qty + 1);
        i.imagePath = f.imagePath || '';
        i.thumbPath = f.thumbPath || f.imagePath || '';
        i.avgColor = f.avgColor || '';
        i.lqip = f.lqip || '';
      } else {
        c.items.push({ id: f.id, vendorId: f.vendorId, name: f.name, price: f.price, emoji: f.emoji, imagePath: f.imagePath || '', thumbPath: f.thumbPath || f.imagePath || '', avgColor: f.avgColor || '', lqip: f.lqip || '', qty: 1, note: '' });
      }
    });
    cart.save(c, true);
    toast(`${label} (${list.length} items) added to cart`);
  },
  setQty(id, d) {
    const c = cart.get(), i = c.items.find(x => x.id == id);
    if (!i) return;
    i.qty = Math.min(20, i.qty + d);
    if (i.qty < 1) c.items = c.items.filter(x => x.id != id);
    cart.save(c, d > 0);
  },
  clear() { cart.save({ items: [], notes: {} }) }
};

function updateCart(bump = false) {
  const n = cart.count(), b = $('#cartCount'), bar = $('#cartbar');
  if (b) {
    if (b.textContent !== String(n)) b.textContent = n;
    if (bump && !prefersReducedMotion()) { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump') }
  }
  const hideOn = ['cart', 'checkout', 'payment', 'confirmation', 'gcash-pay', 'receipt'];
  if (bar) {
    bar.innerHTML = n && !hideOn.includes(B.page)
      ? `<a class="btn btn-wmsu btn-lg w-100 justify-content-between" href="cart.html"><span><i class="bi bi-basket2-fill me-2" aria-hidden="true"></i>${n} item${n === 1 ? '' : 's'} · ${peso(cart.total())}</span><span>View Cart <i class="bi bi-arrow-right ms-1" aria-hidden="true"></i></span></a>`
      : '';
  }
}

/* ---- Page-Specific Zero-CLS Skeletons (Exact layout, grid, card & hero heights) ---- */
function menuCardSkeletons(count = 4) {
  return Array.from({ length: count }, () => `
    <div class="col-6 col-lg-4 col-xl-3">
      <div class="card fcard h-100" aria-hidden="true">
        <div class="skel skel-media-4x3"></div>
        <div class="p-3 d-flex flex-column flex-grow-1">
          <div class="skel skel-line" style="width:72%;height:18px"></div>
          <div class="skel skel-line mb-3" style="width:92%;height:14px"></div>
          <div class="d-flex justify-content-between align-items-center mt-auto pt-2 border-top">
            <div class="skel" style="width:68px;height:22px"></div>
            <div class="skel" style="width:78px;height:38px;border-radius:10px"></div>
          </div>
        </div>
      </div>
    </div>`).join('');
}

function pageSkeleton(page) {
  if (page === 'menu') {
    const vid = +(qs.get('vendor') || qs.get('v') || store.get('vendorId') || 0);
    const n = getLastKnownMenuCount(vid);
    return `
      <div aria-busy="true" aria-label="Loading stall menu">
        <div class="mb-3">
          <div class="skel skel-line mb-2" style="width:86px;height:18px"></div>
          <div class="skel skel-hero"></div>
        </div>
        <div class="d-flex gap-2 flex-wrap mb-3">
          <div class="skel" style="height:48px;width:min(420px,100%);border-radius:999px"></div>
          <div class="skel skel-pill"></div>
        </div>
        <div class="d-flex gap-2 mb-3 overflow-hidden">
          <div class="skel skel-pill" style="width:84px"></div>
          <div class="skel skel-pill" style="width:124px"></div>
          <div class="skel skel-pill" style="width:116px"></div>
        </div>
        <div class="skel skel-line mb-3" style="width:140px"></div>
        <div class="row g-4">${menuCardSkeletons(n)}</div>
      </div>`;
  }
  if (page === 'food-details') {
    return `
      <div aria-busy="true" aria-label="Loading dish details">
        <div class="skel skel-line mb-3" style="width:160px;height:18px"></div>
        <div class="row g-4">
          <div class="col-lg-6">
            <div class="skel fimg big" style="border:1px solid var(--line)"></div>
          </div>
          <div class="col-lg-6 d-flex flex-column justify-content-center">
            <div class="skel skel-line mb-2" style="width:45%"></div>
            <div class="skel skel-title mb-3" style="width:70%;height:38px"></div>
            <div class="skel skel-line mb-3" style="width:110px;height:30px"></div>
            <div class="skel skel-line" style="width:92%"></div>
            <div class="skel skel-line mb-4" style="width:76%"></div>
            <div class="d-flex align-items-center gap-3 mb-4">
              <div class="skel" style="width:80px;height:20px"></div>
              <div class="skel" style="width:136px;height:42px;border-radius:12px"></div>
            </div>
            <div class="skel" style="width:180px;height:52px;border-radius:16px"></div>
          </div>
        </div>
      </div>`;
  }
  if (page === 'vendors') {
    return `
      <div aria-busy="true" aria-label="Loading campus stalls">
        <div class="skel skel-home-hero"></div>
        <div class="mb-4">
          <div class="skel skel-title" style="width:240px"></div>
          <div class="cat-tile-grid mt-3">
            ${Array.from({ length: 6 }, () => `<div class="skel" style="height:104px;border-radius:20px"></div>`).join('')}
          </div>
        </div>
        <div class="stall-grid mt-4">
          ${Array.from({ length: 4 }, () => `<div class="card stall-card" aria-hidden="true"><div class="skel skel-media-16x9"></div><div class="p-3"><div class="skel skel-line" style="width:65%;height:20px"></div><div class="skel skel-line" style="width:90%"></div><div class="skel skel-line" style="width:55%"></div></div></div>`).join('')}
        </div>
      </div>`;
  }
  if (['cart', 'checkout', 'payment'].includes(page)) {
    return `
      <div aria-busy="true" aria-label="Loading checkout">
        <div class="skel skel-title" style="width:260px"></div>
        <div class="skel skel-line mb-4" style="width:380px;max-width:90%"></div>
        <div class="row g-4">
          <div class="col-lg-8"><div class="skel" style="height:320px;border-radius:20px"></div></div>
          <div class="col-lg-4"><div class="skel" style="height:280px;border-radius:20px"></div></div>
        </div>
      </div>`;
  }
  return '<div class="skel-wrap" aria-busy="true" aria-label="Loading content"><div class="skel skel-title"></div><div class="skel skel-line" style="width:55%"></div><div class="row g-3 mt-2"><div class="col-md-4"><div class="skel skel-card"></div></div><div class="col-md-4"><div class="skel skel-card"></div></div><div class="col-md-4"><div class="skel skel-card"></div></div></div></div>';
}

const spinner = pageSkeleton(B.page);
const empty = (i, m, a = '') => `<div class="state"><i class="bi bi-${i}" aria-hidden="true"></i><p class="mt-2 mb-2 fw-medium">${m}</p>${a}</div>`;

const SB = {
  pending: 'pending', preparing: 'preparing', ready: 'ready', completed: 'success', rejected: 'danger',
  active: 'success', banned: 'danger', suspended: 'danger', approved: 'success',
  Paid: 'success', Unpaid: 'neutral', Pending: 'pending', submitted: 'pending', 'Pending Verification': 'pending',
  Failed: 'danger', Rejected: 'danger', Refunded: 'neutral', 'Open now': 'success', Closed: 'neutral', unavailable: 'danger',
  'Pending Payment': 'pending', Confirmed: 'preparing', 'Ready for Pickup': 'ready', Completed: 'success', Cancelled: 'danger'
};
const SLBL = {
  submitted: () => B.role === 'customer' ? 'Waiting for stall to confirm' : 'Submitted (Verify QR)',
  Rejected: () => 'Payment Rejected'
};
const badge = s => `<span class="badge-status badge-${SB[s] || 'neutral'}">${esc(SLBL[s] ? SLBL[s]() : s)}</span>`;

function openImageLightbox(src, alt, caption = '') {
  if (!src) return;
  const dlg = document.createElement('dialog');
  dlg.className = 'kiosk-dialog qr-lightbox';
  dlg.setAttribute('aria-label', alt || 'Image preview');
  dlg.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-2">
      <strong class="small text-truncate pe-2">${esc(caption || alt || 'Preview')}</strong>
      <button type="button" class="btn btn-sm btn-light" data-close aria-label="Close preview"><i class="bi bi-x-lg" aria-hidden="true"></i> Close</button>
    </div>
    <img src="${esc(src)}" alt="${esc(alt || 'Enlarged preview')}">`;
  document.body.append(dlg);
  const close = () => { if (dlg.open) dlg.close(); dlg.remove() };
  dlg.querySelector('[data-close]').onclick = close;
  dlg.addEventListener('click', e => { if (e.target === dlg) close() });
  dlg.addEventListener('cancel', close);
  dlg.showModal();
}
acts.lightbox = d => openImageLightbox(d.src, d.alt, d.cap);

const stat = (i, l, v, hot) => `<div class="col-6 col-lg"><div class="card stat ${hot ? 'hot' : ''}"><i class="bi bi-${i}" aria-hidden="true"></i><div><b>${v}</b><small>${l}</small></div></div></div>`;
const table = (cols, rows, emptyMsg = 'Nothing here yet.') => rows.length ? `<div class="card table-responsive"><table class="table table-hover mb-0"><thead><tr>${cols.map(c => `<th scope="col">${c[0]}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${cols.map(c => `<td>${c[1](r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : empty('inbox', emptyMsg);
const bars = d => { const m = Math.max(1, ...d.map(x => x[1])); return d.map(x => `<div class="d-flex align-items-center gap-3 mb-2"><span style="width:130px" class="small text-truncate">${esc(x[0])}</span><div class="flex-grow-1"><div class="bar" style="width:${x[1] / m * 100}%"></div></div><b class="small">${peso(x[1])}</b></div>`).join('') || empty('bar-chart', 'No data yet.') };
const refresh = () => boot(true);

function toast(m, t = 'dark', undoFn = null) {
  const host = $('#toasts'); if (!host) return;
  const e = document.createElement('div');
  e.className = `toast show align-items-center text-bg-${t} border-0 mb-2 shadow`;
  e.innerHTML = `<div class="d-flex align-items-center justify-content-between gap-2 px-3 py-2"><div class="toast-body p-0">${esc(m)}</div>${undoFn ? '<button type="button" class="btn btn-sm btn-light py-1 px-2 ms-2" data-undo>Undo</button>' : ''}</div>`;
  if (undoFn) e.querySelector('[data-undo]').onclick = () => { undoFn(); e.remove() };
  host.append(e);
  setTimeout(() => e.remove(), undoFn ? 5000 : t === 'danger' ? 5000 : 2600);
}

function modal(title, body, ok = 'Confirm', cls = 'btn-wmsu', showCancel = true) {
  return new Promise(res => {
    const d = document.createElement('div'); d.className = 'modal fade';
    d.innerHTML = `<div class="modal-dialog modal-dialog-centered"><form class="modal-content" novalidate><div class="modal-header"><h5 class="modal-title fw-bold">${title}</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div><div class="modal-body">${body}</div><div class="modal-footer">${showCancel ? '<button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button>' : ''}<button class="btn ${cls} px-4">${ok}</button></div></form></div>`;
    document.body.append(d); const m = new bootstrap.Modal(d); let out = null;
    d.querySelector('form').onsubmit = e => { e.preventDefault(); if (!e.target.checkValidity()) { e.target.classList.add('was-validated'); return } out = Object.fromEntries(new FormData(e.target)); m.hide() };
    d.addEventListener('hidden.bs.modal', () => { d.remove(); res(out) }); m.show()
  })
}

function confirmBox(msg, ok = 'Confirm', title = 'Please confirm') {
  if (typeof HTMLDialogElement === 'undefined') return modal(title, `<p class="mb-0">${msg}</p>`, ok).then(r => !!r);
  return new Promise(res => {
    const dlg = document.createElement('dialog');
    dlg.className = 'kiosk-dialog';
    dlg.setAttribute('aria-labelledby', 'dlgTitle');
    dlg.innerHTML = `<h2 id="dlgTitle" class="h5 fw-bold mb-2">${esc(title)}</h2><p class="text-muted mb-4">${msg}</p><div class="d-flex justify-content-end gap-2"><button type="button" class="btn btn-light" value="cancel">Cancel</button><button type="button" class="btn btn-wmsu px-4" value="ok">${esc(ok)}</button></div>`;
    document.body.append(dlg);
    let done = false;
    const finish = val => { if (done) return; done = true; if (dlg.open) dlg.close(); dlg.remove(); res(val) };
    dlg.querySelector('[value="cancel"]').onclick = () => finish(false);
    dlg.querySelector('[value="ok"]').onclick = () => finish(true);
    dlg.addEventListener('cancel', () => finish(false));
    dlg.showModal();
  });
}

function onForm(sel, fn) {
  const f = $(sel); f.addEventListener('submit', async e => {
    e.preventDefault(); if (!f.checkValidity()) { f.classList.add('was-validated'); return }
    const b = f.querySelector('button:not([type=button])'); b && (b.disabled = true); try { await fn(Object.fromEntries(new FormData(f))) } catch (x) { toast('Something went wrong: ' + x.message, 'danger') } b && (b.disabled = false)
  })
}
document.addEventListener('click', async e => { const b = e.target.closest('[data-act]'); if (b && acts[b.dataset.act]) { try { await acts[b.dataset.act](b.dataset, b) } catch (x) { if (b.type === 'checkbox') b.checked = !b.checked; toast(x.message, 'danger') } } });

/* Global broken-image handler -> swaps broken media to neutral fallback tile */
document.addEventListener('error', e => {
  const img = e.target;
  if (!img || img.tagName !== 'IMG') return;
  if (img.dataset.neutralFallback === 'sm') {
    const d = document.createElement('div');
    d.className = 'dish-fallback-sm';
    d.setAttribute('aria-hidden', 'true');
    d.innerHTML = '<i class="bi bi-image"></i>';
    img.replaceWith(d);
  } else if (img.dataset.neutralFallback === 'cover') {
    const hero = img.closest('.storefront-banner');
    if (hero) { img.remove(); hero.classList.add('hero-img-ready'); return; }
    const d = document.createElement('div');
    d.className = 'stall-neutral-cover';
    d.setAttribute('aria-hidden', 'true');
    d.innerHTML = '<i class="bi bi-shop-window"></i>';
    (img.closest('.lqip-frame') || img).replaceWith(d);
  } else if (img.dataset.neutralFallback) {
    const d = document.createElement('div');
    d.className = 'dish-fallback-tile';
    d.setAttribute('aria-hidden', 'true');
    d.innerHTML = '<i class="bi bi-image"></i><span>No photo</span>';
    (img.closest('.lqip-frame') || img).replaceWith(d);
  }
}, true);

acts.copy = async d => { try { await navigator.clipboard.writeText(d.v); toast('Copied: ' + d.v, 'success') } catch { toast('Copy failed, please copy manually.', 'danger') } };
acts.logout = async () => { try { await API.f('auth', { m: 'POST', q: { action: 'logout' } }) } catch { } sessionStorage.removeItem('wmsu_session'); location = 'login.html' };

/* ---- Kiosk Inactivity Watcher ---- */
let _idleT = null, _idleDlg = null, _idleCnt = null;
function initKioskIdle() {
  if (B.role !== 'customer' || ['confirmation', 'gcash-pay', 'tracking'].includes(B.page)) return;
  const waitMs = KC.campus?.idleTimeoutMs || 180000;
  const resetIdle = () => {
    if (_idleDlg) return;
    clearTimeout(_idleT);
    _idleT = setTimeout(() => {
      if (!cart.count() || typeof HTMLDialogElement === 'undefined') return resetIdle();
      let sec = KC.campus?.idleWarnSec || 15;
      const dlg = document.createElement('dialog');
      dlg.className = 'kiosk-dialog';
      dlg.setAttribute('role', 'alertdialog');
      dlg.setAttribute('aria-labelledby', 'idleTitle');
      dlg.innerHTML = `<h2 id="idleTitle" class="h5 fw-bold mb-2">Still ordering?</h2><p class="text-muted mb-4">For the next student's privacy, your cart will clear in <b id="idleSec">${sec}</b> seconds.</p><div class="d-flex justify-content-end gap-2"><button type="button" class="btn btn-light" data-reset>Clear Cart Now</button><button type="button" class="btn btn-wmsu px-4" data-stay>I'm Still Here</button></div>`;
      document.body.append(dlg);
      _idleDlg = dlg;
      const closeIdle = clearIt => {
        clearInterval(_idleCnt);
        if (dlg.open) dlg.close();
        dlg.remove();
        _idleDlg = null;
        if (clearIt) { cart.clear(); localStorage.removeItem('draft'); toast('Session cleared due to inactivity.'); if (B.page !== 'vendors') location = 'vendors.html'; else refresh() }
        else resetIdle();
      };
      dlg.querySelector('[data-stay]').onclick = () => closeIdle(false);
      dlg.querySelector('[data-reset]').onclick = () => closeIdle(true);
      dlg.addEventListener('cancel', e => { e.preventDefault(); closeIdle(false) });
      dlg.showModal();
      _idleCnt = setInterval(() => {
        sec--;
        const el = $('#idleSec', dlg); if (el) el.textContent = sec;
        if (sec <= 0) closeIdle(true);
      }, 1000);
    }, waitMs);
  };
  ['pointerdown', 'keydown', 'scroll'].forEach(ev => window.addEventListener(ev, resetIdle, { passive: true }));
  resetIdle();
}

/* ---- Shell: reusable header / sidebar / multi-column footer ---- */
const NAV = {
  customer: [['vendors.html', 'shop', 'Stalls & Menu'], ['tracking.html', 'geo-alt', 'Track Order'], ['history.html', 'clock-history', 'History']],
  vendor: [['dashboard', 'speedometer2', 'Dashboard'], ['orders', 'bell', 'Incoming Orders'], ['menu', 'egg-fried', 'Food Menu'], ['categories', 'tags', 'Categories'], ['reports', 'graph-up', 'Sales Reports'], ['profile', 'person-badge', 'Profile']],
  admin: [['dashboard', 'speedometer2', 'Dashboard'], ['users', 'people', 'Users'], ['vendors', 'shop', 'Vendors'], ['foods', 'egg-fried', 'Food Items'], ['categories', 'tags', 'Categories'], ['orders', 'receipt', 'Orders'], ['payments', 'credit-card', 'Payments'], ['reports', 'graph-up', 'Reports'], ['settings', 'gear', 'Settings']]
};

const brand = (t, href = `${ROOT}index.html`) => `<a class="brand" href="${href}"><img class="logo-img" src="${ROOT}assets/img/wmsu-logo.png" width="42" height="42" alt="WMSU seal"><div class="brand-text"><span class="brand-name">WMSU</span><small class="brand-sub">${t}</small></div></a>`;

function renderFooter(hoursText = '7:00 AM – 6:00 PM') {
  return `<footer class="site-footer no-print">
    <div class="container-xl">
      <div class="footer-grid">
        <div>
          <div class="d-flex align-items-center gap-2 mb-3">
            <img src="${ROOT}assets/img/wmsu-logo.png" width="38" height="38" alt="WMSU seal" loading="lazy" decoding="async">
            <div><strong class="text-white d-block" style="font-family:var(--font-display);font-size:1.1rem">WMSU Campus Canteen</strong><small class="opacity-75">Self-Service Food Kiosk</small></div>
          </div>
          <p class="small mb-2 opacity-85">Order fresh Filipino rice meals, burgers, snacks, and cold drinks across multiple campus stalls in a single checkout.</p>
          <span class="badge-accent">Dine-In · Take-Out · Cash &amp; GCash QR</span>
        </div>
        <div>
          <h3>Hours &amp; Location</h3>
          <ul class="footer-links small" role="list">
            <li><i class="bi bi-clock me-2" aria-hidden="true"></i>Mon – Sat: <span id="footerHours">${esc(hoursText)}</span></li>
            <li><i class="bi bi-geo-alt me-2" aria-hidden="true"></i>Normal Road, Baliwasan, Zamboanga City</li>
            <li><i class="bi bi-bag-check me-2" aria-hidden="true"></i>Counter pickup per stall</li>
          </ul>
        </div>
        <nav aria-label="Customer help">
          <h3>Quick Links</h3>
          <ul class="footer-links" role="list">
            <li><a href="vendors.html">Browse Campus Stalls</a></li>
            <li><a href="vendors.html#how-it-works">How Kiosk Ordering Works</a></li>
            <li><a href="tracking.html">Track My Order</a></li>
            <li><a href="history.html">Order History &amp; Reorder</a></li>
          </ul>
        </nav>
        <nav aria-label="Staff portals">
          <h3>For Stalls &amp; Staff</h3>
          <ul class="footer-links" role="list">
            <li><a href="${ROOT}vendor/login.html"><i class="bi bi-shop-window me-2" aria-hidden="true"></i>Vendor Stall Portal</a></li>
            <li><a href="${ROOT}admin/login.html"><i class="bi bi-shield-lock me-2" aria-hidden="true"></i>Canteen Admin Portal</a></li>
          </ul>
        </nav>
      </div>
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 pt-3 small opacity-75">
        <span>© ${new Date().getFullYear()} Western Mindanao State University · Campus Canteen Kiosk</span>
        <span>Multi-stall checkout · Per-stall GCash QR &amp; Counter Cash</span>
      </div>
    </div>
  </footer>`;
}

let _shellMounted = false;
function shell() {
  if (_shellMounted) return;
  const host = $('#shell');
  if (!host) return;
  _shellMounted = true;
  const { role, page } = B, title = document.title.split(' |')[0];
  const th = $('#toasts'); if (th) { th.setAttribute('role', 'status'); th.setAttribute('aria-live', 'polite') }
  if (page === 'login') { host.innerHTML = '<main id="view" class="container"></main>'; return }
  if (role === 'customer') {
    const p = B.page, isV = ['vendors', 'menu', 'food-details'].includes(p);
    const isCur = n => (n === 'vendors.html' && isV) || n === p + '.html';
    const onCart = ['cart', 'checkout', 'payment'].includes(p);
    const cachedS = getCachedKiosk()?.settings;
    const initHours = cachedS ? `${fmtTime12(cachedS.open)} – ${fmtTime12(cachedS.close)}` : '7:00 AM – 6:00 PM';
    host.innerHTML = `
      <header class="topbar no-print">
        <a href="#page-title" class="skip-link visually-hidden">Skip to main content</a>
        <div class="container-xl d-flex flex-wrap align-items-center justify-content-between gap-2 gap-md-3">
          ${brand('Campus Canteen', 'vendors.html')}
          <nav aria-label="Primary" class="ms-md-auto">
            <ul class="topbar-nav" role="list">
              ${NAV.customer.map(n => `<li><a href="${n[0]}" ${isCur(n[0]) ? 'aria-current="page" class="active"' : ''}><i class="bi bi-${n[1]}" aria-hidden="true"></i><span>${n[2]}</span></a></li>`).join('')}
            </ul>
          </nav>
          <div class="d-flex align-items-center gap-2">
            <a class="btn ${onCart ? 'btn-wmsu' : 'btn-outline-wmsu'} cart-pill-btn" href="cart.html" aria-label="View shopping cart">
              <i class="bi bi-basket2-fill" aria-hidden="true"></i>
              <span>Cart</span>
              <span class="cart-count-badge" id="cartCount" aria-live="polite">0</span>
            </a>
          </div>
        </div>
      </header>
      <main id="view" class="container-xl py-4" aria-busy="true">${pageSkeleton(p)}</main>
      <div id="cartbar" class="cartbar no-print"></div>
      ${renderFooter(initHours)}`;
    updateCart();
    initKioskIdle();
    return;
  }
  const s = SES(); if (!s || s.role !== role) { location = 'login.html'; return }
  host.innerHTML = `<aside class="side no-print"><div class="side-header">${brand(role === 'admin' ? 'Admin Portal' : 'Vendor Portal')}</div><hr class="side-divider d-none d-lg-block"><nav class="side-nav" aria-label="Portal">${NAV[role].map(n => `<a class="${n[0] === page || (page.includes('food') && n[0] === 'menu') ? 'active' : ''}" href="${n[0]}.html"><i class="bi bi-${n[1]}" aria-hidden="true"></i> <span>${n[2]}</span></a>`).join('')}</nav></aside><div class="content"><div class="top2 no-print"><h5 class="mb-0 fw-bold">${title}</h5><div class="d-flex align-items-center gap-3"><span class="text-muted small d-none d-sm-inline"><i class="bi bi-person-circle text-wmsu me-1" aria-hidden="true"></i> ${esc(s.name)}</span><button class="btn btn-outline-wmsu btn-sm" data-act="logout"><i class="bi bi-box-arrow-right me-1" aria-hidden="true"></i> Logout</button></div></div><main id="view" class="p-4" aria-busy="true">${pageSkeleton(page)}</main></div>`
}

/* Mount shell & page-accurate skeleton immediately as deferred script executes (before first paint) */
if (B.role) {
  if (!location.hash) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  shell();
}

async function boot(again) {
  if (!again) {
    if (!location.hash) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    shell();
    if (!$('#view')) return;
    if (STAFF && B.page !== 'login') { let u = null; try { u = await API.me() } catch { } if (!u || u.role !== B.role) { sessionStorage.removeItem('wmsu_session'); location = 'login.html'; return } }
  }
  const v = $('#view');
  v.classList.toggle('no-anim', !!again);
  if (!again) v.setAttribute('aria-busy', 'true');
  try {
    await PAGES[B.role][B.page](v);
    v.setAttribute('aria-busy', 'false');
    hydrateSmoothImages(v);
    requestAnimationFrame(() => document.documentElement.classList.add('smooth-scroll'));
    if (!again && location.hash === '#page-title') {
      $('#page-title')?.focus({ preventScroll: true });
    }
  } catch (e) {
    v.setAttribute('aria-busy', 'false');
    v.innerHTML = empty('exclamation-triangle', `Couldn't load this page (${esc(e.message)}). Check your connection and try again.`, '<button type="button" class="btn btn-wmsu mt-2" onclick="refresh()"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Retry</button>');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => boot());
} else {
  boot();
}

/* ---- Shared Staff Pages ---- */
function loginPage(role, v) {
  if (SES()?.role === role) { location = 'dashboard.html'; return }
  v.innerHTML = `<div class="login-card card p-4"><div class="text-center mb-3"><img class="logo-img lg" src="${ROOT}assets/img/wmsu-logo.png" alt="WMSU seal"><h1 class="h4 mt-3 fw-bold">${role === 'admin' ? 'Admin' : 'Vendor'} Login</h1></div><form id="lf" novalidate><div class="mb-3"><label class="form-label" for="loginEmail">Email</label><input id="loginEmail" type="email" name="u" class="form-control" autocomplete="username" required><div class="invalid-feedback">Enter your email address.</div></div><div class="mb-3"><label class="form-label" for="pwInput">Password</label><div class="pw-wrap"><input type="password" name="p" id="pwInput" class="form-control" minlength="8" autocomplete="current-password" required><button type="button" class="pw-toggle" id="pwToggle" aria-label="Show password" aria-pressed="false"><i class="bi bi-eye" aria-hidden="true"></i></button></div><div class="invalid-feedback">Password must be at least 8 characters.</div></div><button class="btn btn-wmsu btn-lg w-100">Sign in</button></form><p class="small text-muted text-center mt-3 mb-1">Use the account issued by the canteen administrator.</p><div class="text-center mt-2"><a class="small text-wmsu" href="${ROOT}index.html">&larr; Back to home</a></div></div>`;
  const pwI = $('#pwInput'), pwT = $('#pwToggle');
  pwT.onclick = () => { const show = pwI.type === 'password'; pwI.type = show ? 'text' : 'password'; pwT.setAttribute('aria-pressed', show); pwT.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); pwT.firstElementChild.className = 'bi bi-eye' + (show ? '-slash' : ''); pwI.focus() };
  onForm('#lf', async d => { const r = await API.login(role, d.u, d.p); if (!r) return; sessionStorage.setItem('wmsu_session', JSON.stringify({ role, ...r })); location = 'dashboard.html' })
}

async function catPage(v) {
  let cs = await API.list('categories'); if (B.role === 'vendor') cs = cs.filter(c => c.vendorId !== null);
  v.innerHTML = `<div class="d-flex justify-content-between align-items-center mb-4"><div><h4 class="fw-bold mb-1">Categories</h4><p class="text-muted small mb-0">Organize menu items by food classification.</p></div><button class="btn btn-wmsu" data-act="catEdit"><i class="bi bi-plus-lg" aria-hidden="true"></i> Add category</button></div>` + table([['Icon', c => c.icon], ['Name', c => esc(c.name)], ['', c => `<div class="d-flex gap-1 justify-content-end"><button class="btn btn-sm btn-light" data-act="catEdit" data-id="${c.id}" data-n="${esc(c.name)}" data-i="${c.icon}"><i class="bi bi-pencil" aria-hidden="true"></i> Edit</button> <button class="btn btn-sm btn-light text-danger" data-act="catDel" data-id="${c.id}"><i class="bi bi-trash" aria-hidden="true"></i> Delete</button></div>`]], cs);
}

acts.catEdit = async d => { const r = await modal(d.id ? 'Edit category' : 'Add category', `<label class="form-label">Name</label><input name="name" class="form-control mb-3" value="${d.n || ''}" required><label class="form-label">Emoji icon</label><input name="icon" class="form-control" value="${d.i || '🍽️'}" maxlength="4" required>`, 'Save'); if (r) { await API.save('categories', { id: d.id ? +d.id : undefined, ...r }); toast('Category saved'); refresh() } };
acts.catDel = async d => { if (await confirmBox('Delete this category?', 'Delete')) { await API.remove('categories', +d.id); toast('Category deleted'); refresh() } };

function foodForm(v, vendorId) {
  const id = +qs.get('id'); return Promise.all([API.list('categories'), API.list('foods')]).then(([cs, fs]) => {
    const f = id ? fs.find(x => x.id === id) : { emoji: '🍽️', available: true }; if (!f) return v.innerHTML = empty('search', 'Food item not found.');
    v.innerHTML = `<div class="mb-4"><h4 class="fw-bold mb-1">${id ? 'Edit' : 'Add'} Food Item</h4><p class="text-muted small mb-0">Configure food item details, price, stock, and photo.</p></div><form id="ff" class="card p-4" style="max-width:640px" novalidate><div class="mb-3"><label class="form-label">Name</label><input name="name" class="form-control" value="${esc(f.name)}" required><div class="invalid-feedback">Name is required.</div></div><div class="row"><div class="col-md-4 mb-3"><label class="form-label">Category</label><select name="catId" class="form-select" required>${cs.map(c => `<option value="${c.id}" ${c.id === f.catId ? 'selected' : ''}>${c.icon} ${esc(c.name)}</option>`).join('')}</select></div><div class="col-md-4 mb-3"><label class="form-label">Price (₱)</label><input type="number" name="price" min="1" step="0.5" class="form-control" value="${f.price || ''}" required><div class="invalid-feedback">Enter a price of ₱1 or more.</div></div><div class="col-md-4 mb-3"><label class="form-label">Daily Stock <span class="text-muted fw-normal">(opt.)</span></label><input type="number" name="stockQty" min="0" max="99999" class="form-control" placeholder="Unlimited" value="${f.stockQty == null ? '' : f.stockQty}"></div></div><div class="mb-3"><label class="form-label">Photo (JPG, PNG or WebP, max 2 MB, auto-converted to 4:3 WebP)</label>${f.imagePath ? `<div class="mb-2">${dishThumbHtml(f)}</div>` : ''}<input type="file" name="image" accept="image/jpeg,image/png,image/webp" class="form-control"></div><div class="mb-3"><label class="form-label">Description</label><textarea name="desc" class="form-control" rows="2" required>${esc(f.desc)}</textarea><div class="invalid-feedback">Add a short description.</div></div><div class="form-check form-switch mb-4"><input class="form-check-input" type="checkbox" name="available" id="fAvail" ${f.available ? 'checked' : ''}><label class="form-check-label fw-semibold" for="fAvail">Available for ordering</label></div><div class="d-flex gap-2"><button class="btn btn-wmsu px-4">Save item</button> <a href="${B.role === 'admin' ? 'foods' : 'menu'}.html" class="btn btn-light">Cancel</a></div></form>`;
    onForm('#ff', async d => { if (d.image && d.image.size > 2 * 1024 * 1024) return toast('Photo must be 2 MB or smaller.', 'danger'); const stk = d.stockQty === '' ? null : +d.stockQty; const r = await API.save('foods', { id: id || undefined, vendorId: id ? f.vendorId : vendorId, name: d.name, desc: d.desc, catId: +d.catId, price: +d.price, stockQty: stk, available: !!d.available }); if (d.image && d.image.size) await API.upload(id || r.id, d.image); toast('Food item saved', 'success'); setTimeout(() => location = (B.role === 'admin' ? 'foods' : 'menu') + '.html', 500) })
  })
}
