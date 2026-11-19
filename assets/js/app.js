/* Core: config, API layer, shell components (header/sidebar/footer), cart, UI helpers */
const B=document.body.dataset, ROOT=B.root||'', PAGES={customer:{},vendor:{},admin:{}}, acts={};
const $=(s,r=document)=>r.querySelector(s), sleep=ms=>new Promise(r=>setTimeout(r,ms)), qs=new URLSearchParams(location.search);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const peso=n=>'₱'+Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
const store={get:(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},set:(k,v)=>localStorage.setItem(k,JSON.stringify(v))};
const SES=()=>JSON.parse(sessionStorage.getItem('wmsu_session')||'null');
const fmt=t=>new Date(t).toLocaleString('en-PH',{dateStyle:'medium',timeStyle:'short'});

/* ---- API layer: talks to api/*.php (PHP + MySQL) and maps backend rows to the shapes the pages use ---- */
const STAFF=B.role==='vendor'||B.role==='admin';
const ST_IN={'Pending Payment':'pending','Confirmed':'pending','Preparing':'preparing','Ready for Pickup':'ready','Completed':'completed','Cancelled':'rejected'};
const when=t=>String(t||'').replace(' ','T');
const pick=m=>Object.fromEntries(Object.entries(m).filter(([,v])=>v!==undefined));
const mapOrder=o=>({id:+o.id,no:o.order_no,code:o.track_code,vendorId:+o.vendor_id,vendorName:o.vendor_name||'',gcashNumber:o.gcash_number||'',gcashName:o.gcash_name||'',gcashQr:o.gcash_qr?`${ROOT}uploads/qr/${o.gcash_qr}`:'',mayaNumber:o.maya_number||'',mayaName:o.maya_name||'',items:(o.items||[]).map(i=>({id:i.food_id,name:i.name,price:+i.unit_price,qty:+i.qty})),type:o.order_type,customer:o.customer_name,pay:o.payment_method,total:+o.total,status:ST_IN[o.order_status]||o.order_status,orderStatus:o.order_status,payStatus:o.payment_status,ref:o.payment_ref||o.reference||'',cancelReason:o.cancel_reason||'',queueAhead:o.queue_ahead??null,estMinutes:o.est_minutes??null,time:when(o.created_at)});
let _csrf=null;
const API={
  async csrf(){if(!_csrf)_csrf=(await this.f('csrf',{noCsrf:true})).csrf;return _csrf},
  async f(t,o={}){const {m='GET',q,b,raw,noCsrf}=o,h={};
   if(b!==undefined&&!raw)h['Content-Type']='application/json';
   if(m!=='GET'&&!noCsrf)h['X-CSRF-Token']=await this.csrf();
   let r;try{r=await fetch(`${ROOT}api/${t}.php`+(q?'?'+new URLSearchParams(q):''),{method:m,headers:h,credentials:'same-origin',body:b===undefined?undefined:raw?b:JSON.stringify(b)})}catch{throw new Error('Cannot reach the server. Check your connection.')}
   let j=null;try{j=await r.json()}catch{}
   if(r.status===419&&!o.retried){_csrf=null;return this.f(t,{...o,retried:true})}
   if(!r.ok||!j||j.success===false){
    if(r.status===401&&STAFF&&B.page!=='login'){sessionStorage.removeItem('wmsu_session');location='login.html';throw new Error('Please log in.')}
    const fe=j&&j.errors&&Object.values(j.errors)[0];throw new Error(((j&&j.error)||'Request failed ('+r.status+').')+(fe?' '+fe:''))}
   return j.data},
  async me(){return (await this.f('auth')).user},
  async list(t){
   switch(t){
   case'vendors':{let rows=await this.f('vendors',B.role==='admin'?{q:{scope:'all'}}:{});
     if(B.role==='vendor'){const me=await this.f('vendors',{q:{me:1}});rows=rows.filter(x=>+x.id!==+me.id);rows.push(me)}
     return rows.map(x=>({id:+x.id,name:x.name,desc:x.description||'',emoji:'🍽️',status:x.status||'active',open:!!+x.is_open,owner:x.owner_name||'',phone:x.phone||'',email:x.email||'',gcashNumber:x.gcash_number||'',gcashName:x.gcash_name||'',gcashQr:x.gcash_qr?`${ROOT}uploads/qr/${x.gcash_qr}`:'',mayaNumber:x.maya_number||'',mayaName:x.maya_name||'',banner:x.banner?`${ROOT}uploads/banners/${x.banner}`:''}))}
   case'applications':return (await this.f('vendors',{q:{scope:'all'}})).map(x=>({id:+x.id,stall:x.name,owner:x.owner_name,email:x.email,phone:x.phone,status:x.status==='pending'?'pending':x.status==='rejected'?'rejected':'approved'}));
   case'categories':return (await this.f('categories',B.role==='vendor'?{q:{vendor_id:SES()?.vendorId}}:{})).map(c=>({id:+c.id,vendorId:c.vendor_id==null?null:+c.vendor_id,name:c.name,icon:c.icon||'🍽️'}));
   case'foods':{const [rows,cs]=await Promise.all([this.f('foods',STAFF?{q:{manage:1}}:{}),this.list('categories')]);
     return rows.map(f=>({id:+f.id,vendorId:+f.vendor_id,catId:f.category_id==null?null:+f.category_id,name:f.name,desc:f.description||'',price:+f.price,stockQty:f.stock_qty==null?null:+f.stock_qty,emoji:cs.find(c=>c.id===+f.category_id)?.icon||'🍽️',img:f.image?`${ROOT}uploads/foods/${f.image}`:'',available:!!+f.is_available}))}
   case'orders':return B.role==='customer'?[]:(await this.f('orders')).map(mapOrder);
   case'payments':return (await this.f('payments')).map(p=>({id:+p.id,orderId:+p.order_id,no:p.order_no,vendorId:+p.vendor_id,method:p.method,amount:+p.amount,status:p.status,ref:p.reference||'',orderStatus:p.order_status}));
   case'users':return this.f('users');
   case'settings':{const s=await this.f('settings');return [{id:1,canteen:s.canteen_name,open:s.open_time,close:s.close_time,cash:s.pay_cash==='1',gcash:s.pay_gcash==='1',maya:s.pay_maya==='1',gcashNumber:s.gcash_number||'',gcashName:s.gcash_name||'',mayaNumber:s.maya_number||'',mayaName:s.maya_name||''}]}
   }throw new Error('Unknown resource: '+t)},
  async order(no,code){const d=await this.f('orders',{q:{order_no:no,code}});const list=Array.isArray(d)?d:[d];return list.map(o=>mapOrder({...o,track_code:code}))},
  async save(t,it){const id=it.id;
   switch(t){
   case'categories':{const b=pick({name:it.name,icon:it.icon});return id?this.f('categories',{m:'PATCH',q:{id},b}):this.f('categories',{m:'POST',b})}
   case'foods':{const b=pick({name:it.name,description:it.desc,price:it.price,stock_qty:it.stockQty,is_available:it.available,category_id:it.catId});
     return id?this.f('foods',{m:'PATCH',q:{id},b}):this.f('foods',{m:'POST',b:{...b,vendor_id:it.vendorId}})}
   case'vendors':return id?this.f('vendors',{m:'PATCH',q:{id},b:pick({name:it.name,description:it.desc,phone:it.phone,is_open:it.open,status:it.status,gcash_number:it.gcashNumber,gcash_name:it.gcashName,maya_number:it.mayaNumber,maya_name:it.mayaName})}):this.f('vendors',{m:'POST',b:it});
   case'applications':return this.f('vendors',{m:'PATCH',q:{id},b:{status:it.status==='approved'?'active':'rejected'}});
   case'users':return id?this.f('users',{m:'PATCH',q:{id},b:pick({status:it.status,ban_reason:it.ban_reason})}):this.f('users',{m:'POST',b:{name:it.name,email:it.email,password:it.password,role:it.role}});
   case'settings':return this.f('settings',{m:'PATCH',b:{canteen_name:it.canteen,open_time:it.open,close_time:it.close,pay_cash:!!it.cash,pay_gcash:!!it.gcash,pay_maya:!!it.maya}});
   case'orders':return id?this.setStatus(id,it.status,it.reason):this.place(it);
   }throw new Error('Unknown resource: '+t)},
  async remove(t,id){if(!['categories','foods','users','vendors'].includes(t))throw new Error('Cannot delete '+t);return this.f(t,{m:'DELETE',q:{id}})},
  async place(it){const r=await this.f('orders',{m:'POST',b:{order_type:it.type,payment_method:it.pay,guest_name:it.customer,items:it.items.map(i=>({food_id:i.id,qty:i.qty}))}});
   return {id:r.id,no:r.order_no,orders:r.orders||[],code:r.track_code,total:+r.total,pay:it.pay}},
  async setStatus(id,s,reason){const o=await this.f('orders',{q:{id}}),patch=b=>this.f('orders',{m:'PATCH',q:{id},b});
   if(s==='preparing'){if(o.order_status==='Pending Payment')await patch({order_status:'Confirmed'});return patch({order_status:'Preparing'})}
   if(s==='ready')return patch({order_status:'Ready for Pickup'});
   if(s==='completed')return patch({order_status:'Completed'});
   if(s==='rejected')return patch({order_status:'Cancelled',cancel_reason:reason||'Declined by the vendor'});
   throw new Error('Unknown status: '+s)},
  pay(orderId,action){return this.f('payments',{m:'PATCH',q:{order_id:orderId},b:{action}})},
  submitRef(no,code,reference){return this.f('payments',{m:'PATCH',b:{action:'submit_reference',order_no:no,code,reference}})},
  upload(foodId,file){const fd=new FormData();fd.append('image',file);return this.f('foods',{m:'POST',q:{action:'image',id:foodId},b:fd,raw:true})},
  uploadBanner(vendorId,file){const fd=new FormData();fd.append('banner',file);return this.f('vendors',{m:'POST',q:{action:'banner',id:vendorId},b:fd,raw:true})},
  removeBanner(vendorId){return this.f('vendors',{m:'DELETE',q:{action:'banner',id:vendorId}})},
  uploadQr(vendorId,file){const fd=new FormData();fd.append('qr',file);return this.f('vendors',{m:'POST',q:{action:'qr',id:vendorId},b:fd,raw:true})},
  removeQr(vendorId){return this.f('vendors',{m:'DELETE',q:{action:'qr',id:vendorId}})},
  report(type,q={}){return this.f('reports',{q:{type,from:'2000-01-01',...q}})},
  async login(role,email,password){let d;try{d=await this.f('auth',{m:'POST',q:{action:'login'},b:{email,password}})}catch(e){toast(e.message,'danger');return null}
   _csrf=d.csrf;
   if(d.user.role!==role){await this.f('auth',{m:'POST',q:{action:'logout'}}).catch(()=>{});_csrf=null;toast('This account cannot sign in here.','danger');return null}
   const r={name:d.user.name};if(role==='vendor')r.vendorId=+(await this.f('vendors',{q:{me:1}})).id;return r}
};

/* ---- Cart (localStorage) ---- */
const cart={get:()=>store.get('cart2',{items:[]}),
 save(c){store.set('cart2',c);updateCart()},
 count:()=>cart.get().items.reduce((s,i)=>s+i.qty,0), total:()=>cart.get().items.reduce((s,i)=>s+i.qty*i.price,0),
 async add(f,qty=1){let c=cart.get();
  const i=c.items.find(x=>x.id===f.id);i?i.qty+=qty:c.items.push({id:f.id,vendorId:f.vendorId,name:f.name,price:f.price,emoji:f.emoji,qty});cart.save(c);toast(f.name+' added to cart');return true},
 setQty(id,d){const c=cart.get(),i=c.items.find(x=>x.id==id);i.qty+=d;if(i.qty<1)c.items=c.items.filter(x=>x.id!=id);cart.save(c)},
 clear(){cart.save({items:[]})}};
function updateCart(){const n=cart.count(),b=$('#cartCount'),bar=$('#cartbar');if(b)b.textContent=n;
 if(bar)bar.innerHTML=n&&B.page!=='cart'?`<a class="btn btn-wmsu btn-lg" href="cart.html"><span><i class="bi bi-cart3"></i> ${n} item(s)</span><span>View cart · ${peso(cart.total())}</span></a>`:''}

/* ---- UI helpers ---- */
const spinner='<div class="skel-wrap" aria-busy="true" aria-label="Loading"><div class="skel skel-title"></div><div class="skel skel-line" style="width:60%"></div><div class="row g-3 mt-2"><div class="col-md-4"><div class="skel skel-card"></div></div><div class="col-md-4"><div class="skel skel-card"></div></div><div class="col-md-4"><div class="skel skel-card"></div></div></div><div class="skel skel-line mt-4"></div><div class="skel skel-line" style="width:85%"></div><div class="skel skel-line" style="width:70%"></div></div>';
const empty=(i,m,a='')=>`<div class="state"><i class="bi bi-${i}"></i><p class="mt-2">${m}</p>${a}</div>`;

const SB={
  pending:'pending',
  preparing:'preparing',
  ready:'ready',
  completed:'success',
  rejected:'danger',
  active:'success',
  banned:'danger',
  suspended:'danger',
  approved:'success',
  Paid:'success',
  Unpaid:'neutral',
  'Pending Verification':'pending',
  Failed:'danger',
  Refunded:'neutral',
  'Open now':'success',
  Closed:'neutral',
  unavailable:'danger',
  'Pending Payment':'pending',
  Confirmed:'preparing',
  'Ready for Pickup':'ready',
  Completed:'success',
  Cancelled:'danger'
};
const badge=s=>{
  const cls=SB[s]||'neutral';
  return `<span class="badge-status badge-${cls}">${esc(s)}</span>`;
};

const stat=(i,l,v,hot)=>`<div class="col-6 col-lg"><div class="card stat ${hot?'hot':''}"><i class="bi bi-${i}"></i><div><b>${v}</b><small>${l}</small></div></div></div>`;
const table=(cols,rows,emptyMsg='Nothing here yet.')=>rows.length?`<div class="card table-responsive"><table class="table table-hover mb-0"><thead><tr>${cols.map(c=>`<th>${c[0]}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${cols.map(c=>`<td>${c[1](r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:empty('inbox',emptyMsg);
const bars=d=>{const m=Math.max(1,...d.map(x=>x[1]));return d.map(x=>`<div class="d-flex align-items-center gap-3 mb-2"><span style="width:130px" class="small text-truncate">${esc(x[0])}</span><div class="flex-grow-1"><div class="bar" style="width:${x[1]/m*100}%"></div></div><b class="small">${peso(x[1])}</b></div>`).join('')||empty('bar-chart','No data yet.')};
const refresh=()=>boot(true);
function toast(m,t='dark'){const e=document.createElement('div');e.className=`toast show align-items-center text-bg-${t} border-0 mb-2 shadow`;e.innerHTML=`<div class="d-flex"><div class="toast-body">${esc(m)}</div></div>`;$('#toasts').append(e);setTimeout(()=>e.remove(),t==='danger'?5000:2500)}

function modal(title,body,ok='Confirm',cls='btn-wmsu',showCancel=true){return new Promise(res=>{const d=document.createElement('div');d.className='modal fade';
 d.innerHTML=`<div class="modal-dialog modal-dialog-centered"><form class="modal-content" novalidate><div class="modal-header"><h5 class="modal-title fw-bold">${title}</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body">${body}</div><div class="modal-footer">${showCancel?'<button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button>':''}<button class="btn ${cls} px-4">${ok}</button></div></form></div>`;
 document.body.append(d);const m=new bootstrap.Modal(d);let out=null;
 d.querySelector('form').onsubmit=e=>{e.preventDefault();if(!e.target.checkValidity()){e.target.classList.add('was-validated');return}out=Object.fromEntries(new FormData(e.target));m.hide()};
 d.addEventListener('hidden.bs.modal',()=>{d.remove();res(out)});m.show()})}
const confirmBox=(msg,ok='Yes')=>modal('Please confirm',`<p class="mb-0">${msg}</p>`,ok).then(r=>!!r);

function onForm(sel,fn){const f=$(sel);f.addEventListener('submit',async e=>{e.preventDefault();if(!f.checkValidity()){f.classList.add('was-validated');return}
 const b=f.querySelector('button:not([type=button])');b&&(b.disabled=true);try{await fn(Object.fromEntries(new FormData(f)))}catch(x){toast('Something went wrong: '+x.message,'danger')}b&&(b.disabled=false)})}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-act]');if(b&&acts[b.dataset.act]){try{await acts[b.dataset.act](b.dataset,b)}catch(x){if(b.type==='checkbox')b.checked=!b.checked;toast(x.message,'danger')}}});
acts.copy=async d=>{try{await navigator.clipboard.writeText(d.v);toast('Copied to clipboard: '+d.v,'success')}catch{toast('Copy failed, please copy manually.','danger')}};
acts.logout=async()=>{try{await API.f('auth',{m:'POST',q:{action:'logout'}})}catch{}sessionStorage.removeItem('wmsu_session');location='login.html'};

const payBtns=(id,method,ps,os,ref='',amt=0)=>{const b=[],add=(a,l,k,icon)=>b.push(`<button class="btn btn-sm btn-${k}" data-act="payA" data-id="${id}" data-a="${a}" data-ref="${esc(ref)}" data-amt="${peso(amt)}"><i class="bi bi-${icon}"></i> ${l}</button>`);
 if(os==='Cancelled'||B.role!=='vendor')return '';
 if(method==='cash'){if(ps==='Unpaid')add('confirm_cash','Receive Cash','success','cash-coin')}
 else if(ps==='Pending Verification'){add('verify','Verify','success','check-lg');add('fail','Reject','outline-danger','x-lg')}
 return b.join(' ')};
acts.payA=async d=>{const t={confirm_cash:`Confirm that cash (${d.amt||''}) was received?`,verify:`<div class="alert alert-warning small mb-2"><i class="bi bi-exclamation-triangle-fill me-1"></i> <b>Verify carefully:</b> Open your GCash/Maya app or SMS and confirm you received <b>${esc(d.amt||'the exact amount')}</b> with Reference <code>${esc(d.ref||'-')}</code>.</div>Mark this e-wallet payment as Paid?`,fail:'Mark this payment as failed?',refund:'Refund this payment and cancel the order?'}[d.a];if(await confirmBox(t,'Yes')){await API.pay(+d.id,d.a);toast('Payment updated','success');refresh()}};

/* ---- Shell: reusable header / sidebar / footer ---- */
const NAV={customer:[['vendors.html','shop','Vendors'],['tracking.html','geo-alt','Track Order'],['history.html','clock-history','History']],
 vendor:[['dashboard','speedometer2','Dashboard'],['orders','bell','Incoming Orders'],['menu','egg-fried','Food Menu'],['categories','tags','Categories'],['reports','graph-up','Sales Reports'],['profile','person-badge','Profile']],
 admin:[['dashboard','speedometer2','Dashboard'],['users','people','Users'],['vendors','shop','Vendors'],['foods','egg-fried','Food Items'],['categories','tags','Categories'],['orders','receipt','Orders'],['payments','credit-card','Payments'],['reports','graph-up','Reports'],['settings','gear','Settings']]};

const brand=(t)=>`<a class="brand" href="${ROOT}index.html"><img class="logo-img" src="${ROOT}assets/img/wmsu-logo.png" width="40" height="40" alt="WMSU seal"><div class="brand-text"><span class="brand-name">WMSU</span><small class="brand-sub">${t}</small></div></a>`;

function shell(){const {role,page}=B,title=document.title.split(' |')[0];
 if(page==='login'){$('#shell').innerHTML='<main id="view" class="container"></main>';return}
 if(role==='customer'){const p=B.page,isV=['vendors','menu','food-details'].includes(p),a=n=>(n==='vendors.html'&&isV)||n===p+'.html'?'active':'';
  $('#shell').innerHTML=`<header class="topbar"><div class="container-xl d-flex flex-wrap align-items-center justify-content-between gap-2 gap-md-3">${brand('Canteen Kiosk')}<div class="d-flex align-items-center gap-2 order-md-3"><a class="btn ${p==='cart'||p==='checkout'?'btn-wmsu':'btn-outline-wmsu'} btn-sm d-inline-flex align-items-center gap-2 px-3 py-2" href="cart.html"><i class="bi bi-cart3"></i><span class="d-none d-sm-inline">Cart</span><span class="badge ${p==='cart'||p==='checkout'?'bg-light text-dark':'bg-danger text-white'}" id="cartCount">0</span></a></div><nav class="nav order-3 order-md-2 w-100 w-md-auto ms-md-auto gap-1 pt-2 pt-md-0 border-top border-md-0">${NAV.customer.map(n=>`<a class="${a(n[0])}" href="${n[0]}"><i class="bi bi-${n[1]}"></i><span>${n[2]}</span></a>`).join('')}</nav></div></header><main id="view" class="container-xl py-4"></main><footer class="text-center text-muted small py-4 border-top mt-5"><div class="container">© Western Mindanao State University · Canteen Self-Service Kiosk</div></footer>`;updateCart();return}
 const s=SES();if(!s||s.role!==role){location='login.html';return}
 $('#shell').innerHTML=`<aside class="side no-print"><div class="side-header">${brand(role==='admin'?'Admin Portal':'Vendor Portal')}</div><hr class="side-divider d-none d-lg-block"><nav class="side-nav">${NAV[role].map(n=>`<a class="${n[0]===page||(page.includes('food')&&n[0]==='menu')?'active':''}" href="${n[0]}.html"><i class="bi bi-${n[1]}"></i> <span>${n[2]}</span></a>`).join('')}</nav></aside><div class="content"><div class="top2 no-print"><h5 class="mb-0 fw-bold">${title}</h5><div class="d-flex align-items-center gap-3"><span class="text-muted small d-none d-sm-inline"><i class="bi bi-person-circle text-wmsu me-1"></i> ${esc(s.name)}</span><button class="btn btn-outline-wmsu btn-sm" data-act="logout"><i class="bi bi-box-arrow-right me-1"></i> Logout</button></div></div><main id="view" class="p-4"></main></div>`}

async function boot(again){if(!again){shell();if(!$('#view'))return;
  if(STAFF&&B.page!=='login'){let u=null;try{u=await API.me()}catch{}if(!u||u.role!==B.role){sessionStorage.removeItem('wmsu_session');location='login.html';return}}}const v=$('#view');v.classList.toggle('no-anim',!!again);if(!again)v.innerHTML=spinner;
 try{await PAGES[B.role][B.page](v)}catch(e){v.innerHTML=empty('exclamation-triangle',`Couldn't load this page (${esc(e.message)}). Check your connection and try again.`,'<button class="btn btn-wmsu mt-2" onclick="refresh()">Retry</button>')}}
document.addEventListener('DOMContentLoaded',()=>boot());

/* ---- Shared pages ---- */
function loginPage(role,v){
 v.innerHTML=`<div class="login-card card p-4"><div class="text-center mb-3"><img class="logo-img lg" src="${ROOT}assets/img/wmsu-logo.png" alt="WMSU seal"><h4 class="mt-3 fw-bold">${role==='admin'?'Admin':'Vendor'} Login</h4></div><form id="lf" novalidate><div class="mb-3"><label class="form-label">Email</label><input type="email" name="u" class="form-control" autocomplete="username" required><div class="invalid-feedback">Enter your email address.</div></div><div class="mb-3"><label class="form-label">Password</label><div class="pw-wrap"><input type="password" name="p" id="pwInput" class="form-control" minlength="8" autocomplete="current-password" required><button type="button" class="pw-toggle" id="pwToggle" aria-label="Show password" aria-pressed="false" title="Show password"><i class="bi bi-eye"></i></button></div><div class="invalid-feedback">Password must be at least 8 characters.</div></div><button class="btn btn-wmsu btn-lg w-100">Sign in</button></form><p class="small text-muted text-center mt-3 mb-1">Use the account issued by the canteen administrator.</p><div class="text-center mt-2"><a class="small text-wmsu" href="${ROOT}index.html">&larr; Back to home</a></div></div>`;
 const pwI=$('#pwInput'),pwT=$('#pwToggle');
 pwT.onclick=()=>{const show=pwI.type==='password';pwI.type=show?'text':'password';pwT.setAttribute('aria-pressed',show);pwT.setAttribute('aria-label',show?'Hide password':'Show password');pwT.title=show?'Hide password':'Show password';pwT.firstElementChild.className='bi bi-eye'+(show?'-slash':'');pwI.focus()};
 onForm('#lf',async d=>{const r=await API.login(role,d.u,d.p);if(!r)return;sessionStorage.setItem('wmsu_session',JSON.stringify({role,...r}));location='dashboard.html'})}

async function catPage(v){let cs=await API.list('categories');if(B.role==='vendor')cs=cs.filter(c=>c.vendorId!==null); // shared categories are admin-managed
 v.innerHTML=`<div class="d-flex justify-content-between align-items-center mb-4"><div><h4 class="fw-bold mb-1">Categories</h4><p class="text-muted small mb-0">Organize menu items by food classification.</p></div><button class="btn btn-wmsu" data-act="catEdit"><i class="bi bi-plus-lg"></i> Add category</button></div>`+table([['Icon',c=>c.icon],['Name',c=>esc(c.name)],['',c=>`<div class="d-flex gap-1 justify-content-end"><button class="btn btn-sm btn-light" data-act="catEdit" data-id="${c.id}" data-n="${esc(c.name)}" data-i="${c.icon}"><i class="bi bi-pencil"></i> Edit</button> <button class="btn btn-sm btn-light text-danger" data-act="catDel" data-id="${c.id}"><i class="bi bi-trash"></i> Delete</button></div>`]],cs);}

acts.catEdit=async d=>{const r=await modal(d.id?'Edit category':'Add category',`<label class="form-label">Name</label><input name="name" class="form-control mb-3" value="${d.n||''}" required><label class="form-label">Emoji icon</label><input name="icon" class="form-control" value="${d.i||'🍽️'}" maxlength="4" required>`,'Save');if(r){await API.save('categories',{id:d.id?+d.id:undefined,...r});toast('Category saved');refresh()}};
acts.catDel=async d=>{if(await confirmBox('Delete this category?','Delete')){await API.remove('categories',+d.id);toast('Category deleted');refresh()}};

function foodForm(v,vendorId){const id=+qs.get('id');return Promise.all([API.list('categories'),API.list('foods')]).then(([cs,fs])=>{const f=id?fs.find(x=>x.id===id):{emoji:'🍽️',available:true};if(!f)return v.innerHTML=empty('search','Food item not found.');
 v.innerHTML=`<div class="mb-4"><h4 class="fw-bold mb-1">${id?'Edit':'Add'} Food Item</h4><p class="text-muted small mb-0">Configure food item details, price, stock, and photo.</p></div><form id="ff" class="card p-4" style="max-width:640px" novalidate><div class="mb-3"><label class="form-label">Name</label><input name="name" class="form-control" value="${esc(f.name)}" required><div class="invalid-feedback">Name is required.</div></div><div class="row"><div class="col-md-4 mb-3"><label class="form-label">Category</label><select name="catId" class="form-select" required>${cs.map(c=>`<option value="${c.id}" ${c.id===f.catId?'selected':''}>${c.icon} ${esc(c.name)}</option>`).join('')}</select></div><div class="col-md-4 mb-3"><label class="form-label">Price (₱)</label><input type="number" name="price" min="1" step="0.5" class="form-control" value="${f.price||''}" required><div class="invalid-feedback">Enter a price of ₱1 or more.</div></div><div class="col-md-4 mb-3"><label class="form-label">Daily Stock <span class="text-muted fw-normal">(opt.)</span></label><input type="number" name="stockQty" min="0" max="99999" class="form-control" placeholder="Unlimited" value="${f.stockQty==null?'':f.stockQty}"></div></div><div class="mb-3"><label class="form-label">Photo (JPG, PNG or WebP, max 2 MB, optional)</label><input type="file" name="image" accept="image/jpeg,image/png,image/webp" class="form-control"></div><div class="mb-3"><label class="form-label">Description</label><textarea name="desc" class="form-control" rows="2" required>${esc(f.desc)}</textarea><div class="invalid-feedback">Add a short description.</div></div><div class="form-check form-switch mb-4"><input class="form-check-input" type="checkbox" name="available" ${f.available?'checked':''}><label class="form-check-label fw-semibold">Available for ordering</label></div><div class="d-flex gap-2"><button class="btn btn-wmsu px-4">Save item</button> <a href="${B.role==='admin'?'foods':'menu'}.html" class="btn btn-light">Cancel</a></div></form>`;
 onForm('#ff',async d=>{if(d.image&&d.image.size>2*1024*1024)return toast('Photo must be 2 MB or smaller.','danger');const stk=d.stockQty===''?null:+d.stockQty;const r=await API.save('foods',{id:id||undefined,vendorId:id?f.vendorId:vendorId,name:d.name,desc:d.desc,catId:+d.catId,price:+d.price,stockQty:stk,available:!!d.available});if(d.image&&d.image.size)await API.upload(id||r.id,d.image);toast('Food item saved','success');setTimeout(()=>location=(B.role==='admin'?'foods':'menu')+'.html',500)})})}
