require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const seed = async () => {
  try {
    console.log('🌱 Starting database seeding...');
    const schemaPath = path.join(__dirname, '../config/schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    // Run the entire schema.sql file
    await pool.query(sql);
    console.log('✅ Database schema and seed data successfully initialized!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Database seeding failed:', err);
    process.exit(1);
  }
};

seed();
