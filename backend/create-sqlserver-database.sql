-- ============================================================
-- Run this ONCE in SSMS (SQL Server Management Studio)
-- Connect to: localhost\SQLEXPRESS
-- Then click "New Query" and paste this, then click Execute
-- ============================================================

-- Step 1: Create the database
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'digital_menu')
BEGIN
    CREATE DATABASE digital_menu;
    PRINT 'Database digital_menu created.';
END
ELSE
    PRINT 'Database digital_menu already exists.';
GO

-- Step 2: Enable SQL Server Authentication (if using sa login)
-- If you use Windows Authentication (MSSQL_TRUSTED=true), skip steps 2-4

-- Step 3: Enable TCP/IP on port 1433
-- Open "SQL Server Configuration Manager" → SQL Server Network Configuration
-- → Protocols for SQLEXPRESS → Enable TCP/IP → Restart SQL Server service

-- Step 4: Make sure SQL Server Browser service is running
-- Services → SQL Server Browser → Start

-- You're done! The app will auto-create all tables when it starts.
-- Default login: admin@abc.com / admin123
