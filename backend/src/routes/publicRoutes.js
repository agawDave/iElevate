const express = require('express');
const { pool } = require('../config/db');
const { offeredSql } = require('../lib/programPhases');

// Facts about this year's ELEVATE program for the landing and login pages, before anyone signs in.
// Counts only: no names, accounts or anything people entered.
const router = express.Router();

router.get('/program', async (req, res) => {
  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS topics, COUNT(DISTINCT phase) AS phases, COALESCE(SUM(hours), 0) AS hours
     FROM learning_modules lm
     WHERE lm.is_elevate_program = 1 AND lm.approval_status = 'approved' AND ${offeredSql('lm')}`
  );
  // The landing page's phase list: each phase with topics offered this year.
  const [phases] = await pool.query(
    `SELECT pp.number, pp.name, COUNT(*) AS topics, COALESCE(SUM(lm.hours), 0) AS hours
     FROM learning_modules lm
     JOIN program_phases pp ON lm.phase = CONCAT('ELEVATE Phase ', pp.number)
     WHERE lm.is_elevate_program = 1 AND lm.approval_status = 'approved' AND ${offeredSql('lm')}
     GROUP BY pp.number, pp.name ORDER BY pp.number`
  );
  res.json({
    success: true,
    data: {
      topics: Number(row.topics),
      phases: Number(row.phases),
      hours: Number(row.hours),
      phaseList: phases.map((phase) => ({ number: phase.number, name: phase.name, topics: Number(phase.topics), hours: Number(phase.hours) })),
    },
  });
});

module.exports = router;
