# iELEVATE

iELEVATE is the web app for the **ELEVATE Program** of Cebu Technological University – Tuburan Campus (BSIT capstone).
Beneficiaries take a skill check, apply to specialists for the training topics they need, learn through
activities and pre/post-tests, and earn certificates that build their portfolio. Admins follow the program
through reports and an activity log.

Built with React + Vite + Tailwind (frontend), Express (backend) and MySQL.

## Versions

One version per month. Versions 2, 3 and 4 have no saved code.

| Version | Month | What it was | Code |
|---|---|---|---|
| 1 | July 2026 | The first iELEVATE: a peer-to-peer skill-exchange site (profiles, skill matching, exchanges, live chat, blockchain credentials that were never deployed) | tag `v1-july` |
| 2 | August 2026 | Moved into its current folder and reworked | not saved |
| 3 | September 2026 | Learning modules with admin approval, and Python coding exercises that check themselves in the browser | not saved (the `iElevate_V2` repository was created but left empty) |
| 4 | October 2026 | No changes on record | – |
| 5 | November 2026 | Rebuilt as the iELEVATE web app for the ELEVATE Program: skill check, specialists create their own module for each training-design topic (approved by the admin), apply to a specialist, chat inside modules, activities, pre/post-tests, certificates, portfolios, reports | tag `v5-november` |

## Getting started (group members)

You need [XAMPP](https://www.apachefriends.org/) (for MySQL), [Node.js](https://nodejs.org/) (LTS) and
[Git](https://git-scm.com/). The repository is private: ask the owner (`agawDave`) to add your GitHub account as a collaborator first.

1. **Download the code.** In VS Code press Ctrl+Shift+P → **Git: Clone**, paste
   `https://github.com/agawDave/iElevate.git` and choose a folder.
2. **Create the database.** Start **MySQL** in the XAMPP Control Panel, open phpMyAdmin
   (<http://localhost/phpmyadmin>), click **Import**, choose `backend/database/setup_fresh_database.sql`
   and click **Import**. This makes an empty `ielevate_db` with the ELEVATE topics; it contains no accounts.
   (If you already have an `ielevate_db`, delete it first: the import refuses to overwrite one.)
3. **Settings.** Copy `backend/.env.example` to `backend/.env`. With XAMPP's defaults, keep `DB_USER=root`
   and leave `DB_PASSWORD` empty. Replace the two `JWT_..._SECRET` values with any long random text.
   Never upload your `.env`.
4. **Install.** Open a terminal in the project folder and run:
   ```
   cd backend
   npm install
   cd ../frontend
   npm install
   ```
5. **Start it.** Double-click `start-servers.bat` and open <http://localhost:5173>.
6. **Make yourself the admin.** Sign up in the app, then in phpMyAdmin open `ielevate_db` → **SQL** and run
   (with your own email):
   ```sql
   UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
   ```
   Log out and in again. To try the rest, sign up a specialist (who creates and submits a module) and a
   beneficiary (who takes the skill check and applies) in a second browser or a private window.

More detail on every feature: [README-STARTUP.md](README-STARTUP.md).

## Not in this repository

Kept off GitHub on purpose (see `.gitignore`): the `.env` settings files, learners' certificates, profile
photos, uploaded answers and module materials, and installed libraries (`node_modules`).
