const axios = require('axios');

async function testLoginPage() {
  console.log('🔍 Running automated validation of frontend rendering and backend authentication...');
  
  // 1. Healthcheck Frontend Server
  try {
    const frontendRes = await axios.get('http://localhost:5173/');
    console.log(`✅ Frontend dev server is ONLINE (HTTP ${frontendRes.status}).`);
    if (frontendRes.data.includes('<div id="root"></div>') && frontendRes.data.includes('src="/src/main.jsx"')) {
      console.log('   - Confirmed index.html is served correctly with Vite script injection.');
    } else {
      console.warn('   - Warning: index.html format does not match expected script/container signatures.');
    }
  } catch (err) {
    console.error('❌ Frontend dev server is OFFLINE:', err.message);
  }

  // 2. Healthcheck Authentication API Endpoint (Correct Credentials)
  try {
    const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'paper.procurement@itc.in',
      password: 'customerpassword123'
    });
    console.log(`✅ Backend Auth API is ONLINE & FUNCTIONAL (HTTP ${loginRes.status}).`);
    if (loginRes.data.success && loginRes.data.data.token) {
      console.log('   - Confirmed login requests return JWT token and user metadata successfully.');
      console.log(`   - Logged-in Customer Name: ${loginRes.data.data.user.name}`);
    } else {
      console.error('   - Error: Login response payload is malformed.');
    }
  } catch (err) {
    console.error('❌ Backend Auth API failed on correct credentials:', err.message);
    if (err.response) {
      console.error('   Response Status:', err.response.status);
      console.error('   Response Payload:', err.response.data);
    }
  }

  // 3. Healthcheck Authentication API Endpoint (Invalid Credentials validation)
  try {
    await axios.post('http://localhost:5000/api/auth/login', {
      email: 'paper.procurement@itc.in',
      password: 'wrongpassword'
    });
    console.error('❌ Security validation fail: Backend API allowed login with wrong password!');
  } catch (err) {
    if (err.response && err.response.status === 401) {
      console.log(`✅ Security validation success: Backend rejected wrong password correctly (HTTP ${err.response.status}).`);
      console.log(`   - API message: "${err.response.data.message}"`);
    } else {
      console.error('❌ Backend API returned unexpected error code on invalid login:', err.message);
    }
  }

  // 4. Role-Selection Constraint: Customer tries to log in as Employee
  try {
    await axios.post('http://localhost:5000/api/auth/login', {
      email: 'paper.procurement@itc.in',
      password: 'customerpassword123',
      isCustomer: false
    });
    console.error('❌ Validation fail: Allowed customer to log in via Employee tab!');
  } catch (err) {
    if (err.response && err.response.status === 400) {
      console.log(`✅ Validation success: Backend blocked customer logging in as employee (HTTP ${err.response.status}).`);
      console.log(`   - API message: "${err.response.data.message}"`);
    } else {
      console.error('❌ Unexpected response code for customer logging in as employee:', err.message);
    }
  }

  // 5. Role-Selection Constraint: Employee tries to log in as Customer
  try {
    await axios.post('http://localhost:5000/api/auth/login', {
      email: 'amit.sharma@orientpaper.com',
      password: 'password123',
      isCustomer: true
    });
    console.error('❌ Validation fail: Allowed employee to log in via Customer tab!');
  } catch (err) {
    if (err.response && err.response.status === 400) {
      console.log(`✅ Validation success: Backend blocked employee logging in as customer (HTTP ${err.response.status}).`);
      console.log(`   - API message: "${err.response.data.message}"`);
    } else {
      console.error('❌ Unexpected response code for employee logging in as customer:', err.message);
    }
  }

  // 6. Role-Selection Constraint: Employee logs in as Employee (Success case)
  try {
    const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'amit.sharma@orientpaper.com',
      password: 'password123',
      isCustomer: false
    });
    console.log(`✅ Validation success: Employee logged in via Employee tab (HTTP ${loginRes.status}).`);
    console.log(`   - Logged-in Employee Role: ${loginRes.data.data.user.role}`);
  } catch (err) {
    console.error('❌ Validation fail: Employee login failed via Employee tab:', err.message);
  }

  // 7. Role-Selection Constraint: Customer logs in as Customer (Success case)
  try {
    const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'paper.procurement@itc.in',
      password: 'customerpassword123',
      isCustomer: true
    });
    console.log(`✅ Validation success: Customer logged in via Customer tab (HTTP ${loginRes.status}).`);
  } catch (err) {
    console.error('❌ Validation fail: Customer login failed via Customer tab:', err.message);
  }
}

testLoginPage();
