# iElevate Startup Guide

## Quick Start (Easiest)

**Double-click `start-servers.bat`** in the project root folder.

This will:
- ✅ Start the Backend API (port 5000)
- ✅ Start the Frontend Dev Server (port 5173)
- Both open in separate terminal windows

## Alternative: Start Servers Separately

If you only need one server:
- **Backend only:** Double-click `start-backend.bat`
- **Frontend only:** Double-click `start-frontend.bat`

## Manual Start (If batch files don't work)

Open PowerShell in the project root and run:

**Terminal 1 - Backend:**
```powershell
cd backend
npm start
```

**Terminal 2 - Frontend:**
```powershell
cd frontend
npm run dev
```

## Prerequisites

Make sure you have:
- ✅ Node.js and npm installed
- ✅ MySQL running (XAMPP Control Panel → Start MySQL)
- ✅ Dependencies installed (run `npm install` in both backend and frontend folders if not already done)

## Access the Website

Once both servers are running:
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:5000

## Stopping the Servers

- Close the terminal windows, or
- Press `Ctrl+C` in each terminal

## ELEVATE Modules and Specialist Matching

Modules follow the ELEVATE **training designs**: each *Competencies/Topics* row is a
module (Google Slides, Freelancing 101, …), and each *Resource Person* is a specialist
who teaches it. Phase 1 has 6 topic modules, Phase 2 has 5, and Phase 3 has 3 (also
broadcast as Phase 4, ELEVATE On Air). "Orientation, Pre-test, Profiling" is the
beneficiary onboarding, and "Monitoring and Evaluation" is the admin progress report.

Beneficiaries never pick topics or specialists by hand. During onboarding they take the
**skill check**: their goal (office/BPO job, freelancing, online business, or not sure),
then for each topic on that goal's track they rate "I can…" statements from 0 to 3 and
answer two quick questions. Each topic gets a level, (rating average + 1.5 × correct
answers) ÷ 2. Topics below 2.0 become their topics: up to four start now, and the rest
are "next up" until prerequisites are met or a current topic is finished. Retaking the
check after training is saved as a post-test. Questions and scoring live in
`backend/src/lib/elevateSkillCheck.js`; the answer key never reaches the browser.

Beneficiaries then describe their **circumstances**:

- learning mode: face-to-face, online, radio
- weekly availability (morning / afternoon / evening per day)
- device and internet access
- barangay

Specialists choose the topics they teach and set their own learning modes, availability,
and the barangays where they can hold face-to-face sessions. For each topic they can also
give their level, the learners they take (beginners, developing learners, or both), a
learner limit, certifications, and earlier ELEVATE phases they taught.

For each active topic, the system assigns the specialist who teaches it and fits best:

- A specialist rated beginner or intermediate in the topic isn't matched for it.
- A specialist who takes only beginners (or only developing learners) gets only those.
- A specialist at their learner limit for the topic is skipped. An expert ranks higher.

- A specialist must share a learning mode the beneficiary can attend. Online is ruled
  out when the beneficiary has no device or no internet.
- If both have set availability, they must share at least one time slot.
- More shared time slots and a matching face-to-face barangay rank a specialist higher.
- Ties keep the current specialist, then go to whoever has fewer learners.

Circumstances a specialist hasn't filled in yet don't block a match. If nobody fits,
the topic shows as waiting with the reason, and the beneficiary is connected
automatically once someone does. The Modules page shows each learner why their
specialist was chosen.

### Setup

After the existing schema, skill, module, resource, and module-messaging migrations,
run these against `ielevate_db`, in order:

1. `backend/database/elevate_curriculum_matching_migration.sql`
2. `backend/database/elevate_training_design_migration.sql`: creates the topic modules
   and the circumstances table, retires the whole-phase Phase 1/2 modules, and hides
   Phase 3/4 (`pending`) until their training designs name resource persons. Safe to re-run.
3. `backend/database/specialist_materials_migration.sql`: lets specialists attach their
   own materials (adds the `excel` resource type and `module_resources.uploaded_by`).
   Safe to re-run.
4. `backend/database/elevate_skill_check_migration.sql`: adds the skill-check tables,
   the specialist teaching-detail columns, the `queued` (next up) assignment status, and
   the Phase 3 topic modules. Safe to re-run.
5. `backend/database/profile_demographics_migration.sql`: adds sex, age, work status and
   mobile number to users, so the Profile page holds demographic data only. The skill
   check and circumstances live on **My Learning Plan** (`/learning-plan`). Safe to re-run.
6. `backend/database/advisor_feedback_migration.sql` (project-advisor feedback): birthdate,
   civil status, education, sector tags and a typed address with the PSGC region code on
   the Profile; the skill check's "Tell us more" note; specialist-issued certificates; and
   the `completed` learning status. Safe to re-run.
7. `backend/database/certificate_upload_migration.sql`: lets specialists upload the
   certificate they made for each learner (see "Certificates" below). Safe to re-run.
8. `backend/database/module_sessions_index_migration.sql`: indexes topic sessions by
   learner-specialist pair. Safe to re-run.
9. `backend/database/module_applications_migration.sql`: adds the apply → accept flow
   (see "Modules page" below). Existing matches that had already started stay accepted.
   Ones nobody had started become topics the learner applies to. Safe to re-run.
10. `backend/database/module_activities_migration.sql`: specialist-made module activities
    and learners' answers (see "Module activities" below). Safe to re-run.
11. `backend/database/activity_log_migration.sql`: the activity log behind the admin
    Reports and Activity log pages (see "Admin reports and activity log" below). It
    fills in earlier activity from saved dates. Safe to re-run.
12. `backend/database/file_task_migration.sql`: file tasks, a third kind of module
    activity built from a file the specialist uploads (see "Module activities"
    below). Safe to re-run.
13. `backend/database/module_tests_migration.sql`: a pre-test and post-test for each
    module (see "Pre-test and post-test" below). Safe to re-run.
14. `backend/database/portfolio_items_migration.sql`: reflections, rubric scores, and the
    projects, awards and photos beneficiaries add to their portfolio (see "Learning
    portfolio" below). Safe to re-run.
15. `backend/database/career_portfolio_migration.sql`: the Career tab of My Portfolio:
    resume, work-sample picks, licenses and recommendations (see "Career portfolio"
    below). Safe to re-run.
16. `cd backend` then `node database/seed_training_design_specialists.js`: creates a
    specialist account for each Phase 1–3 resource person, linked to their topics. Each
    signs in with their first name at Gmail (e.g. `naomi@gmail.com`; compound first
    names drop the space or hyphen: `johnlemnil@gmail.com`, `jaean@gmail.com`).
    Passwords are not stored in the script. Choose them when you run it:
    - PowerShell: `$env:SEED_PASSWORD_PATTERN='{login}12345'; node database/seed_training_design_specialists.js`
      gives each person their first name + 12345 (e.g. `naomi12345`).
    - `SEED_SPECIALIST_PASSWORD=...` gives everyone one shared password.
    - Neither prints one random temporary password.

    Existing accounts are left as they are.

Topic modules link to these protected files in `backend/module-resources/`:

- `elevate-phase-1.pdf` (Phase 1 topics)
- `elevate-phase-2.pdf` (Phase 2 topics)
- `elevate-phase-3.pdf` and `elevate-phase-4.pdf` (Phase 3 topics)

Beneficiaries can open the materials for topics they chose. Specialists can open the
materials for topics they teach. Only a matched beneficiary and specialist share the
private module discussion and can book a learning session.

### Specialist materials

On a topic they teach, a specialist can upload PDF, Word (DOCX), Excel (XLSX/XLS) and
video (MP4, WebM, MOV, OGG) files and add links:

- Up to 5 files per upload, 100 MB each, and 30 materials per topic.
- Files are checked by their contents, not just their extension, and stored under
  random names in `backend/module-resources/`.
- Materials go live right away, but only for that specialist and the beneficiaries
  matched to them on that topic. Another specialist's learners for the same topic don't
  see them. The official program PDF stays visible to everyone in the topic.
- The specialist who uploaded a material can remove it, which also deletes the file.

### Modules page: apply, accept, learn, complete

The Modules page shows the topics as cards, with tabs for the three stages (the
project-advisor grouping):

- **Incoming:** the beneficiary applied to a topic, and it's waiting for the specialist
  to accept.
- **Ongoing:** the specialist accepted, and the beneficiary is doing the module. The
  chat opens at this point.
- **Completed:** the specialist marked the beneficiary completed and gave the
  certificate.

**Learners** see every topic from their skill check under **All topics**.

- Each topic lists the specialists who teach it and fit the learner's schedule, learning
  mode and level. The best fit comes first, with why. The learner presses **Apply**
  next to the one they choose, and only that specialist sees it.
- "Next up" topics can be applied to once a current topic is finished.
- A topic with no fitting specialist yet says so, and can be applied to once one fits.
- The learner can **cancel** an application that hasn't been answered.
- If the specialist **declines**, the learner chooses another specialist. The one who
  declined isn't offered for that topic again.

**Specialists** have an **All topics** tab with every topic they teach, even with no
learners yet. Each shows its Incoming / Ongoing / Completed counts and Materials. The
other tabs list learners, grouped by topic.

- **Incoming** shows each applicant's place, skill-check level and note, with
  **Accept** / **Decline**. Accepting is refused if the specialist is at their learner
  limit for that topic.
- **Ongoing** puts learners waiting for a reply first ("Waiting 5 hours for your
  reply").
- **Profile** (or the learner's name, or the button in the chat) opens the beneficiary's
  information. A specialist can only open it for people who applied to them or learn
  with them. It shows:
  - their profile basics: age, sex, education, work, school, address and about;
  - their skill-check results per topic, goal, note, learning modes, weekly schedule,
    and device and internet;
  - their mobile number and email, once the specialist accepts them.

  Civil status and sector tags stay admin-only.

**Chat** opens in a side panel from a card. Its header has:

- **Materials:** the topic's materials. Specialists add or remove their own there, or
  use **Teaching materials** for any topic they teach.
- **Book a session:** opens the booking form on the Sessions page. Only the other
  person can accept a session, and only the specialist marks it done.
- **Specialists:** **Mark as completed** (certificate upload), View / Replace
  certificate, and Reopen topic.

**Badges and links:** both people get a pop-up when someone applies, accepts or
declines. The sidebar's Modules badge shows unread messages, and new applications for
specialists. Old links redirect to Modules: `/messages`, `/modules/:id` and
`/modules/:id/chat`.

### Module activities

Each specialist writes the activities for the topics they teach, under **All topics →
Tests & activities**. There are three kinds:

- **Multiple choice:** 2 to 4 choices, with one marked correct.
- **Written task:** the learner writes an answer.
- **File task:** the specialist uploads an activity they made, for example a worksheet
  in Word, a PDF, a spreadsheet, slides or an image, with instructions. The learner
  downloads it. They answer with their filled-in file, a photo of their answer on
  paper, a typed answer, or a file plus a note.

**Learners.** Once a specialist accepts a learner, the topic card shows **Start module**
or **Continue module (3/5)**, with a progress bar. It opens the module page
(`/modules/:id`): the topic's materials, then the activities one at a time.

- A multiple-choice answer is checked at once. A wrong answer can be tried again, and
  the correct choice is never sent to the learner's browser.
- A written or file-task answer goes to the specialist, who is notified. The learner can
  change it later, which keeps, replaces or removes the file they sent.
- Answers lock once the topic is completed.

**Specialists.** Ongoing learner rows show their activity progress and how many written
and file answers are waiting. **Answers** opens that learner's answers, with the
learner's file to open or download and a reply box. The reply can include an optional
rubric: Content, Completeness and Effort, each scored 1 to 4 (all three or none). The
learner is notified and sees the reply and rubric on the module page. If the learner
changes their answer, the reply and rubric are cleared and it waits to be read again.

**Editing.**

- Changing an activity's correct choice re-checks earlier answers.
- Changing its kind (for example, multiple choice to written) clears its old answers.
- Replacing a file task's file keeps the answers learners already sent.
- Removing an activity, or changing its kind, also deletes its files.

**Files.** File-task files are PDF, Word (DOC/DOCX), Excel (XLS/XLSX), PowerPoint
(PPT/PPTX), JPG or PNG, up to 20 MB each.

- They're checked by their contents, not just their extension, and stored under random
  names in `backend/activity-files/`, which is never served publicly.
- Each opens through a link that expires after 10 minutes. PDFs and photos open in the
  browser, and Office files download.
- A specialist's file can be opened by that specialist, the learners they accepted on
  the topic, and admins. A learner's answer file can be opened by that learner, the
  specialist, and admins.

### Pre-test and post-test

Each module can have a pre-test and a post-test. Both use the same questions, so the
before and after scores show what the learner gained.

- **Specialists** write the test in **Tests & activities → Pre-test & post-test → Edit
  questions**. Questions are multiple choice, 2 to 4 choices each, up to 30 questions.
  Each specialist writes their own test for the topics they teach.
- **Learners** see the steps **Pre-test → activities → Post-test** on the module page:
  - The activities open once the pre-test is done.
  - The post-test opens once all activities are done.
  - Each test is taken once, and the learner sees their score.
  - The correct answers are never sent to the learner's browser until after the
    post-test, which then shows each question with the right answer and the
    before → after score.
- **Specialists see the results:**
  - learner rows show "Pre-test 2/4 → Post-test 4/4";
  - **Answers** shows which questions they got right before and after;
  - a pop-up comes when a learner takes a test;
  - **Mark as completed** shows the scores, and reminds the specialist if the
    post-test or some activities aren't done. They can still issue the certificate.
- **Locks and history:**
  - The tests close once the topic is completed.
  - Each attempt keeps a copy of the questions as they were, so editing or removing
    questions later doesn't change scores already given.
  - A topic with no questions has no tests, and its activities are open from the
    start.
- **Admins** see the scores in Reports → Progress: the average before → after per
  topic, and each learner's scores, also in the CSV. The Activity log records each
  test taken, for example "Pre-test · 2 of 4".

### Certificates

Each specialist makes their own certificate (for example in Canva or Word) and issues it
when a learner finishes the topic:

- In the topic chat, **Mark as completed** asks for the certificate file: PDF, PNG or
  JPG, up to 10 MB. Uploading it marks the topic completed. The conversation moves to
  Completed, and the learner's next-up topic starts.
- The learner opens and downloads it from **My Portfolio** or the topic chat.
- **Replace certificate** swaps the file, for example to fix a misspelled name.
  **Reopen topic** withdraws the certificate and deletes the file.
- Files are checked by their contents and stored under random names in
  `backend/certificates/`, which is never served publicly. Only the learner, the
  specialist who issued the certificate, and admins can open it, through a link that
  expires after 10 minutes. Admins see it in the beneficiary's details panel.

### Learning portfolio

**My Portfolio** (`/portfolio`) is the beneficiary's learning record in one place. It
replaces the old Credentials page, and `/credentials` redirects to it. It opens with a
**cover** (photo, name, program, school or organization) and a **contents** list that
jumps to each numbered section:

1. **About Me:** photo, bio, school or organization, education, goal and address, from
   their Profile and skill check, plus topics completed and in progress, certificates,
   and training hours completed. ELEVATE has no grade or section, so those don't appear.
2. **Skill profile:** each topic's level from the ELEVATE skill check. If they retook it,
   it shows the level at the start and the latest level.
3. **Sample works,** by phase. Each topic shows the specialist, dates, certificate,
   pre-test → post-test score, activities done and sessions held. **My work** lists each
   written and file-task answer with what they wrote, their file, the specialist's reply
   and rubric, and a **What I learned** reflection. Multiple-choice activities are
   counted, not listed. Below the topics, beneficiaries can add their own **projects and
   artworks**.
4. **Certificates and recognitions:** certificates their specialists issued, plus
   **awards** they add.
5. **Photos:** training events, group work or performance tasks they add.

Reflections stay editable, even after a topic is completed. A changed answer keeps its
reflection.

Projects, awards and photos are added by the beneficiary and always labelled "Added by
the beneficiary", so they aren't confused with certificates a specialist issued. Nobody
reviews them. Each portfolio can hold up to 60 of these items. Files follow the same
rules as file tasks (photos must be JPG or PNG) and stay private in
`backend/activity-files/`.

**Print / Save as PDF** prints the whole portfolio with all the work shown. The cover and
contents each get their own page. The contents list uses section numbers, not page
numbers, because page numbers depend on the printer.

It's private: only the beneficiary and admins can see it. Admins open it from
**Beneficiaries → (a beneficiary) → View learning portfolio**, read-only, and can print
it too. Specialists don't see the portfolio or the reflections, and the sidebar link
shows only for beneficiaries.

### Career portfolio

The **Career** tab of My Portfolio (`/portfolio?tab=career`) is a short version for job
applications. It prints on its own. At the top are the beneficiary's photo, mobile
number, email and address, from their Profile. Then:

1. **Resume.** Either **Built here** (objective, work experience and education they type
   in) or **Upload my own** (PDF or Word). An uploaded resume can't be merged into the
   printed page, so it prints as a line saying it's attached separately; send the file
   along with the PDF.
2. **Work samples.** Only what they pick: a **Show in career portfolio** tick under each
   written or file task and project on the Learning tab.
3. **Skills and qualifications.** Topics completed with a specialist show as Certified.
   Topics they rated Proficient or Strong in the skill check also show, marked on the
   page as their own rating. Lower levels are left out. They can add other skills, and
   their education and ELEVATE training hours appear here too.
4. **Certificates, licenses and trainings.** Certificates issued by specialists, plus
   licenses and other trainings they add, and their awards.
5. **Recommendations.** The beneficiary chooses a topic and presses **Ask for a
   recommendation**. The specialist who accepted them gets a pop-up and a
   **Recommendation (asked)** button on that learner's row, where they write it or
   decline. It shows as written by that specialist on iELEVATE. The beneficiary can
   remove it, but can't change the words. They can also upload a letter or type a
   testimonial from someone else, labelled "Uploaded by the beneficiary".

Admins see this tab read-only, and only finished recommendations.

### Admin reports and activity log

The system records what users do in an activity log, and admins get two pages built on
it.

**Recorded actions:**

- joining, logging in and the skill check (pre-test, then post-test);
- applying, cancelling, accepting and declining;
- chat messages;
- sessions requested, accepted, cancelled, held or missed;
- activities added, answered and replied to;
- certificates issued and topics reopened.

Each entry says who did it, when, on which topic, and with whom.

**Activity log** (`/admin/activity`) lists every entry, newest first.

- Search by name, email or topic, and filter by action, by beneficiaries or
  specialists, and by dates.
- **Download CSV** exports everything that matches, up to 10,000 rows.
- Logins are recorded one by one from when the log was added. For earlier dates, only
  each user's last login is known.

**Reports** (`/admin/reports`) cover a period: the last 7 or 30 days, this or last
month, the last 3 months, this year, or custom dates (up to 3 years). You can narrow
them by phase, topic, city, sex and sector. Every chart has a table view.

- **Participation:** logins, chat messages and activity answers over time. "Who took
  part" (active and all beneficiaries, by sex, age group and sector), and a row per
  beneficiary. A beneficiary is active if they logged in, sent a message, answered an
  activity, attended a session, applied or got a certificate in the period. With a
  topic filter, logins don't count, since they aren't tied to a topic.
- **Progress:** where every beneficiary stands *today* on each topic, whatever the
  period: Incoming, Ongoing or Completed. It also shows the average share of
  activities done, and the skill-check level at the start (0–3). For learners who
  retook the check, it shows their level at the start against their latest level.
- **Completed engagements:** certificates issued and sessions held over time. Totals
  by topic and by specialist, including the average days from acceptance to
  certificate, and the list of certificates.

**Print / Save as PDF** prints the report with a heading showing the period and
filters. Each section can also be downloaded as a CSV that opens in Excel.
