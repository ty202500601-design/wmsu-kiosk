/* SAMPLE DATA FOR UI DEVELOPMENT ONLY. Replace with MySQL data via /api/*.php (set CONFIG.USE_MOCK=false in app.js). */
const ago=m=>new Date(Date.now()-m*60000).toISOString();
const MOCK_DATA={
 accounts:{vendor:{u:'vendor1',p:'vendor123',name:'Aling Nena',vendorId:1},admin:{u:'admin',p:'admin123',name:'System Admin'}},
 settings:[{id:1,canteen:'WMSU Campus Canteen',cash:true,gcash:true,maya:true,card:false,open:'07:00',close:'18:00'}],
 vendors:[
  {id:1,name:"Aling Nena's Kitchen",desc:'Filipino rice meals & silog',emoji:'🍛',status:'active',open:true,owner:'Nena Reyes',phone:'0917 000 0001'},
  {id:2,name:'Burger Hub',desc:'Burgers, fries & drinks',emoji:'🍔',status:'active',open:true,owner:'Carlo Mendoza',phone:'0917 000 0002'},
  {id:3,name:'Sweet Corner',desc:'Snacks, halo-halo & desserts',emoji:'🍧',status:'active',open:false,owner:'Ana Lim',phone:'0917 000 0003'}],
 categories:[{id:1,name:'Rice Meals',icon:'🍚'},{id:2,name:'Burgers',icon:'🍔'},{id:3,name:'Snacks',icon:'🍟'},{id:4,name:'Drinks',icon:'🥤'},{id:5,name:'Desserts',icon:'🍨'}],
 foods:[
  {id:1,vendorId:1,catId:1,name:'Tapsilog',price:85,emoji:'🍳',desc:'Beef tapa, garlic rice and egg.',available:true},
  {id:2,vendorId:1,catId:1,name:'Chicken Adobo',price:75,emoji:'🍗',desc:'Classic adobo with steamed rice.',available:true},
  {id:3,vendorId:1,catId:1,name:'Pork Sinigang',price:90,emoji:'🍲',desc:'Sour tamarind soup with pork.',available:true},
  {id:4,vendorId:1,catId:4,name:'Iced Tea',price:25,emoji:'🧋',desc:'Refreshing house iced tea.',available:true},
  {id:5,vendorId:2,catId:2,name:'Cheeseburger',price:65,emoji:'🍔',desc:'Beef patty with melted cheese.',available:true},
  {id:6,vendorId:2,catId:2,name:'Double Burger',price:95,emoji:'🍔',desc:'Two patties, extra juicy.',available:true},
  {id:7,vendorId:2,catId:3,name:'French Fries',price:45,emoji:'🍟',desc:'Crispy golden fries.',available:true},
  {id:8,vendorId:2,catId:4,name:'Soda',price:30,emoji:'🥤',desc:'Chilled soft drink.',available:true},
  {id:9,vendorId:3,catId:5,name:'Halo-Halo',price:60,emoji:'🍧',desc:'Shaved ice with sweet toppings.',available:true},
  {id:10,vendorId:3,catId:3,name:'Banana Cue',price:20,emoji:'🍌',desc:'Caramelized fried banana.',available:true},
  {id:11,vendorId:3,catId:5,name:'Leche Flan',price:40,emoji:'🍮',desc:'Creamy caramel custard.',available:false}],
 orders:[
  {id:1,no:'A101',vendorId:1,items:[{id:1,name:'Tapsilog',price:85,qty:2}],type:'Dine-In',customer:'Juan D.',pay:'cash',total:170,status:'pending',time:ago(4)},
  {id:2,no:'A102',vendorId:1,items:[{id:2,name:'Chicken Adobo',price:75,qty:1},{id:4,name:'Iced Tea',price:25,qty:1}],type:'Take-Out',customer:'Maria S.',pay:'gcash',total:100,status:'preparing',time:ago(12)},
  {id:3,no:'A103',vendorId:2,items:[{id:5,name:'Cheeseburger',price:65,qty:2},{id:7,name:'French Fries',price:45,qty:1}],type:'Dine-In',customer:'Pedro L.',pay:'cash',total:175,status:'ready',time:ago(30)},
  {id:4,no:'A104',vendorId:1,items:[{id:3,name:'Pork Sinigang',price:90,qty:1}],type:'Dine-In',customer:'Ana R.',pay:'maya',total:90,status:'completed',time:ago(1500)},
  {id:5,no:'A105',vendorId:2,items:[{id:6,name:'Double Burger',price:95,qty:1}],type:'Take-Out',customer:'Leo T.',pay:'cash',total:95,status:'completed',time:ago(2900)},
  {id:6,no:'A106',vendorId:3,items:[{id:9,name:'Halo-Halo',price:60,qty:2}],type:'Dine-In',customer:'Mia C.',pay:'gcash',total:120,status:'completed',time:ago(4400)}],
 users:[{id:1,name:'Juan Dela Cruz',email:'juan@wmsu.edu.ph',role:'student',status:'active'},{id:2,name:'Maria Santos',email:'maria@wmsu.edu.ph',role:'student',status:'active'},{id:3,name:'Prof. Lopez',email:'lopez@wmsu.edu.ph',role:'faculty',status:'active'},{id:4,name:'Pedro Lim',email:'pedro@wmsu.edu.ph',role:'student',status:'banned'}],
 applications:[{id:1,stall:'Pizza Corner',owner:'Rico Valdez',email:'rico@mail.com',phone:'0918 111 2222',status:'pending'},{id:2,stall:'Noodle House',owner:'Lina Go',email:'lina@mail.com',phone:'0918 333 4444',status:'pending'}]
};
