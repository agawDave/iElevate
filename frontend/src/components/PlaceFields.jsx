import { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { PH_REGIONS, PHILIPPINES } from '../lib/places';

// Address. Philippines: linked dropdowns (PSGC) for region -> province ->
// city/municipality -> barangay. Any other country: country, state/region and
// city, all typed.

// Province and city lists rarely change, so keep them for the session.
const listCache = new Map();
function loadList(url) {
  if (!listCache.has(url)) {
    listCache.set(url, axiosClient.get(url).then((response) => response.data.data).catch((error) => {
      listCache.delete(url);
      throw error;
    }));
  }
  return listCache.get(url);
}
export const EMPTY_PLACE = {
  country: PHILIPPINES,
  regionCode: '',
  stateRegion: '',
  province: '',
  city: '',
  barangay: '',
};

export function placeFromProfile(data) {
  return {
    country: data?.country || PHILIPPINES,
    regionCode: data?.region_code || '',
    stateRegion: data?.state_region || '',
    province: data?.province || '',
    city: data?.city || '',
    barangay: data?.barangay || '',
  };
}

// True when anything beyond the default country has been filled in.
export function placeHasData(place) {
  const isPh = place.country.trim().toLowerCase() === PHILIPPINES.toLowerCase();
  return Boolean((!isPh && place.country.trim()) || place.regionCode
    || [place.stateRegion, place.province, place.city, place.barangay].some((value) => value.trim()));
}

// Returns an error message, or '' when the place is complete enough.
export function placeError(place, required = true) {
  const isPh = place.country.trim().toLowerCase() === PHILIPPINES.toLowerCase();
  if (!required && !placeHasData(place)) return '';
  if (!place.country.trim()) return required ? 'Enter your country.' : '';
  if (isPh) {
    if (!place.regionCode) return 'Choose your region.';
    if (required && (!place.province.trim() || !place.city.trim() || !place.barangay.trim())) {
      return 'Choose your province, city or municipality, and barangay.';
    }
    return '';
  }
  if (required && (!place.stateRegion.trim() || !place.city.trim())) return 'Enter your state or region, and your city.';
  return '';
}

export function placePayload(place) {
  const isPh = place.country.trim().toLowerCase() === PHILIPPINES.toLowerCase();
  return isPh
    ? { country: PHILIPPINES, regionCode: place.regionCode, province: place.province.trim(), city: place.city.trim(), barangay: place.barangay.trim() }
    : { country: place.country.trim(), stateRegion: place.stateRegion.trim(), city: place.city.trim() };
}

const inputClass = 'w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent';

export default function PlaceFields({ value, onChange, idPrefix = 'place' }) {
  const isPh = value.country === PHILIPPINES;
  const set = (changes) => onChange({ ...value, ...changes });
  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [listError, setListError] = useState('');

  // Provinces of the chosen region.
  useEffect(() => {
    setProvinces([]);
    if (!isPh || !value.regionCode) return undefined;
    let active = true;
    loadList(`/places/ph/regions/${value.regionCode}/provinces`)
      .then((list) => { if (active) { setProvinces(list); setListError(''); } })
      .catch(() => { if (active) setListError('Unable to load provinces. Check your connection and try again.'); });
    return () => { active = false; };
  }, [isPh, value.regionCode]);

  // Cities and municipalities of the chosen province.
  const provinceCode = provinces.find((item) => item.name.toLowerCase() === value.province.trim().toLowerCase())?.code || '';
  useEffect(() => {
    setCities([]);
    if (!provinceCode) return undefined;
    let active = true;
    loadList(`/places/ph/provinces/${provinceCode}/cities`)
      .then((list) => { if (active) { setCities(list); setListError(''); } })
      .catch(() => { if (active) setListError('Unable to load cities. Check your connection and try again.'); });
    return () => { active = false; };
  }, [provinceCode]);

  // Barangays of the chosen city or municipality.
  const cityRow = cities.find((item) => item.name.toLowerCase() === value.city.trim().toLowerCase());
  const cityCode = cityRow?.code || '';
  useEffect(() => {
    setBarangays([]);
    if (!cityCode) return undefined;
    let active = true;
    loadList(`/places/ph/cities/${cityCode}/barangays`)
      .then((list) => { if (active) { setBarangays(list); setListError(''); } })
      .catch(() => { if (active) setListError('Unable to load barangays. Check your connection and try again.'); });
    return () => { active = false; };
  }, [cityCode]);

  // A saved value from before the dropdowns that isn't in the official list
  // stays visible so the person can see it and pick the right one.
  const legacyProvince = value.province && provinces.length && !provinceCode ? value.province : '';
  const legacyCity = value.city && cities.length && !cityRow ? value.city : '';
  const selectedCity = cityRow?.name || legacyCity;
  const barangayMatch = barangays.find((item) => item.toLowerCase() === value.barangay.trim().toLowerCase());
  const legacyBarangay = value.barangay && barangays.length && !barangayMatch ? value.barangay : '';
  const selectedBarangay = barangayMatch || legacyBarangay;

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-1 text-sm font-semibold text-slate-800">Country</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name={`${idPrefix}-country-kind`} checked={isPh} onChange={() => set({ country: PHILIPPINES, stateRegion: '' })} className="h-4 w-4" />
            Philippines
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name={`${idPrefix}-country-kind`} checked={!isPh} onChange={() => set({ country: '', regionCode: '', province: '', barangay: '' })} className="h-4 w-4" />
            Other country
          </label>
        </div>
      </fieldset>

      {isPh ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor={`${idPrefix}-region`} className="mb-1 block text-sm font-semibold text-slate-800">Region</label>
            <select
              id={`${idPrefix}-region`}
              value={value.regionCode}
              onChange={(e) => set({ regionCode: e.target.value, province: '', city: '', barangay: '' })}
              className={inputClass}
            >
              <option value="">Choose your region…</option>
              {PH_REGIONS.map((region) => (
                <option key={region.code} value={region.code}>{region.name} · PSGC {region.psgc}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${idPrefix}-province`} className="mb-1 block text-sm font-semibold text-slate-800">Province</label>
            <select
              id={`${idPrefix}-province`}
              value={provinceCode ? provinces.find((item) => item.code === provinceCode).name : legacyProvince}
              onChange={(e) => set({ province: e.target.value, city: '', barangay: '' })}
              disabled={!value.regionCode || !provinces.length}
              className={`${inputClass} disabled:bg-stone-50 disabled:text-slate-400`}
            >
              <option value="">{!value.regionCode ? 'Choose a region first' : provinces.length ? 'Choose your province…' : 'Loading provinces…'}</option>
              {legacyProvince && <option value={legacyProvince}>{legacyProvince} (not in the official list)</option>}
              {provinces.map((item) => <option key={item.code} value={item.name}>{item.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={`${idPrefix}-city`} className="mb-1 block text-sm font-semibold text-slate-800">City or municipality</label>
            <select
              id={`${idPrefix}-city`}
              value={selectedCity}
              onChange={(e) => set({ city: e.target.value, barangay: '' })}
              disabled={!provinceCode || !cities.length}
              className={`${inputClass} disabled:bg-stone-50 disabled:text-slate-400`}
            >
              <option value="">{!provinceCode ? 'Choose a province first' : cities.length ? 'Choose your city or municipality…' : 'Loading…'}</option>
              {legacyCity && <option value={legacyCity}>{legacyCity} (not in the official list)</option>}
              {cities.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={`${idPrefix}-barangay`} className="mb-1 block text-sm font-semibold text-slate-800">Barangay</label>
            <select
              id={`${idPrefix}-barangay`}
              value={selectedBarangay}
              onChange={(e) => set({ barangay: e.target.value })}
              disabled={!cityCode || !barangays.length}
              className={`${inputClass} disabled:bg-stone-50 disabled:text-slate-400`}
            >
              <option value="">{!cityCode ? 'Choose a city or municipality first' : barangays.length ? 'Choose your barangay…' : 'Loading barangays…'}</option>
              {legacyBarangay && <option value={legacyBarangay}>{legacyBarangay} (not in the official list)</option>}
              {barangays.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          {listError && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{listError}</p>}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor={`${idPrefix}-country`} className="mb-1 block text-sm font-semibold text-slate-800">Country</label>
            <input id={`${idPrefix}-country`} value={value.country} onChange={(e) => set({ country: e.target.value })} maxLength={80} placeholder="e.g. Japan" className={inputClass} />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-state`} className="mb-1 block text-sm font-semibold text-slate-800">State or region</label>
            <input id={`${idPrefix}-state`} value={value.stateRegion} onChange={(e) => set({ stateRegion: e.target.value })} maxLength={100} className={inputClass} />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-city-other`} className="mb-1 block text-sm font-semibold text-slate-800">City</label>
            <input id={`${idPrefix}-city-other`} value={value.city} onChange={(e) => set({ city: e.target.value })} maxLength={100} className={inputClass} />
          </div>
        </div>
      )}
    </div>
  );
}
