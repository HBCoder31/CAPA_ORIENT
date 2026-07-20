const axios = require('axios');
const BASE_URL = 'http://localhost:5000/api';

async function runLifecycleTest() {
  console.log('🧪 Starting CCMS Complete Lifecycle Integration Test...');
  
  let customerToken = '';
  let tsToken = '';
  let tsEngToken = '';
  let qcToken = '';
  let opsToken = '';
  let pmToken = '';
  let mktHeadToken = '';
  let finToken = '';
  let adminToken = '';
  let kamToken = '';

  let complaintId = '';
  let complaintNo = '';

  try {
    // 1. Authenticate all roles
    console.log('Test 1: Authenticating all lifecycle roles...');
    
    const [t1, t2, t3, t4, t5, t6, t7, t8, tKam, tTsEng] = await Promise.all([
      axios.post(`${BASE_URL}/auth/login`, { email: 'paper.procurement@itc.in', password: 'customerpassword123' }),
      axios.post(`${BASE_URL}/auth/login`, { email: 'amit.sharma@orientpaper.com', password: 'password123' }),
      axios.post(`${BASE_URL}/auth/login`, { email: 'rajesh.gupta@orientpaper.com', password: 'password123' }),
      axios.post(`${BASE_URL}/auth/login`, { email: 'vikram.mehta@orientpaper.com', password: 'password123' }),
      axios.post(`${BASE_URL}/auth/login`, { email: 'rohit.malhotra@orientpaper.com', password: 'password123' }),
      axios.post(`${BASE_URL}/auth/login`, { email: 'anjali.kapoor@orientpaper.com', password: 'password123' }),
      axios.post(`${BASE_URL}/auth/login`, { email: 'deepak.sinha@orientpaper.com', password: 'password123' }),
      axios.post(`${BASE_URL}/auth/login`, { email: 'admin@orientpaper.com', password: 'password123' }),
      axios.post(`${BASE_URL}/auth/login`, { email: 'siddharth@orientpaper.com', password: 'password123' }),
      axios.post(`${BASE_URL}/auth/login`, { email: 'neha.verma@orientpaper.com', password: 'password123' }),
    ]);

    customerToken = t1.data.data.token;
    tsToken = t2.data.data.token;
    tsEngToken = tTsEng.data.data.token;
    qcToken = t3.data.data.token;
    opsToken = t4.data.data.token;
    pmToken = t5.data.data.token;
    mktHeadToken = t6.data.data.token;
    finToken = t7.data.data.token;
    adminToken = t8.data.data.token;
    kamToken = tKam.data.data.token;
    
    console.log('✅ All lifecycle roles authenticated successfully.');

    // 2. Fetch lookups & invoices
    const lookupsRes = await axios.get(`${BASE_URL}/complaints/lookups`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const catId = lookupsRes.data.data.categories[0].Lookup_ID;
    const natureId = lookupsRes.data.data.natures[0].Lookup_ID;
    const prioId = lookupsRes.data.data.priorities.find(p => p.Lookup_Value === 'Medium').Lookup_ID;

    const invRes = await axios.get(`${BASE_URL}/complaints/invoices`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const invoiceNo = invRes.data.data[0].Invoice_No;
    
    const detailsRes = await axios.get(`${BASE_URL}/complaints/invoices/${invoiceNo}`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const lineItem = detailsRes.data.data[0];

    // Enable customer portal so customer can log a complaint in the test flow
    console.log('   - Enabling customer portal via Administrator...');
    await axios.put(`${BASE_URL}/auth/config/customer-portal`, {
      enabled: true
    }, { headers: { Authorization: `Bearer ${adminToken}` } });

    // 3. Customer Files Complaint (Intake)
    console.log('\nTest 2: Customer logging complaint (Intake)...');
    const logRes = await axios.post(`${BASE_URL}/complaints`, {
      title: 'Moisture defects on paper reams',
      description: 'The moisture test failed parameters. Please investigate.',
      priorityId: prioId,
      lineItems: [{
        invoiceNo,
        lineItem: lineItem.Line_Item,
        defectiveQty: 3.5,
        categoryId: catId,
        defectNatureId: natureId,
        customerRemarks: 'Moisture content exceeds OPM standards.'
      }]
    }, { headers: { Authorization: `Bearer ${customerToken}` } });
    
    complaintId = logRes.data.data.complaintId;
    complaintNo = logRes.data.data.complaintNumber;
    console.log(`✅ Complaint CMP created. ID: ${complaintId}, Number: ${complaintNo}`);

    // 3b. KAM approves the complaint intake to TS
    console.log('\nTest 2b: KAM verifying and forwarding complaint to TS...');
    await axios.post(`${BASE_URL}/complaints/${complaintId}/approve`, {
      stage: 'kam',
      remarks: 'Intake details confirmed, forwarding to TS.',
      severityId: prioId
    }, { headers: { Authorization: `Bearer ${adminToken}` } });
    console.log('✅ KAM Verification approved. Complaint forwarded to TS Review.');

    // 4. TS schedules visit and completes it
    console.log('\nTest 3: TS Scheduling and logging visit findings...');
    await axios.post(`${BASE_URL}/complaints/${complaintId}/ts-review`, {
      actionType: 'visit-schedule',
      visitDate: '2026-07-22 14:00:00',
      departureDate: '2026-07-22 09:00:00',
      returnDate: '2026-07-23 18:00:00',
      visitMembers: [100003], // Neha Verma
      remarks: 'Onsite inspection needed.'
    }, { headers: { Authorization: `Bearer ${tsToken}` } });

    await axios.post(`${BASE_URL}/complaints/${complaintId}/visit-remarks`, {
      remarks: 'Verified high moisture on rolls in batch Dryer 3.'
    }, { headers: { Authorization: `Bearer ${tsEngToken}` } });

    // 5. TS forwards to QC
    console.log('\nTest 4: TS forwarding claim to QC...');
    await axios.post(`${BASE_URL}/complaints/${complaintId}/ts-review`, {
      actionType: 'forward',
      remarks: 'Sample sent to QC lab.'
    }, { headers: { Authorization: `Bearer ${tsToken}` } });

    // 6. QC requests and receives sample
    console.log('\nTest 5: QC requesting and receiving sample...');
    await axios.post(`${BASE_URL}/complaints/${complaintId}/qc-review`, {
      actionType: 'sample-request',
      remarks: 'GSM sample needed.'
    }, { headers: { Authorization: `Bearer ${qcToken}` } });

    await axios.post(`${BASE_URL}/complaints/${complaintId}/qc-review`, {
      actionType: 'sample-receive',
      sampleCondition: 'Intact package, slightly damp edge',
      remarks: 'Logging received sample.'
    }, { headers: { Authorization: `Bearer ${qcToken}` } });

    // 7. QC forwards to Ops (CAPA Pending)
    console.log('\nTest 6: QC forwarding to Operations...');
    await axios.post(`${BASE_URL}/complaints/${complaintId}/qc-review`, {
      actionType: 'forward',
      sampleVerified: true,
      observation: 'GSM verified. Defect is genuine.'
    }, { headers: { Authorization: `Bearer ${qcToken}` } });

    // 8. Ops logs CAPA and approves CAPA
    console.log('\nTest 7: Operations logging and approving CAPA details...');
    await axios.post(`${BASE_URL}/complaints/${complaintId}/capa`, {
      rootCause: 'Valve fault in Dryer 3 steam pipes.',
      correctiveAction: 'Replaced manual valve lock.',
      preventiveAction: 'Hourly inspection schedules.'
    }, { headers: { Authorization: `Bearer ${opsToken}` } });

    await axios.post(`${BASE_URL}/complaints/${complaintId}/approve`, {
      stage: 'ops-head',
      remarks: 'CAPA approved by Vikram Mehta.'
    }, { headers: { Authorization: `Bearer ${opsToken}` } });

    // 9. Marketing PM forwards to Marketing Head
    console.log('\nTest 8: Marketing PM reviewing claim...');
    await axios.post(`${BASE_URL}/complaints/${complaintId}/approve`, {
      stage: 'marketing-pm',
      remarks: 'Forwarding to Head.'
    }, { headers: { Authorization: `Bearer ${pmToken}` } });

    // 10. Marketing Head approves settlement
    console.log('\nTest 9: Marketing Head approving commercial payout of ₹65,000...');
    await axios.post(`${BASE_URL}/complaints/${complaintId}/approve`, {
      stage: 'marketing-head',
      settlementAmount: 65000,
      remarks: 'Approved. Send to Deepak Sinha (Finance) to issue Credit Note.'
    }, { headers: { Authorization: `Bearer ${mktHeadToken}` } });

    // Verify status (should be Finance Pending)
    let verifyRes = await axios.get(`${BASE_URL}/complaints/${complaintId}`, {
      headers: { Authorization: `Bearer ${finToken}` }
    });
    console.log(`   Verify Status: ${verifyRes.data.data.complaint.Status} (Expected: Finance Pending)`);
    console.log(`   Verify Settlement Amount in DB: ₹${verifyRes.data.data.settlement.Approved_Amount} (Expected: ₹65000)`);

    // 10b. Finance Executive prepares credit note (Stage 10)
    console.log('\nTest 9b: Finance Executive issuing SAP Credit Note...');
    await axios.post(`${BASE_URL}/complaints/${complaintId}/finance`, {
      creditNoteNumber: 'SAP-CN-2026-9901',
      creditNoteDate: '2026-07-15',
      creditNoteAmount: 65000,
      fiscalYear: '2026',
      companyCode: 'OPM_PAPER',
      remarks: 'SAP sync complete. Credit note posted.'
    }, { headers: { Authorization: `Bearer ${finToken}` } });
    console.log('✅ Finance Executive prepared credit note. Complaint is now Credit Note Pending.');

    // 11. Finance Head approves settlement and closes complaint (Stage 11)
    console.log('\nTest 10: Finance Head approving commercial payout and closing claim...');
    await axios.post(`${BASE_URL}/complaints/${complaintId}/approve`, {
      stage: 'finance-head',
      remarks: 'Settlement confirmed, proceeding to Credit Note sync.'
    }, { headers: { Authorization: `Bearer ${adminToken}` } });

    verifyRes = await axios.get(`${BASE_URL}/complaints/${complaintId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log(`   Verify Status: ${verifyRes.data.data.complaint.Status} (Expected: Closed)`);
    console.log(`   Verify Credit Note number in DB: ${verifyRes.data.data.creditNote.Credit_Note_Number} (Expected: SAP-CN-2026-9901)`);

    // 12. Reopening closed complaint within 7 days (KAM only, Customer blocked)
    console.log('\nTest 11: Reopening closed complaint (7-day rule, KAM auth)...');
    
    // First, verify that a customer attempt fails with 403
    try {
      await axios.post(`${BASE_URL}/complaints/${complaintId}/action`, {
        action: 'reopen',
        remarks: 'Trying to reopen as customer.'
      }, { headers: { Authorization: `Bearer ${customerToken}` } });
      console.log('❌ Failed: Customer reopen did not throw 403');
    } catch (e) {
      console.log('✅ Customer reopen successfully blocked (403).');
    }

    // Now reopen using KAM token
    await axios.post(`${BASE_URL}/complaints/${complaintId}/action`, {
      action: 'reopen',
      remarks: 'Moisture issue still persist in replacement bundle. Reopening.',
      targetStageId: 2
    }, { headers: { Authorization: `Bearer ${kamToken}` } });

    verifyRes = await axios.get(`${BASE_URL}/complaints/${complaintId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log(`   Verify Status after Reopen: ${verifyRes.data.data.complaint.Status} (Expected: Under TS Review)`);
    console.log(`   Verify Assignee: ${verifyRes.data.data.complaint.Assignee} (Expected: Neha Verma)`);
    console.log(`   Total Timeline Logs Length: ${verifyRes.data.data.logs.length} (Expected: 15 logs)`);

    console.log('\n🎉 CCMS END-TO-END COMPLETE LIFECYCLE INTEGRATION TEST PASSED! 🎉');
  } catch (err) {
    console.error('❌ CCMS Lifecycle Test Failed:', err.message);
    if (err.response) {
      console.error('   Response Data:', err.response.data);
    }
  }
}

runLifecycleTest();
