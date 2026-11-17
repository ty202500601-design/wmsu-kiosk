/* Vendor pages */
const V=PAGES.vendor, vid=()=>SES()?.vendorId, PAYN={cash:'Cash',gcash:'GCash',maya:'Maya',card:'Card'};
const myOrd=async()=>(await API.list('orders')).filter(o=>o.vendorId===vid()).sort((a,b)=>new Date(b.time)-new Date(a.time));
const FLOW={
  pending:[['preparing','Accept','success','check-lg'],['rejected','Reject','outline-danger','x-lg']],
  preparing:[['ready','Mark Ready','wmsu','bag-check']],
  ready:[['completed','Complete','success','check2-circle']]
};
const obtn=o=>(FLOW[o.status]||[]).map(f=>`<button class="btn btn-sm btn-${f[2]}" data-act="setS" data-id="${o.id}" data-s="${f[0]}"><i class="bi bi-${f[3]}"></i> ${f[1]}</button>`).join(' ');
acts.setS=async d=>{if(d.s==='rejected'&&!await confirmBox('Reject this order? The customer will be notified.','Reject'))return;await API.save('orders',{id:+d.id,status:d.s});toast('Order updated','success');refresh()};
const actCell=o=>[obtn(o),payBtns(o.id,o.pay,o.payStatus,o.orderStatus)].filter(Boolean).join(' ')||'<span class="text-muted small">-</span>';
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
V.apply=async v=>{
  v.innerHTML=`
    <div class="card p-4 mx-auto my-4" style="max-width:540px">
      <div class="text-center mb-3">
        <img class="logo-img lg" src="${ROOT}assets/img/wmsu-logo.png" alt="WMSU seal">
        <h4 class="mt-3 fw-bold">Apply as Vendor</h4>
        <p class="text-muted small">Register your food stall for the campus canteen kiosk.</p>
      </div>
      <form id="af" novalidate>
        <div class="mb-3">
          <label class="form-label">Stall / Business Name</label>
          <input name="stall_name" class="form-control" placeholder="e.g. Aling Nena's Kitchen" minlength="2" maxlength="100" required>
          <div class="invalid-feedback">Enter your stall name (2-100 characters).</div>
        </div>
        <div class="mb-3">
          <label class="form-label">Owner Full Name</label>
          <input name="owner_name" class="form-control" placeholder="e.g. Maria Santos" minlength="2" maxlength="100" required>
          <div class="invalid-feedback">Enter owner name.</div>
        </div>
        <div class="mb-3">
          <label class="form-label">Contact Phone</label>
          <input name="phone" class="form-control" placeholder="0917 123 4567" pattern="[0-9 +]{7,20}" required>
          <div class="invalid-feedback">Enter a valid phone number (7-20 digits).</div>
        </div>
        <div class="mb-3">
          <label class="form-label">Email Address</label>
          <input type="email" name="email" class="form-control" placeholder="vendor@example.com" required>
          <div class="invalid-feedback">Enter a valid email.</div>
        </div>
        <div class="mb-3">
          <label class="form-label">Password</label>
          <input type="password" name="password" class="form-control" minlength="8" maxlength="72" placeholder="At least 8 chars (letters and numbers)" required>
          <div class="invalid-feedback">Password must be 8-72 characters with letters and numbers.</div>
        </div>
        <button class="btn btn-wmsu btn-lg w-100">Submit Application</button>
      </form>
      <div class="text-center mt-3">
        <a class="small text-wmsu" href="login.html"><i class="bi bi-arrow-left"></i> Already have an account? Sign in</a>
      </div>
    </div>`;
  onForm('#af',async d=>{
    if(!/[A-Za-z]/.test(d.password)||!/\d/.test(d.password))return toast('Password must contain letters and numbers.','danger');
    await API.f('vendors',{m:'POST',q:{action:'apply'},b:d});
    v.innerHTML=`
      <div class="card p-5 mx-auto my-4 text-center" style="max-width:540px">
        <i class="bi bi-check-circle-fill text-success" style="font-size:4rem"></i>
        <h3 class="fw-bold mt-2">Application Submitted!</h3>
        <p class="text-muted">Your vendor application has been sent for review by the campus canteen administrator.</p>
        <p class="small text-muted">Once approved, you will be able to sign in using your email and password.</p>
        <a class="btn btn-wmsu mt-3" href="login.html">Go to Vendor Login</a>
      </div>`;
  });
};

V.dashboard=async v=>{
  const [os,r,me]=await Promise.all([myOrd(),API.report('dashboard').catch(()=>null),API.list('vendors').then(a=>a.find(x=>x.id===vid()))]);
  const n=s=>os.filter(o=>o.status===s).length,active=os.filter(o=>['pending','preparing','ready'].includes(o.status));
  v.innerHTML=`
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
      <div>
        <h4 class="fw-bold mb-1">${esc(me?.name||'My stall')}</h4>
        <div class="text-muted small">Live vendor operations dashboard. Updates automatically.</div>
      </div>
      <div class="form-check form-switch fs-6 m-0">
        <input class="form-check-input" type="checkbox" id="openSw" data-act="openSw" ${me?.open?'checked':''}>
        <label class="form-check-label fw-semibold" for="openSw">${me?.open?'Open for orders':'Closed'}</label>
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
  const f=qs.get('s')||'all',os=(await myOrd()).filter(o=>f==='all'||o.status===f);
  v.innerHTML=`
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
      <div>
        <h4 class="fw-bold mb-1">Incoming Orders</h4>
        <p class="text-muted small mb-0">Manage customer orders and update preparation status.</p>
      </div>
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
      <div class="d-flex flex-wrap gap-2">${[obtn(o),payBtns(o.id,o.pay,o.payStatus,o.orderStatus)].filter(Boolean).join(' ')||'<span class="text-muted">No further actions.</span>'}</div>
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
      <p class="text-muted small mb-0">Update stall information, contact details, and your e-wallet receiving accounts.</p>
    </div>
    <form id="pf" class="card p-4" style="max-width:640px" novalidate>
      <div class="mb-3"><label class="form-label">Stall name</label><input name="name" class="form-control" value="${esc(x.name)}" required></div>
      <div class="mb-3"><label class="form-label">Description</label><input name="desc" class="form-control" value="${esc(x.desc)}" required></div>
      <div class="mb-3"><label class="form-label">Contact number</label><input name="phone" class="form-control" pattern="[0-9 +]{7,15}" value="${esc(x.phone)}" required><div class="invalid-feedback">Enter a valid phone number.</div></div>
      <div class="card bg-light p-3 mb-3">
        <h6 class="fw-bold mb-2"><i class="bi bi-wallet2 text-wmsu me-1"></i> E-Wallet Payment Accounts</h6>
        <p class="small text-muted mb-3">Customers will send their GCash or Maya payments directly to these details.</p>
        <div class="row g-2 mb-2">
          <div class="col-sm-6"><label class="form-label small mb-1">GCash Mobile Number</label><input name="gcashNumber" class="form-control" placeholder="e.g. 0917 123 4567" value="${esc(x.gcashNumber)}"></div>
          <div class="col-sm-6"><label class="form-label small mb-1">GCash Account Name</label><input name="gcashName" class="form-control" placeholder="e.g. Juan Dela Cruz" value="${esc(x.gcashName)}"></div>
        </div>
        <div class="row g-2">
          <div class="col-sm-6"><label class="form-label small mb-1">Maya Mobile Number</label><input name="mayaNumber" class="form-control" placeholder="e.g. 0918 123 4567" value="${esc(x.mayaNumber)}"></div>
          <div class="col-sm-6"><label class="form-label small mb-1">Maya Account Name</label><input name="mayaName" class="form-control" placeholder="e.g. Juan Dela Cruz" value="${esc(x.mayaName)}"></div>
        </div>
      </div>
      <div class="form-check form-switch mb-4"><input class="form-check-input" type="checkbox" name="open" ${x.open?'checked':''}><label class="form-check-label fw-semibold">Stall is open for orders</label></div>
      <div><button class="btn btn-wmsu px-4">Save Profile</button></div>
    </form>`;
  onForm('#pf',async d=>{await API.save('vendors',{id:x.id,...d,open:!!d.open});toast('Profile saved','success')});
};
