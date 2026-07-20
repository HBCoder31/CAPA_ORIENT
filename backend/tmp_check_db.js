const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'ccms'
  });
  const dbName = process.env.DB_NAME || 'ccms';
  console.log('dbName=', dbName);
  const [rowsExact] = await conn.query("SHOW TABLES LIKE 'Customer_KAM_Segment_Assignment'");
  console.log('SHOW exact:', JSON.stringify(rowsExact));
  const [rowsLower] = await conn.query("SHOW TABLES LIKE '%customer_kam_segment_assignment%'");
  console.log('SHOW lower pattern:', JSON.stringify(rowsLower));
  const [rowsInfo] = await conn.query(
    'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND LOWER(TABLE_NAME) = ?',
    [dbName, 'customer_kam_segment_assignment']
  );
  console.log('INFORMATION_SCHEMA exact lower:', JSON.stringify(rowsInfo));
  const [rowsSegment] = await conn.query("SHOW TABLES LIKE '%Segment%'");
  console.log('SHOW %Segment%:', JSON.stringify(rowsSegment));
  const [rowsAssign] = await conn.query("SHOW TABLES LIKE '%Assign%'");
  console.log('SHOW %Assign%:', JSON.stringify(rowsAssign));
  const migrationFile = path.join(process.cwd(), '..', 'database', 'migrations', '003_customer_kam_segment_assignment.sql');
  console.log('migrationFile=', migrationFile);
  const sql = fs.readFileSync(migrationFile, 'utf8');
  console.log('sql length=', sql.length);
  const statements = sql.split(/;\s*$/m).map(s => s.trim()).filter(s => s.length && !s.startsWith('--'));
  console.log('statements count=', statements.length);
  statements.forEach((stmt, i) => {
    console.log('stmt', i, stmt.slice(0, 120).replace(/\n/g, ' '));
  });
  await conn.end();
})().catch(err => { console.error(err); process.exit(1); });
