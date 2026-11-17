/* Customer / student kiosk pages */
const C=PAGES.customer, FOODS={}, fImg=f=>f.img?`<img src="${esc(f.img)}" alt="${esc(f.name)}">`:`<span>${f.emoji}</span>`;
const myOrders=()=>store.get('myOrders',[]).filter(x=>x&&x.no), curV=()=>+(qs.get('v')||store.get('vendorId')||0);
const PAYS={cash:['cash-coin','Cash at Counter'],gcash:['phone','GCash'],maya:['wallet2','Maya'],card:['credit-card','Debit/Credit Card']};
const head=(t,s='')=>`<div class="page-header mb-4"><h2 class="page-title">${t}</h2>${s?`<p class="text-muted mb-0">${s}</p>`:''}</div>`;

C.vendors=async v=>{
  const vs=(await API.list('vendors')).filter(x=>x.status==='active');
  v.innerHTML=head('Choose a vendor','Select a campus food stall to browse their menu and start ordering.')+(vs.length?`<div class="row g-4">${vs.map(x=>`
    <div class="col-md-6 col-lg-4">
      <div class="card vcard h-100">
        <div class="vcard-banner">
          <div class="vcard-avatar">${x.emoji||'🍽️'}</div>
        </div>
        <div class="p-4 d-flex flex-column flex-grow-1 text-center">
          <h5 class="fw-bold mb-1 text-truncate" title="${esc(x.name)}">${esc(x.name)}</h5>
          <p class="text-muted small vcard-desc mb-3">${esc(x.desc||'Campus food stall')}</p>
          <div class="mb-3">
            ${badge(x.open?'Open now':'Closed')}
          </div>
          <button class="btn btn-wmsu w-100 mt-auto" data-act="pickV" data-id="${x.id}" ${x.open?'':'disabled'}>
            <i class="bi bi-menu-app me-1"></i> View Menu
          </button>
        </div>
      </div>
    </div>`).join('')}</div>`:empty('shop','No vendors are open right now.'));
};
acts.pickV=d=>{store.set('vendorId',+d.id);location='menu.html?v='+d.id};
acts.quick=d=>cart.add(FOODS[d.id]);

C.menu=async v=>{
  const vid=curV();if(!vid)return location='vendors.html';store.set('vendorId',vid);
  const [vs,cs,fs]=await Promise.all([API.list('vendors'),API.list('categories'),API.list('foods')]),ven=vs.find(x=>x.id===vid),all=fs.filter(f=>f.vendorId===vid);all.forEach(f=>FOODS[f.id]=f);
  const mine=cs.filter(c=>all.some(f=>f.catId===c.id));let cat=0,q='';
  v.innerHTML=`
    <div class="mb-4">
      <a href="vendors.html" class="text-wmsu text-decoration-none small fw-semibold d-inline-flex align-items-center gap-1 mb-2">
        <i class="bi bi-arrow-left"></i> All Vendors
      </a>
      <div class="d-flex justify-content-between flex-wrap gap-2 align-items-end">
        ${head(ven?esc(ven.name):'Menu',ven?.desc?esc(ven.desc):'Pick your meal.')}
      </div>
    </div>
    <div class="input-group input-group-lg mb-3">
      <span class="input-group-text bg-white"><i class="bi bi-search text-muted"></i></span>
      <input id="q" class="form-control ps-0" placeholder="Search menu items…">
    </div>
    <div class="pills mb-4" id="pills"></div>
    <div class="row g-4" id="grid"></div>`;
  const draw=()=>{
    $('#pills').innerHTML=[{id:0,name:'All',icon:'🍽️'},...mine].map(c=>`<button class="pill ${c.id===cat?'active':''}" data-act="cat" data-id="${c.id}">${c.icon} ${esc(c.name)}</button>`).join('');
    const l=all.filter(f=>(!cat||f.catId===cat)&&f.name.toLowerCase().includes(q));
    $('#grid').innerHTML=l.length?l.map(f=>`
      <div class="col-6 col-lg-4 col-xl-3">
        <div class="card fcard h-100 ${f.available?'':'opacity-75'}">
          <a href="food-details.html?id=${f.id}" class="fimg">${fImg(f)}</a>
          <div class="p-3 d-flex flex-column flex-grow-1">
            <h6 class="fw-bold mb-1 text-truncate" title="${esc(f.name)}">${esc(f.name)}</h6>
            <p class="text-muted small mb-2 text-truncate">${esc(f.desc||'')}</p>
            <div class="d-flex justify-content-between align-items-center mt-auto pt-2 border-top">
              <strong class="text-wmsu fs-5">${peso(f.price)}</strong>
              ${f.available?`<button class="btn btn-wmsu btn-sm px-3" aria-label="Add ${esc(f.name)}" data-act="quick" data-id="${f.id}"><i class="bi bi-plus-lg me-1"></i> Add</button>`:'<span class="badge-status badge-neutral">Sold out</span>'}
            </div>
          </div>
        </div>
      </div>`).join(''):`<div class="col-12">${empty('search','No food matches your search. Try another word or category.')}</div>`;
  };
  acts.cat=d=>{cat=+d.id;draw()};$('#q').oninput=e=>{q=e.target.value.toLowerCase().trim();draw()};draw();
};

C['food-details']=async v=>{
  const f=(await API.list('foods')).find(x=>x.id===+qs.get('id'));
  if(!f)return v.innerHTML=empty('search','This food item was not found.','<a class="btn btn-wmsu" href="vendors.html">Back to vendors</a>');
  let n=1;
  v.innerHTML=`
    <a href="menu.html?v=${f.vendorId}" class="text-wmsu text-decoration-none small fw-semibold d-inline-flex align-items-center gap-1 mb-3">
      <i class="bi bi-arrow-left"></i> Back to menu
    </a>
    <div class="row g-4">
      <div class="col-lg-6">
        <div class="fimg big">${fImg(f)}</div>
      </div>
      <div class="col-lg-6 d-flex flex-column justify-content-center">
        <h1 class="fw-bold mb-2">${esc(f.name)}</h1>
        <h3 class="text-wmsu fw-bold mb-3">${peso(f.price)}</h3>
        <p class="lead text-muted mb-4">${esc(f.desc)}</p>
        <div class="d-flex align-items-center gap-3 mb-4">
          <span class="fw-semibold">Quantity:</span>
          <div class="qty"><button data-act="dq" data-d="-1" aria-label="Less">−</button><span id="n" class="fs-4">1</span><button data-act="dq" data-d="1" aria-label="More">+</button></div>
        </div>
        <div>
          <button class="btn btn-wmsu btn-lg px-4" id="add" ${f.available?'':'disabled'}>
            <i class="bi bi-cart-plus me-1"></i> ${f.available?'Add to cart':'Sold out'}
          </button>
        </div>
      </div>
    </div>`;
  acts.dq=d=>{n=Math.max(1,Math.min(20,n+ +d.d));$('#n').textContent=n};
  $('#add').onclick=async()=>{if(await cart.add(f,n))location='cart.html'};
};

C.cart=async v=>{
  const [c,vs]=await Promise.all([cart.get(),API.list('vendors')]);
  if(!c.items.length)return v.innerHTML=head('Your cart')+empty('cart-x','Your cart is empty.','<a class="btn btn-wmsu btn-lg mt-3" href="vendors.html"><i class="bi bi-shop me-1"></i> Start ordering</a>');
  v.innerHTML=head('Your cart','Review order items from all selected stalls.')+`
    <div class="row g-4">
      <div class="col-lg-8">
        ${c.items.map(i=>{
          const ven=vs.find(x=>x.id===i.vendorId);
          return `
            <div class="card p-3 mb-3 d-flex flex-row align-items-center gap-3">
              <span style="font-size:2.4rem">${i.emoji||'🍽️'}</span>
              <div class="flex-grow-1">
                <h5 class="fw-bold mb-0">${esc(i.name)}</h5>
                <div class="d-flex align-items-center gap-2 mt-1">
                  <span class="text-muted fw-semibold">${peso(i.price)}</span>
                  ${ven?`<span class="badge-status badge-wmsu"><i class="bi bi-shop"></i> ${esc(ven.name)}</span>`:''}
                </div>
              </div>
              <div class="qty">
                <button data-act="cq" data-id="${i.id}" data-d="-1">−</button>
                <span>${i.qty}</span>
                <button data-act="cq" data-id="${i.id}" data-d="1">+</button>
              </div>
              <b style="width:90px" class="text-end text-wmsu fs-5">${peso(i.price*i.qty)}</b>
              <button class="btn btn-light text-danger" aria-label="Remove" data-act="cr" data-id="${i.id}"><i class="bi bi-trash"></i></button>
            </div>`;
        }).join('')}
        <button class="btn btn-link text-danger p-0 mt-2 text-decoration-none" data-act="cclear"><i class="bi bi-trash me-1"></i> Clear cart</button>
      </div>
      <div class="col-lg-4">
        <div class="card p-4">
          <h5 class="fw-bold mb-3">Order Summary</h5>
          <div class="d-flex justify-content-between text-muted mb-2"><span>Subtotal</span><b>${peso(cart.total())}</b></div>
          <hr class="my-3">
          <div class="d-flex justify-content-between fs-4 mb-4"><b>Total</b><b class="text-wmsu">${peso(cart.total())}</b></div>
          <a href="checkout.html" class="btn btn-wmsu btn-lg w-100 mb-2">Proceed to Checkout</a>
          <a href="vendors.html" class="btn btn-light w-100"><i class="bi bi-plus-lg me-1"></i> Add items from other stalls</a>
        </div>
      </div>
    </div>`;
};
acts.cq=d=>{cart.setQty(d.id,+d.d);refresh()};
acts.cr=async d=>{if(await confirmBox('Remove this item?','Remove')){const c=cart.get();c.items=c.items.filter(i=>i.id!=d.id);cart.save(c);refresh()}};
acts.cclear=async()=>{if(await confirmBox('Remove everything from your cart?','Clear cart')){cart.clear();refresh()}};

C.checkout=async v=>{
  if(!cart.count())return location='cart.html';
  const [vs,o]=await Promise.all([API.list('vendors'),store.get('draft',{type:'Dine-In',customer:''})]);
  v.innerHTML=head('Checkout','Tell us how you want to receive your order.')+`
    <form id="cf" novalidate class="row g-4">
      <div class="col-lg-7">
        <label class="form-label mb-2">Dining preference</label>
        <div class="row g-3 mb-4">
          ${[['Dine-In','cup-hot'],['Take-Out','bag']].map(t=>`
            <div class="col-6">
              <label class="w-100 h-100">
                <input type="radio" class="d-none" name="type" value="${t[0]}" ${o.type===t[0]?'checked':''}>
                <span class="opt">
                  <i class="bi bi-${t[1]}"></i>
                  <h5 class="mt-2 mb-0 fw-bold">${t[0]}</h5>
                </span>
              </label>
            </div>`).join('')}
        </div>
        <div class="mb-3">
          <label class="form-label">Customer Name</label>
          <input name="customer" class="form-control form-control-lg" placeholder="Enter your full name" value="${esc(o.customer)}" minlength="2" required>
          <div class="invalid-feedback">Please enter your name.</div>
        </div>
      </div>
      <div class="col-lg-5">
        <div class="card p-4">
          <h5 class="fw-bold mb-3">Order Summary</h5>
          ${cart.get().items.map(i=>{
            const ven=vs.find(x=>x.id===i.vendorId);
            return `<div class="d-flex justify-content-between align-items-center mb-2"><div><div>${i.qty}× ${esc(i.name)}</div>${ven?`<small class="text-muted"><i class="bi bi-shop"></i> ${esc(ven.name)}</small>`:''}</div><b>${peso(i.qty*i.price)}</b></div>`;
          }).join('')}
          <hr class="my-3">
          <div class="d-flex justify-content-between fs-4 mb-4"><b>Total</b><b class="text-wmsu">${peso(cart.total())}</b></div>
          <button class="btn btn-wmsu btn-lg w-100">Continue to Payment</button>
        </div>
      </div>
    </form>`;
  onForm('#cf',async d=>{store.set('draft',d);location='payment.html'});
};

C.payment=async v=>{
  if(!cart.count())return location='cart.html';
  const [[s],vs]=await Promise.all([API.list('settings'),API.list('vendors')]),on=Object.keys(PAYS).filter(k=>s[k]);
  const byV={};
  cart.get().items.forEach(i=>{if(!byV[i.vendorId])byV[i.vendorId]=0;byV[i.vendorId]+=i.price*i.qty});
  const stallTotals=Object.entries(byV).map(([vid,tot])=>({ven:vs.find(x=>x.id===+vid)||{},tot}));
  v.innerHTML=head('Choose payment',`Total to pay: <b class="text-wmsu">${peso(cart.total())}</b>`)+`
    <form id="pf" novalidate>
      <div class="row g-3 mb-3">
        ${on.map((k,i)=>`
          <div class="col-6 col-lg-3">
            <label class="w-100 h-100">
              <input type="radio" class="d-none" name="pay" value="${k}" ${i?'':'required'}>
              <span class="opt">
                <i class="bi bi-${PAYS[k][0]}"></i>
                <h6 class="mt-2 mb-0 fw-bold">${PAYS[k][1]}</h6>
              </span>
            </label>
          </div>`).join('')}
      </div>
      <div id="pinfo" class="mb-4"></div>
      <div class="text-danger small mb-3 d-none" id="perr">Please select a payment method.</div>
      <div class="d-flex gap-2">
        <a href="checkout.html" class="btn btn-light btn-lg">Back</a>
        <button class="btn btn-wmsu btn-lg px-5">Place Order</button>
      </div>
    </form>`;
  const updateInfo=m=>{
    if(m==='cash')$('#pinfo').innerHTML=`<div class="alert alert-light border small mb-0"><i class="bi bi-info-circle text-wmsu me-1"></i> Pay <b>${peso(cart.total())}</b> directly at the stall counter(s) when your order is called.</div>`;
    else if(m==='gcash'||m==='maya'){
      $('#pinfo').innerHTML=`<div class="card bg-light p-3 border small"><div class="fw-bold mb-2"><i class="bi bi-phone text-wmsu me-1"></i> ${PAYS[m][1]} Payment Breakdown (${stallTotals.length} stall${stallTotals.length>1?'s':''})</div>${stallTotals.map(({ven,tot})=>{
        const num=(m==='gcash'?ven.gcashNumber:ven.mayaNumber)||(m==='gcash'?s.gcashNumber:s.mayaNumber)||'';
        const name=(m==='gcash'?ven.gcashName:ven.mayaName)||(m==='gcash'?s.gcashName:s.mayaName)||'';
        return `<div class="d-flex justify-content-between align-items-center py-1 border-bottom"><span><b>${esc(ven.name||'Stall')}</b> ${num?`→ ${esc(num)}${name?` (${esc(name)})`:''}`:'(ask counter)'}</span><b class="text-wmsu">${peso(tot)}</b></div>`;
      }).join('')}<div class="text-muted mt-2">You will send each stall's exact amount to their ${PAYS[m][1]} account and enter the reference number(s) on the next screen.</div></div>`;
    }else $('#pinfo').innerHTML='';
  };
  document.querySelectorAll('input[name="pay"]').forEach(el=>el.addEventListener('change',e=>{ $('#perr').classList.add('d-none'); updateInfo(e.target.value); }));
  onForm('#pf',async d=>{
    if(!d.pay)return $('#perr').classList.remove('d-none');
    const c=cart.get(),dr=store.get('draft',{});
    const o=await API.save('orders',{items:c.items,type:dr.type,customer:dr.customer,pay:d.pay});
    store.set('myOrders',[{no:o.no,code:o.code},...myOrders()]);
    store.set('lastOrder',{no:o.no,code:o.code});
    cart.clear();
    location='confirmation.html?no='+encodeURIComponent(o.no)+'&code='+encodeURIComponent(o.code);
  });
};

const findCode=no=>myOrders().find(x=>x.no===no)?.code||'';
const getOrders=async()=>{
  const no=(qs.get('no')||store.get('lastOrder',{}).no||'').toUpperCase();
  const code=(qs.get('code')||findCode(no)).toUpperCase();
  if(!no||!code)return null;
  try{
    const r=await API.order(no,code);
    return Array.isArray(r)?r:[r];
  }catch{return null}
};
const payNote=o=>o.pay==='cash'?(o.payStatus==='Paid'?'Payment received.':'Please pay at the stall counter(s) when called.'):o.payStatus==='Paid'?'Payment received.':o.payStatus==='Pending Verification'?'Reference received. Stall(s) will verify shortly.':'';

C.confirmation=async v=>{
  const [orders,settings]=await Promise.all([getOrders(),API.list('settings').then(a=>a[0]||{}).catch(()=>({}))]);
  if(!orders||!orders.length)return v.innerHTML=empty('receipt','No order found.','<a class="btn btn-wmsu" href="vendors.html">Order now</a>');
  const primary=orders[0];
  const grandTotal=orders.reduce((sum,o)=>sum+o.total,0);
  const isEwallet=primary.pay!=='cash';
  v.innerHTML=`
    <div class="text-center card p-4 p-md-5 mx-auto" style="max-width:680px">
      <i class="bi bi-check-circle-fill text-success" style="font-size:4rem"></i>
      <h3 class="fw-bold mt-2">Order Placed!</h3>
      <p class="text-muted mb-1">Your Tracking Code</p>
      <div class="order-no mb-2">${esc(primary.code)}</div>
      <p class="text-muted small mb-4">${esc(primary.type)} · ${PAYS[primary.pay]?.[1]||esc(primary.pay)} · Grand Total: <b class="text-wmsu">${peso(grandTotal)}</b></p>

      <div class="text-start mb-4">
        <div class="fw-bold mb-2">Stall Orders & Payment (${orders.length}):</div>
        ${orders.map(o=>{
          const ewNum=(o.pay==='gcash'?o.gcashNumber:o.mayaNumber)||(o.pay==='gcash'?settings.gcashNumber:settings.mayaNumber)||'';
          const ewName=(o.pay==='gcash'?o.gcashName:o.mayaName)||(o.pay==='gcash'?settings.gcashName:settings.mayaName)||'';
          const needRef=isEwallet&&['Unpaid','Failed'].includes(o.payStatus)&&o.orderStatus!=='Cancelled';
          return `
            <div class="card bg-light p-3 mb-3 border">
              <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 pb-2 border-bottom">
                <div>
                  <span class="badge-status badge-neutral me-1">#${esc(o.no)}</span>
                  <strong class="fs-6"><i class="bi bi-shop text-wmsu me-1"></i>${esc(o.vendorName||'Stall')}</strong>
                </div>
                <div class="d-flex align-items-center gap-2">
                  ${badge(o.payStatus)}
                  <b class="text-wmsu fs-5">${peso(o.total)}</b>
                </div>
              </div>
              <div class="small text-muted py-2">
                ${o.items.map(i=>`${i.qty}× ${esc(i.name)}`).join(', ')}
              </div>
              ${needRef?`
                <div class="card p-3 bg-white border mt-1">
                  ${o.payStatus==='Failed'?'<div class="alert alert-danger py-2 small mb-2">Previous reference could not be verified. Please submit a valid reference number.</div>':''}
                  <div class="small mb-2">Send exact amount <b class="text-wmsu">${peso(o.total)}</b> via <b>${PAYS[o.pay]?.[1]||'e-wallet'}</b> to:</div>
                  <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3 p-2 bg-light rounded border">
                    <div>
                      <div class="fw-bold text-dark fs-6">${ewNum?esc(ewNum):'<span class="text-muted small">Ask stall cashier</span>'}</div>
                      ${ewName?`<div class="small text-muted">Account Name: <b class="text-dark">${esc(ewName)}</b></div>`:''}
                    </div>
                    ${ewNum?`<button type="button" class="btn btn-sm btn-outline-wmsu" data-act="copy" data-v="${esc(ewNum)}"><i class="bi bi-clipboard"></i> Copy</button>`:''}
                  </div>
                  <form class="rf-stall" data-no="${esc(o.no)}" data-code="${esc(primary.code)}" novalidate>
                    <label class="form-label small mb-1">Enter ${PAYS[o.pay]?.[1]||'e-wallet'} Reference No. for ${esc(o.vendorName||'this stall')}:</label>
                    <div class="input-group input-group-sm">
                      <input name="ref" class="form-control" pattern="[A-Za-z0-9\\-]{4,60}" minlength="4" maxlength="60" placeholder="e.g. 1234567890123" required>
                      <button class="btn btn-wmsu px-3">Submit</button>
                    </div>
                    <div class="invalid-feedback">Letters, numbers and dashes only (4-60).</div>
                  </form>
                </div>`:
              isEwallet&&o.payStatus==='Pending Verification'?`<div class="small text-success fw-semibold mt-1"><i class="bi bi-check-circle me-1"></i> Reference submitted: <code>${esc(o.ref)}</code> · Waiting for ${esc(o.vendorName||'stall')} to verify.</div>`:
              isEwallet&&o.payStatus==='Paid'?`<div class="small text-success fw-semibold mt-1"><i class="bi bi-patch-check-fill me-1"></i> Payment verified by ${esc(o.vendorName||'stall')}.</div>`:
              `<div class="small text-muted mt-1"><i class="bi bi-cash-coin me-1"></i> ${payNote(o)}</div>`}
            </div>`;
        }).join('')}
      </div>

      <div class="d-grid gap-2">
        <a class="btn btn-wmsu btn-lg" href="tracking.html?no=${encodeURIComponent(primary.no)}&code=${encodeURIComponent(primary.code)}"><i class="bi bi-geo-alt me-1"></i> Track Order Status</a>
        <a class="btn btn-light" href="receipt.html?no=${encodeURIComponent(primary.no)}&code=${encodeURIComponent(primary.code)}"><i class="bi bi-receipt me-1"></i> View Receipt</a>
      </div>
    </div>`;
  document.querySelectorAll('.rf-stall').forEach(f=>{
    f.addEventListener('submit',async e=>{
      e.preventDefault();
      if(!f.checkValidity()){f.classList.add('was-validated');return}
      const b=f.querySelector('button[type=submit],button:not([type=button])');b&&(b.disabled=true);
      try{
        await API.submitRef(f.dataset.no,f.dataset.code,f.ref.value.trim());
        toast('Reference submitted for '+f.dataset.no,'success');
        refresh();
      }catch(x){toast('Something went wrong: '+x.message,'danger');b&&(b.disabled=false)}
    });
  });
};

C.receipt=async v=>{
  const orders=await getOrders();
  if(!orders||!orders.length)return v.innerHTML=empty('receipt','Receipt not found.');
  const primary=orders[0];
  const grandTotal=orders.reduce((sum,o)=>sum+o.total,0);
  v.innerHTML=`
    <div class="receipt card p-4">
      <div class="text-center"><b>WMSU CAMPUS CANTEEN</b><br><small class="text-muted">${fmt(primary.time)}</small></div>
      <hr>
      <div>Tracking Code: <b>${esc(primary.code)}</b></div>
      <div>Customer: <b>${esc(primary.customer)}</b></div>
      <div>Order Type: ${esc(primary.type)}</div>
      <hr>
      ${orders.map(o=>`
        <div class="mb-3">
          <div class="d-flex justify-content-between border-bottom pb-1">
            <strong><i class="bi bi-shop"></i> ${esc(o.vendorName||'Stall')}</strong>
            <small class="text-muted">#${esc(o.no)}</small>
          </div>
          ${o.items.map(i=>`<div class="d-flex justify-content-between ps-2 pt-1"><span>${i.qty}× ${esc(i.name)}</span><span>${peso(i.qty*i.price)}</span></div>`).join('')}
          <div class="text-end small fw-semibold text-muted pt-1">Stall Total: ${peso(o.total)}</div>
        </div>`).join('')}
      <hr>
      <div class="d-flex justify-content-between fs-5"><b>GRAND TOTAL</b><b>${peso(grandTotal)}</b></div>
      <div class="mt-1">Paid via: ${PAYS[primary.pay]?.[1]||esc(primary.pay)} (${esc(primary.payStatus)})</div>
      ${primary.ref?`<div>Reference: <code>${esc(primary.ref)}</code></div>`:''}
      <hr>
      <div class="text-center small text-muted">Thank you! Please keep this receipt.</div>
    </div>
    <div class="text-center mt-3 no-print">
      <button class="btn btn-wmsu" onclick="print()"><i class="bi bi-printer me-1"></i> Print Receipt</button>
    </div>`;
};

const STEPS=[['pending','hourglass-split','Received'],['preparing','fire','Preparing'],['ready','bag-check','Ready'],['completed','emoji-smile','Picked up']];
let poll;
C.tracking=async v=>{
  clearInterval(poll);
  const no0=(qs.get('no')||store.get('lastOrder',{}).no||'').toUpperCase();
  const code0=(qs.get('code')||findCode(no0)).toUpperCase();
  v.innerHTML=head('Track my order','Enter your order number or 6-character tracking code.')+`
    <form id="tf" class="row g-2 mb-4" style="max-width:700px" novalidate>
      <div class="col-sm-5"><input name="no" class="form-control form-control-lg" placeholder="Order no. (e.g. 1001)" value="${esc(no0)}" required></div>
      <div class="col-sm-4"><input name="code" class="form-control form-control-lg" placeholder="Tracking code" maxlength="6" value="${esc(code0)}" required></div>
      <div class="col-sm-3"><button class="btn btn-wmsu btn-lg w-100">Track</button></div>
    </form>
    <div id="tr"></div>`;
  let cur=null;
  const show=async()=>{
    try{
      const r=await API.order(...cur);
      const orders=Array.isArray(r)?r:[r];
      if(!orders.length)return $('#tr').innerHTML=empty('search','No orders found.');
      const primary=orders[0];
      const needPay=primary.pay!=='cash'&&orders.some(o=>['Unpaid','Failed'].includes(o.payStatus)&&o.orderStatus!=='Cancelled');
      $('#tr').innerHTML=`
        ${needPay?`<div class="alert alert-warning d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3"><div><i class="bi bi-exclamation-triangle-fill me-1"></i> <b>Payment reference required:</b> Please submit your ${PAYS[primary.pay]?.[1]||'e-wallet'} reference number so the stall can confirm your order.</div><a class="btn btn-sm btn-wmsu" href="confirmation.html?no=${encodeURIComponent(primary.no)}&code=${encodeURIComponent(primary.code)}">Pay / Enter Reference</a></div>`:''}
        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <div>
            <h4 class="mb-0 fw-bold">Tracking: <span class="text-wmsu">${esc(primary.code)}</span></h4>
            <small class="text-muted">${orders.length} stall(s) in this order · Customer: ${esc(primary.customer)}</small>
          </div>
          <a class="btn btn-light btn-sm" href="receipt.html?no=${encodeURIComponent(primary.no)}&code=${encodeURIComponent(primary.code)}"><i class="bi bi-receipt me-1"></i> View receipt</a>
        </div>
        ${orders.map(o=>`
          <div class="card p-4 mb-3">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div>
                <h5 class="fw-bold mb-0"><i class="bi bi-shop me-1"></i> ${esc(o.vendorName||'Stall')}</h5>
                <small class="text-muted">Order <strong class="text-wmsu">#${esc(o.no)}</strong> · ${peso(o.total)}</small>
              </div>
              <div class="d-flex gap-1 align-items-center">
                ${badge(o.status)} ${o.pay==='cash'&&o.payStatus==='Unpaid'?'':badge(o.payStatus)}
              </div>
            </div>
            <div class="stepper my-3">
              ${STEPS.map((s,i)=>`<div class="step ${i<=STEPS.findIndex(x=>x[0]===o.status)?'done':''}"><i class="bi bi-${s[1]}"></i>${s[2]}</div>`).join('')}
            </div>
            <div class="small text-muted pt-2 border-top"><strong>Items:</strong> ${o.items.map(i=>`${i.qty}× ${esc(i.name)}`).join(', ')}</div>
          </div>`).join('')}`;
    }catch(e){clearInterval(poll);$('#tr').innerHTML=empty('search',esc(e.message))};
  };
  const go=async()=>{clearInterval(poll);await show();poll=setInterval(show,5000)};
  onForm('#tf',async d=>{cur=[d.no.trim().toUpperCase(),d.code.trim().toUpperCase()];history.replaceState(0,'','?no='+encodeURIComponent(cur[0])+'&code='+encodeURIComponent(cur[1]));await go()});
  if(no0&&code0){cur=[no0,code0];await go()};
};

C.history=async v=>{
  const mine=myOrders();
  const results=await Promise.all(mine.map(m=>API.order(m.no,m.code).catch(()=>null)));
  const orders=results.flat().filter(Boolean);
  v.innerHTML=head('Order history','Orders placed from this browser.')+table([
    ['Order',o=>`<b>#${esc(o.no)}</b><br><small class="text-muted"><i class="bi bi-shop"></i> ${esc(o.vendorName||'')}</small>`],
    ['Date',o=>fmt(o.time)],
    ['Items',o=>o.items.map(i=>`${i.qty}× ${esc(i.name)}`).join(', ')],
    ['Total',o=>`<b class="text-wmsu">${peso(o.total)}</b>`],
    ['Status',o=>badge(o.status)],
    ['',o=>`<div class="d-flex gap-1 justify-content-end"><a class="btn btn-sm btn-light" href="tracking.html?no=${encodeURIComponent(o.no)}&code=${encodeURIComponent(o.code)}"><i class="bi bi-geo-alt"></i> Track</a> <a class="btn btn-sm btn-light" href="receipt.html?no=${encodeURIComponent(o.no)}&code=${encodeURIComponent(o.code)}"><i class="bi bi-receipt"></i> Receipt</a></div>`]
  ],orders,'You have not placed any orders yet.');
};
