const express = require('express');
const { pool } = require('../config/db');

// Facts about the ELEVATE program for the login page, before anyone signs in.
// Counts only: no names, accounts or anything people entered.
const router = express.Router();

router.get('/program', async (req, res) => {
  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS topics, COUNT(DISTINCT phase) AS phases, COALESCE(SUM(hours), 0) AS hours
     FROM learning_modules
     WHERE is_elevate_program = 1 AND approval_status = 'approved'`
  );
  res.json({ success: true, data: { topics: Number(row.topics), phases: Number(row.phases), hours: Number(row.hours) } });
});

module.exports = router;
