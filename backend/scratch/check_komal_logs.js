const { pool } = require('../config/db');
async function run() {
  const [rows] = await pool.query(`
    SELECT wl.Workflow_Log_ID, wl.Complaint_ID, e.Employee_Name, wl.Remarks
    FROM Complaint_Workflow_Log wl
    JOIN Employee_Master e ON wl.Action_By = e.Employee_ID
    WHERE e.Employee_Name LIKE '%Komal%'
    ORDER BY wl.Workflow_Log_ID DESC LIMIT 10
  `);
  rows.forEach(r => console.log(r.Workflow_Log_ID, r.Complaint_ID, r.Employee_Name, '\n  ->', r.Remarks, '\n'));
  process.exit();
}
run().catch(console.error);
