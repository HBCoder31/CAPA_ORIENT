const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { exec } = require('child_process');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
};

const SQL_FILE_PATH = path.join(__dirname, '..', '..', 'database', 'ccms.sql');
const MIGRATION_FILE_PATH = path.join(__dirname, '..', '..', 'database', 'migrations', '001_add_customer_password_hash.sql');
const MIGRATION_2_FILE_PATH = path.join(__dirname, '..', '..', 'database', 'migrations', '002_add_complaint_escalation_column.sql');
const MIGRATION_3_FILE_PATH = path.join(__dirname, '..', '..', 'database', 'migrations', '003_customer_kam_segment_assignment.sql');
const MIGRATION_4_FILE_PATH = path.join(__dirname, '..', '..', 'database', 'migrations', '004_workflow_stages_finance_split.sql');
const MIGRATION_5_FILE_PATH = path.join(__dirname, '..', '..', 'database', 'migrations', '005_create_login_tables.sql');

async function run() {
  console.log('🔄 Starting Database Initialization...');
  let connection;

  try {
    // 1. Connect to MySQL without specifying a database
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to MySQL server.');

    // 2. Check if database exists
    const [dbResult] = await connection.query(`SHOW DATABASES LIKE '${process.env.DB_NAME || 'ccms'}'`);
    const dbExists = dbResult.length > 0;

    if (!dbExists) {
      console.log(`📡 Database "${process.env.DB_NAME || 'ccms'}" does not exist. Creating and importing...`);
      
      // Try to import using mysql CLI if available
      const mysqlPath = '"C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe"';
      const cmd = `cmd.exe /c ${mysqlPath} -u ${dbConfig.user} -p"${dbConfig.password}" < "${SQL_FILE_PATH}"`;
      
      console.log(`Running import command: ${cmd}`);
      
      await new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
          if (error) {
            console.warn('⚠️ mysql CLI import failed, falling back to JS parsing...', stderr);
            reject(error);
          } else {
            console.log('✅ Schema imported successfully via mysql CLI.');
            resolve();
          }
        });
      }).catch(async (err) => {
        // Fallback: manual JS execution
        console.log('🔄 Running manual query parsing fallback...');
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'ccms'}\``);
        await connection.query(`USE \`${process.env.DB_NAME || 'ccms'}\``);
        
        const sqlContent = fs.readFileSync(SQL_FILE_PATH, 'utf8');
        const statements = sqlContent
          .split(/;\s*$/m)
          .map(stmt => stmt.trim())
          .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

        for (let i = 0; i < statements.length; i++) {
          try {
            await connection.query(statements[i]);
          } catch (stmtErr) {
            if (!statements[i].includes('CREATE DATABASE')) {
              console.error(`Error executing statement index ${i}:`, stmtErr.message);
            }
          }
        }
      });
    } else {
      console.log(`✅ Database "${process.env.DB_NAME || 'ccms'}" already exists.`);
    }

    // Connect directly to target database now
    await connection.changeUser({ database: process.env.DB_NAME || 'ccms' });

    // 3. Apply migration: Password_Hash in Customer_Master (if missing)
    const [columns] = await connection.query(`SHOW COLUMNS FROM Customer_Master LIKE 'Password_Hash'`);
    if (columns.length === 0) {
      console.log('⚙️ Applying Customer_Master Password_Hash migration...');
      const migrationSql = fs.readFileSync(MIGRATION_FILE_PATH, 'utf8');
      await connection.query(migrationSql);
      console.log('✅ Applied migration successfully.');
    } else {
      console.log('✅ Customer_Master Password_Hash column already exists.');
    }

    // 3b. Apply migration: Is_Escalated in Complaint_Header (if missing)
    const [headerColumns] = await connection.query(`SHOW COLUMNS FROM Complaint_Header LIKE 'Is_Escalated'`);
    if (headerColumns.length === 0) {
      console.log('⚙️ Applying Complaint_Header Is_Escalated migration...');
      const migrationSql = fs.readFileSync(MIGRATION_2_FILE_PATH, 'utf8');
      await connection.query(migrationSql);
      console.log('✅ Applied migration 002 successfully.');
    } else {
      console.log('✅ Complaint_Header Is_Escalated column already exists.');
    }

    // 3c. Apply migration: Customer_KAM_Segment_Assignment table (if missing)
    const [tables] = await connection.query(`SHOW TABLES LIKE 'Customer_KAM_Segment_Assignment'`);
    if (tables.length === 0) {
      console.log('⚙️ Applying Customer_KAM_Segment_Assignment table migration...');
      const migrationSql = fs.readFileSync(MIGRATION_3_FILE_PATH, 'utf8');
      const statements = migrationSql
        .split(/;\s*$/m)
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      for (const statement of statements) {
        await connection.query(statement);
      }
      console.log('✅ Applied migration 003 successfully.');
    } else {
      console.log('✅ Customer_KAM_Segment_Assignment table already exists.');
    }

    // 3d. Apply migration: Workflow Configuration & Finance Split lookup status check
    const [wfStages] = await connection.query(`SELECT COUNT(*) as count FROM Workflow_Configuration`);
    if (wfStages[0].count !== 22) {
      console.log('⚙️ Applying Workflow Overhaul & Finance Split lookup migration...');
      const migrationSql = fs.readFileSync(MIGRATION_4_FILE_PATH, 'utf8');
      const statements = migrationSql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);

      for (const statement of statements) {
        await connection.query(statement);
      }
      console.log('✅ Applied migration 004 successfully.');
    } else {
      console.log('✅ Workflow Overhaul & Finance Split statuses already seeded.');
    }

    // 3e. Apply: Add Reopen_Limit_Days column to Customer_Master (if missing)
    const [custCols] = await connection.query(`SHOW COLUMNS FROM Customer_Master LIKE 'Reopen_Limit_Days'`);
    if (custCols.length === 0) {
      console.log('⚙️ Adding Reopen_Limit_Days column to Customer_Master...');
      await connection.query('ALTER TABLE Customer_Master ADD COLUMN Reopen_Limit_Days INT DEFAULT NULL');
      console.log('✅ Column added successfully.');
    } else {
      console.log('✅ Customer_Master Reopen_Limit_Days column already exists.');
    }

    // 3f. Seed REOPEN_LIMIT_DAYS if missing
    const [configs] = await connection.query(`SELECT Configuration_ID FROM System_Configuration WHERE Configuration_Key = 'REOPEN_LIMIT_DAYS'`);
    if (configs.length === 0) {
      console.log('⚙️ Seeding REOPEN_LIMIT_DAYS configuration...');
      await connection.query(`
        INSERT INTO System_Configuration (Configuration_ID, Configuration_Key, Configuration_Value, Data_Type, Remarks, Is_Active)
        VALUES (9, 'REOPEN_LIMIT_DAYS', '7', 'Integer', 'Default window (days) within which closed complaints can be reopened', 1)
      `);
      console.log('✅ Seeding complete.');
    } else {
      console.log('✅ REOPEN_LIMIT_DAYS configuration already seeded.');
    }

    // 3g. Seed MAX_IMAGE_COUNT if missing
    const [configsCount] = await connection.query(`SELECT Configuration_ID FROM System_Configuration WHERE Configuration_Key = 'MAX_IMAGE_COUNT'`);
    if (configsCount.length === 0) {
      console.log('⚙️ Seeding MAX_IMAGE_COUNT configuration...');
      await connection.query(`
        INSERT INTO System_Configuration (Configuration_ID, Configuration_Key, Configuration_Value, Data_Type, Remarks, Is_Active)
        VALUES (10, 'MAX_IMAGE_COUNT', '5', 'Integer', 'Maximum number of images allowed for upload per complaint', 1)
      `);
      console.log('✅ Seeding complete.');
    } else {
      console.log('✅ MAX_IMAGE_COUNT configuration already seeded.');
    }

    // 3h. Apply migration: Centralized Login Tables (if missing)
    const [loginTables] = await connection.query(`SHOW TABLES LIKE 'Login_Master'`);
    if (loginTables.length === 0) {
      console.log('⚙️ Applying central login table migrations...');
      const migrationSql = fs.readFileSync(MIGRATION_5_FILE_PATH, 'utf8');
      const statements = migrationSql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);

      for (const statement of statements) {
        await connection.query(statement);
      }
      console.log('✅ Applied migration 005 successfully.');
    } else {
      console.log('✅ Login_Master table already exists.');
    }

    // 4. Update employee passwords to default hash for testing inside Login_Master (unconditionally)
    console.log('🔑 Seeding default employee passwords in Login_Master ("password123")...');
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('password123', salt);

    // Seed all active employees into Login_Master
    const [empRows] = await connection.query(`
      SELECT e.Employee_ID, e.Official_Email, r.Role_Name 
      FROM Employee_Master e
      JOIN Role_Master r ON e.Role_ID = r.Role_ID
      WHERE e.Is_Active = TRUE
    `);
    
    let seededCount = 0;
    for (const emp of empRows) {
      if (emp.Official_Email) {
        const typeId = emp.Role_Name === 'Administrator' ? 4 : 2;
        await connection.query(`
          INSERT INTO Login_Master (Email, Password_Hash, Login_Type_ID, Employee_ID, Is_Active)
          VALUES (?, ?, ?, ?, 1)
          ON DUPLICATE KEY UPDATE Password_Hash = ?
        `, [emp.Official_Email, hash, typeId, emp.Employee_ID, hash]);
        seededCount++;
      }
    }
    console.log(`✅ Seeded ${seededCount} employees into Login_Master with default password "password123".`);
    console.log('🎉 Database Initialization Complete!');
  } catch (err) {
    console.error('❌ Database Initialization Failed:', err);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

run();
