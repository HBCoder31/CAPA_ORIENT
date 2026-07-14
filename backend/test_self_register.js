const axios = require('axios');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const BASE_URL = 'http://localhost:5000/api';

async function run() {
  console.log('🧪 Starting Customer Self-Registration Integration Tests...\n');

  let connection;
  try {
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'ccms'
    };
    connection = await mysql.createConnection(dbConfig);

    // Prepare clean state for CUST100002
    console.log('🧹 Preparing clean test state for CUST100002 (purchase@jkpaper.com)...');
    await connection.execute('DELETE FROM Login_Master WHERE Customer_ID = ?', ['CUST100002']);
    await connection.execute('UPDATE Customer_Master SET Customer_Portal_Access = FALSE, Is_Active = TRUE WHERE Customer_ID = ?', ['CUST100002']);
    console.log('✅ Clean state prepared.\n');

    // Test 1: Verify non-existent customer profile
    console.log('Test 1: Verifying non-existent Customer ID/Email combo...');
    try {
      await axios.post(`${BASE_URL}/auth/register/check`, {
        customerId: 'CUST-INVALID',
        email: 'invalid@unilever.com'
      });
      console.error('❌ Test 1 Failed: Request should have failed.');
      process.exit(1);
    } catch (err) {
      if (err.response && err.response.status === 404) {
        console.log('✅ Test 1 Passed: Rejected with 404 Not Found.');
      } else {
        console.error('❌ Test 1 Failed: Unexpected error:', err.message);
        process.exit(1);
      }
    }

    // Test 2: Verify active registration check for clean account
    console.log('\nTest 2: Verifying valid unactivated profile CUST100002...');
    const checkRes = await axios.post(`${BASE_URL}/auth/register/check`, {
      customerId: 'CUST100002',
      email: 'purchase@jkpaper.com'
    });
    if (checkRes.status === 200 && checkRes.data.success) {
      console.log('✅ Test 2 Passed: Identity verified successfully. Customer Name:', checkRes.data.data.customerName);
    } else {
      console.error('❌ Test 2 Failed:', checkRes.data);
      process.exit(1);
    }

    // Test 3: Complete self-registration with password
    console.log('\nTest 3: Completing self-registration with password...');
    const registerRes = await axios.post(`${BASE_URL}/auth/register/submit`, {
      customerId: 'CUST100002',
      email: 'purchase@jkpaper.com',
      password: 'jkpassword123'
    });
    if (registerRes.status === 200 && registerRes.data.success) {
      console.log('✅ Test 3 Passed: Registration submitted successfully.');
    } else {
      console.error('❌ Test 3 Failed:', registerRes.data);
      process.exit(1);
    }

    // Test 4: Verify duplicate registration attempts returns alreadyRegistered: true
    console.log('\nTest 4: Checking duplicate registration flag...');
    const dupCheckRes = await axios.post(`${BASE_URL}/auth/register/check`, {
      customerId: 'CUST100002',
      email: 'purchase@jkpaper.com'
    });
    if (dupCheckRes.status === 200 && dupCheckRes.data.data.alreadyRegistered === true) {
      console.log('✅ Test 4 Passed: alreadyRegistered flag is correctly set to true.');
    } else {
      console.error('❌ Test 4 Failed: Expected alreadyRegistered to be true, got:', dupCheckRes.data);
      process.exit(1);
    }

    // Test 5: Verify new login with registered credentials
    console.log('\nTest 5: Logging in with the newly registered credentials...');
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'purchase@jkpaper.com',
      password: 'jkpassword123'
    });
    if (loginRes.status === 200 && loginRes.data.success) {
      console.log('✅ Test 5 Passed: Customer portal login works! Role:', loginRes.data.data.user.role);
    } else {
      console.error('❌ Test 5 Failed:', loginRes.data);
      process.exit(1);
    }

    // Test 6: Verify Customer Portal Access flag was auto-enabled
    console.log('\nTest 6: Verifying Customer Portal Access auto-enabled in DB...');
    const [rows] = await connection.execute('SELECT Customer_Portal_Access FROM Customer_Master WHERE Customer_ID = ?', ['CUST100002']);
    if (rows.length > 0 && rows[0].Customer_Portal_Access === 1) {
      console.log('✅ Test 6 Passed: Customer_Portal_Access flag is active (1).');
    } else {
      console.error('❌ Test 6 Failed: Flag is not enabled.');
      process.exit(1);
    }

    console.log('\n🎉 ALL SELF-REGISTRATION TESTS PASSED SUCCESSFULLY! 🎉');
  } catch (err) {
    console.error('❌ Integration Test Failed:', err.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

run();
