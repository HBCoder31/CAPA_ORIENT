const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'ccms',
};

async function test() {
  const connection = await mysql.createConnection(dbConfig);
  console.log('Connected to DB.');
  
  const migrationPath = path.join(__dirname, '..', '..', 'database', 'migrations', '005_create_login_tables.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  const statements = sql
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);

  console.log(`Total statements to run: ${statements.length}`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    console.log(`\n--- Running statement ${i + 1} ---`);
    console.log(stmt);
    try {
      const [res] = await connection.query(stmt);
      console.log(`Success! Result:`, res);
    } catch (err) {
      console.error(`ERROR running statement ${i + 1}:`, err);
    }
  }

  await connection.end();
}

test();
