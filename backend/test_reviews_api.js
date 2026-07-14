const axios = require('axios');
const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('🧪 Starting Phase 2 CCMS Review Stages API tests...');
  let customerToken = '';
  let tsToken = '';
  let qcToken = '';
  let complaintId = '';
  let complaintNo = '';

  try {
    // 1. Log in as customer
    console.log('Test 1: Logging in as customer...');
    const custLoginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'paper.procurement@itc.in',
      password: 'customerpassword123',
    });
    customerToken = custLoginRes.data.data.token;
    console.log('✅ Customer login successful.');

    // 2. Fetch customer invoices
    console.log('\nTest 2: Fetching customer invoices...');
    const invRes = await axios.get(`${BASE_URL}/complaints/invoices`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const invoiceNo = invRes.data.data[0].Invoice_No;

    // 3. Fetch invoice details
    console.log(`\nTest 3: Fetching line items for invoice ${invoiceNo}...`);
    const detailsRes = await axios.get(`${BASE_URL}/complaints/invoices/${invoiceNo}`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const lineItem = detailsRes.data.data[0];

    // 4. Fetch lookups
    const lookupsRes = await axios.get(`${BASE_URL}/complaints/lookups`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const catId = lookupsRes.data.data.categories[0].Lookup_ID;
    const natureId = lookupsRes.data.data.natures[0].Lookup_ID;
    const prioId = lookupsRes.data.data.priorities.find(p => p.Lookup_Value === 'High').Lookup_ID;

    // 5. Submit complaint
    console.log('\nTest 4: Logging a complaint for TS Review...');
    const complaintData = {
      title: 'Torn Reels Delivered',
      description: 'The reels have excessive edge cracking and tearing.',
      priorityId: prioId, // High
      lineItems: [
        {
          invoiceNo: invoiceNo,
          lineItem: lineItem.Line_Item,
          defectiveQty: 2.5,
          categoryId: catId,
          defectNatureId: natureId,
          customerRemarks: 'Reels tearing'
        }
      ]
    };
    const logRes = await axios.post(`${BASE_URL}/complaints`, complaintData, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    complaintId = logRes.data.data.complaintId;
    complaintNo = logRes.data.data.complaintNumber;
    console.log(`✅ Complaint created. No: ${complaintNo}, ID: ${complaintId}`);

    // 6. Log in as TS Engineer / Head (Amit Sharma)
    console.log('\nTest 5: Logging in as TS Engineer (Amit Sharma)...');
    const tsLoginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'amit.sharma@orientpaper.com',
      password: 'password123',
    });
    tsToken = tsLoginRes.data.data.token;
    console.log('✅ TS login successful.');

    // 7. TS Schedules Visit
    console.log('\nTest 6: TS scheduling a customer visit...');
    const visitRes = await axios.post(
      `${BASE_URL}/complaints/${complaintId}/ts-review`,
      {
        actionType: 'visit-schedule',
        visitDate: '2026-07-20 10:00:00',
        observation: 'Visual inspection shows edge cracking on raw reels.',
        recommendedAction: 'Inspect rolls and log feedback.',
        remarks: 'Scheduling customer visit for Monday.'
      },
      { headers: { Authorization: `Bearer ${tsToken}` } }
    );
    console.log('✅ Customer visit scheduled.');

    // Verify claim status (should be "Visit Scheduled")
    let verifyRes = await axios.get(`${BASE_URL}/complaints/${complaintId}`, {
      headers: { Authorization: `Bearer ${tsToken}` }
    });
    console.log(`   Verify Claim Status: ${verifyRes.data.data.complaint.Status} (Expected: Visit Scheduled)`);

    // 8. TS Completes Visit
    console.log('\nTest 7: TS logging visit completion...');
    await axios.post(
      `${BASE_URL}/complaints/${complaintId}/ts-review`,
      {
        actionType: 'visit-complete',
        findings: 'Verified tearing on first 3 rolls. Moisture levels normal.',
        feedback: 'Customer requested quick replacement or credit note.',
        followUpRequired: false,
        observation: 'Visit complete. Roll defects confirmed.',
        remarks: 'Visit completed successfully.'
      },
      { headers: { Authorization: `Bearer ${tsToken}` } }
    );
    console.log('✅ Visit completed.');

    // Verify claim status (should revert to "Under TS Review")
    verifyRes = await axios.get(`${BASE_URL}/complaints/${complaintId}`, {
      headers: { Authorization: `Bearer ${tsToken}` }
    });
    console.log(`   Verify Claim Status: ${verifyRes.data.data.complaint.Status} (Expected: Under TS Review)`);

    // 9. TS Forwards to QC
    console.log('\nTest 8: TS forwarding claim to QC Review...');
    await axios.post(
      `${BASE_URL}/complaints/${complaintId}/ts-review`,
      {
        actionType: 'forward',
        observation: 'Defects verified onsite. Sending to QC for physical sample testing.',
        remarks: 'Forwarding reels sample testing.'
      },
      { headers: { Authorization: `Bearer ${tsToken}` } }
    );
    console.log('✅ Claim forwarded to QC.');

    // Verify department and assignee
    verifyRes = await axios.get(`${BASE_URL}/complaints/${complaintId}`, {
      headers: { Authorization: `Bearer ${tsToken}` }
    });
    console.log(`   Verify Current Dept: ${verifyRes.data.data.complaint.Department_Name} (Expected: Quality Control Department)`);
    console.log(`   Verify Current Assignee: ${verifyRes.data.data.complaint.Assignee} (Expected: Rajesh Gupta)`);
    console.log(`   Verify Current Status: ${verifyRes.data.data.complaint.Status} (Expected: Under QC Review)`);

    // 10. Log in as QC Head (Rajesh Gupta)
    console.log('\nTest 9: Logging in as QC Head (Rajesh Gupta)...');
    const qcLoginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'rajesh.gupta@orientpaper.com',
      password: 'password123',
    });
    qcToken = qcLoginRes.data.data.token;
    console.log('✅ QC login successful.');

    // 11. QC requests sample
    console.log('\nTest 10: QC requesting customer sample...');
    await axios.post(
      `${BASE_URL}/complaints/${complaintId}/qc-review`,
      {
        actionType: 'sample-request',
        remarks: 'Sample needed for GSM and bursting strength checking.'
      },
      { headers: { Authorization: `Bearer ${qcToken}` } }
    );
    console.log('✅ Sample requested.');

    // Verify claim status (should be "Waiting Sample")
    verifyRes = await axios.get(`${BASE_URL}/complaints/${complaintId}`, {
      headers: { Authorization: `Bearer ${qcToken}` }
    });
    console.log(`   Verify Current Status: ${verifyRes.data.data.complaint.Status} (Expected: Waiting Sample)`);

    // 12. QC receives sample
    console.log('\nTest 11: QC logging sample receipt...');
    await axios.post(
      `${BASE_URL}/complaints/${complaintId}/qc-review`,
      {
        actionType: 'sample-receive',
        sampleCondition: 'Intact rolls package',
        remarks: 'Sample package received.'
      },
      { headers: { Authorization: `Bearer ${qcToken}` } }
    );
    console.log('✅ Sample receipt logged.');

    // Verify claim status (should revert to "Under QC Review")
    verifyRes = await axios.get(`${BASE_URL}/complaints/${complaintId}`, {
      headers: { Authorization: `Bearer ${qcToken}` }
    });
    console.log(`   Verify Current Status: ${verifyRes.data.data.complaint.Status} (Expected: Under QC Review)`);

    // 13. QC Forwards to Operations
    console.log('\nTest 12: QC forwarding claim to Operations...');
    await axios.post(
      `${BASE_URL}/complaints/${complaintId}/qc-review`,
      {
        actionType: 'forward',
        sampleVerified: true,
        observation: 'GSM and bursting strength check failed parameters by 8%. Defect is genuine.',
        recommendation: 'Replace defective material or propose commercial credit.',
        remarks: 'Observations compiled. Forwarding to Operations for CAPA documentation.'
      },
      { headers: { Authorization: `Bearer ${qcToken}` } }
    );
    console.log('✅ Claim forwarded to Operations.');

    // Verify department and assignee
    verifyRes = await axios.get(`${BASE_URL}/complaints/${complaintId}`, {
      headers: { Authorization: `Bearer ${qcToken}` }
    });
    console.log(`   Verify Current Dept: ${verifyRes.data.data.complaint.Department_Name} (Expected: Operations Department)`);
    console.log(`   Verify Current Assignee: ${verifyRes.data.data.complaint.Assignee} (Expected: Vikram Mehta)`);
    console.log(`   Verify Current Status: ${verifyRes.data.data.complaint.Status} (Expected: CAPA Pending)`);
    console.log(`   Verify Timeline Logs Length: ${verifyRes.data.data.logs.length} (Expected: 6 logs)`);

    console.log('\n🎉 ALL PHASE 2 REVIEW STAGES TESTS PASSED SUCCESSFULLY! 🎉');
  } catch (err) {
    console.error('❌ Phase 2 Integration Test Failed:', err.message);
    if (err.response) {
      console.error('   Response Data:', err.response.data);
    }
  }
}

runTests();
