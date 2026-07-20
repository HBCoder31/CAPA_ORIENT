const { pool } = require('../config/db');

async function run() {
  console.log('Cleaning up yb@itc.in customer data with disabled foreign keys...');
  const connection = await pool.getConnection();
  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    
    const [complaints] = await connection.query('SELECT Complaint_ID FROM complaint_header WHERE Customer_ID = ?', ['CUST100006']);
    const ids = complaints.map(c => c.Complaint_ID);
    
    if (ids.length > 0) {
      console.log('Deleting referencing rows for complaint IDs:', ids);
      await connection.query('DELETE FROM capa_analysis WHERE Complaint_ID IN (?)', [ids]);
      await connection.query('DELETE FROM technical_service_details WHERE Complaint_ID IN (?)', [ids]);
      await connection.query('DELETE FROM quality_control_details WHERE Complaint_ID IN (?)', [ids]);
      await connection.query('DELETE FROM sample_tracking WHERE Complaint_ID IN (?)', [ids]);
      await connection.query('DELETE FROM settlement_details WHERE Complaint_ID IN (?)', [ids]);
      await connection.query('DELETE FROM visit_details WHERE Complaint_ID IN (?)', [ids]);
      await connection.query('DELETE FROM visit_members WHERE Complaint_ID IN (?)', [ids]);
      await connection.query('DELETE FROM credit_note WHERE Complaint_ID IN (?)', [ids]);
      await connection.query('DELETE FROM attachment_master WHERE Complaint_ID IN (?)', [ids]);
      await connection.query('DELETE FROM complaint_workflow_log WHERE Complaint_ID IN (?)', [ids]);
      await connection.query('DELETE FROM complaint_line_item WHERE Complaint_ID IN (?)', [ids]);
    }
    
    await connection.query('DELETE FROM complaint_line_item WHERE Invoice_No = ?', ['INV900010']);
    await connection.query('DELETE FROM complaint_header WHERE Customer_ID = ?', ['CUST100006']);
    await connection.query('DELETE FROM login_master WHERE Email IN (?, ?)', ['yb@itc.in', 'db@orientpaper.com']);
    await connection.query('DELETE FROM customer_kam_segment_assignment WHERE Customer_ID = ?', ['CUST100006']);
    await connection.query('DELETE FROM invoice_master WHERE Customer_ID = ?', ['CUST100006']);
    await connection.query('DELETE FROM customer_master WHERE Customer_Email = ?', ['yb@itc.in']);
    await connection.query('DELETE FROM kam_master WHERE Employee_ID = ?', [100020]);
    await connection.query('DELETE FROM employee_master WHERE Official_Email = ?', ['db@orientpaper.com']);
    
    console.log('Cleanup complete!');
  } catch (err) {
    console.error('Error during cleanup:', err);
  } finally {
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    connection.release();
  }
  process.exit(0);
}

run();
