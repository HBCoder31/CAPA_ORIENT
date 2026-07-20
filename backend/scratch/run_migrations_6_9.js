const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function runMigration(migrationFile) {
  console.log(`🔄 Executing Migration ${migrationFile}...`);
  const filePath = path.join(__dirname, '..', '..', 'database', 'migrations', migrationFile);
  const sqlContent = fs.readFileSync(filePath, 'utf8');
  
  // Split statements by semicolon, but filtering empty lines
  const statements = sqlContent
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (stmt.toLowerCase().startsWith('use ')) {
      continue; // Skip USE statements since we are already connected to the correct db in the pool
    }
    try {
      await pool.query(stmt);
      console.log(`  ✅ Statement ${i + 1}/${statements.length} succeeded.`);
    } catch (stmtErr) {
      console.error(`  ❌ Statement ${i + 1}/${statements.length} failed:`, stmtErr.message);
      console.error(`     Query:`, stmt);
    }
  }
}

async function runAll() {
  try {
    const migrations = [
      '006_customer_exec_assignment_and_finance_reversal.sql',
      '007_qc_image_response_and_visit_scheduling.sql',
      '008_ts_visit_members_and_qc_sample_contact.sql',
      '009_visit_member_remarks.sql'
    ];

    for (const migration of migrations) {
      await runMigration(migration);
    }
    console.log('🎉 All migrations from 006 to 009 executed.');
  } catch (err) {
    console.error('❌ Migration runner failed:', err.message);
  } finally {
    process.exit();
  }
}

runAll();
