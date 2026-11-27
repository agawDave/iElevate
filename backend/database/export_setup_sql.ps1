# Rebuilds the database files from your local iELEVATE database. Run it after
# you change the database (add a table or column), so the files group members
# use stay complete:
#   powershell -ExecutionPolicy Bypass -File backend\database\export_setup_sql.ps1
#
# It writes:
#   tables\<table>.sql        one file per table: what it holds, and its structure (no rows)
#   data\<table>.sql          the reference data a new copy needs: the ELEVATE
#                             phases, topics and their skills
#   setup_fresh_database.sql  all of the above in one file: the one to import
#
# It never includes accounts or anything people entered.
$ErrorActionPreference = 'Stop'
$backend = Split-Path -Parent $PSScriptRoot
$setupFile = Join-Path $PSScriptRoot 'setup_fresh_database.sql'
$tablesDir = Join-Path $PSScriptRoot 'tables'
$dataDir = Join-Path $PSScriptRoot 'data'
$dump = 'C:\xampp\mysql\bin\mysqldump.exe'
$mysql = 'C:\xampp\mysql\bin\mysql.exe'
if (-not (Test-Path $dump)) { throw "mysqldump not found at $dump (is XAMPP installed in C:\xampp?)" }

# What each table holds, shown at the top of its file and in the setup file.
# A new table needs a line here (the script warns if one is missing).
$about = @{
  career_entries               = "Work and education lines in a beneficiary's career portfolio."
  career_profiles              = "Each beneficiary's career portfolio: objective, other skills, and their resume (built by iELEVATE or uploaded)."
  career_recommendations       = 'Recommendations beneficiaries ask their specialists for, with what the specialist wrote, or that they declined.'
  conversations                = 'Chats between two people: a beneficiary and their specialist about a topic, or the admin and a beneficiary or specialist (module_id empty).'
  elevate_application_declines = 'Specialists who declined a beneficiary for a topic, so the beneficiary goes to the next specialist who fits.'
  elevate_learner_profiles     = "The skill check's questions about the beneficiary: goal, computer experience, phases already done, and background."
  elevate_module_assignments   = 'Each beneficiary''s ELEVATE topics and where they are with each one: suggested, applied, accepted, waiting, with which specialist and why.'
  elevate_skill_assessments    = 'Skill check results for each skill: the self-rating, the check questions, the level found, and the outcome.'
  learning_modules             = 'The ELEVATE topics from the training design: phase, title, description and hours.'
  messages                     = 'The messages in each conversation, with attachments and when they were read.'
  module_activities            = 'Activities a specialist writes for a topic: multiple choice, written tasks and file tasks.'
  module_activity_answers      = "Beneficiaries' answers to the activities, with the specialist's feedback and rubric scores."
  module_certificates          = 'The certificate a specialist uploads when a beneficiary completes a topic.'
  module_connections           = 'Topics a beneficiary has been accepted into (recorded when a specialist accepts them, so they can chat).'
  module_resources             = 'Materials for a topic: the files and links specialists add.'
  module_sessions              = 'Face-to-face sessions for a topic: one-on-one (a specialist and a beneficiary) or open (posted by a specialist for anyone who needs the topic), with when, where, seats and the status.'
  module_session_attendees     = 'Beneficiaries who joined an open face-to-face session, and whether they came.'
  learning_sessions            = 'Online sessions: one each time a beneficiary takes a topic''s pre-test or post-test or answers an activity.'
  module_skills                = 'Which skill each ELEVATE topic teaches (links learning_modules to skills).'
  module_test_attempts         = "Beneficiaries' pre-test and post-test scores, each with a copy of the questions as they were."
  module_test_questions        = 'The pre-test and post-test questions a specialist writes for a topic.'
  module_prerequisites         = 'Which modules a module needs first (a topic waits as "next up" until the beneficiary can do them).'
  notifications                = 'The notification bell: face-to-face session notices for each person (requested, accepted, cancelled, posted, joined), and when they read each one.'
  program_goals                = 'The answers to the pre-assessment''s "What is your main goal in joining ELEVATE?" question, managed by the admin; modules list the goals that need them (learning_modules.goal_tracks), and "Not sure yet" asks about the phase in start_phase (0 = all phases; normal goals leave it empty).'
  program_phases               = 'The ELEVATE phases: number, name and the year each was created (its modules have learning_modules.phase).'
  portfolio_items              = 'What beneficiaries add to their portfolio: projects, awards, photos, licenses, trainings and letters.'
  skill_categories             = 'Groups of skills: the ELEVATE phases.'
  skills                       = 'The skills behind the ELEVATE topics.'
  specialist_modules           = "The module each specialist creates for a topic they teach, and the admin's review (draft, waiting, approved, changes requested)."
  user_activity_log            = 'What people did in iELEVATE, for the admin''s activity log.'
  user_learning_circumstances  = 'How and when each person can learn or teach: online or face to face, available times, device, internet and barangay.'
  user_skills                  = 'Topics a specialist teaches (with their limits and learner levels) and skills a beneficiary is learning.'
  users                        = 'Every account: beneficiaries, specialists and admins, with their profile. Passwords are stored only as hashes.'
}

# The reference data a new copy needs, in the order it's imported.
$reference = [ordered]@{
  skill_categories = @{ about = 'The ELEVATE phases, as skill categories.' }
  skills           = @{ about = 'The skills behind the ELEVATE topics.' }
  learning_modules = @{ about = 'The ELEVATE modules from the training design, with each one''s pre-assessment task and goals.' }
  module_skills    = @{ about = 'Which skill each ELEVATE topic teaches.' }
  module_prerequisites = @{ about = 'Which modules a module needs first.' }
  program_phases       = @{ about = 'The ELEVATE phases, with the year each was created.' }
  program_goals        = @{ about = 'The main goals beneficiaries choose from in the pre-assessment.' }
}

# Database settings from backend\.env (the password stays in this process only).
$settings = @{ DB_HOST = '127.0.0.1'; DB_USER = 'root'; DB_PASSWORD = ''; DB_NAME = 'ielevate_db' }
$envFile = Join-Path $backend '.env'
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object { if ($_ -match '^\s*(DB_HOST|DB_USER|DB_PASSWORD|DB_NAME)\s*=\s*(.*)$') { $settings[$Matches[1]] = $Matches[2].Trim() } }
}
if ($settings.DB_PASSWORD) { $env:MYSQL_PWD = $settings.DB_PASSWORD }
$db = $settings.DB_NAME
$common = @('-h', $settings.DB_HOST, '-u', $settings.DB_USER, '--compact', '--skip-tz-utc', '--default-character-set=utf8mb4')
# Read mysqldump's output as UTF-8, so letters like ñ or curly quotes in the data come through.
[Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)

function Save-Sql($path, $text) {
  $text = ($text -replace "`r`n", "`n").TrimEnd() + "`n"
  [IO.File]::WriteAllText($path, $text, (New-Object Text.UTF8Encoding($false)))
}
# mysqldump's version-specific lines (/*!40101 … */;) and counters aren't needed.
function Format-Dump($lines) {
  (($lines | Where-Object { $_ -notmatch '^/\*!\d+ .*\*/;$' }) -join "`n") -replace ' AUTO_INCREMENT=\d+', ''
}

$names = @(& $mysql -h $settings.DB_HOST -u $settings.DB_USER -N -e 'SHOW TABLES' $db)
if ($LASTEXITCODE -or -not $names.Count) { throw 'Could not read the list of tables. Is MySQL running?' }

# Start the folders fresh, so a table that was removed leaves no file behind.
foreach ($dir in @($tablesDir, $dataDir)) {
  New-Item -ItemType Directory -Force $dir | Out-Null
  Get-ChildItem $dir -Filter '*.sql' | Remove-Item -Force -Confirm:$false
}

$setupTables = New-Object System.Collections.Generic.List[string]
foreach ($name in $names) {
  # CREATE TABLE without DROP, so importing over an existing database stops instead of erasing it.
  $structure = Format-Dump (& $dump @common --no-data --skip-add-drop-table $db $name)
  if ($LASTEXITCODE) { throw "Could not read the structure of $name." }
  $what = $about[$name]
  if (-not $what) { Write-Warning "No description for table $name. Add one to `$about in export_setup_sql.ps1."; $what = '(No description yet.)' }
  Save-Sql (Join-Path $tablesDir "$name.sql") @"
-- Table: $name
-- $what
--
-- One table of the iELEVATE database (ielevate_db), structure only. To set up
-- the database, import ..\setup_fresh_database.sql: it has every table in one file.

$structure
"@
  $setupTables.Add("-- $('-' * 76)`n-- ${name}: $what`n-- $('-' * 76)`n$structure")
}

$setupData = New-Object System.Collections.Generic.List[string]
foreach ($name in $reference.Keys) {
  $options = @('--no-create-info', '--complete-insert', '--skip-extended-insert')
  if ($reference[$name].where) { $options += "--where=$($reference[$name].where)" }
  $rows = Format-Dump (& $dump @common @options $db $name)
  if ($LASTEXITCODE) { throw "Could not export the reference data in $name." }
  $what = $reference[$name].about
  Save-Sql (Join-Path $dataDir "$name.sql") @"
-- Reference data: $name
-- $what
--
-- Starting data every copy of iELEVATE needs. It's already in
-- ..\setup_fresh_database.sql; import tables\$name.sql first if you use this file on its own.

$rows
"@
  $setupData.Add("-- ${name}: $what`n$rows")
}

$header = @"
-- iELEVATE: a fresh, empty database (structure + ELEVATE reference data)
--
-- What it creates: the ielevate_db database with every table, the ELEVATE
-- topics with their skills.
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
-- To read one table at a time, see the tables\ folder (one file per table) and
-- the data\ folder (the reference data). This file is all of them together.
--
-- Made from the project's own database on $(Get-Date -Format 'yyyy-MM-dd') by export_setup_sql.ps1.

CREATE DATABASE IF NOT EXISTS ``ielevate_db`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ``ielevate_db``;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- $('=' * 76)
-- Tables ($($names.Count))
-- $('=' * 76)
"@
$footer = @"
SET FOREIGN_KEY_CHECKS = 1;
-- Done. Next: sign up in the app, then make your account the admin (see README.md).
"@
$dataHeading = "-- $('=' * 76)`n-- Reference data`n-- $('=' * 76)"
Save-Sql $setupFile ($header + "`n`n" + ($setupTables -join "`n`n") + "`n`n" + $dataHeading + "`n`n" + ($setupData -join "`n`n") + "`n`n" + $footer)
"Wrote $($names.Count) table files to tables\, $($reference.Count) data files to data\, and $setupFile ($([math]::Round((Get-Item $setupFile).Length / 1KB)) KB)."
