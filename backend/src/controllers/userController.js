const { pool } = require('../config/db');
const {
  circumstancesFromRow,
  isComplete,
  validateCircumstances,
  cleanBarangay,
  MAX_BARANGAY_LENGTH,
} = require('../lib/elevateCircumstances');
const {
  recomputeElevateAssignments,
  recomputeAssignmentsForSpecialist,
} = require('../services/elevateAssignmentService');

const { PH_REGION_CODES, PHILIPPINES, findProvince, findCity, findBarangay, livesAbroad } = require('../lib/places');

const SEX_VALUES = ['female', 'male', 'prefer_not_to_say'];
const WORK_STATUS_VALUES = ['unemployed', 'employed', 'self_employed', 'student'];
const CIVIL_STATUS_VALUES = ['single', 'married', 'widowed', 'separated'];
const MAX_PLACE_LENGTH = 100;

function ageFrom(birthdate) {
  const born = new Date(`${birthdate}T00:00:00`);
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  if (now.getMonth() < born.getMonth() || (now.getMonth() === born.getMonth() && now.getDate() < born.getDate())) age -= 1;
  return age;
}

// The Profile is demographic data only. Barangay and city are shown here too,
// but they're also stored with the learning circumstances because matching
// reads them there.
async function getMyProfile(req, res) {
  const [rows] = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.avatar_url, u.bio, u.school_or_org, u.wallet_address,
            u.user_type, u.created_at, u.sex, u.age, DATE_FORMAT(u.birthdate, '%Y-%m-%d') AS birthdate,
            u.work_status, u.civil_status, u.mobile_number,
            u.country, u.region_code, u.state_region, u.province, u.city, c.barangay
     FROM users u
     LEFT JOIN user_learning_circumstances c ON c.user_id = u.id
     WHERE u.id = ?`,
    [req.user.id]
  );
  const row = rows[0];
  res.json({ success: true, data: row });
}

// Country, then for the Philippines a PSGC region, province, city and
// barangay; elsewhere a state/region and city. All typed except the region.
function readPlace(body, required) {
  const clean = (value) => (typeof value === 'string' ? cleanBarangay(value) : '');
  const tooLong = (value) => value.length > MAX_PLACE_LENGTH;
  const country = clean(body.country);
  if (!country) return required ? { error: 'Choose your country.' } : { place: null };
  if (tooLong(country)) return { error: 'Keep the country name under 100 characters.' };
  if (country.toLowerCase() === PHILIPPINES.toLowerCase()) {
    const regionCode = clean(body.regionCode);
    const province = clean(body.province);
    const city = clean(body.city);
    const barangay = clean(body.barangay);
    if (!required && !regionCode && !province && !city && !barangay) return { place: null };
    if (!PH_REGION_CODES.has(regionCode)) return { error: 'Choose your region.' };
    if (required && (!province || !city || !barangay)) return { error: 'Choose your province and city or municipality, and enter your barangay.' };
    if (tooLong(barangay)) return { error: 'Keep the barangay under 100 characters.' };
    // Province must be in the region and the city in the province (PSGC list).
    const provinceRow = province ? findProvince(regionCode, province) : null;
    if (province && !provinceRow) return { error: `${province} is not a province in the region you chose.` };
    const cityRow = city ? (provinceRow && findCity(provinceRow.code, city)) : null;
    if (city && !cityRow) return { error: `${city} is not a city or municipality in ${provinceRow ? provinceRow.name : 'that province'}.` };
    const barangayName = barangay ? (cityRow && findBarangay(cityRow.code, barangay)) : null;
    if (barangay && !barangayName) return { error: `${barangay} is not a barangay in ${cityRow ? cityRow.name : 'that city or municipality'}.` };
    return {
      place: {
        country: PHILIPPINES,
        region_code: regionCode,
        state_region: null,
        province: provinceRow ? provinceRow.name : null,
        city: cityRow ? cityRow.name : null,
        barangay: barangayName || null,
      },
    };
  }
  const stateRegion = clean(body.stateRegion);
  const city = clean(body.city);
  if (required && (!stateRegion || !city)) return { error: 'Enter your state or region, and your city.' };
  if ([stateRegion, city].some(tooLong)) return { error: 'Keep each part of the address under 100 characters.' };
  return {
    place: { country, region_code: null, state_region: stateRegion || null, province: null, city: city || null, barangay: null },
  };
}

// Only fields present in the request change. An empty optional field clears it.
function readProfileFields(body) {
  const fields = {};
  const has = (key) => body[key] !== undefined;
  const text = (key) => (typeof body[key] === 'string' ? body[key].trim() : body[key]);

  if (has('fullName')) {
    const value = text('fullName');
    if (typeof value !== 'string' || !value || value.length > 150) return { error: 'Enter your full name (up to 150 characters).' };
    fields.full_name = value;
  }
  if (has('bio')) {
    const value = text('bio') || null;
    if (value !== null && (typeof value !== 'string' || value.length > 1000)) return { error: 'Keep your bio under 1,000 characters.' };
    fields.bio = value;
  }
  if (has('schoolOrOrg')) {
    const value = text('schoolOrOrg') || null;
    if (value !== null && (typeof value !== 'string' || value.length > 190)) return { error: 'Keep the school or organization under 190 characters.' };
    fields.school_or_org = value;
  }
  if (has('sex')) {
    const value = text('sex') || null;
    if (value !== null && !SEX_VALUES.includes(value)) return { error: 'Choose a valid option for sex.' };
    fields.sex = value;
  }
  if (has('age')) {
    const raw = text('age');
    const value = raw === '' || raw === null ? null : Number(raw);
    if (value !== null && (!Number.isInteger(value) || value < 12 || value > 100)) return { error: 'Enter an age from 12 to 100.' };
    fields.age = value;
  }
  if (has('birthdate')) {
    const value = text('birthdate') || null;
    if (value !== null) {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
        return { error: 'Enter your birthdate.' };
      }
      const age = ageFrom(value);
      if (age < 12 || age > 100) return { error: 'Check your birthdate: age must be from 12 to 100.' };
      fields.age = age;
    }
    fields.birthdate = value;
  }
  if (has('workStatus')) {
    const value = text('workStatus') || null;
    if (value !== null && !WORK_STATUS_VALUES.includes(value)) return { error: 'Choose a valid work status.' };
    fields.work_status = value;
  }
  if (has('civilStatus')) {
    const value = text('civilStatus') || null;
    if (value !== null && !CIVIL_STATUS_VALUES.includes(value)) return { error: 'Choose a valid civil status.' };
    fields.civil_status = value;
  }
  if (has('mobileNumber')) {
    const value = text('mobileNumber') || null;
    if (value !== null && (typeof value !== 'string' || !/^\+?[0-9][0-9 -]{6,18}$/.test(value))) {
      return { error: 'Enter a valid mobile number, e.g. 0917 123 4567.' };
    }
    fields.mobile_number = value;
  }
  if (has('walletAddress')) {
    const value = text('walletAddress') || null;
    if (value !== null && (typeof value !== 'string' || value.length > 42)) return { error: 'Enter a valid wallet address.' };
    fields.wallet_address = value;
  }
  return { fields };
}

async function updateMyProfile(req, res) {
  const body = req.body || {};
  const { fields, error } = readProfileFields(body);
  if (error) return res.status(400).json({ success: false, message: error });
  if (req.file) fields.avatar_url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

  const [[account]] = await pool.query('SELECT user_type FROM users WHERE id = ?', [req.user.id]);
  const isBeneficiary = account?.user_type === 'beneficiary';

  // Full address (sent with `country`), or the older barangay-only update.
  let matchPlace;
  if (body.country !== undefined) {
    const { place, error: placeError } = readPlace(body, isBeneficiary);
    if (placeError) return res.status(400).json({ success: false, message: placeError });
    const { barangay: placeBarangay, ...userPlace } = place || {
      country: null, region_code: null, state_region: null, province: null, city: null, barangay: null,
    };
    Object.assign(fields, userPlace);
    matchPlace = { barangay: placeBarangay, city: userPlace.city };
  } else if (body.barangay !== undefined) {
    const barangay = cleanBarangay(body.barangay);
    if (!barangay || barangay.length > MAX_BARANGAY_LENGTH) {
      return res.status(400).json({ success: false, message: 'Enter your barangay.' });
    }
    matchPlace = { barangay };
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const columns = Object.keys(fields);
    if (columns.length) {
      await connection.query(
        `UPDATE users SET ${columns.map((column) => `${column} = ?`).join(', ')} WHERE id = ?`,
        [...columns.map((column) => fields[column]), req.user.id]
      );
    }
    // Learners and specialists alike: the Profile address is where they are,
    // which matching uses for face-to-face sessions.
    const isSpecialist = account?.user_type === 'specialist';
    if (matchPlace && (isBeneficiary || isSpecialist)) {
      const hasCity = matchPlace.city !== undefined;
      await connection.query(
        `INSERT INTO user_learning_circumstances (user_id, barangay${hasCity ? ', city' : ''})
         VALUES (?, ?${hasCity ? ', ?' : ''})
         ON DUPLICATE KEY UPDATE barangay = VALUES(barangay)${hasCity ? ', city = VALUES(city)' : ''}`,
        hasCity ? [req.user.id, matchPlace.barangay, matchPlace.city] : [req.user.id, matchPlace.barangay]
      );
      // Moving outside the Philippines: online only from now on.
      if (isBeneficiary && body.country !== undefined && livesAbroad(fields.country)) {
        await connection.query(
          `UPDATE user_learning_circumstances SET learning_modes = '["online"]'
           WHERE user_id = ? AND learning_modes IS NOT NULL AND learning_modes <> '[]'`,
          [req.user.id]
        );
      }
      // Barangay and city affect which face-to-face specialist fits best.
      if (isBeneficiary) await recomputeElevateAssignments(req.user.id, connection);
    }
    await connection.commit();
  } catch (saveError) {
    await connection.rollback();
    throw saveError;
  } finally {
    connection.release();
  }
  // A specialist's new address can make them the closer fit for learners.
  if (matchPlace && account?.user_type === 'specialist') {
    await recomputeAssignmentsForSpecialist(req.user.id);
  }
  res.json({ success: true, message: 'Profile updated' });
}

async function getPublicProfile(req, res) {
  const [rows] = await pool.query(
    `SELECT id, full_name, avatar_url, bio, school_or_org, user_type, created_at FROM users WHERE id = ?`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, data: rows[0] });
}

async function findLearningUserType(userId) {
  const [users] = await pool.query(
    "SELECT user_type, role FROM users WHERE id = ? AND status = 'active'",
    [userId]
  );
  const account = users[0];
  if (!account || account.role === 'admin') return null;
  return ['beneficiary', 'specialist'].includes(account.user_type) ? account.user_type : null;
}

async function getMyCircumstances(req, res) {
  const userType = await findLearningUserType(req.user.id);
  if (!userType) {
    return res.status(403).json({ success: false, message: 'Only beneficiaries and specialists have a preferred setup' });
  }
  const [rows] = await pool.query('SELECT * FROM user_learning_circumstances WHERE user_id = ?', [req.user.id]);
  const circumstances = circumstancesFromRow(rows[0]);
  res.json({ success: true, data: { ...circumstances, complete: isComplete(circumstances, userType) } });
}

async function updateMyCircumstances(req, res) {
  const userType = await findLearningUserType(req.user.id);
  if (!userType) {
    return res.status(403).json({ success: false, message: 'Only beneficiaries and specialists have a preferred setup' });
  }
  const [[me]] = await pool.query('SELECT country FROM users WHERE id = ?', [req.user.id]);
  const { value, error } = validateCircumstances(req.body, userType, { country: me?.country });
  if (error) return res.status(400).json({ success: false, message: error });
  const [saved] = await pool.query('SELECT barangay, city FROM user_learning_circumstances WHERE user_id = ?', [req.user.id]);
  if (value.barangay === undefined) {
    // Barangay comes from the Profile; keep the saved one.
    value.barangay = saved[0]?.barangay || null;
  }
  value.city = saved[0]?.city || null;

  const params = [
    req.user.id,
    JSON.stringify(value.learningModes),
    JSON.stringify(value.availability),
    value.deviceAccess,
    value.internetAccess,
    value.barangay,
    JSON.stringify(value.serviceBarangays),
  ];
  const upsertSql = `INSERT INTO user_learning_circumstances
       (user_id, learning_modes, availability, device_access, internet_access, barangay, service_barangays)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE learning_modes = VALUES(learning_modes), availability = VALUES(availability),
       device_access = VALUES(device_access), internet_access = VALUES(internet_access),
       barangay = VALUES(barangay), service_barangays = VALUES(service_barangays)`;

  if (userType === 'beneficiary') {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(upsertSql, params);
      await recomputeElevateAssignments(req.user.id, connection);
      await connection.commit();
    } catch (saveError) {
      await connection.rollback();
      throw saveError;
    } finally {
      connection.release();
    }
  } else {
    await pool.query(upsertSql, params);
    await recomputeAssignmentsForSpecialist(req.user.id);
  }

  res.json({ success: true, message: 'Preferred setup saved', data: { ...value, complete: isComplete(value, userType) } });
}

module.exports = {
  getMyProfile,
  updateMyProfile,
  getPublicProfile,
  getMyCircumstances,
  updateMyCircumstances,
};
