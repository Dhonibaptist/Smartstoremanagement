require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const pool = require('../config/db');
const fs = require('fs');
const path = require('path');

const app = express();

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', require('./routes'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Initialize database
const initDB = async () => {
  try {
    // 1. Run schema DDL (creates all tables/indexes if they do not exist)
    const schema = fs.readFileSync(path.join(__dirname, '../config/schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('✅ Tables and indexes verified');

    // 2. Seed Roles if empty
    const roleCheck = await pool.query('SELECT COUNT(*) FROM roles');
    if (parseInt(roleCheck.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO roles (name, permissions) VALUES
        ('owner', '{"all": true}'),
        ('manager', '{"products": true, "suppliers": true, "reports": true, "inventory": true}'),
        ('cashier', '{"billing": true}')
      `);
      console.log('🌱 Roles seeded successfully');
    }

    // 3. Seed Default Owner if empty
    const userCheck = await pool.query('SELECT COUNT(*) FROM users');
    if (parseInt(userCheck.rows[0].count) === 0) {
      const ownerRole = await pool.query("SELECT id FROM roles WHERE name = 'owner'");
      if (ownerRole.rows.length > 0) {
        const roleId = ownerRole.rows[0].id;
        await pool.query(
          `INSERT INTO users (name, email, password, role_id, phone) VALUES ($1, $2, $3, $4, $5)`,
          ['Store Owner', 'owner@store.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', roleId, '+919876543210']
        );
        console.log('🌱 Default owner seeded successfully');
      }
    }

    // 4. Seed Categories if empty
    const categoryCheck = await pool.query('SELECT COUNT(*) FROM categories');
    if (parseInt(categoryCheck.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO categories (name, description) VALUES
        ('Grocery', 'Daily grocery items'),
        ('Dairy', 'Milk, curd, cheese etc'),
        ('Beverages', 'Drinks and beverages'),
        ('Snacks', 'Chips, biscuits, namkeen'),
        ('Personal Care', 'Soap, shampoo, toothpaste'),
        ('Household', 'Cleaning and household items'),
        ('Frozen Foods', 'Frozen and refrigerated items'),
        ('Bakery', 'Bread, cakes, buns')
      `);
      console.log('🌱 Categories seeded successfully');
    }

    // 5. Seed Suppliers if empty
    const supplierCheck = await pool.query('SELECT COUNT(*) FROM suppliers');
    if (parseInt(supplierCheck.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO suppliers (name, contact_person, phone, email, gstin) VALUES
        ('Metro Cash & Carry', 'Ramesh Kumar', '+919811000001', 'ramesh@metro.com', '07AABCM1234A1Z5'),
        ('HUL Distributor', 'Suresh Shah', '+919811000002', 'suresh@hul.com', '07AABCH5678B1Z3'),
        ('Amul Dairy', 'Priya Patel', '+919811000003', 'priya@amul.com', '24AAAAA0000A1Z5'),
        ('Parle Biscuits', 'Ankit Jain', '+919811000004', 'ankit@parle.com', '27AAACB2345C1Z1')
      `);
      console.log('🌱 Suppliers seeded successfully');
    }

    // 6. Seed Products if empty
    const productCheck = await pool.query('SELECT COUNT(*) FROM products');
    if (parseInt(productCheck.rows[0].count) === 0) {
      // Get category map
      const cats = await pool.query('SELECT id, name FROM categories');
      const catMap = {};
      cats.rows.forEach(c => { catMap[c.name] = c.id; });

      // Get supplier map
      const sups = await pool.query('SELECT id, name FROM suppliers');
      const supMap = {};
      sups.rows.forEach(s => { supMap[s.name] = s.id; });

      const productsToSeed = [
        { name: 'Aashirvaad Atta 5kg', sku: 'GR001', barcode: '8901063111111', catName: 'Grocery', supName: 'Metro Cash & Carry', buy: 220, sell: 265, tax: 0, stock: 45, reorder: 10, unit: 'bag' },
        { name: 'Tata Salt 1kg', sku: 'GR002', barcode: '8901234567890', catName: 'Grocery', supName: 'Metro Cash & Carry', buy: 18, sell: 24, tax: 0, stock: 120, reorder: 20, unit: 'pack' },
        { name: 'Amul Butter 500g', sku: 'DA001', barcode: '8901234000001', catName: 'Dairy', supName: 'Amul Dairy', buy: 230, sell: 275, tax: 12, stock: 30, reorder: 8, unit: 'pack' },
        { name: 'Amul Milk 1L', sku: 'DA002', barcode: '8901234000002', catName: 'Dairy', supName: 'Amul Dairy', buy: 58, sell: 68, tax: 0, stock: 60, reorder: 15, unit: 'litre' },
        { name: 'Coca Cola 2L', sku: 'BV001', barcode: '8901234111001', catName: 'Beverages', supName: 'Metro Cash & Carry', buy: 68, sell: 90, tax: 28, stock: 40, reorder: 12, unit: 'bottle' },
        { name: 'Parle-G Biscuits 200g', sku: 'SN001', barcode: '8901719100005', catName: 'Snacks', supName: 'Parle Biscuits', buy: 22, sell: 30, tax: 18, stock: 200, reorder: 30, unit: 'pack' },
        { name: 'Lays Classic 26g', sku: 'SN002', barcode: '8901234222001', catName: 'Snacks', supName: 'Metro Cash & Carry', buy: 18, sell: 25, tax: 18, stock: 85, reorder: 20, unit: 'pack' },
        { name: 'Colgate Max Fresh 150g', sku: 'PC001', barcode: '8901234333001', catName: 'Personal Care', supName: 'HUL Distributor', buy: 65, sell: 85, tax: 18, stock: 55, reorder: 10, unit: 'tube' },
        { name: 'Dettol Soap 75g', sku: 'PC002', barcode: '8901234444001', catName: 'Personal Care', supName: 'HUL Distributor', buy: 32, sell: 45, tax: 18, stock: 70, reorder: 15, unit: 'bar' },
        { name: 'Surf Excel 1kg', sku: 'HH001', barcode: '8901234555001', catName: 'Household', supName: 'HUL Distributor', buy: 105, sell: 135, tax: 18, stock: 35, reorder: 8, unit: 'pack' },
        { name: 'Bread Brown 400g', sku: 'BK001', barcode: '8901234666001', catName: 'Bakery', supName: 'Metro Cash & Carry', buy: 32, sell: 45, tax: 0, stock: 25, reorder: 5, unit: 'pack' },
        { name: 'Maggi Noodles 70g', sku: 'SN003', barcode: '8901234777001', catName: 'Snacks', supName: 'Metro Cash & Carry', buy: 12, sell: 18, tax: 18, stock: 150, reorder: 25, unit: 'pack' }
      ];

      for (const p of productsToSeed) {
        const catId = catMap[p.catName] || null;
        const supId = supMap[p.supName] || null;
        await pool.query(
          `INSERT INTO products (name, sku, barcode, category_id, supplier_id, purchase_price, selling_price, tax_percent, stock_quantity, reorder_level, unit) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [p.name, p.sku, p.barcode, catId, supId, p.buy, p.sell, p.tax, p.stock, p.reorder, p.unit]
        );
      }
      console.log('🌱 Products seeded successfully');
    }

    console.log('✅ Database fully initialized & seeded!');
  } catch (err) {
    console.error('❌ DB Seeding error:', err.message);
  }
};


// Cron Jobs
// Midnight: scan expiry
cron.schedule('0 0 * * *', async () => {
  try {
    await pool.query(`
      INSERT INTO expiry_alerts (product_id, alert_type)
      SELECT id, CASE
        WHEN expiry_date < NOW() THEN 'expired'
        WHEN expiry_date < NOW() + INTERVAL '7 days' THEN 'critical'
        ELSE 'warning'
      END
      FROM products WHERE expiry_date IS NOT NULL AND expiry_date < NOW() + INTERVAL '30 days' AND is_active = true
      ON CONFLICT DO NOTHING
    `);
    console.log('✅ Expiry check done');
  } catch (err) { console.error('Expiry cron error:', err); }
});

// 9PM: low stock check
cron.schedule('0 21 * * *', async () => {
  try {
    const lowStock = await pool.query('SELECT * FROM products WHERE stock_quantity <= reorder_level AND is_active = true');
    if (lowStock.rows.length > 0) {
      console.log(`⚠️ Low stock alert: ${lowStock.rows.length} products`);
      // WhatsApp/SMS integration would go here
    }
  } catch (err) { console.error('Low stock cron error:', err); }
});

const PORT = process.env.PORT || 5000;

const start = async () => {
  await initDB();
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
};

start();
