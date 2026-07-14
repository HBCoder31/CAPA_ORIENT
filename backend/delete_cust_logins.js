const { pool } = require('./config/db');

async function deleteLogins() {
  console.log('🧹 Deleting test customer login accounts CUST100002 and CUST100003...');
  try {
    const [res] = await pool.execute(
      'DELETE FROM Login_Master WHERE Customer_ID IN (?, ?)',
      ['CUST100002', 'CUST100003']
    );
    console.log(`✅ Success: Deleted ${res.affectedRows} login record(s).`);

    // Also disable Customer_Portal_Access for them so they can be registered fresh
    const [res2] = await pool.execute(
      'UPDATE Customer_Master SET Customer_Portal_Access = FALSE WHERE Customer_ID IN (?, ?)',
      ['CUST100002', 'CUST100003']
    );
    console.log(`✅ Success: Reset portal access flags for ${res2.affectedRows} customer(s).`);
  } catch (err) {
    console.error('❌ Error executing deletion:', err.message);
  } finally {
    process.exit(0);
  }
}

deleteLogins();
