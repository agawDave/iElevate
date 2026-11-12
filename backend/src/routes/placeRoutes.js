const express = require('express');
const {
  PH_REGIONS,
  PH_REGION_CODES,
  PLACES_SOURCE,
  provincesFor,
  citiesFor,
  barangaysFor,
} = require('../lib/places');

// Public reference data for the linked address dropdowns:
// region -> provinces -> cities/municipalities -> barangays (PSGC).
const router = express.Router();

router.use((req, res, next) => {
  res.set('Cache-Control', 'public, max-age=86400');
  next();
});

router.get('/ph/regions', (req, res) => {
  res.json({ success: true, data: PH_REGIONS, source: PLACES_SOURCE });
});

router.get('/ph/regions/:regionCode/provinces', (req, res) => {
  if (!PH_REGION_CODES.has(req.params.regionCode)) {
    return res.status(404).json({ success: false, message: 'Region not found' });
  }
  res.json({ success: true, data: provincesFor(req.params.regionCode) });
});

router.get('/ph/provinces/:provinceCode/cities', (req, res) => {
  const cities = citiesFor(req.params.provinceCode);
  if (!cities.length) return res.status(404).json({ success: false, message: 'Province not found' });
  res.json({ success: true, data: cities });
});

router.get('/ph/cities/:cityCode/barangays', (req, res) => {
  const barangays = barangaysFor(req.params.cityCode);
  if (!barangays.length) return res.status(404).json({ success: false, message: 'City or municipality not found' });
  res.json({ success: true, data: barangays });
});

module.exports = router;
