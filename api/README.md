# WMSU Canteen Kiosk - setup

1. Start **Apache** and **MySQL** in XAMPP, then open `http://localhost/wmsu/` (not Live Server, which can't run PHP).
2. Import `database/schema.sql` (phpMyAdmin > Import). It creates the `wmsu_canteen` database, which matches `config/config.php`.
3. Create the first admin from a terminal: `C:\xampp\php\php.exe setup\create_admin.php`
4. Sign in at `/admin/login.html` with that **email** and password. Admins can add customers/admins under Users; vendors apply through `api/vendors.php?action=apply` and are approved under Applications.
5. Payments: cash is confirmed by the vendor ("Cash received"). GCash/Maya orders need the customer to submit the reference on the confirmation page; the vendor or admin then verifies it. Set `PAY_WEBHOOK_SECRET` to let a payment provider confirm automatically via `api/payment_webhook.php`.

The frontend (`assets/js/app.js`) calls the REST endpoints in `api/` with sessions and CSRF tokens. There is no mock data anymore.
Customers order as guests. Each order gets an order number and a 6-character **tracking code**; both are needed to track it.
