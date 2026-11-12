/* Core: config, API layer, shell components (header/sidebar/footer), cart, UI helpers */
const CONFIG={USE_MOCK:true}; // false => fetch() calls to api/*.php (PHP + MySQL)
const B=document.body.dataset, ROOT=B.root||'', PAGES={customer:{},vendor:{},admin:{}}, acts={};
const $=(s,r=document)=>r.querySelector(s), sleep=ms=>new Promise(r=>setTimeout(r,ms)), qs=new URLSearchParams(location.search);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const peso=n=>'₱'+Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
const store={get:(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},set:(k,v)=>localStorage.setItem(k,JSON.stringify(v))};
const SES=()=>JSON.parse(sessionStorage.getItem('wmsu_session')||'null');
const fmt=t=>new Date(t).toLocaleString('en-PH',{dateStyle:'medium',timeStyle:'short'});
let _db=store.get('wmsu_db')||structuredClone(MOCK_DATA); const persist=()=>store.set('wmsu_db',_db);

/* ---- API layer: same method names work for mock and PHP ---- */
const API={
 async list(t){if(CONFIG.USE_MOCK){await sleep(150);return structuredClone(_db[t])}return this.f(t)},
 async save(t,it){if(!CONFIG.USE_MOCK)return this.f(t,'save',it);await sleep(150);const a=_db[t];
  if(it.id){const i=a.findIndex(x=>x.id==it.id);a[i]={...a[i],...it}}else{it.id=Math.max(0,...a.map(x=>x.id))+1;if(t=='orders')it.no='A'+(it.id+100);a.push(it)}persist();return it},
 async remove(t,id){if(!CONFIG.USE_MOCK)return this.f(t,'delete',{id});_db[t]=_db[t].filter(x=>x.id!=id);persist();return{ok:true}},
 async login(role,u,p){if(!CONFIG.USE_MOCK)return this.f('auth','login',{role,u,p});await sleep(250);const a=MOCK_DATA.accounts[role];return a.u===u&&a.p===p?{name:a.name,vendorId:a.vendorId}:null},
 async f(t,a,b){const r=await fetch(`${ROOT}api/${t}.php${a?'?action='+a:''}`,{method:b?'POST':'GET',headers:{'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined});if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}
};

/* ---- Cart (localStorage) ---- */
const cart={get:()=>store.get('cart',{vendorId:null,items:[]}),
 save(c){store.set('cart',c);updateCart()},
 count:()=>cart.get().items.reduce((s,i)=>s+i.qty,0), total:()=>cart.get().items.reduce((s,i)=>s+i.qty*i.price,0),
 async add(f,qty=1){let c=cart.get();if(c.vendorId&&c.vendorId!==f.vendorId&&c.items.length){if(!await confirmBox('Your cart has items from another vendor. Start a new cart?','Start new'))return false;c={vendorId:null,items:[]}}
  c.vendorId=f.vendorId;const i=c.items.find(x=>x.id===f.id);i?i.qty+=qty:c.items.push({id:f.id,name:f.name,price:f.price,emoji:f.emoji,qty});cart.save(c);toast(f.name+' added to cart');return true},
 setQty(id,d){const c=cart.get(),i=c.items.find(x=>x.id==id);i.qty+=d;if(i.qty<1)c.items=c.items.filter(x=>x.id!=id);cart.save(c)},
 clear(){cart.save({vendorId:null,items:[]})}};
function updateCart(){const n=cart.count(),b=$('#cartCount'),bar=$('#cartbar');if(b)b.textContent=n;
 if(bar)bar.innerHTML=n&&B.page!=='cart'?`<a class="btn btn-wmsu btn-lg" href="cart.html"><span><i class="bi bi-cart3"></i> ${n} item(s)</span><span>View cart · ${peso(cart.total())}</span></a>`:''}

/* ---- UI helpers ---- */
const spinner='<div class="state"><div class="spinner-border text-danger"></div><p class="mt-3">Loading…</p></div>';
const empty=(i,m,a='')=>`<div class="state"><i class="bi bi-${i}"></i><p class="mt-2">${m}</p>${a}</div>`;
const SB={pending:'warning text-dark',preparing:'info text-dark',ready:'primary',completed:'success',rejected:'danger',active:'success',banned:'danger',suspended:'danger',approved:'success'};
const badge=s=>`<span class="badge rounded-pill bg-${SB[s]||'secondary'}">${esc(s)}</span>`;
const stat=(i,l,v)=>`<div class="col-6 col-xl-4"><div class="card stat"><i class="bi bi-${i}"></i><div><b>${v}</b><small>${l}</small></div></div></div>`;
const table=(cols,rows,emptyMsg='Nothing here yet.')=>rows.length?`<div class="card table-responsive"><table class="table table-hover mb-0"><thead><tr>${cols.map(c=>`<th>${c[0]}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${cols.map(c=>`<td>${c[1](r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:empty('inbox',emptyMsg);
const bars=d=>{const m=Math.max(1,...d.map(x=>x[1]));return d.map(x=>`<div class="d-flex align-items-center gap-3 mb-2"><span style="width:130px" class="small text-truncate">${esc(x[0])}</span><div class="flex-grow-1"><div class="bar" style="width:${x[1]/m*100}%"></div></div><b class="small">${peso(x[1])}</b></div>`).join('')||empty('bar-chart','No data yet.')};
const refresh=()=>boot(true);
function toast(m,t='dark'){const e=document.createElement('div');e.className=`toast show align-items-center text-bg-${t} border-0 mb-2`;e.innerHTML=`<div class="d-flex"><div class="toast-body">${esc(m)}</div></div>`;$('#toasts').append(e);setTimeout(()=>e.remove(),2500)}
function modal(title,body,ok='Confirm',cls='btn-wmsu'){return new Promise(res=>{const d=document.createElement('div');d.className='modal fade';
 d.innerHTML=`<div class="modal-dialog modal-dialog-centered"><form class="modal-content" novalidate><div class="modal-header"><h5 class="modal-title">${title}</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body">${body}</div><div class="modal-footer"><button type="button" class="btn btn-light rounded-pill" data-bs-dismiss="modal">Cancel</button><button class="btn ${cls} rounded-pill px-4">${ok}</button></div></form></div>`;
 document.body.append(d);const m=new bootstrap.Modal(d);let out=null;
 d.querySelector('form').onsubmit=e=>{e.preventDefault();if(!e.target.checkValidity()){e.target.classList.add('was-validated');return}out=Object.fromEntries(new FormData(e.target));m.hide()};
 d.addEventListener('hidden.bs.modal',()=>{d.remove();res(out)});m.show()})}
const confirmBox=(msg,ok='Yes')=>modal('Please confirm',`<p class="mb-0">${msg}</p>`,ok).then(r=>!!r);
function onForm(sel,fn){const f=$(sel);f.addEventListener('submit',async e=>{e.preventDefault();if(!f.checkValidity()){f.classList.add('was-validated');return}
 const b=f.querySelector('button:not([type=button])');b&&(b.disabled=true);try{await fn(Object.fromEntries(new FormData(f)))}catch(x){toast('Something went wrong: '+x.message,'danger')}b&&(b.disabled=false)})}
document.addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(b&&acts[b.dataset.act])acts[b.dataset.act](b.dataset,b)});
acts.logout=()=>{sessionStorage.removeItem('wmsu_session');location='login.html'};

/* ---- Shell: reusable header / sidebar / footer ---- */
const NAV={customer:[['index.html','house','Home'],['vendors.html','shop','Vendors'],['cart.html','cart3','Cart'],['tracking.html','geo-alt','Track Order'],['history.html','clock-history','History']],
 vendor:[['dashboard','speedometer2','Dashboard'],['orders','bell','Incoming Orders'],['menu','egg-fried','Food Menu'],['categories','tags','Categories'],['reports','graph-up','Sales Reports'],['profile','person-badge','Profile']],
 admin:[['dashboard','speedometer2','Dashboard'],['users','people','Users'],['vendors','shop','Vendors'],['applications','file-earmark-check','Applications'],['foods','egg-fried','Food Items'],['categories','tags','Categories'],['orders','receipt','Orders'],['payments','credit-card','Payments'],['reports','graph-up','Reports'],['settings','gear','Settings']]};
const brand=(t)=>`<a class="brand" href="${ROOT}index.html"><span class="logo">WMSU</span><b>${t}</b></a>`; /* logo placeholder: swap for <img src="assets/img/wmsu-logo.png"> */
function shell(){const {role,page}=B,title=document.title.split(' |')[0];
 if(page==='login'){$('#shell').innerHTML='<main id="view" class="container"></main>';return}
 if(role==='customer'){const a=n=>n===location.pathname.split('/').pop()?'active':'';
  $('#shell').innerHTML=`<header class="topbar"><div class="container-xl d-flex flex-wrap align-items-center gap-3">${brand('Canteen Kiosk')}<nav class="nav ms-auto flex-wrap">${NAV.customer.map(n=>`<a class="${a(n[0])}" href="${n[0]==='index.html'?ROOT:''}${n[0]}"><i class="bi bi-${n[1]}"></i> ${n[2]}</a>`).join('')}</nav><a class="btn btn-wmsu" href="cart.html"><i class="bi bi-cart3"></i> <span id="cartCount">0</span></a></div></header><main id="view" class="container-xl py-4" style="padding-bottom:6rem!important"></main><div id="cartbar"></div><footer class="text-center text-muted small py-4">© Western Mindanao State University · Canteen Self-Service Kiosk</footer>`;updateCart();return}
 const s=SES();if(!s||s.role!==role){location='login.html';return}
 $('#shell').innerHTML=`<aside class="side no-print">${brand(role==='admin'?'Admin':'Vendor')}<hr class="d-none d-lg-block">${NAV[role].map(n=>`<a class="${n[0]===page||(page.includes('food')&&n[0]==='menu')?'active':''}" href="${n[0]}.html"><i class="bi bi-${n[1]}"></i> ${n[2]}</a>`).join('')}</aside><div class="content"><div class="top2 no-print"><h5 class="mb-0 fw-bold">${title}</h5><div><span class="me-3 text-muted"><i class="bi bi-person-circle"></i> ${esc(s.name)}</span><button class="btn btn-outline-wmsu btn-sm" data-act="logout"><i class="bi bi-box-arrow-right"></i> Logout</button></div></div><main id="view" class="p-4"></main></div>`}
async function boot(again){if(!again){shell();if(!$('#view'))return}const v=$('#view');v.innerHTML=spinner;
 try{await PAGES[B.role][B.page](v)}catch(e){v.innerHTML=empty('exclamation-triangle',`Couldn't load this page (${esc(e.message)}). Check your connection and try again.`,'<button class="btn btn-wmsu mt-2" onclick="refresh()">Retry</button>')}}
document.addEventListener('DOMContentLoaded',()=>boot());

/* ---- Shared pages ---- */
function loginPage(role,v){const d=role==='admin'?'admin / admin123':'vendor1 / vendor123';
 v.innerHTML=`<div class="login-card card p-4"><div class="text-center mb-3"><span class="logo lg">WMSU</span><h4 class="mt-3 fw-bold">${role==='admin'?'Admin':'Vendor'} Login</h4></div><form id="lf" novalidate><div class="mb-3"><label class="form-label">Username</label><input name="u" class="form-control form-control-lg" required><div class="invalid-feedback">Enter your username.</div></div><div class="mb-3"><label class="form-label">Password</label><input type="password" name="p" class="form-control form-control-lg" minlength="6" required><div class="invalid-feedback">Password must be at least 6 characters.</div></div><button class="btn btn-wmsu btn-lg w-100">Sign in</button></form><p class="small text-muted text-center mt-3 mb-1">Demo account: ${d}</p><a class="text-center small text-wmsu" href="${ROOT}index.html">Back to home</a></div>`;
 onForm('#lf',async d=>{const r=await API.login(role,d.u,d.p);if(!r)return toast('Wrong username or password.','danger');sessionStorage.setItem('wmsu_session',JSON.stringify({role,...r}));location='dashboard.html'})}
async function catPage(v){const cs=await API.list('categories');
 v.innerHTML=`<div class="d-flex justify-content-between mb-3"><h4 class="fw-bold">Categories</h4><button class="btn btn-wmsu" data-act="catEdit"><i class="bi bi-plus-lg"></i> Add category</button></div>`+table([['Icon',c=>c.icon],['Name',c=>esc(c.name)],['',c=>`<button class="btn btn-sm btn-outline-wmsu" data-act="catEdit" data-id="${c.id}" data-n="${esc(c.name)}" data-i="${c.icon}">Edit</button> <button class="btn btn-sm btn-light text-danger" data-act="catDel" data-id="${c.id}">Delete</button>`]],cs);}
acts.catEdit=async d=>{const r=await modal(d.id?'Edit category':'Add category',`<label class="form-label">Name</label><input name="name" class="form-control mb-3" value="${d.n||''}" required><label class="form-label">Emoji icon</label><input name="icon" class="form-control" value="${d.i||'🍽️'}" maxlength="4" required>`,'Save');if(r){await API.save('categories',{id:d.id?+d.id:undefined,...r});toast('Category saved');refresh()}};
acts.catDel=async d=>{if(await confirmBox('Delete this category?','Delete')){await API.remove('categories',+d.id);toast('Category deleted');refresh()}};
function foodForm(v,vendorId){const id=+qs.get('id');return Promise.all([API.list('categories'),API.list('foods')]).then(([cs,fs])=>{const f=id?fs.find(x=>x.id===id):{emoji:'🍽️',available:true};if(!f)return v.innerHTML=empty('search','Food item not found.');
 v.innerHTML=`<h4 class="fw-bold mb-3">${id?'Edit':'Add'} food item</h4><form id="ff" class="card p-4" style="max-width:640px" novalidate><div class="mb-3"><label class="form-label">Name</label><input name="name" class="form-control" value="${esc(f.name)}" required><div class="invalid-feedback">Name is required.</div></div><div class="row"><div class="col-md-6 mb-3"><label class="form-label">Category</label><select name="catId" class="form-select" required>${cs.map(c=>`<option value="${c.id}" ${c.id===f.catId?'selected':''}>${c.icon} ${esc(c.name)}</option>`).join('')}</select></div><div class="col-md-6 mb-3"><label class="form-label">Price (₱)</label><input type="number" name="price" min="1" step="0.5" class="form-control" value="${f.price||''}" required><div class="invalid-feedback">Enter a price of ₱1 or more.</div></div></div><div class="mb-3"><label class="form-label">Emoji (or set image URL in database)</label><input name="emoji" class="form-control" value="${f.emoji}" required></div><div class="mb-3"><label class="form-label">Description</label><textarea name="desc" class="form-control" rows="2" required>${esc(f.desc)}</textarea><div class="invalid-feedback">Add a short description.</div></div><div class="form-check form-switch mb-3"><input class="form-check-input" type="checkbox" name="available" ${f.available?'checked':''}><label class="form-check-label">Available for ordering</label></div><div><button class="btn btn-wmsu px-4">Save item</button> <a href="${B.role==='admin'?'foods':'menu'}.html" class="btn btn-light rounded-pill">Cancel</a></div></form>`;
 onForm('#ff',async d=>{await API.save('foods',{id:id||undefined,vendorId:id?f.vendorId:vendorId,...d,catId:+d.catId,price:+d.price,available:!!d.available});toast('Food item saved','success');setTimeout(()=>location=(B.role==='admin'?'foods':'menu')+'.html',500)})})}
