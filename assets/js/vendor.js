/* Vendor pages */
const V=PAGES.vendor, vid=()=>SES()?.vendorId, PAYN={cash:'Cash',gcash:'GCash',maya:'Maya',card:'Card'};
const myOrd=async()=>(await API.list('orders')).filter(o=>o.vendorId===vid()).sort((a,b)=>new Date(b.time)-new Date(a.time));
const FLOW={
  pending:[['preparing','Accept','success','check-lg'],['rejected','Reject','outline-danger','x-lg']],
  preparing:[['ready','Mark Ready','wmsu','bag-check']],
  ready:[['completed','Complete','success','check2-circle']]
};
const obtn=o=>(FLOW[o.status]||[]).map(f=>`<button class="btn btn-sm btn-${f[2]}" data-act="setS" data-id="${o.id}" data-s="${f[0]}"><i class="bi bi-${f[3]}"></i> ${f[1]}</button>`).join(' ');
acts.setS=async d=>{
  if(d.s==='rejected'){
    const r=await modal('Reject Order',`<p class="small text-muted mb-2">Tell the customer why this order cannot be fulfilled:</p><label class="form-label small">Reason</label><select name="preset" class="form-select form-select-sm mb-2"><option value="Out of stock">Out of stock</option><option value="Closing early">Closing early</option><option value="Unable to fulfill order">Unable to fulfill order</option><option value="">Other (type below)</option></select><input name="custom" class="form-control form-control-sm" maxlength="180" placeholder="Optional details or custom reason...">`,'Reject Order','btn-danger');
    if(!r)return;
    const reason=(r.custom||'').trim()||r.preset||'Declined by the vendor';
    await API.save('orders',{id:+d.id,status:d.s,reason});
    toast('Order rejected','success');refresh();return;
  }
  await API.save('orders',{id:+d.id,status:d.s});toast('Order updated','success');refresh();
};
const actCell=o=>[obtn(o),payBtns(o.id,o.pay,o.payStatus,o.orderStatus,o.ref,o.total)].filter(Boolean).join(' ')||'<span class="text-muted small">-</span>';
const soundOn=()=>store.get('vendor_sound',true);
const playChime=()=>{if(!soundOn())return;try{const ctx=new(window.AudioContext||window.webkitAudioContext)();[[1046.5,0],[1318.5,0.14]].forEach(([freq,delay])=>{const osc=ctx.createOscillator(),g=ctx.createGain();osc.type='sine';osc.frequency.value=freq;g.gain.setValueAtTime(0.001,ctx.currentTime+delay);g.gain.exponentialRampToValueAtTime(0.18,ctx.currentTime+delay+0.02);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+delay+0.35);osc.connect(g);g.connect(ctx.destination);osc.start(ctx.currentTime+delay);osc.stop(ctx.currentTime+delay+0.36)})}catch{}};
const checkAlert=os=>{const cur=os.filter(o=>o.status==='pending'||o.payStatus==='Pending Verification').map(o=>o.id);if(window._knownAtt){const fresh=cur.some(id=>!window._knownAtt.includes(id));if(fresh){playChime();toast('New order or payment verification received!','success')}}window._knownAtt=cur};
acts.tglSound=()=>{store.set('vendor_sound',!soundOn());if(soundOn())playChime();refresh()};
const soundBtn=()=>`<button class="btn btn-sm ${soundOn()?'btn-outline-wmsu':'btn-light'}" data-act="tglSound" title="Toggle new order sound alerts"><i class="bi bi-volume-${soundOn()?'up-fill':'mute'}"></i> Sound: ${soundOn()?'On':'Off'}</button>`;
const poll=()=>{clearInterval(window._poll);window._poll=setInterval(()=>{if(!document.hidden&&!document.querySelector('.modal.show'))refresh()},20000)};
const ocols=[
  ['Order',o=>`<a href="order-details.html?id=${o.id}" class="fw-bold">#${o.no}</a>`],
  ['Customer',o=>esc(o.customer)],
  ['Items',o=>o.items.map(i=>`${i.qty}× ${esc(i.name)}`).join(', ')],
  ['Type',o=>esc(o.type)],
  ['Total',o=>`<strong class="text-wmsu">${peso(o.total)}</strong>`],
  ['Payment',o=>`<span>${PAYN[o.pay]||o.pay}</span> ${badge(o.payStatus)}${o.ref?`<br><small class="text-muted">Ref: <code>${esc(o.ref)}</code></small>`:''}`],
  ['Status',o=>badge(o.status)]
];

V.login=async v=>loginPage('vendor',v);

V.dashboard=async v=>{
  const [os,r,me]=await Promise.all([myOrd(),API.report('dashboard').catch(()=>null),API.list('vendors').then(a=>a.find(x=>x.id===vid()))]);
  checkAlert(os);
  const n=s=>os.filter(o=>o.status===s).length,active=os.filter(o=>['pending','preparing','ready'].includes(o.status));
  v.innerHTML=`
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
      <div>
        <h4 class="fw-bold mb-1">${esc(me?.name||'My stall')}</h4>
        <div class="text-muted small">Live vendor operations dashboard. Updates automatically.</div>
      </div>
      <div class="d-flex align-items-center gap-3">
        ${soundBtn()}
        <div class="form-check form-switch fs-6 m-0">
          <input class="form-check-input" type="checkbox" id="openSw" data-act="openSw" ${me?.open?'checked':''}>
          <label class="form-check-label fw-semibold" for="openSw">${me?.open?'Open for orders':'Closed'}</label>
        </div>
      </div>
    </div>
    <div class="row g-3 mb-4">
      ${stat('hourglass-split','New orders',n('pending'),n('pending')>0)
        +stat('fire','Preparing',n('preparing'))
        +stat('bag-check','Ready for pickup',n('ready'))
        +stat('check2-circle','Completed',n('completed'))
        +stat('cash-stack','Total sales (paid)',peso(r?r.total_sales:0))}
    </div>
    <div class="mb-4">
      <h5 class="fw-bold mb-3">Needs Attention</h5>
      ${table([...ocols,['Actions',actCell]],active,'No active orders right now.')}
    </div>
    <h5 class="fw-bold mb-3">Recent Orders</h5>
    ${table(ocols,os.slice(0,6),'No orders yet.')}`;
  poll();
};
acts.openSw=async(d,b)=>{await API.save('vendors',{id:vid(),open:b.checked});$('label[for=openSw]').textContent=b.checked?'Open for orders':'Closed';toast(b.checked?'Stall is now open':'Stall is now closed')};

V.orders=async v=>{
  const allOs=await myOrd(), f=qs.get('s')||'all', os=allOs.filter(o=>f==='all'||o.status===f);
  checkAlert(allOs);
  v.innerHTML=`
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
      <div>
        <h4 class="fw-bold mb-1">Incoming Orders</h4>
        <p class="text-muted small mb-0">Manage customer orders and update preparation status.</p>
      </div>
      ${soundBtn()}
    </div>
    <div class="pills mb-4">
      ${['all','pending','preparing','ready','completed','rejected'].map(s=>`<a class="pill text-decoration-none ${s===f?'active':''}" href="?s=${s}">${s[0].toUpperCase()+s.slice(1)}</a>`).join('')}
    </div>
    ${table([...ocols,['Actions',actCell]],os,'No incoming orders in this view.')}`;
  poll();
};

V['order-details']=async v=>{
  const o=(await myOrd()).find(x=>x.id===+qs.get('id'));
  if(!o)return v.innerHTML=empty('search','Order not found.','<a class="btn btn-wmsu" href="orders.html">Back to orders</a>');
  v.innerHTML=`
    <a href="orders.html" class="text-wmsu text-decoration-none small fw-semibold d-inline-flex align-items-center gap-1 mb-3">
      <i class="bi bi-arrow-left"></i> Back to orders
    </a>
    <div class="card p-4" style="max-width:640px">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <h3 class="fw-bold mb-0">Order <span class="text-wmsu">#${o.no}</span></h3>
        <div>${badge(o.status)}</div>
      </div>
      <p class="text-muted small mb-3">${fmt(o.time)} · ${esc(o.type)} · Customer: <b>${esc(o.customer)}</b> · ${PAYN[o.pay]||o.pay} ${badge(o.payStatus)}</p>
      ${o.ref?`<div class="alert alert-light border py-2 px-3 mb-3"><strong>Payment Reference:</strong> <code class="fs-6">${esc(o.ref)}</code></div>`:''}
      <hr class="my-3">
      ${o.items.map(i=>`<div class="d-flex justify-content-between py-1"><span>${i.qty}× ${esc(i.name)}</span><b>${peso(i.qty*i.price)}</b></div>`).join('')}
      <hr class="my-3">
      <div class="d-flex justify-content-between fs-4 mb-4"><b>Total</b><b class="text-wmsu">${peso(o.total)}</b></div>
      <div class="d-flex flex-wrap gap-2">${[obtn(o),payBtns(o.id,o.pay,o.payStatus,o.orderStatus,o.ref,o.total)].filter(Boolean).join(' ')||'<span class="text-muted">No further actions.</span>'}</div>
    </div>`;
};

V.menu=async v=>{
  const [fs,cs]=await Promise.all([API.list('foods'),API.list('categories')]),m=fs.filter(f=>f.vendorId===vid());
  v.innerHTML=`
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h4 class="fw-bold mb-1">Food Menu</h4>
        <p class="text-muted small mb-0">Manage items displayed in the canteen kiosk.</p>
      </div>
      <a class="btn btn-wmsu" href="add-food.html"><i class="bi bi-plus-lg"></i> Add Food Item</a>
    </div>
    ${table([
      ['Item',f=>`${f.emoji} <b>${esc(f.name)}</b>`],
      ['Category',f=>esc(cs.find(c=>c.id===f.catId)?.name||'-')],
      ['Price',f=>peso(f.price)],
      ['Stock',f=>f.stockQty==null?'<span class="text-muted small">Unlimited</span>':`<span class="badge-status badge-${f.stockQty===0?'danger':f.stockQty<=5?'pending':'neutral'}">${f.stockQty} left</span>`],
      ['Available',f=>`<div class="form-check form-switch"><input type="checkbox" class="form-check-input" data-act="avail" data-id="${f.id}" ${f.available?'checked':''}></div>`],
      ['',f=>`<div class="d-flex gap-1 justify-content-end"><a class="btn btn-sm btn-light" href="edit-food.html?id=${f.id}"><i class="bi bi-pencil"></i> Edit</a> <button class="btn btn-sm btn-light text-danger" data-act="delF" data-id="${f.id}"><i class="bi bi-trash"></i> Delete</button></div>`]
    ],m,'Your menu is empty. Add your first food item.')}`;
};
acts.avail=async(d,b)=>{await API.save('foods',{id:+d.id,available:b.checked});toast('Availability updated')};
acts.delF=async d=>{if(await confirmBox('Delete this food item?','Delete')){await API.remove('foods',+d.id);toast('Item deleted');refresh()}};

V['add-food']=async v=>foodForm(v,vid());
V['edit-food']=V['add-food'];
V.categories=async v=>catPage(v);

V.reports=async v=>{
  const r=await API.report('sales'),day=r.by_day.map(d=>[new Date(d.day+'T00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric'}),+d.sales]),item=r.top_items.slice(0,5).map(i=>[i.name,+i.sales]);
  v.innerHTML=`
    <div class="mb-4">
      <h4 class="fw-bold mb-1">Sales Reports</h4>
      <p class="text-muted small mb-0">Overview of paid orders and stall revenue.</p>
    </div>
    <div class="row g-3 mb-4">
      ${stat('cash-stack','Total sales (paid orders)',peso(r.totals.sales))+stat('receipt','Paid orders',r.totals.orders)}
    </div>
    <div class="row g-4">
      <div class="col-lg-6"><div class="card p-4"><h5 class="fw-bold mb-3">Sales by Day</h5>${bars(day)}</div></div>
      <div class="col-lg-6"><div class="card p-4"><h5 class="fw-bold mb-3">Top Selling Items</h5>${bars(item)}</div></div>
    </div>`;
};

V.profile=async v=>{
  const x=(await API.list('vendors')).find(a=>a.id===vid());
  v.innerHTML=`
    <div class="mb-4">
      <h4 class="fw-bold mb-1">Stall Profile</h4>
      <p class="text-muted small mb-0">Update stall information, canteen banner, and your e-wallet receiving accounts.</p>
    </div>
    <form id="pf" class="card p-4" style="max-width:640px" novalidate>
      <div class="mb-3"><label class="form-label">Stall name</label><input name="name" class="form-control" value="${esc(x.name)}" required></div>
      <div class="mb-3"><label class="form-label">Description</label><input name="desc" class="form-control" value="${esc(x.desc)}" required></div>
      <div class="mb-3"><label class="form-label">Contact number</label><input name="phone" class="form-control" pattern="[0-9 +]{7,15}" value="${esc(x.phone)}" required><div class="invalid-feedback">Enter a valid phone number.</div></div>
      <div class="card bg-light p-3 mb-3">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h6 class="fw-bold mb-0"><i class="bi bi-image text-wmsu me-1"></i> Canteen Banner</h6>
          ${x.banner?`<button type="button" class="btn btn-sm btn-outline-danger" data-act="delBanner" data-id="${x.id}"><i class="bi bi-trash"></i> Remove Banner</button>`:''}
        </div>
        <div id="bannerPreview" class="mb-2">
          ${x.banner?`<img src="${esc(x.banner)}" alt="Stall banner" style="width:100%;height:140px;object-fit:cover;border-radius:8px;border:1px solid var(--line)">`:`<div class="text-center py-4 bg-white rounded border text-muted small"><i class="bi bi-image fs-3 d-block mb-1 opacity-50"></i>No banner uploaded (default theme banner will be shown)</div>`}
        </div>
        <input type="file" name="banner" id="bannerInput" accept="image/jpeg,image/png,image/webp" class="form-control form-control-sm">
        <div class="form-text">Recommended wide image (JPG, PNG, or WebP, max 2 MB).</div>
      </div>
      <div class="card bg-light p-3 mb-3">
        <h6 class="fw-bold mb-2"><i class="bi bi-wallet2 text-wmsu me-1"></i> E-Wallet Payment Accounts</h6>
        <p class="small text-muted mb-3">Customers will send their GCash or Maya payments directly to these details. Leave blank if you do not accept e-wallet.</p>
        <div class="row g-2 mb-2">
          <div class="col-sm-6"><label class="form-label small mb-1">GCash Mobile Number</label><input name="gcashNumber" class="form-control" placeholder="e.g. 0917 123 4567" value="${esc(x.gcashNumber)}"></div>
          <div class="col-sm-6"><label class="form-label small mb-1">GCash Account Name</label><input name="gcashName" class="form-control" placeholder="e.g. Juan Dela Cruz" value="${esc(x.gcashName)}"></div>
        </div>
        <div class="mb-3 p-2 bg-white rounded border">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <label class="form-label small fw-bold mb-0"><i class="bi bi-qr-code text-wmsu me-1"></i> GCash QR Code Image</label>
            ${x.gcashQr?`<button type="button" class="btn btn-sm btn-outline-danger py-0 px-2" data-act="delQr" data-id="${x.id}"><i class="bi bi-trash"></i> Remove QR</button>`:''}
          </div>
          <div id="qrPreview" class="mb-2 text-center">
            ${x.gcashQr?`<img src="${esc(x.gcashQr)}" alt="GCash QR" style="max-height:160px;border-radius:8px;border:1px solid var(--line)">`:'<div class="text-muted small py-2">No QR code uploaded (optional, recommended for fast kiosk scanning)</div>'}
          </div>
          <input type="file" name="qr" id="qrInput" accept="image/jpeg,image/png,image/webp" class="form-control form-control-sm">
        </div>
        <div class="row g-2">
          <div class="col-sm-6"><label class="form-label small mb-1">Maya Mobile Number</label><input name="mayaNumber" class="form-control" placeholder="e.g. 0918 123 4567" value="${esc(x.mayaNumber)}"></div>
          <div class="col-sm-6"><label class="form-label small mb-1">Maya Account Name</label><input name="mayaName" class="form-control" placeholder="e.g. Juan Dela Cruz" value="${esc(x.mayaName)}"></div>
        </div>
      </div>
      <div class="form-check form-switch mb-4"><input class="form-check-input" type="checkbox" name="open" ${x.open?'checked':''}><label class="form-check-label fw-semibold">Stall is open for orders</label></div>
      <div><button class="btn btn-wmsu px-4">Save Profile</button></div>
    </form>`;
  $('#bannerInput').onchange=e=>{
    const f=e.target.files[0];if(!f)return;
    if(f.size>2*1024*1024){toast('Banner image must be 2 MB or smaller.','danger');e.target.value='';return}
    $('#bannerPreview').innerHTML=`<img src="${URL.createObjectURL(f)}" alt="Banner preview" style="width:100%;height:140px;object-fit:cover;border-radius:8px;border:1px solid var(--line)">`;
  };
  $('#qrInput').onchange=e=>{
    const f=e.target.files[0];if(!f)return;
    if(f.size>2*1024*1024){toast('QR image must be 2 MB or smaller.','danger');e.target.value='';return}
    $('#qrPreview').innerHTML=`<img src="${URL.createObjectURL(f)}" alt="QR preview" style="max-height:160px;border-radius:8px;border:1px solid var(--line)">`;
  };
  onForm('#pf',async d=>{
    if(d.banner&&d.banner.size>2*1024*1024)return toast('Banner image must be 2 MB or smaller.','danger');
    if(d.qr&&d.qr.size>2*1024*1024)return toast('QR image must be 2 MB or smaller.','danger');
    await API.save('vendors',{id:x.id,name:d.name,desc:d.desc,phone:d.phone,gcashNumber:d.gcashNumber,gcashName:d.gcashName,mayaNumber:d.mayaNumber,mayaName:d.mayaName,open:!!d.open});
    if(d.banner&&d.banner.size)await API.uploadBanner(x.id,d.banner);
    if(d.qr&&d.qr.size)await API.uploadQr(x.id,d.qr);
    toast('Profile saved','success');
    refresh();
  });
};
acts.delBanner=async d=>{if(await confirmBox('Remove your canteen banner?','Remove')){await API.removeBanner(+d.id);toast('Banner removed');refresh()}};
acts.delQr=async d=>{if(await confirmBox('Remove your GCash QR code?','Remove')){await API.removeQr(+d.id);toast('QR code removed');refresh()}};
