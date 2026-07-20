const { pool } = require('../config/db');

async function run() {
  const [rows] = await pool.query('SHOW TABLES');
  console.log(rows);
  process.exit(0);
}

run();
