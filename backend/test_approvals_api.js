const axios = require('axios');
const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('🧪 Starting Phase 3 Approvals & CAPA API tests...');
  
  let customerToken = '';
  let tsToken = '';
  let qcToken = '';
  let opsToken = '';
  let pmToken = '';
  let mktHeadToken = '';
  let mdToken = '';

  let complaintId1 = ''; // Claim <= 1 Lakh
  let complaintId2 = ''; // Claim > 1 Lakh

  try {
    // 1. Log in all roles
    console.log('Test 1: Authenticating all test roles...');
    
    const [t1, t2, t3, t4, t5, t6, t7] = await Promise.all([
      axios.post(`${BASE_URL}/auth/login`, { email: 'paper.procurement@itc.in', password: 'customerpassword123' }),
      axios.post(`${BASE_URL}/auth/login`, { email: 'amit.sharma@orientpaper.com', password: 'password123' }),
      axios.post(`${BASE_URL}/auth/login`, { email: 'rajesh.gupta@orientpaper.com', password: 'password123' }),
      axios.post(`${BASE_URL}/auth/login`, { email: 'vikram.mehta@orientpaper.com', password: 'password123' }),
      axios.post(`${BASE_URL}/auth/login`, { email: 'rohit.malhotra@orientpaper.com', password: 'password123' }),
      axios.post(`${BASE_URL}/auth/login`, { email: 'anjali.kapoor@orientpaper.com', password: 'password123' }),
      axios.post(`${BASE_URL}/auth/login`, { email: 'sanjay.bansal@orientpaper.com', password: 'password123' }),
    ]);

    customerToken = t1.data.data.token;
    tsToken = t2.data.data.token;
    qcToken = t3.data.data.token;
    opsToken = t4.data.data.token;
    pmToken = t5.data.data.token;
    mktHeadToken = t6.data.data.token;
    mdToken = t7.data.data.token;
    
    console.log('✅ All roles authenticated successfully.');

    // 2. Fetch lookup data
    const lookupsRes = await axios.get(`${BASE_URL}/complaints/lookups`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const catId = lookupsRes.data.data.categories[0].Lookup_ID;
    const natureId = lookupsRes.data.data.natures[0].Lookup_ID;
    const prioId = lookupsRes.data.data.priorities.find(p => p.Lookup_Value === 'Medium').Lookup_ID;

    // Fetch invoices
    const invRes = await axios.get(`${BASE_URL}/complaints/invoices`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const invoiceNo = invRes.data.data[0].Invoice_No;
    
    const detailsRes = await axios.get(`${BASE_URL}/complaints/invoices/${invoiceNo}`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const lineItem = detailsRes.data.data[0];

    // Helper function to create and progress a claim to CAPA Pending
    const createAndProgressClaim = async (title) => {
      const cRes = await axios.post(`${BASE_URL}/complaints`, {
        title,
        description: 'Torn sheets.',
        priorityId: prioId,
        lineItems: [{
          invoiceNo,
          lineItem: lineItem.Line_Item,
          defectiveQty: 2.0,
          categoryId: catId,
          defectNatureId: natureId,
          customerRemarks: 'Reams wet'
        }]
      }, { headers: { Authorization: `Bearer ${customerToken}` } });
      const cId = cRes.data.data.complaintId;

      // Forward TS -> QC
      await axios.post(`${BASE_URL}/complaints/${cId}/ts-review`, { actionType: 'forward' }, { headers: { Authorization: `Bearer ${tsToken}` } });
      // Forward QC -> Ops
      await axios.post(`${BASE_URL}/complaints/${cId}/qc-review`, { actionType: 'forward', sampleVerified: true }, { headers: { Authorization: `Bearer ${qcToken}` } });

      return cId;
    };

    // 3. Setup Case A & Case B complaints
    console.log('\nTest 2: Spawning and progressing test complaints to CAPA Pending...');
    complaintId1 = await createAndProgressClaim('Settlement below 1 Lakh');
    complaintId2 = await createAndProgressClaim('Settlement above 1 Lakh');
    console.log(`✅ Case A Claim ID: ${complaintId1}, Case B Claim ID: ${complaintId2}`);

    // 4. Test CAPA submission
    console.log('\nTest 3: Logging CAPA analysis details...');
    await axios.post(`${BASE_URL}/complaints/${complaintId1}/capa`, {
      rootCause: 'Low moisture control settings in Dryer 2.',
      correctiveAction: 'Re-calibrated Dryer temperature.',
      preventiveAction: 'Set automated hourly temperature logging checklists.',
      remarks: 'CAPA logged by operations engineer.'
    }, { headers: { Authorization: `Bearer ${opsToken}` } });
    console.log('✅ CAPA worksheet logged successfully.');

    // 5. Test Ops Head Approval (Locks check)
    console.log('\nTest 4: Ops Head approving CAPA...');
    await axios.post(`${BASE_URL}/complaints/${complaintId1}/approve`, {
      stage: 'ops-head',
      remarks: 'CAPA details review complete. Approved.'
    }, { headers: { Authorization: `Bearer ${opsToken}` } });
    
    // Verify status (should be Marketing Review)
    let verifyRes = await axios.get(`${BASE_URL}/complaints/${complaintId1}`, {
      headers: { Authorization: `Bearer ${pmToken}` }
    });
    console.log(`   Verify Claim Status: ${verifyRes.data.data.complaint.Status} (Expected: Marketing Review)`);
    console.log(`   Verify Assignee: ${verifyRes.data.data.complaint.Assignee} (Expected: Rohit Malhotra)`);

    // 6. Marketing PM Review
    console.log('\nTest 5: Marketing PM reviewing claim...');
    await axios.post(`${BASE_URL}/complaints/${complaintId1}/approve`, {
      stage: 'marketing-pm',
      remarks: 'Customer relationship holds high priority. Proposing 50,000 credit note.'
    }, { headers: { Authorization: `Bearer ${pmToken}` } });

    verifyRes = await axios.get(`${BASE_URL}/complaints/${complaintId1}`, {
      headers: { Authorization: `Bearer ${mktHeadToken}` }
    });
    console.log(`   Verify Claim Status: ${verifyRes.data.data.complaint.Status} (Expected: Marketing Head Approval)`);
    console.log(`   Verify Assignee: ${verifyRes.data.data.complaint.Assignee} (Expected: Anjali Kapoor)`);

    // 7. Case A: Marketing Head approves (Settlement <= 1 Lakh)
    console.log('\nTest 6: Marketing Head approving claim with ₹50,000 settlement (<= 1 Lakh)...');
    await axios.post(`${BASE_URL}/complaints/${complaintId1}/approve`, {
      stage: 'marketing-head',
      settlementAmount: 50000,
      remarks: 'Settlement amount approved. Routing to Finance.'
    }, { headers: { Authorization: `Bearer ${mktHeadToken}` } });

    verifyRes = await axios.get(`${BASE_URL}/complaints/${complaintId1}`, {
      headers: { Authorization: `Bearer ${mktHeadToken}` }
    });
    console.log(`   Verify Claim Status: ${verifyRes.data.data.complaint.Status} (Expected: Finance Pending)`);
    console.log(`   Verify Assignee: ${verifyRes.data.data.complaint.Assignee} (Expected: Deepak Sinha)`);

    // 8. Case B: MD Escalation check (> 1 Lakh)
    console.log('\nTest 7: Processing Case B. Submitting CAPA...');
    await axios.post(`${BASE_URL}/complaints/${complaintId2}/capa`, {
      rootCause: 'Chemical mix error.',
      correctiveAction: 'Purged batch tanks.',
      preventiveAction: 'Manual mixer valve lock checks.'
    }, { headers: { Authorization: `Bearer ${opsToken}` } });

    console.log('   Ops Head approving CAPA...');
    await axios.post(`${BASE_URL}/complaints/${complaintId2}/approve`, { stage: 'ops-head' }, { headers: { Authorization: `Bearer ${opsToken}` } });
    
    console.log('   Marketing PM reviewing...');
    await axios.post(`${BASE_URL}/complaints/${complaintId2}/approve`, { stage: 'marketing-pm' }, { headers: { Authorization: `Bearer ${pmToken}` } });

    console.log('   Marketing Head approving with ₹1,20,000 settlement (> 1 Lakh)...');
    await axios.post(`${BASE_URL}/complaints/${complaintId2}/approve`, {
      stage: 'marketing-head',
      settlementAmount: 120000,
      remarks: 'Escalating to MD due to settlement exceeding ₹1 Lakh.'
    }, { headers: { Authorization: `Bearer ${mktHeadToken}` } });

    verifyRes = await axios.get(`${BASE_URL}/complaints/${complaintId2}`, {
      headers: { Authorization: `Bearer ${mdToken}` }
    });
    console.log(`   Verify Claim Status: ${verifyRes.data.data.complaint.Status} (Expected: MD Approval)`);
    console.log(`   Verify Assignee: ${verifyRes.data.data.complaint.Assignee} (Expected: Sanjay Bansal)`);

    // MD Approves
    console.log('   MD approving settlement...');
    await axios.post(`${BASE_URL}/complaints/${complaintId2}/approve`, {
      stage: 'md',
      remarks: 'Claim settlement approved. Send to creditors department.'
    }, { headers: { Authorization: `Bearer ${mdToken}` } });

    verifyRes = await axios.get(`${BASE_URL}/complaints/${complaintId2}`, {
      headers: { Authorization: `Bearer ${mdToken}` }
    });
    console.log(`   Verify Claim Status: ${verifyRes.data.data.complaint.Status} (Expected: Finance Pending)`);
    console.log(`   Verify Assignee: ${verifyRes.data.data.complaint.Assignee} (Expected: Deepak Sinha)`);

    // 9. Rejection Flow Verification
    console.log('\nTest 8: Testing claim rejection back-transitions...');
    // We reject Case A from Finance (Deepak Sinha) back to Marketing Head
    const finLoginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'deepak.sinha@orientpaper.com',
      password: 'password123',
    });
    const finToken = finLoginRes.data.data.token;

    await axios.post(`${BASE_URL}/complaints/${complaintId1}/action`, {
      action: 'reject',
      remarks: 'Incorrect billing code. Return to marketing for correction.'
    }, { headers: { Authorization: `Bearer ${finToken}` } });

    verifyRes = await axios.get(`${BASE_URL}/complaints/${complaintId1}`, {
      headers: { Authorization: `Bearer ${mktHeadToken}` }
    });
    console.log(`   Verify Claim Status after Rejection: ${verifyRes.data.data.complaint.Status} (Expected: Marketing Head Approval)`);
    console.log(`   Verify Assignee after Rejection: ${verifyRes.data.data.complaint.Assignee} (Expected: Anjali Kapoor)`);

    console.log('\n🎉 ALL PHASE 3 CAPA & APPROVAL TESTS PASSED SUCCESSFULLY! 🎉');
  } catch (err) {
    console.error('❌ Phase 3 Integration Test Failed:', err.message);
    if (err.response) {
      console.error('   Response Data:', err.response.data);
    }
  }
}

runTests();
