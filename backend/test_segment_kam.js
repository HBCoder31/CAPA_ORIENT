const axios = require('axios');

async function testSegmentKam() {
  console.log('🧪 Testing segment-specific KAM assignment logic...');

  // 1. Authenticate Customer yb@itc.in
  let token;
  try {
    const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'yb@itc.in',
      password: 'yb123'
    });
    token = loginRes.data.data.token;
    console.log('✅ Customer yb@itc.in authenticated successfully.');
  } catch (err) {
    console.error('❌ Authentication failed:', err.message);
    return;
  }

  // 2. Submit Paper Complaint (INV900010 is division 'Paper')
  try {
    const complaintRes = await axios.post('http://localhost:5000/api/complaints', {
      title: 'Testing segment KAM mapping for Paper',
      description: 'Verifying that Paper complaints map to Dev Brat.',
      priorityId: 32, // Medium
      lineItems: [
        {
          invoiceNo: 'INV900010',
          lineItem: 1,
          defectiveQty: 12,
          categoryId: 37, // Quality
          defectNatureId: 42, // Bursting Strength Failure
          customerRemarks: 'Paper tearing issues'
        }
      ]
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const complaintId = complaintRes.data.data.complaintId;
    const complaintNumber = complaintRes.data.data.complaintNumber;
    console.log(`✅ Paper complaint logged successfully: ${complaintNumber} (ID: ${complaintId})`);

    // 3. Query Database to verify which KAM was assigned
    const { pool } = require('./config/db');
    const [kamRows] = await pool.query('SELECT KAM_ID FROM KAM_Master WHERE Employee_ID = 100020');
    const expectedKamId = kamRows[0]?.KAM_ID;

    const [rows] = await pool.query(`
      SELECT ch.Complaint_Number, ch.KAM_ID, ch.Current_Assignee_ID, emp.Employee_Name as Assigned_Employee
      FROM Complaint_Header ch
      JOIN Employee_Master emp ON ch.Current_Assignee_ID = emp.Employee_ID
      WHERE ch.Complaint_ID = ?
    `, [complaintId]);

    const result = rows[0];
    console.log('\n🔍 Verifying assigned KAM details in DB:');
    console.log(`   - Complaint Code    : ${result.Complaint_Number}`);
    console.log(`   - Assigned KAM ID   : ${result.KAM_ID} (Expected: ${expectedKamId} for Dev Brat)`);
    console.log(`   - Assigned Employee : ${result.Assigned_Employee} (Expected: Dev Brat (KAM))`);

    if (parseInt(result.KAM_ID) === expectedKamId && result.Assigned_Employee.includes('Dev Brat')) {
      console.log('\n🎉 SUCCESS: Segment KAM resolved to Dev Brat correctly!');
    } else {
      console.error('\n❌ FAILURE: Segment KAM did not map to Dev Brat.');
    }
  } catch (err) {
    console.error('❌ Complaint filing failed:', err.message);
    if (err.response) {
      console.error('   Response Status:', err.response.status);
      console.error('   Response Payload:', err.response.data);
    }
  }

  process.exit();
}

testSegmentKam();
