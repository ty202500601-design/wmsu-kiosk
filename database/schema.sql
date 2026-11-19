CREATE DATABASE IF NOT EXISTS wmsu_canteen CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE wmsu_canteen;
CREATE TABLE users(id INT AUTO_INCREMENT PRIMARY KEY,name VARCHAR(100) NOT NULL,email VARCHAR(150) NOT NULL UNIQUE,password_hash VARCHAR(255) NOT NULL,
 role ENUM('customer','vendor','admin') NOT NULL,status ENUM('active','pending','banned') NOT NULL DEFAULT 'active',ban_reason VARCHAR(255) NULL DEFAULT NULL,banned_at DATETIME NULL DEFAULT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE vendors(id INT AUTO_INCREMENT PRIMARY KEY,user_id INT NOT NULL UNIQUE,name VARCHAR(100) NOT NULL,owner_name VARCHAR(100) NOT NULL,description VARCHAR(255) NOT NULL DEFAULT '',
 phone VARCHAR(20) NOT NULL,gcash_number VARCHAR(30) NOT NULL DEFAULT '',gcash_name VARCHAR(100) NOT NULL DEFAULT '',gcash_qr VARCHAR(120) NULL DEFAULT NULL,maya_number VARCHAR(30) NOT NULL DEFAULT '',maya_name VARCHAR(100) NOT NULL DEFAULT '',banner VARCHAR(120) NULL DEFAULT NULL,status ENUM('pending','active','suspended','rejected') NOT NULL DEFAULT 'pending',is_open TINYINT(1) NOT NULL DEFAULT 1,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
CREATE TABLE categories(id INT AUTO_INCREMENT PRIMARY KEY,vendor_id INT NULL,name VARCHAR(60) NOT NULL,icon VARCHAR(8) NOT NULL DEFAULT '',
 UNIQUE(vendor_id,name),FOREIGN KEY(vendor_id) REFERENCES vendors(id) ON DELETE CASCADE);
CREATE TABLE foods(id INT AUTO_INCREMENT PRIMARY KEY,vendor_id INT NOT NULL,category_id INT NULL,name VARCHAR(100) NOT NULL,description VARCHAR(255) NOT NULL DEFAULT '',
 price DECIMAL(10,2) NOT NULL CHECK(price>0),image VARCHAR(120) NULL,stock_qty INT NULL DEFAULT NULL,is_available TINYINT(1) NOT NULL DEFAULT 1,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX(vendor_id,category_id),FOREIGN KEY(vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL);
CREATE TABLE orders(id INT AUTO_INCREMENT PRIMARY KEY,order_no VARCHAR(30) NOT NULL UNIQUE,track_code CHAR(6) NOT NULL,vendor_id INT NOT NULL,user_id INT NULL,customer_name VARCHAR(100) NOT NULL,
 order_type ENUM('Dine-In','Take-Out') NOT NULL,
 order_status ENUM('Pending Payment','Confirmed','Preparing','Ready for Pickup','Completed','Cancelled') NOT NULL DEFAULT 'Pending Payment',
 payment_method VARCHAR(20) NOT NULL,
 payment_status ENUM('Unpaid','Pending Verification','Paid','Failed','Refunded') NOT NULL DEFAULT 'Unpaid',
 subtotal DECIMAL(10,2) NOT NULL,total DECIMAL(10,2) NOT NULL,cancel_reason VARCHAR(200) NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX(vendor_id,order_status),INDEX(user_id),FOREIGN KEY(vendor_id) REFERENCES vendors(id),FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL);
CREATE TABLE order_items(id INT AUTO_INCREMENT PRIMARY KEY,order_id INT NOT NULL,food_id INT NULL,name VARCHAR(100) NOT NULL,unit_price DECIMAL(10,2) NOT NULL,qty INT NOT NULL,line_total DECIMAL(10,2) NOT NULL,
 FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,FOREIGN KEY(food_id) REFERENCES foods(id) ON DELETE SET NULL);
CREATE TABLE payments(id INT AUTO_INCREMENT PRIMARY KEY,order_id INT NOT NULL UNIQUE,method VARCHAR(20) NOT NULL,amount DECIMAL(10,2) NOT NULL,
 status ENUM('Unpaid','Pending Verification','Paid','Failed','Refunded') NOT NULL DEFAULT 'Unpaid',reference VARCHAR(60) NULL,verified_by INT NULL,verified_at DATETIME NULL,
 INDEX(reference),FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE);
CREATE TABLE notifications(id INT AUTO_INCREMENT PRIMARY KEY,user_id INT NOT NULL,order_id INT NULL,message VARCHAR(200) NOT NULL,is_read TINYINT(1) NOT NULL DEFAULT 0,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX(user_id,is_read),FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
CREATE TABLE activity_logs(id INT AUTO_INCREMENT PRIMARY KEY,user_id INT NULL,action VARCHAR(60) NOT NULL,detail VARCHAR(255) NOT NULL DEFAULT '',ip VARCHAR(45) NOT NULL DEFAULT '',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE settings(k VARCHAR(40) PRIMARY KEY,v VARCHAR(255) NOT NULL);
INSERT INTO settings(k,v) VALUES('canteen_name','WMSU Campus Canteen'),('open_time','07:00'),('close_time','18:00'),('pay_cash','1'),('pay_gcash','1'),('pay_maya','0'),('gcash_number','0917 123 4567'),('gcash_name','WMSU Campus Canteen'),('maya_number','0918 123 4567'),('maya_name','WMSU Campus Canteen');
INSERT INTO categories(vendor_id,name,icon) VALUES(NULL,'Rice Meals','🍚'),(NULL,'Burgers & Sandwiches','🍔'),(NULL,'Snacks','🍟'),(NULL,'Drinks','🥤'),(NULL,'Desserts','🍨') ON DUPLICATE KEY UPDATE name=name;
