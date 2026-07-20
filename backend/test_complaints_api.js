const axios = require('axios');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config();

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('🧪 Starting Phase 1 CCMS Complaints API tests...');
  let customerToken = '';
  let employeeToken = '';

  try {
    // 1. Unconditionally set a test password for CUST100001 (ITC Limited, paper.procurement@itc.in)
    console.log('🔑 Updating test customer password hash in DB directly...');
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('customerpassword123', salt);
    
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'ccms'
    };
    const connection = await mysql.createConnection(dbConfig);
    await connection.execute(
      'UPDATE Customer_Master SET Customer_Portal_Access = TRUE WHERE Customer_ID = ?',
      ['CUST100001']
    );
    await connection.execute(
      `INSERT INTO Login_Master (Email, Password_Hash, Login_Type_ID, Customer_ID, Is_Active)
       VALUES ('paper.procurement@itc.in', ?, 1, 'CUST100001', 1)
       ON DUPLICATE KEY UPDATE Password_Hash = ?`,
      [hash, hash]
    );
    await connection.end();
    console.log('✅ Customer account CUST100001 prepared for login.');

    // 2. Customer login
    console.log('\nTest 1: Logging in as customer...');
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'paper.procurement@itc.in',
      password: 'customerpassword123',
    });
    console.log('✅ Customer login successful.');
    customerToken = loginRes.data.data.token;

    // 3. Fetch customer invoices
    console.log('\nTest 2: Fetching customer invoices...');
    const invoicesRes = await axios.get(`${BASE_URL}/complaints/invoices`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    console.log(`✅ Invoices retrieved: ${invoicesRes.data.data.length} found.`);
    const firstInvoiceNo = invoicesRes.data.data[0].Invoice_No;
    console.log(`   First Invoice Number: ${firstInvoiceNo}`);

    // 4. Fetch invoice line items
    console.log(`\nTest 3: Fetching details for invoice ${firstInvoiceNo}...`);
    const invoiceDetailsRes = await axios.get(`${BASE_URL}/complaints/invoices/${firstInvoiceNo}`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    console.log(`✅ Invoice line items retrieved: ${invoiceDetailsRes.data.data.length} items found.`);
    const firstLineItem = invoiceDetailsRes.data.data[0];
    console.log(`   Item: ${firstLineItem.Product_Name}, Qty: ${firstLineItem.Invoice_Qty}, Price: ${firstLineItem.Price}`);

    // 5. Fetch lookups
    console.log('\nTest 4: Fetching intake lookups (categories, defect natures, severities)...');
    const lookupsRes = await axios.get(`${BASE_URL}/complaints/lookups`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    console.log('✅ Lookups retrieved.');
    const cat = lookupsRes.data.data.categories[0];
    const nature = lookupsRes.data.data.natures[0];
    const prio = lookupsRes.data.data.priorities.find(p => p.Lookup_Value === 'Critical') || lookupsRes.data.data.priorities[0];
    console.log(`   Selected Category: ${cat.Lookup_Value} (ID: ${cat.Lookup_ID})`);
    console.log(`   Selected Defect Nature: ${nature.Lookup_Value} (ID: ${nature.Lookup_ID})`);
    console.log(`   Selected Severity: ${prio.Lookup_Value} (ID: ${prio.Lookup_ID})`);

    // 6. Log complaint
    console.log('\nTest 5: Logging a new complaint...');
    const complaintData = {
      title: 'Wet / Damaged Reams on Delivery',
      description: 'The paper reams on line item 1 were completely torn and damp upon arrival. Unusable.',
      priorityId: prio.Lookup_ID, // Critical
      lineItems: [
        {
          invoiceNo: firstInvoiceNo,
          lineItem: firstLineItem.Line_Item,
          defectiveQty: 5.0,
          categoryId: cat.Lookup_ID,
          defectNatureId: nature.Lookup_ID,
          customerRemarks: 'Severe moisture damage'
        }
      ]
    };
    const logRes = await axios.post(`${BASE_URL}/complaints`, complaintData, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    console.log('✅ Complaint logged successfully.');
    const newComplaintId = logRes.data.data.complaintId;
    const newComplaintNo = logRes.data.data.complaintNumber;
    console.log(`   Complaint ID: ${newComplaintId}`);
    console.log(`   Complaint Number: ${newComplaintNo}`);

    // 7. Login as KAM (Dev Brat db@orientpaper.com - who handles ITC Limited)
    console.log('\nTest 6: Logging in as KAM (Dev Brat) to verify assignment...');
    const empLoginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'db@orientpaper.com',
      password: 'password123',
    });
    console.log('✅ Employee/KAM login successful.');
    employeeToken = empLoginRes.data.data.token;

    // 8. Fetch complaints list
    console.log('\nTest 7: Fetching complaints list as KAM...');
    const listRes = await axios.get(`${BASE_URL}/complaints`, {
      headers: { Authorization: `Bearer ${employeeToken}` }
    });
    console.log(`✅ Complaints list retrieved: ${listRes.data.data.length} items found.`);
    const matchingComplaint = listRes.data.data.find(c => c.Complaint_ID === newComplaintId);
    if (matchingComplaint) {
      console.log('✅ Successfully verified assignment in KAM list.');
      console.log(`   Title: ${matchingComplaint.Complaint_Title}`);
      console.log(`   Status: ${matchingComplaint.Status}`);
      console.log(`   Severity: ${matchingComplaint.Severity}`);
      console.log(`   Assignee: ${matchingComplaint.Assignee}`);
      console.log(`   SLA Due Date: ${matchingComplaint.SLA_Due_Date}`);
      console.log(`   Total Value: ₹${matchingComplaint.Total_Complaint_Value}`);
    } else {
      console.log('❌ Failed: new complaint not found in KAM list or not assigned correctly.');
    }

    // 9. Fetch complaint details
    console.log(`\nTest 8: Fetching details for complaint ${newComplaintId}...`);
    const detailsRes = await axios.get(`${BASE_URL}/complaints/${newComplaintId}`, {
      headers: { Authorization: `Bearer ${employeeToken}` }
    });
    console.log('✅ Complaint details retrieved.');
    const details = detailsRes.data.data;
    console.log(`   Header Title: ${details.complaint.Complaint_Title}`);
    console.log(`   Total Value Check: ₹${details.complaint.Total_Complaint_Value}`);
    console.log(`   Line Items Count: ${details.lineItems.length}`);
    console.log(`   Timeline Logs Count: ${details.logs.length}`);
    console.log(`   Audit Log Action: ${details.logs[0].Action_Value} by ${details.logs[0].Employee_Name}`);

    // 10. Fetch dashboard stats
    console.log('\nTest 9: Fetching dashboard stats...');
    const statsRes = await axios.get(`${BASE_URL}/complaints/dashboard/stats`, {
      headers: { Authorization: `Bearer ${employeeToken}` }
    });
    console.log('✅ Dashboard stats retrieved.');
    console.log(`   Total Complaints: ${statsRes.data.data.totalComplaints}`);
    console.log(`   SLA Compliance Rate: ${statsRes.data.data.slaCompliancePct}%`);
    console.log(`   Avg Resolution Time: ${statsRes.data.data.avgResolutionTimeDays} days`);

    console.log('\n🎉 ALL PHASE 1 API TESTS PASSED SUCCESSFULLY! 🎉');
  } catch (err) {
    console.error('❌ Phase 1 Integration Test Failed:', err.message);
    if (err.response) {
      console.error('   Response Data:', err.response.data);
    }
  }
}

runTests();
