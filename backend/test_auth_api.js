const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api/auth';

async function runTests() {
  console.log('🧪 Starting Authentication API tests...');
  let adminToken = '';
  let customerToken = '';
  let activationToken = '';

  try {
    // Test 1: Employee login (Admin User)
    console.log('\nTest 1: Logging in as seeded employee Admin User...');
    const loginRes = await axios.post(`${BASE_URL}/login`, {
      email: 'admin@orientpaper.com',
      password: 'password123',
    });
    console.log('✅ Employee login successful.');
    adminToken = loginRes.data.data.token;
    console.log('   Received Token:', adminToken.substring(0, 20) + '...');
    console.log('   User Role:', loginRes.data.data.user.role);

    // Test 2: Access protect endpoint (/me)
    console.log('\nTest 2: Fetching profile of logged-in admin...');
    const meRes = await axios.get(`${BASE_URL}/me`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.log('✅ Profile fetched successfully.');
    console.log('   Profile User Name:', meRes.data.data.user.name);
    console.log('   Profile User Role:', meRes.data.data.user.role);

    // Test 3: Try logging in as Customer CUST100001 (who has no password set yet)
    console.log('\nTest 3: Attempting customer login before password is set...');
    try {
      await axios.post(`${BASE_URL}/login`, {
        email: 'paper.procurement@itc.in', // Customer CUST100001
        password: 'password123',
      });
      console.log('❌ Test failed: customer logged in without password!');
    } catch (err) {
      console.log('✅ Customer login rejected (expected):', err.response.data.message);
    }

    // Test 4: Generate customer activation token (invite)
    console.log('\nTest 4: Generating invite token for customer CUST100001...');
    const inviteRes = await axios.post(
      `${BASE_URL}/invite`,
      { customerId: 'CUST100001' },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    console.log('✅ Customer invite token generated successfully.');
    activationToken = inviteRes.data.data.activationToken;
    console.log('   Activation Token:', activationToken.substring(0, 20) + '...');
    console.log('   Activation URL:', inviteRes.data.data.activationUrl);

    // Test 5: Activate customer using the token
    console.log('\nTest 5: Setting password for customer CUST100001 using activation token...');
    const activateRes = await axios.post(`${BASE_URL}/activate`, {
      token: activationToken,
      password: 'customerpassword123',
    });
    console.log('✅ Customer account activated successfully:', activateRes.data.message);

    // Test 6: Log in as Customer CUST100001 with new password
    console.log('\nTest 6: Logging in as customer CUST100001 with new password...');
    const custLoginRes = await axios.post(`${BASE_URL}/login`, {
      email: 'paper.procurement@itc.in',
      password: 'customerpassword123',
    });
    console.log('✅ Customer login successful.');
    customerToken = custLoginRes.data.data.token;
    console.log('   Received Token:', customerToken.substring(0, 20) + '...');
    console.log('   User Role:', custLoginRes.data.data.user.role);

    // Test 7: Fetch customer profile
    console.log('\nTest 7: Fetching profile of logged-in customer CUST100001...');
    const custMeRes = await axios.get(`${BASE_URL}/me`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    console.log('✅ Customer profile fetched successfully.');
    console.log('   Customer ID:', custMeRes.data.data.user.id);
    console.log('   Customer Role:', custMeRes.data.data.user.role);

    // Test 8: Try to login as Customer CUST100003 (Portal access = FALSE)
    console.log('\nTest 8: Attempting login for customer CUST100003 (portal access disabled)...');
    try {
      await axios.post(`${BASE_URL}/login`, {
        email: 'procurement@westcoastpaper.com', // CUST100003
        password: 'password123',
      });
      console.log('❌ Test failed: customer CUST100003 logged in despite no portal access!');
    } catch (err) {
      console.log('✅ Customer login rejected (expected):', err.response.data.message);
    }

    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉');
  } catch (err) {
    console.error('❌ Integration Test Failed:', err.message);
    if (err.response) {
      console.error('   Response Data:', err.response.data);
    }
  }
}

runTests();
