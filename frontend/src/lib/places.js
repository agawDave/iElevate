// Philippine regions with their PSGC region codes (Philippine Statistics
// Authority), including the Negros Island Region re-created in 2024.
// Keep in sync with backend/src/lib/places.js.
export const PH_REGIONS = [
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

export const PHILIPPINES = 'Philippines';

export function regionName(code) {
  return PH_REGIONS.find((region) => region.code === code)?.name || '';
}

export function formatPlace(place) {
  if (!place?.country) return '';
  if (place.country === PHILIPPINES) {
    return [place.barangay && `Brgy. ${place.barangay}`, place.city, place.province, regionName(place.regionCode)]
      .filter(Boolean).join(', ');
  }
  return [place.city, place.stateRegion, place.country].filter(Boolean).join(', ');
}
