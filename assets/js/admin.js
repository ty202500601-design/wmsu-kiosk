/* Admin pages */
const A=PAGES.admin, PN={cash:'Cash',gcash:'GCash',maya:'Maya'};
const vname=(vs,id)=>esc(vs.find(v=>v.id===id)?.name||'-');
const tgl=(t,id,s,a,b)=>`<button class="btn btn-sm btn-light" data-act="aset" data-t="${t}" data-id="${id}" data-s="${s==='active'?b:a}"><i class="bi bi-${s==='active'?'slash-circle':'check-circle'}"></i> ${s==='active'?(t==='users'?'Ban':'Suspend'):'Activate'}</button>`;
const del=(t,id)=>`<button class="btn btn-sm btn-light text-danger" data-act="adel" data-t="${t}" data-id="${id}"><i class="bi bi-trash"></i> Delete</button>`;

acts.aset=async d=>{if(await confirmBox('Change this status?','Yes, change')){await API.save(d.t,{id:+d.id,status:d.s});toast('Status updated','success');refresh()}};
acts.adel=async d=>{if(await confirmBox('Delete permanently? This cannot be undone.','Delete')){await API.remove(d.t,+d.id);toast('Deleted');refresh()}};

A.login=async v=>loginPage('admin',v);

A.dashboard=async v=>{
  const [os,vs,r]=await Promise.all([API.list('orders'),API.list('vendors'),API.report('dashboard')]),total=Object.values(r.orders_by_status).reduce((a,b)=>a+ +b,0);
  v.innerHTML=`
    <div class="mb-4">
      <h4 class="fw-bold mb-1">Canteen Overview</h4>
      <p class="text-muted small mb-0">Live metrics across users, vendors, and transactions.</p>
    </div>
    <div class="row g-3 mb-4">
      ${stat('people','Total users',r.total_users)
        +stat('shop','Active vendors',r.total_vendors)
        +stat('receipt','Total orders',total)
        +stat('cash-stack','Total sales (paid)',peso(r.total_sales))
        +stat('file-earmark-check','Pending applications',r.pending_applications)}
    </div>
    <h5 class="fw-bold mb-3">Recent Transactions</h5>
    ${table([
      ['Order',o=>`<b>#${esc(o.no)}</b>`],
      ['Vendor',o=>vname(vs,o.vendorId)],
      ['Method',o=>PN[o.pay]||esc(o.pay)],
      ['Amount',o=>`<strong class="text-wmsu">${peso(o.total)}</strong>`],
      ['Payment',o=>badge(o.payStatus)],
      ['Status',o=>badge(o.status)],
      ['Date',o=>fmt(o.time)]
    ],os.slice(0,6))}`;
};

A.users=async v=>{
  const us=await API.list('users');
  v.innerHTML=`
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h4 class="fw-bold mb-1">User Management</h4>
        <p class="text-muted small mb-0">Manage system users, administrators, and customer accounts.</p>
      </div>
      <button class="btn btn-wmsu" data-act="addU"><i class="bi bi-person-plus"></i> Add User</button>
    </div>
    ${table([
      ['Name',u=>`<b>${esc(u.name)}</b>`],
      ['Email',u=>esc(u.email)],
      ['Role',u=>`<span class="badge-status badge-neutral">${esc(u.role)}</span>`],
      ['Status',u=>badge(u.status)],
      ['',u=>`<div class="d-flex gap-1 justify-content-end">${tgl('users',u.id,u.status,'active','banned')} ${del('users',u.id)}</div>`]
    ],us)}`;
};
acts.addU=async()=>{
  const r=await modal('Add user',`
    <div class="mb-3"><label class="form-label">Full Name</label><input name="name" class="form-control" placeholder="Full name" minlength="2" required></div>
    <div class="mb-3"><label class="form-label">Email Address</label><input type="email" name="email" class="form-control" placeholder="email@wmsu.edu.ph" required></div>
    <div class="mb-3"><label class="form-label">Password</label><input type="password" name="password" class="form-control" placeholder="8+ characters, letters and numbers" pattern="(?=.*[A-Za-z])(?=.*[0-9]).{8,72}" required></div>
    <div class="mb-3"><label class="form-label">Account Role</label><select name="role" class="form-select"><option value="customer">Customer</option><option value="admin">Admin</option></select></div>
  `,'Add user');
  if(r){await API.save('users',r);toast('User added','success');refresh()}
};

A.vendors=async v=>{
  const vs=(await API.list('vendors')).filter(x=>['active','suspended'].includes(x.status));
  v.innerHTML=`
    <div class="mb-4">
      <h4 class="fw-bold mb-1">Campus Vendors</h4>
      <p class="text-muted small mb-0">Active food stalls and vendor partners operating in the canteen.</p>
    </div>
    ${table([
      ['Stall',x=>`${x.emoji} <b>${esc(x.name)}</b>`],
      ['Owner',x=>esc(x.owner)],
      ['Phone',x=>esc(x.phone)],
      ['Status',x=>badge(x.status)],
      ['',x=>`<div class="d-flex gap-1 justify-content-end">${tgl('vendors',x.id,x.status,'active','suspended')} ${del('vendors',x.id)}</div>`]
    ],vs)}`;
};

A.applications=async v=>{
  const ap=await API.list('applications');
  v.innerHTML=`
    <div class="mb-4">
      <h4 class="fw-bold mb-1">Vendor Applications</h4>
      <p class="text-muted small mb-0">Review registration requests submitted by prospective food stalls.</p>
    </div>
    ${table([
      ['Stall',a=>`<b>${esc(a.stall)}</b>`],
      ['Owner',a=>esc(a.owner)],
      ['Contact',a=>`${esc(a.email)}<br><small class="text-muted">${esc(a.phone)}</small>`],
      ['Status',a=>badge(a.status)],
      ['',a=>a.status==='pending'?`<div class="d-flex gap-1 justify-content-end"><button class="btn btn-sm btn-success" data-act="appr" data-id="${a.id}" data-ok="1"><i class="bi bi-check-lg"></i> Approve</button> <button class="btn btn-sm btn-outline-danger" data-act="appr" data-id="${a.id}"><i class="bi bi-x-lg"></i> Reject</button></div>`:badge(a.status)]
    ],ap,'No applications to review.')}`;
};
acts.appr=async d=>{
  const ap=(await API.list('applications')).find(a=>a.id===+d.id);
  if(!ap)return;
  if(!await confirmBox(`${d.ok?'Approve':'Reject'} application from ${esc(ap.stall)}?`,d.ok?'Approve':'Reject'))return;
  await API.save('applications',{id:ap.id,status:d.ok?'approved':'rejected'});
  toast('Application '+(d.ok?'approved':'rejected'),'success');
  refresh();
};

A.foods=async v=>{
  const [fs,vs,cs]=await Promise.all(['foods','vendors','categories'].map(t=>API.list(t)));
  v.innerHTML=`
    <div class="mb-4">
      <h4 class="fw-bold mb-1">All Food Items</h4>
      <p class="text-muted small mb-0">Global list of menu items from all registered stalls.</p>
    </div>
    ${table([
      ['Item',f=>`${f.emoji} <b>${esc(f.name)}</b>`],
      ['Vendor',f=>vname(vs,f.vendorId)],
      ['Category',f=>esc(cs.find(c=>c.id===f.catId)?.name||'-')],
      ['Price',f=>peso(f.price)],
      ['Status',f=>badge(f.available?'active':'suspended').replace('suspended','unavailable')],
      ['',f=>`<div class="d-flex gap-1 justify-content-end"><a class="btn btn-sm btn-light" href="edit-food.html?id=${f.id}"><i class="bi bi-pencil"></i> Edit</a> ${del('foods',f.id)}</div>`]
    ],fs)}`;
};

A['edit-food']=async v=>foodForm(v);
A.categories=async v=>catPage(v);

A.orders=async v=>{
  const f=qs.get('s')||'all',[os,vs]=await Promise.all([API.list('orders'),API.list('vendors')]);
  v.innerHTML=`
    <div class="mb-4">
      <h4 class="fw-bold mb-1">Orders</h4>
      <p class="text-muted small mb-0">Track and monitor all orders across campus food stalls.</p>
    </div>
    <div class="pills mb-4">
      ${['all','pending','preparing','ready','completed','rejected'].map(s=>`<a class="pill text-decoration-none ${s===f?'active':''}" href="?s=${s}">${s[0].toUpperCase()+s.slice(1)}</a>`).join('')}
    </div>
    ${table([
      ['Order',o=>`<b>#${esc(o.no)}</b>`],
      ['Vendor',o=>vname(vs,o.vendorId)],
      ['Customer',o=>esc(o.customer)],
      ['Items',o=>o.items.reduce((s,i)=>s+i.qty,0)+' item(s)'],
      ['Total',o=>`<strong class="text-wmsu">${peso(o.total)}</strong>`],
      ['Payment',o=>badge(o.payStatus)],
      ['Status',o=>badge(o.status)],
      ['Date',o=>fmt(o.time)]
    ],os.filter(o=>f==='all'||o.status===f))}`;
};

A.payments=async v=>{
  const ps=await API.list('payments');
  v.innerHTML=`
    <div class="mb-4">
      <h4 class="fw-bold mb-1">Payments & Audits</h4>
      <p class="text-muted small mb-0">Verify e-wallet references, confirm cash, or process refunds.</p>
    </div>
    ${table([
      ['Order',p=>`<b>#${esc(p.no)}</b>`],
      ['Method',p=>PN[p.method]||esc(p.method)],
      ['Amount',p=>`<strong class="text-wmsu">${peso(p.amount)}</strong>`],
      ['Reference',p=>p.ref?`<code>${esc(p.ref)}</code>`:'<span class="text-muted">-</span>'],
      ['Status',p=>badge(p.status)],
      ['',p=>`<div class="d-flex gap-1 justify-content-end">${payBtns(p.orderId,p.method,p.status,p.orderStatus)}</div>`]
    ],ps,'No payments yet.')}`;
};

A.reports=async v=>{
  const r=await API.report('sales'),n=+r.totals.orders,s=+r.totals.sales;
  v.innerHTML=`
    <div class="mb-4">
      <h4 class="fw-bold mb-1">Sales & Revenue Reports</h4>
      <p class="text-muted small mb-0">Financial metrics, stall breakdown, and payment analytics.</p>
    </div>
    <div class="row g-3 mb-4">
      ${stat('cash-stack','Total sales (paid orders)',peso(s))
        +stat('receipt','Paid orders',n)
        +stat('calculator','Average order',peso(n?s/n:0))}
    </div>
    <div class="row g-4">
      <div class="col-lg-6"><div class="card p-4"><h5 class="fw-bold mb-3">Sales by Vendor</h5>${bars(r.by_vendor.map(x=>[x.name,+x.sales]))}</div></div>
      <div class="col-lg-6"><div class="card p-4"><h5 class="fw-bold mb-3">Sales by Payment Method</h5>${bars(r.by_method.map(x=>[PN[x.method]||x.method,+x.sales]))}</div></div>
    </div>`;
};

A.settings=async v=>{
  const s=(await API.list('settings'))[0];
  v.innerHTML=`
    <div class="mb-4">
      <h4 class="fw-bold mb-1">System Settings</h4>
      <p class="text-muted small mb-0">Operating hours and active campus payment gateways.</p>
    </div>
    <form id="sf" class="card p-4" style="max-width:600px" novalidate>
      <div class="mb-3"><label class="form-label">Canteen name</label><input name="canteen" class="form-control" value="${esc(s.canteen)}" minlength="2" required></div>
      <div class="row mb-3">
        <div class="col"><label class="form-label">Opening Time</label><input type="time" name="open" class="form-control" value="${esc(s.open)}" required></div>
        <div class="col"><label class="form-label">Closing Time</label><input type="time" name="close" class="form-control" value="${esc(s.close)}" required></div>
      </div>
      <label class="form-label mb-2">Accepted Payment Methods & Account Details</label>
      <div class="card bg-light p-3 mb-4">
        <div class="form-check form-switch mb-3">
          <input class="form-check-input" type="checkbox" id="pay_cash" name="cash" ${s.cash?'checked':''}>
          <label class="form-check-label fw-semibold" for="pay_cash">Cash at Counter</label>
        </div>
        <div class="border-top pt-3 mb-3">
          <div class="form-check form-switch mb-2">
            <input class="form-check-input" type="checkbox" id="pay_gcash" name="gcash" ${s.gcash?'checked':''}>
            <label class="form-check-label fw-semibold" for="pay_gcash">GCash</label>
          </div>
          <div class="row g-2 ps-4">
            <div class="col-sm-6"><label class="form-label small mb-1">GCash Mobile Number</label><input name="gcashNumber" class="form-control form-control-sm" placeholder="e.g. 0917 123 4567" value="${esc(s.gcashNumber)}"></div>
            <div class="col-sm-6"><label class="form-label small mb-1">GCash Account Name</label><input name="gcashName" class="form-control form-control-sm" placeholder="e.g. WMSU Campus Canteen" value="${esc(s.gcashName)}"></div>
          </div>
        </div>
        <div class="border-top pt-3">
          <div class="form-check form-switch mb-2">
            <input class="form-check-input" type="checkbox" id="pay_maya" name="maya" ${s.maya?'checked':''}>
            <label class="form-check-label fw-semibold" for="pay_maya">Maya</label>
          </div>
          <div class="row g-2 ps-4">
            <div class="col-sm-6"><label class="form-label small mb-1">Maya Mobile Number</label><input name="mayaNumber" class="form-control form-control-sm" placeholder="e.g. 0918 123 4567" value="${esc(s.mayaNumber)}"></div>
            <div class="col-sm-6"><label class="form-label small mb-1">Maya Account Name</label><input name="mayaName" class="form-control form-control-sm" placeholder="e.g. WMSU Campus Canteen" value="${esc(s.mayaName)}"></div>
          </div>
        </div>
      </div>
      <div><button class="btn btn-wmsu px-4">Save Settings</button></div>
    </form>`;
  onForm('#sf',async d=>{await API.save('settings',{id:1,canteen:d.canteen,open:d.open,close:d.close,gcashNumber:d.gcashNumber,gcashName:d.gcashName,mayaNumber:d.mayaNumber,mayaName:d.mayaName,...Object.fromEntries(Object.keys(PN).map(k=>[k,!!d[k]]))});toast('Settings saved','success')});
};
