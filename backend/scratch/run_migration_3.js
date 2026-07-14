const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function run() {
  console.log('🔄 Executing Migration 003 via connection pool...');
  try {
    const filePath = path.join(__dirname, '..', '..', 'database', 'migrations', '003_customer_kam_segment_assignment.sql');
    const sqlContent = fs.readFileSync(filePath, 'utf8');
    
    // Split statements by semicolon, but be careful not to split inside comments or trigger errors
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    for (let i = 0; i < statements.length; i++) {
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      try {
        const [result] = await pool.query(statements[i]);
        console.log(`✅ Statement ${i + 1} succeeded.`, result);
      } catch (stmtErr) {
        console.error(`❌ Statement ${i + 1} failed:`, stmtErr.message);
        console.error(`   Query:`, statements[i]);
      }
    }
    console.log('🎉 Migration run complete.');
  } catch (err) {
    console.error('❌ Failed to run migration:', err.message);
  } finally {
    process.exit();
  }
}

run();
