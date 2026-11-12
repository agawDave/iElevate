# Rebuilds setup_fresh_database.sql from your local iELEVATE database.
# Run it after you change the database (add a table or column), so the setup
# file that group members import stays complete:
#   powershell -ExecutionPolicy Bypass -File backend\database\export_setup_sql.ps1
#
# It writes every table's structure (no rows), plus only the reference data a
# new copy needs: the ELEVATE topics, skills and official materials. It never
# includes accounts or anything people entered.
$ErrorActionPreference = 'Stop'
$backend = Split-Path -Parent $PSScriptRoot
$out = Join-Path $PSScriptRoot 'setup_fresh_database.sql'
$dump = 'C:\xampp\mysql\bin\mysqldump.exe'
if (-not (Test-Path $dump)) { throw "mysqldump not found at $dump (is XAMPP installed in C:\xampp?)" }

# Database settings from backend\.env (the password stays in this process only).
$settings = @{ DB_HOST = '127.0.0.1'; DB_USER = 'root'; DB_PASSWORD = ''; DB_NAME = 'ielevate_db' }
$envFile = Join-Path $backend '.env'
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object { if ($_ -match '^\s*(DB_HOST|DB_USER|DB_PASSWORD|DB_NAME)\s*=\s*(.*)$') { $settings[$Matches[1]] = $Matches[2].Trim() } }
}
if ($settings.DB_PASSWORD) { $env:MYSQL_PWD = $settings.DB_PASSWORD }
$db = $settings.DB_NAME
$common = @('-h', $settings.DB_HOST, '-u', $settings.DB_USER, '--compact', '--skip-tz-utc')

# Structure: CREATE TABLE without DROP, so importing over an existing database stops instead of erasing it.
$structure = (& $dump @common --no-data --skip-add-drop-table $db) -join "`n"
if ($LASTEXITCODE) { throw 'Could not read the database structure. Is MySQL running?' }
$structure = $structure -replace ' AUTO_INCREMENT=\d+', ''
# Reference data only. Official materials are the ones no person uploaded.
$reference = (& $dump @common --no-create-info --complete-insert $db skill_categories skills learning_modules module_skills module_topics) -join "`n"
$materials = (& $dump @common --no-create-info --complete-insert '--where=uploaded_by IS NULL' $db module_resources) -join "`n"

$header = @"
-- iELEVATE: a fresh, empty database (structure + ELEVATE reference data)
--
-- What it creates: the ielevate_db database with every table, the 16 ELEVATE
-- topics with their skills, and the official program-document entries.
-- No accounts, no learners, no personal data.
--
-- How to run (XAMPP): start MySQL, open phpMyAdmin (http://localhost/phpmyadmin),
-- choose Import, pick this file and click Import. Or in a terminal:
--   C:\xampp\mysql\bin\mysql.exe -u root < backend\database\setup_fresh_database.sql
--
-- Safe on an existing copy: if ielevate_db already has these tables, the import
-- stops at the first table and changes nothing. To start over, delete the
-- ielevate_db database in phpMyAdmin first.
--
-- Made from the project's own database on $(Get-Date -Format 'yyyy-MM-dd') by export_setup_sql.ps1.

CREATE DATABASE IF NOT EXISTS ``ielevate_db`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ``ielevate_db``;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------- tables
"@
$footer = @"

SET FOREIGN_KEY_CHECKS = 1;
-- Done. Next: sign up in the app, then make your account the admin (see README.md).
"@
$text = $header + "`n" + $structure + "`n`n-- ------------------------------------------------- reference data`n" + $reference + "`n" + $materials + "`n" + $footer
[IO.File]::WriteAllText($out, ($text -replace "`r`n", "`n"), (New-Object Text.UTF8Encoding($false)))
$tables = ([regex]::Matches($text, 'CREATE TABLE ')).Count
"Wrote $out ($tables tables, $([math]::Round((Get-Item $out).Length / 1KB)) KB)."
