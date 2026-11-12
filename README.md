# iElevate

The web app for the **ELEVATE Program** of Cebu Technological University – Tuburan Campus (BSIT capstone).
Beneficiaries take a skill check, apply to specialists for the training topics they need, learn through
activities and pre/post-tests, and earn certificates that build their portfolio. Admins follow the program
through reports and an activity log.

Built with React + Vite + Tailwind (frontend), Express (backend) and MySQL.

## Versions

One version per month. Versions 2, 3 and 4 have no saved code.

| Version | Month | What it was | Code |
|---|---|---|---|
| 1 | July 2026 | The first iElevate: a peer-to-peer skill-exchange site (profiles, skill matching, exchanges, live chat, blockchain credentials that were never deployed) | tag `v1-july` |
| 2 | August 2026 | Moved into its current folder and reworked | not saved |
| 3 | September 2026 | Learning modules with admin approval, and Python coding exercises that check themselves in the browser | not saved (the `iElevate_V2` repository was created but left empty) |
| 4 | October 2026 | No changes on record | – |
| 5 | November 2026 | Rebuilt as the ELEVATE learning web app: skill check, specialists create their own module for each training-design topic (approved by the admin), apply to a specialist, chat inside modules, activities, pre/post-tests, certificates, portfolios, reports | tag `v5-november` |

## Running it

See [README-STARTUP.md](README-STARTUP.md). In short: start MySQL in XAMPP, copy `backend/.env.example`
to `backend/.env` and fill it in, run `npm install` in `backend` and `frontend`, then double-click
`start-servers.bat`.

## Not in this repository

Kept off GitHub on purpose (see `.gitignore`): the `.env` settings files, learners' certificates, profile
photos, uploaded answers and module materials, and installed libraries (`node_modules`).
