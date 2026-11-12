# Connecting the PHP + MySQL backend
1. In `assets/js/app.js` set `CONFIG.USE_MOCK=false`. Sample data (`assets/js/mock-data.js`) is then never used.
2. Create `api/<table>.php` for: vendors, categories, foods, orders, users, applications, settings, auth.
   - `GET  api/foods.php`                -> JSON array
   - `POST api/foods.php?action=save`   -> body = item JSON (no id = insert); return saved item (orders must return `no`)
   - `POST api/foods.php?action=delete` -> body = {"id":1}
   - `POST api/auth.php?action=login`   -> body = {role,u,p}; return {name,vendorId} or null
3. Field names match `mock-data.js`. Replace the demo login/session with PHP sessions + password_hash().
Demo logins (mock only): vendor1 / vendor123, admin / admin123.
