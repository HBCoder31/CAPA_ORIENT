const { pool } = require('../config/db');

async function run() {
  const [rows] = await pool.query('SELECT * FROM Customer_Master WHERE Customer_Email = ?', ['yb@itc.in']);
  console.log('Customer Master:', rows);
  
  const [kamRows] = await pool.query('SELECT * FROM KAM_Master');
  console.log('KAM Master:', kamRows);

  const [segmentRows] = await pool.query('SELECT * FROM Customer_KAM_Segment_Assignment WHERE Customer_ID = ?', [rows[0]?.Customer_ID]);
  console.log('Segment Assignments:', segmentRows);

  const [empRows] = await pool.query('SELECT Employee_ID, Employee_Name FROM Employee_Master');
  console.log('Employees:', empRows);

  process.exit(0);
}

run();
