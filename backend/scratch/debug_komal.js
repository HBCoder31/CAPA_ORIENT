const { pool } = require('../config/db');
async function run() {
  // Check complaint 117 and 118 KAM approval (Komal Sharma)
  const [rows] = await pool.query(`
    SELECT ch.Complaint_ID, ch.Business_Unit_ID, ch.Customer_ID, ch.Current_Department_ID,
           ch.Current_Assignee_ID, e.Employee_Name as Assignee_Name,
           wl.Remarks
    FROM Complaint_Header ch
    LEFT JOIN Employee_Master e ON ch.Current_Assignee_ID = e.Employee_ID
    LEFT JOIN Complaint_Workflow_Log wl ON wl.Complaint_ID = ch.Complaint_ID
    WHERE ch.Complaint_ID IN (117, 118)
    ORDER BY wl.Workflow_Log_ID ASC
  `);
  rows.forEach(r => console.log(r.Complaint_ID, r.Business_Unit_ID, r.Customer_ID, r.Assignee_Name, '\n  ->', r.Remarks));
  
  // Check what resolveNextStage would return for BU=12 (Chemical) stage 1
  const [wfRows] = await pool.query(`
    SELECT wc.*, dm.Department_Name
    FROM Workflow_Configuration wc
    LEFT JOIN Department_Master dm ON wc.Department_ID = dm.Department_ID
    WHERE wc.Business_Unit_ID = 12 AND wc.Stage_Number = 2
    LIMIT 5
  `);
  console.log('\nNext stage config for Chemical BU stage 2:');
  wfRows.forEach(r => console.log(r));
  
  process.exit();
}
run().catch(console.error);
