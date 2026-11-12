// Creates specialist accounts for the resource persons in the ELEVATE Phase 1
// and Phase 2 training designs and registers the topics each one teaches.
//
// Usage (from the backend folder, after elevate_training_design_migration.sql):
//   node database/seed_training_design_specialists.js
//   SEED_PASSWORD_PATTERN=... node database/seed_training_design_specialists.js
//   SEED_SPECIALIST_PASSWORD=... node database/seed_training_design_specialists.js
//
// Each account signs in with <login>@gmail.com. New accounts get:
//   * SEED_PASSWORD_PATTERN, with {login} replaced by each person's login, or
//   * one shared SEED_SPECIALIST_PASSWORD, or
//   * one random temporary password, printed once.
// Passwords are never stored in this file. Existing accounts (same email) keep
// their password; only their teaching topics are topped up.
const path = require('path');
const crypto = require('crypto');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../src/config/db');
const { recomputeAssignmentsForSpecialist } = require('../src/services/elevateAssignmentService');

const PHASE_1_TOPICS = new Set([
  'elevate-basic-computer-operation',
  'elevate-google-document',
  'elevate-google-slides',
  'elevate-google-spreadsheet',
  'elevate-basic-internet-operation',
  'elevate-english-communication',
]);

const PHASE_3_TOPICS = new Set([
  'elevate-digital-marketing-intro',
  'elevate-core-digital-marketing',
  'elevate-digital-business',
]);

// Resource persons and their topics, as listed in the training designs.
const RESOURCE_PERSONS = [
  {
    fullName: 'Naomi A. Bajao',
    login: 'naomi',
    email: 'naomi@gmail.com',
    org: 'CTU-Tuburan · BSIT',
    topics: [
      'elevate-google-spreadsheet', 'elevate-freelancing-101', 'elevate-virtual-assistant',
      'elevate-core-digital-marketing', 'elevate-digital-business',
    ],
  },
  {
    fullName: 'Catherine P. Losenara',
    login: 'catherine',
    email: 'catherine@gmail.com',
    org: 'CTU-Tuburan · BSIT',
    topics: ['elevate-digital-marketing-intro', 'elevate-core-digital-marketing'],
  },
  {
    fullName: 'John Lemnil C. Patindol',
    login: 'johnlemnil',
    email: 'johnlemnil@gmail.com',
    org: 'CTU-Tuburan · BSIT',
    topics: ['elevate-basic-computer-operation', 'elevate-work-from-home-setup'],
  },
  {
    fullName: 'Rianne R. Castro',
    login: 'rianne',
    email: 'rianne@gmail.com',
    org: 'CTU-Tuburan · BSIT',
    topics: ['elevate-google-document'],
  },
  {
    fullName: 'Jae-an V. Sarucam',
    login: 'jaean',
    email: 'jaean@gmail.com',
    org: 'CTU-Tuburan · BSIT',
    topics: ['elevate-google-slides', 'elevate-online-marketplace', 'elevate-virtual-assistant'],
  },
  {
    fullName: 'Bonibeth O. Matedios',
    login: 'bonibeth',
    email: 'bonibeth@gmail.com',
    org: 'CTU-Tuburan · BSIT',
    topics: ['elevate-basic-internet-operation'],
  },
  {
    fullName: 'Syd T. Tabotabo',
    login: 'syd',
    email: 'syd@gmail.com',
    org: 'CTU-Tuburan · BSIT',
    topics: ['elevate-basic-internet-operation'],
  },
  {
    fullName: 'Rogela A. Flores',
    login: 'rogela',
    email: 'rogela@gmail.com',
    org: 'CTU-Tuburan · CAS',
    topics: ['elevate-english-communication'],
  },
  {
    fullName: 'Angel U. Buot',
    login: 'angel',
    email: 'angel@gmail.com',
    org: 'CTU-Tuburan · BSIT',
    topics: ['elevate-work-from-home-setup'],
  },
  {
    fullName: 'Teodoro L. Buhia Jr.',
    login: 'teodoro',
    email: 'teodoro@gmail.com',
    org: 'CTU-Tuburan · BSIT',
    topics: ['elevate-wordpress'],
  },
];

// Delivery modes described in the program documents: Phase 1 ran at the
// CTU-Tuburan IT laboratory and online over Zoom; Phase 2 was broadcast on
// BT Radio and its online platforms; Phase 3 ran modular and face-to-face
// sessions and Phase 4 broadcast the same modules on DYPS BT Radio.
// Specialists can change these later.
function learningModesFor(topics) {
  const modes = new Set();
  topics.forEach((slug) => {
    if (PHASE_1_TOPICS.has(slug)) {
      modes.add('face_to_face');
      modes.add('online');
    } else if (PHASE_3_TOPICS.has(slug)) {
      modes.add('face_to_face');
      modes.add('radio');
    } else {
      modes.add('online');
      modes.add('radio');
    }
  });
  return ['face_to_face', 'online', 'radio'].filter((mode) => modes.has(mode));
}

function temporaryPassword() {
  return `Elevate-${crypto.randomBytes(6).toString('base64url')}`;
}

async function main() {
  const [topicRows] = await pool.query(
    `SELECT s.slug, s.id AS skill_id, lm.title, lm.phase
     FROM skills s
     JOIN module_skills ms ON ms.skill_id = s.id AND ms.is_primary = 1
     JOIN learning_modules lm ON lm.id = ms.module_id AND lm.is_elevate_program = 1
     WHERE lm.approval_status = 'approved'`
  );
  const topicBySlug = new Map(topicRows.map((row) => [row.slug, row]));
  const missing = [...new Set(RESOURCE_PERSONS.flatMap((person) => person.topics))]
    .filter((slug) => !topicBySlug.has(slug));
  if (missing.length) {
    throw new Error(`Run elevate_training_design_migration.sql first. Missing topics: ${missing.join(', ')}`);
  }

  const pattern = process.env.SEED_PASSWORD_PATTERN || '';
  if (pattern && !pattern.includes('{login}')) throw new Error('SEED_PASSWORD_PATTERN must contain {login}');
  const sharedPassword = pattern ? null : (process.env.SEED_SPECIALIST_PASSWORD || temporaryPassword());
  const passwordFor = (person) => (pattern ? pattern.replaceAll('{login}', person.login) : sharedPassword);
  const tooShort = RESOURCE_PERSONS.filter((person) => passwordFor(person).length < 8);
  if (tooShort.length) {
    throw new Error(`Passwords must be at least 8 characters (too short for: ${tooShort.map((person) => person.login).join(', ')})`);
  }
  const sharedHash = sharedPassword ? await bcrypt.hash(sharedPassword, 12) : null;
  const created = [];
  const updated = [];

  for (const person of RESOURCE_PERSONS) {
    const topics = person.topics.map((slug) => topicBySlug.get(slug));
    const bio = `ELEVATE resource person: ${topics.map((topic) => `${topic.title} (${topic.phase})`).join('; ')}.`;
    const [existing] = await pool.query('SELECT id, user_type FROM users WHERE email = ?', [person.email]);
    let userId = existing[0]?.id;
    if (userId && existing[0].user_type !== 'specialist') {
      throw new Error(`${person.email} already exists and is not a specialist account`);
    }
    if (!userId) {
      const passwordHash = sharedHash || await bcrypt.hash(passwordFor(person), 12);
      const [result] = await pool.query(
        `INSERT INTO users (uuid, full_name, email, password_hash, school_or_org, bio, user_type, oauth_provider)
         VALUES (?, ?, ?, ?, ?, ?, 'specialist', 'local')`,
        [uuidv4(), person.fullName, person.email, passwordHash, person.org, bio]
      );
      userId = result.insertId;
      created.push(person);
    } else {
      updated.push(person);
    }

    for (const topic of topics) {
      await pool.query(
        "INSERT IGNORE INTO user_skills (user_id, skill_id, relation_type) VALUES (?, ?, 'teaches')",
        [userId, topic.skill_id]
      );
    }
    // Only fill in learning modes the specialist has not set themselves.
    await pool.query(
      `INSERT INTO user_learning_circumstances (user_id, learning_modes)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE learning_modes = COALESCE(learning_modes, VALUES(learning_modes))`,
      [userId, JSON.stringify(learningModesFor(person.topics))]
    );
  }

  await recomputeAssignmentsForSpecialist();

  console.log(`Created ${created.length} specialist account(s); ${updated.length} already existed.`);
  created.forEach((person) => console.log(
    `  ${person.fullName.padEnd(26)} ${person.email.padEnd(24)}${pattern ? ` ${passwordFor(person)}` : ''}`
  ));
  if (created.length && sharedPassword) {
    console.log(`\nTemporary password for the new accounts: ${sharedPassword}`);
    console.log('Share it with each specialist and have them change it.');
  }
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
