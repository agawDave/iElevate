// Philippine regions with their PSGC (Philippine Standard Geographic Code)
// region codes, as published by the Philippine Statistics Authority. Includes
// the Negros Island Region re-created in 2024. Keep in sync with
// frontend/src/lib/places.js.
//
// Provinces and cities/municipalities come from data/ph-places.json, compiled
// from the PSGC (see its `source` field). Metro Manila and a few independent
// cities have no province, so they sit under a pseudo-province in their region.
const PH_PLACES = require('../data/ph-places.json');
// Barangays per city/municipality PSGC code (data/ph-barangays.json).
const { barangays: PH_BARANGAYS } = require('../data/ph-barangays.json');

const PH_REGIONS = [
  { code: '13', psgc: '1300000000', name: 'National Capital Region (NCR)' },
  { code: '14', psgc: '1400000000', name: 'Cordillera Administrative Region (CAR)' },
  { code: '01', psgc: '0100000000', name: 'Region I – Ilocos Region' },
  { code: '02', psgc: '0200000000', name: 'Region II – Cagayan Valley' },
  { code: '03', psgc: '0300000000', name: 'Region III – Central Luzon' },
  { code: '04', psgc: '0400000000', name: 'Region IV-A – CALABARZON' },
  { code: '17', psgc: '1700000000', name: 'MIMAROPA Region' },
  { code: '05', psgc: '0500000000', name: 'Region V – Bicol Region' },
  { code: '06', psgc: '0600000000', name: 'Region VI – Western Visayas' },
  { code: '18', psgc: '1800000000', name: 'Negros Island Region (NIR)' },
  { code: '07', psgc: '0700000000', name: 'Region VII – Central Visayas' },
  { code: '08', psgc: '0800000000', name: 'Region VIII – Eastern Visayas' },
  { code: '09', psgc: '0900000000', name: 'Region IX – Zamboanga Peninsula' },
  { code: '10', psgc: '1000000000', name: 'Region X – Northern Mindanao' },
  { code: '11', psgc: '1100000000', name: 'Region XI – Davao Region' },
  { code: '12', psgc: '1200000000', name: 'Region XII – SOCCSKSARGEN' },
  { code: '16', psgc: '1600000000', name: 'Region XIII – Caraga' },
  { code: '19', psgc: '1900000000', name: 'Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)' },
];

const PH_REGION_CODES = new Set(PH_REGIONS.map((region) => region.code));
const PHILIPPINES = 'Philippines';

const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

function provincesFor(regionCode) {
  return PH_PLACES.provinces
    .filter((province) => province.regionCode === regionCode)
    .map(({ code, name }) => ({ code, name }));
}

function citiesFor(provinceCode) {
  return PH_PLACES.cities
    .filter((city) => city.provinceCode === provinceCode)
    .map(({ code, name, isCity }) => ({ code, name, isCity }));
}

function barangaysFor(cityCode) {
  return PH_BARANGAYS[cityCode] || [];
}

function findBarangay(cityCode, name) {
  return barangaysFor(cityCode).find((barangay) => same(barangay, name)) || null;
}

// Canonical province / city by name, or null when it isn't in that region / province.
function findProvince(regionCode, name) {
  return PH_PLACES.provinces.find((province) => province.regionCode === regionCode && same(province.name, name)) || null;
}

function findCity(provinceCode, name) {
  return PH_PLACES.cities.find((city) => city.provinceCode === provinceCode && same(city.name, name)) || null;
}

module.exports = {
  PH_REGIONS,
  PH_REGION_CODES,
  PHILIPPINES,
  PLACES_SOURCE: PH_PLACES.source,
  provincesFor,
  citiesFor,
  barangaysFor,
  findProvince,
  findCity,
  findBarangay,
};
