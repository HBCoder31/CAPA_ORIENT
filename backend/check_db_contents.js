const { pool } = require('./config/db');

async function checkDatabaseContents() {
  console.log('📊 Querying the CCMS database to verify active tables and data...');
  try {
    // 1. Fetch complaints count
    const [[countRow]] = await pool.query('SELECT COUNT(*) as count FROM Complaint_Header');
    console.log(`✅ Connection OK. Total complaints in database: ${countRow.count}`);

    if (countRow.count > 0) {
      // 2. Fetch the latest complaint details, status, assignee, and customer name
      const [complaints] = await pool.query(`
        SELECT 
          c.Complaint_ID, 
          c.Complaint_Number, 
          c.Complaint_Title, 
          c.Total_Complaint_Value,
          c.Expected_Settlement_Amount,
          c.SLA_Due_Date,
          cust.Customer_Name,
          l_status.Lookup_Value as Status,
          dept.Department_Name as Department,
          emp.Employee_Name as Assignee
        FROM Complaint_Header c
        JOIN Customer_Master cust ON c.Customer_ID = cust.Customer_ID
        JOIN Lookup_Master l_status ON c.Complaint_Status_ID = l_status.Lookup_ID
        LEFT JOIN Department_Master dept ON c.Current_Department_ID = dept.Department_ID
        LEFT JOIN Employee_Master emp ON c.Current_Assignee_ID = emp.Employee_ID
        ORDER BY c.Complaint_ID DESC
        LIMIT 1
      `);
      
      const latest = complaints[0];
      console.log('\n🔍 Latest logged complaint records from DB:');
      console.log(`   - Complaint Number : ${latest.Complaint_Number} (ID: ${latest.Complaint_ID})`);
      console.log(`   - Title            : "${latest.Complaint_Title}"`);
      console.log(`   - Customer         : ${latest.Customer_Name}`);
      console.log(`   - Status           : ${latest.Status}`);
      console.log(`   - Current Dept     : ${latest.Department || 'Unassigned'}`);
      console.log(`   - Assignee         : ${latest.Assignee || 'Unassigned'}`);
      console.log(`   - Claim Value      : ₹${parseFloat(latest.Total_Complaint_Value).toLocaleString('en-IN')}`);
      console.log(`   - SLA Due Date     : ${new Date(latest.SLA_Due_Date).toLocaleString('en-IN')}`);

      // 3. Fetch product line items for the latest complaint
      const [lines] = await pool.query(`
        SELECT cli.Invoice_No, cli.Line_Item, pm.Product_Name, im.Product_Code, cli.Defective_Quantity, cli.Complaint_Value
        FROM Complaint_Line_Item cli
        JOIN Invoice_Master im ON cli.Invoice_No = im.Invoice_No AND cli.Line_Item = im.Line_Item
        JOIN Product_Master pm ON im.Product_Code = pm.Product_Code
        WHERE cli.Complaint_ID = ?
      `, [latest.Complaint_ID]);

      console.log('\n📦 Line item details:');
      lines.forEach(item => {
        console.log(`   - Invoice: ${item.Invoice_No} | Product: ${item.Product_Name} | Qty: ${item.Defective_Quantity} | Value: ₹${parseFloat(item.Complaint_Value).toLocaleString('en-IN')}`);
      });

      // 4. Fetch the timeline workflow logs for the latest complaint
      const [logs] = await pool.query(`
        SELECT wl.Action_Date, emp.Employee_Name, l_act.Lookup_Value as Action, wl.Remarks
        FROM Complaint_Workflow_Log wl
        JOIN Employee_Master emp ON wl.Action_By = emp.Employee_ID
        LEFT JOIN Lookup_Master l_act ON wl.Action_Type_ID = l_act.Lookup_ID
        WHERE wl.Complaint_ID = ?
        ORDER BY wl.Created_On ASC
      `, [latest.Complaint_ID]);

      console.log('\n📜 Workflow Audit Logs path:');
      logs.forEach((log, index) => {
        console.log(`   [${index + 1}] ${new Date(log.Action_Date).toLocaleString('en-IN')} | By: ${log.Employee_Name} | Action: ${log.Action}`);
        if (log.Remarks) console.log(`       Comment: "${log.Remarks}"`);
      });
    } else {
      console.log('⚠️ Database is empty. No complaints filed yet.');
    }
  } catch (err) {
    console.error('❌ Database query failed:', err.message);
  } finally {
    process.exit();
  }
}

checkDatabaseContents();
