const { pool } = require('../config/db');
const { circumstancesFromRow } = require('../lib/elevateCircumstances');

function ageOf(birthdate, storedAge) {
  if (!birthdate) return storedAge ?? null;
  const born = new Date(`${birthdate}T00:00:00`);
  if (Number.isNaN(born.getTime())) return storedAge ?? null;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  if (now.getMonth() < born.getMonth() || (now.getMonth() === born.getMonth() && now.getDate() < born.getDate())) age -= 1;
  return age;
}

// A beneficiary's information for a specialist they applied to or learn with:
// what the specialist needs to decide and to teach. Contact details appear
// once the specialist has accepted them; civil status and sector tags (PWD,
// 4Ps, …) stay with the admin.
async function getLearnerForSpecialist(req, res) {
  const beneficiaryId = Number(req.params.beneficiaryId);
  const [withYou] = await pool.query(
    `SELECT a.module_id, a.assignment_status, a.applied_at, a.assigned_at, lm.title, lm.phase,
            cert.issued_at AS completed_at
     FROM elevate_module_assignments a
     JOIN learning_modules lm ON lm.id = a.module_id
     LEFT JOIN module_certificates cert ON cert.user_id = a.beneficiary_id AND cert.module_id = a.module_id
     WHERE a.beneficiary_id = ? AND a.specialist_id = ? AND a.assignment_status IN ('pending', 'assigned')
     ORDER BY lm.sort_order, lm.id`,
    [beneficiaryId, req.user.id]
  );
  if (!withYou.length) {
    return res.status(404).json({ success: false, message: 'This beneficiary has not applied to you.' });
  }
  const [users] = await pool.query(
    `SELECT u.id, u.full_name, u.avatar_url, u.bio, u.sex, u.age, DATE_FORMAT(u.birthdate, '%Y-%m-%d') AS birthdate,
            u.education, u.work_status, u.school_or_org, u.mobile_number, u.email,
            u.country, u.province, u.state_region, u.city, c.barangay,
            c.learning_modes, c.availability, c.device_access, c.internet_access,
            COALESCE(p.goal_other, g.label) AS goal_label, p.used_computer, p.completed_at AS skill_check_at
     FROM users u
     LEFT JOIN user_learning_circumstances c ON c.user_id = u.id
     LEFT JOIN elevate_learner_profiles p ON p.user_id = u.id
     LEFT JOIN program_goals g ON g.value = p.goal_track
     WHERE u.id = ? AND u.user_type = 'beneficiary' AND u.status = 'active'`,
    [beneficiaryId]
  );
  const user = users[0];
  if (!user) return res.status(404).json({ success: false, message: 'This beneficiary is not available.' });

  // Latest skill-check result for each topic (pre-test, or a later post-test).
  const [skills] = await pool.query(
    `SELECT lm.id AS module_id, lm.title, lm.phase, sa.band, sa.test_kind, sa.taken_at
     FROM elevate_skill_assessments sa
     JOIN module_skills ms ON ms.skill_id = sa.skill_id AND ms.is_primary = 1
     JOIN learning_modules lm ON lm.id = ms.module_id AND lm.is_elevate_program = 1
     WHERE sa.user_id = ?
       AND sa.attempt = (SELECT MAX(x.attempt) FROM elevate_skill_assessments x WHERE x.user_id = sa.user_id AND x.skill_id = sa.skill_id)
     ORDER BY lm.sort_order, lm.id`,
    [beneficiaryId]
  );

  const accepted = withYou.some((row) => row.assignment_status === 'assigned');
  const circumstances = circumstancesFromRow(user);
  res.json({
    success: true,
    data: {
      id: user.id,
      fullName: user.full_name,
      avatarUrl: user.avatar_url,
      bio: user.bio || '',
      age: ageOf(user.birthdate, user.age),
      sex: user.sex,
      education: user.education,
      workStatus: user.work_status,
      schoolOrOrg: user.school_or_org,
      place: {
        barangay: user.barangay,
        city: user.city,
        province: user.province || user.state_region,
        country: user.country,
      },
      contact: accepted ? { mobile: user.mobile_number || null, email: user.email } : null,
      learning: {
        goalLabel: user.goal_label,
        usedComputer: user.used_computer === null || user.used_computer === undefined ? null : Boolean(user.used_computer),
        skillCheckAt: user.skill_check_at,
        learningModes: circumstances.learningModes,
        availability: circumstances.availability,
        deviceAccess: circumstances.deviceAccess,
        internetAccess: circumstances.internetAccess,
      },
      skills: skills.map((row) => ({ moduleId: row.module_id, title: row.title, phase: row.phase, band: row.band, kind: row.test_kind })),
      withYou: withYou.map((row) => ({
        moduleId: row.module_id,
        title: row.title,
        stage: row.completed_at ? 'completed' : row.assignment_status === 'pending' ? 'incoming' : 'ongoing',
        appliedAt: row.applied_at,
        acceptedAt: row.assigned_at,
        completedAt: row.completed_at,
      })),
    },
  });
}

module.exports = { getLearnerForSpecialist };
