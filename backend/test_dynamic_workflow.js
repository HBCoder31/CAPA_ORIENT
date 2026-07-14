const axios = require('axios');
const { pool } = require('./config/db');

const BASE_URL = 'http://localhost:5000/api';

async function getToken(email) {
  const password = email === 'yb@itc.in' ? 'yb123' : 'password123';
  try {
    const res = await axios.post(`${BASE_URL}/auth/login`, { email, password });
    return res.data.data.token;
  } catch (err) {
    console.error(`❌ Authentication failed for ${email}:`, err.message);
    throw err;
  }
}

async function verifyComplaintState(complaintId, expectedStageName, expectedStatusId, expectedAssigneeName) {
  const [rows] = await pool.query(`
    SELECT ch.Complaint_Status_ID, ch.Current_Assignee_ID, emp.Employee_Name, status.Lookup_Value as Status_Name
    FROM Complaint_Header ch
    LEFT JOIN Employee_Master emp ON ch.Current_Assignee_ID = emp.Employee_ID
    LEFT JOIN Lookup_Master status ON ch.Complaint_Status_ID = status.Lookup_ID
    WHERE ch.Complaint_ID = ?
  `, [complaintId]);

  if (rows.length === 0) {
    throw new Error('Complaint not found in database.');
  }

  const { Complaint_Status_ID, Employee_Name, Status_Name } = rows[0];

  console.log(`   [State Check] Status: ${Status_Name} (${Complaint_Status_ID}) | Assignee: ${Employee_Name || 'None'}`);

  if (Complaint_Status_ID !== expectedStatusId) {
    throw new Error(`State verification failed at stage "${expectedStageName}". Expected status ID ${expectedStatusId}, got ${Complaint_Status_ID}.`);
  }

  if (expectedAssigneeName && (!Employee_Name || !Employee_Name.toLowerCase().includes(expectedAssigneeName.toLowerCase()))) {
    throw new Error(`State verification failed at stage "${expectedStageName}". Expected assignee "${expectedAssigneeName}", got "${Employee_Name}".`);
  }

  console.log(`   ✅ Passed: "${expectedStageName}" state checks out perfectly.`);
}

async function runWorkflowTest() {
  console.log('🧪 Starting End-To-End 11-Stage Dynamic Workflow Integration Test...\n');

  try {
    // 1. Intake Stage (Stage 1) - Customer logs complaint
    console.log('--- Stage 1: Intake (Customer yb@itc.in) ---');
    const customerToken = await getToken('yb@itc.in');
    const logRes = await axios.post(`${BASE_URL}/complaints`, {
      title: 'Testing dynamic 11-stage pipeline',
      description: 'Verifying automatic routing and department assignment rules.',
      priorityId: 32, // Medium
      lineItems: [{
        invoiceNo: 'INV900010', // Paper division item
        lineItem: 1,
        defectiveQty: 10,
        categoryId: 37, // Quality
        defectNatureId: 42, // Bursting Strength Failure
        customerRemarks: 'Tearing during printing run.'
      }]
    }, { headers: { Authorization: `Bearer ${customerToken}` } });

    const complaintId = logRes.data.data.complaintId;
    const complaintNo = logRes.data.data.complaintNumber;
    console.log(`✅ Complaint logged successfully: ${complaintNo} (ID: ${complaintId})`);
    await verifyComplaintState(complaintId, 'Submitted', 17, 'Dev Brat');

    // 2. KAM Approval (Stage 1 to 2) - Dev Brat reviews & forwards
    console.log('\n--- Stage 2: KAM Approval (Dev Brat) ---');
    const kamToken = await getToken('db@orientpaper.com');
    const kamRes = await axios.post(`${BASE_URL}/complaints/${complaintId}/approve`, {
      stage: 'kam',
      remarks: 'Intake details checked and approved by KAM.'
    }, { headers: { Authorization: `Bearer ${kamToken}` } });
    console.log('   [KAM API Response]', kamRes.data);
    await verifyComplaintState(complaintId, 'Under TS Review', 18, 'Neha Verma');

    // 3. TS Review (Stage 2 to 3) - Neha Verma schedules, completes, and forwards
    console.log('\n--- Stage 3: Technical Services Review (Neha Verma) ---');
    const tsToken = await getToken('neha.verma@orientpaper.com');
    await axios.post(`${BASE_URL}/complaints/${complaintId}/ts-review`, {
      actionType: 'visit-schedule',
      visitDate: '2026-07-20 10:00:00',
      remarks: 'Scheduling customer visit.'
    }, { headers: { Authorization: `Bearer ${tsToken}` } });
    await verifyComplaintState(complaintId, 'Visit Scheduled', 19, 'Neha Verma');

    await axios.post(`${BASE_URL}/complaints/${complaintId}/ts-review`, {
      actionType: 'visit-complete',
      findings: 'Observation of moisture lines and tearing.',
      feedback: 'Genuine quality complaint.',
      followUpRequired: false
    }, { headers: { Authorization: `Bearer ${tsToken}` } });
    await verifyComplaintState(complaintId, 'Under TS Review after visit', 18, 'Neha Verma');

    await axios.post(`${BASE_URL}/complaints/${complaintId}/ts-review`, {
      actionType: 'forward',
      remarks: 'TS review complete. Forwarding to QC Engineer.'
    }, { headers: { Authorization: `Bearer ${tsToken}` } });
    await verifyComplaintState(complaintId, 'QC Review Pending', 21, 'Pooja Singh');

    // 4. QC Review (Stage 3 to 4) - Pooja Singh receives sample and forwards
    console.log('\n--- Stage 4: Quality Control Review (Pooja Singh) ---');
    const qcToken = await getToken('pooja.singh@orientpaper.com');
    await axios.post(`${BASE_URL}/complaints/${complaintId}/qc-review`, {
      actionType: 'sample-request',
      remarks: 'Damp ream sample requested.'
    }, { headers: { Authorization: `Bearer ${qcToken}` } });
    await verifyComplaintState(complaintId, 'Waiting Sample', 20, 'Pooja Singh');

    await axios.post(`${BASE_URL}/complaints/${complaintId}/qc-review`, {
      actionType: 'sample-receive',
      sampleCondition: 'Good, packed edge',
      remarks: 'Sample received and inspected.'
    }, { headers: { Authorization: `Bearer ${qcToken}` } });
    await verifyComplaintState(complaintId, 'Under QC Review after sample', 21, 'Pooja Singh');

    await axios.post(`${BASE_URL}/complaints/${complaintId}/qc-review`, {
      actionType: 'forward',
      sampleVerified: true,
      observation: 'Confirmed paper moisture content is 9.5% (standard max is 7.5%). Defect verified.'
    }, { headers: { Authorization: `Bearer ${qcToken}` } });
    await verifyComplaintState(complaintId, 'QC Head Pending', 84, 'Rajesh Gupta');

    // 5. QC Head Review (Stage 4 to 5) - Rajesh Gupta approves
    console.log('\n--- Stage 5: QC Head Review (Rajesh Gupta) ---');
    const qcHeadToken = await getToken('rajesh.gupta@orientpaper.com');
    await axios.post(`${BASE_URL}/complaints/${complaintId}/approve`, {
      stage: 'qc-head',
      remarks: 'QC observations confirmed and approved by QC Head.'
    }, { headers: { Authorization: `Bearer ${qcHeadToken}` } });
    await verifyComplaintState(complaintId, 'CAPA Pending', 22, 'Karan Patel');

    // 6. CAPA Entry (Stage 5 to 6) - Karan Patel enters CAPA details
    console.log('\n--- Stage 6: CAPA Entry (Karan Patel) ---');
    const opsEngToken = await getToken('karan.patel@orientpaper.com');
    await axios.post(`${BASE_URL}/complaints/${complaintId}/capa`, {
      rootCause: 'Improper nozzle calibration in Dryer section 3.',
      correctiveAction: 'Calibrated moisture nozzles and replaced Dryer valve.',
      preventiveAction: 'Bi-weekly calibration checklist implemented.',
      remarks: 'CAPA logged by Karan Patel.'
    }, { headers: { Authorization: `Bearer ${opsEngToken}` } });
    await verifyComplaintState(complaintId, 'Ops Head Approval', 23, 'Vikram Mehta');

    // 7. Operations Head Approval (Stage 6 to 7) - Vikram Mehta approves
    console.log('\n--- Stage 7: Operations Head Approval (Vikram Mehta) ---');
    const opsToken = await getToken('vikram.mehta@orientpaper.com');
    await axios.post(`${BASE_URL}/complaints/${complaintId}/approve`, {
      stage: 'ops-head',
      remarks: 'CAPA approved. Releasing to Marketing.'
    }, { headers: { Authorization: `Bearer ${opsToken}` } });
    await verifyComplaintState(complaintId, 'Marketing Review', 24, 'Rohit Malhotra');

    // 8. Marketing PM Review (Stage 7 to 8) - Rohit Malhotra approves
    console.log('\n--- Stage 8: Marketing PM Review (Rohit Malhotra) ---');
    const pmToken = await getToken('rohit.malhotra@orientpaper.com');
    await axios.post(`${BASE_URL}/complaints/${complaintId}/approve`, {
      stage: 'marketing-pm',
      remarks: 'Forwarding with recommendation for credit note.'
    }, { headers: { Authorization: `Bearer ${pmToken}` } });
    await verifyComplaintState(complaintId, 'Marketing Head Approval', 25, 'Anjali Kapoor');

    // 9. Marketing Head Approval (Stage 8 to 10) - Anjali Kapoor approves <= 1L payout (₹85,000)
    // This should skip MD (Stage 9) and go directly to Finance Head Approval (Stage 10)
    console.log('\n--- Stage 9: Marketing Head Approval (Anjali Kapoor) ---');
    const mktHeadToken = await getToken('anjali.kapoor@orientpaper.com');
    await axios.post(`${BASE_URL}/complaints/${complaintId}/approve`, {
      stage: 'marketing-head',
      settlementAmount: 85000,
      remarks: 'Approved credit note payout of ₹85,000.'
    }, { headers: { Authorization: `Bearer ${mktHeadToken}` } });
    await verifyComplaintState(complaintId, 'Finance Pending', 27, 'Finance Head');

    // 10. Finance Head Approval (Stage 10 to 11) - Finance Head approves
    console.log('\n--- Stage 10: Finance Head Approval (Finance Head) ---');
    const finHeadToken = await getToken('finance.head@orientpaper.com');
    await axios.post(`${BASE_URL}/complaints/${complaintId}/approve`, {
      stage: 'finance-head',
      remarks: 'Commercial details verified and approved.'
    }, { headers: { Authorization: `Bearer ${finHeadToken}` } });
    await verifyComplaintState(complaintId, 'Credit Note Pending', 83, 'Deepak Sinha');

    // 11. Finance Executive CN Sync (Stage 11 to Closed) - Deepak Sinha posts CN details
    console.log('\n--- Stage 11: Finance Credit Note Execution (Deepak Sinha) ---');
    const finToken = await getToken('deepak.sinha@orientpaper.com');
    await axios.post(`${BASE_URL}/complaints/${complaintId}/finance`, {
      creditNoteNumber: 'SAP-CN-2026-0044',
      creditNoteDate: '2026-07-20',
      creditNoteAmount: 85000,
      fiscalYear: '2026',
      companyCode: 'OPM_PAPER',
      remarks: 'Syncing credit note detail to SAP.'
    }, { headers: { Authorization: `Bearer ${finToken}` } });
    await verifyComplaintState(complaintId, 'Closed', 28, null);

    console.log('\n🎉 SUCCESS: The end-to-end 11-stage dynamic workflow pipeline ran flawlessly!');
  } catch (err) {
    console.error('\n❌ TEST FAILURE:', err.message);
    if (err.response) {
      console.error('   Status Code:', err.response.status);
      console.error('   Error Payload:', err.response.data);
    }
  }

  process.exit();
}

runWorkflowTest();
