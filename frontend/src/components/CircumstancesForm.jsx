import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import SelectAllControls from './SelectAllControls';
import PlaceFields, { EMPTY_PLACE, placeError, placeFromProfile, placePayload } from './PlaceFields';
import { formatPlace, livesAbroad } from '../lib/places';
import {
  DAYS,
  DEVICE_OPTIONS,
  INTERNET_OPTIONS,
  LEARNING_MODES,
  TIME_BLOCKS,
  slotKey,
} from '../lib/circumstances';
import { SkeletonLines } from './ui/Skeleton';

const EMPTY = {
  learningModes: [],
  availability: [],
  deviceAccess: '',
  internetAccess: '',
};

const ALL_MODES = LEARNING_MODES.map((mode) => mode.value);
const ALL_SLOTS = TIME_BLOCKS.flatMap((time) => DAYS.map((day) => slotKey(day.value, time.value)));

function toggle(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function ChoiceList({ name, options, value, onChange }) {
  return (
    <div className="grid gap-2">
      {options.map((option) => (
        <label key={option.value} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition ${value === option.value ? 'border-brand-300 bg-brand-50' : 'border-stone-200 hover:bg-stone-50'}`}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="h-4 w-4 border-stone-300 text-brand-600 focus:ring-brand-500"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

function GroupHeading({ title, hint, controls }) {
  return (
    <div className="mb-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <legend className="text-sm font-semibold text-slate-800">{title}</legend>
        {controls}
      </div>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

// askPlace: onboarding asks for the beneficiary's address here (it's saved to
// the Profile); elsewhere the address is edited on the Profile and shown read-only.
export default function CircumstancesForm({ userType, onSaved, submitLabel, askPlace = false }) {
  const isBeneficiary = userType === 'beneficiary';
  const [form, setForm] = useState(EMPTY);
  const [place, setPlace] = useState(EMPTY_PLACE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      axiosClient.get('/users/me/circumstances'),
      axiosClient.get('/users/me'),
    ])
      .then(([circumstancesResponse, profileResponse]) => {
        if (!active) return;
        const data = circumstancesResponse.data.data;
        setForm({
          learningModes: data.learningModes || [],
          availability: data.availability || [],
          deviceAccess: data.deviceAccess || '',
          internetAccess: data.internetAccess || '',
        });
        if (profileResponse) setPlace(placeFromProfile(profileResponse.data.data));
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load your preferred setup.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [isBeneficiary]);

  function update(changes) {
    setForm((current) => ({ ...current, ...changes }));
    setError('');
    setMessage('');
  }

  const offline = form.deviceAccess === 'none' || form.internetAccess === 'none';
  // Outside the Philippines: online only.
  const abroad = isBeneficiary && livesAbroad(place.country);
  const modes = abroad ? ['online'] : form.learningModes;
  const onlineOnlyButOffline = isBeneficiary && !abroad && offline
    && form.learningModes.length > 0 && form.learningModes.every((mode) => mode === 'online');

  async function save(event) {
    event.preventDefault();
    if (!modes.length) return setError('Choose at least one learning mode.');
    if (!form.availability.length) return setError('Choose at least one day and time you are available.');
    if (isBeneficiary) {
      if (!form.deviceAccess) return setError('Tell us which device you can use.');
      if (!form.internetAccess) return setError('Tell us about your internet connection.');
      if (askPlace) {
        const problem = placeError(place);
        if (problem) return setError(problem);
      }
      if (onlineOnlyButOffline) return setError('Online classes need a device and internet. Also choose face-to-face or radio.');
      if (abroad && offline) return setError('You learn online, so choose the device and internet connection you can use.');
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      if (isBeneficiary && askPlace) await axiosClient.patch('/users/me', placePayload(place));
      await axiosClient.put('/users/me/circumstances', isBeneficiary
        ? {
          learningModes: modes,
          availability: form.availability,
          deviceAccess: form.deviceAccess,
          internetAccess: form.internetAccess,
        }
        : {
          learningModes: form.learningModes,
          availability: form.availability,
        });
      setMessage(isBeneficiary
        ? 'Saved. Your specialist matches are updated.'
        : 'Saved. Beneficiary matches are updated.');
      onSaved?.();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save your preferred setup.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <SkeletonLines lines={5} label="Loading your preferred setup…" />;

  return (
    <form onSubmit={save} className="space-y-6">
      <fieldset>
        <GroupHeading
          title={isBeneficiary ? 'How can you attend sessions?' : 'How do you teach?'}
          hint={abroad ? 'You live outside the Philippines, so you learn online. Face-to-face sessions and radio lessons are only in the Philippines.' : 'Choose every mode that works for you.'}
          controls={abroad ? null : (
            <SelectAllControls
              label="learning modes"
              onCheckAll={() => update({ learningModes: ALL_MODES })}
              onClear={() => update({ learningModes: [] })}
              allChecked={form.learningModes.length === ALL_MODES.length}
              noneChecked={!form.learningModes.length}
            />
          )}
        />
        <div className="grid gap-2 sm:grid-cols-3">
          {LEARNING_MODES.map((mode) => {
            const checked = modes.includes(mode.value);
            const locked = abroad;
            return (
              <label key={mode.value} className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 transition ${locked ? (checked ? 'border-brand-300 bg-brand-50' : 'border-stone-200 opacity-50') : `cursor-pointer ${checked ? 'border-brand-300 bg-brand-50' : 'border-stone-200 hover:bg-stone-50'}`}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={locked}
                  onChange={() => update({ learningModes: toggle(form.learningModes, mode.value) })}
                  className="mt-0.5 h-4 w-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                />
                <span>
                  <span className="block text-sm font-medium text-slate-800">{mode.label}</span>
                  <span className="block text-xs text-slate-500">{mode.description}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <GroupHeading
          title={isBeneficiary ? 'When are you free to learn?' : 'When are you available to teach?'}
          hint="Tick every time slot that usually works for you each week."
          controls={(
            <SelectAllControls
              label="time slots"
              onCheckAll={() => update({ availability: ALL_SLOTS })}
              onClear={() => update({ availability: [] })}
              allChecked={form.availability.length === ALL_SLOTS.length}
              noneChecked={!form.availability.length}
            />
          )}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-center text-xs">
            <thead>
              <tr>
                <th className="w-28 py-1.5 text-left font-medium text-slate-500" scope="col"><span className="sr-only">Time</span></th>
                {DAYS.map((day) => <th key={day.value} scope="col" className="py-1.5 font-medium text-slate-600">{day.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {TIME_BLOCKS.map((time) => (
                <tr key={time.value} className="border-t border-stone-100">
                  <th scope="row" className="py-2 text-left font-medium text-slate-700">
                    {time.label}
                    <span className="block font-normal text-slate-400">{time.hint}</span>
                  </th>
                  {DAYS.map((day) => {
                    const key = slotKey(day.value, time.value);
                    return (
                      <td key={key} className="py-2">
                        <input
                          type="checkbox"
                          aria-label={`${day.label} ${time.label}`}
                          checked={form.availability.includes(key)}
                          onChange={() => update({ availability: toggle(form.availability, key) })}
                          className="h-5 w-5 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </fieldset>

      {isBeneficiary ? (
        <>
          <div className="grid gap-6 sm:grid-cols-2">
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-slate-800">Which device can you use?</legend>
              <ChoiceList name="deviceAccess" options={DEVICE_OPTIONS} value={form.deviceAccess} onChange={(value) => update({ deviceAccess: value })} />
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-slate-800">What is your internet like?</legend>
              <ChoiceList name="internetAccess" options={INTERNET_OPTIONS} value={form.internetAccess} onChange={(value) => update({ internetAccess: value })} />
            </fieldset>
          </div>
          {offline && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {abroad
                ? 'You live outside the Philippines, so you learn online and need a device and internet.'
                : 'Without a device or internet, you’ll be matched with specialists who teach face-to-face or by radio.'}
            </p>
          )}
          {askPlace ? (
            <fieldset>
              <legend className="text-sm font-semibold text-slate-800">Where do you live?</legend>
              <p className="mb-3 text-xs text-slate-500">Used to find specialists who hold face-to-face sessions near you. It’s saved to your Profile.</p>
              <PlaceFields value={place} onChange={(value) => { setPlace(value); setError(''); }} idPrefix="onboarding-place" />
            </fieldset>
          ) : (
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-800">Address:</span> {formatPlace(place) || 'Not set'}
              {' · '}
              <Link to="/profile" className="font-medium text-brand-600 hover:underline">Change it on your Profile</Link>
            </p>
          )}
        </>
      ) : (
        <div>
          <p className="text-sm font-semibold text-slate-800">Where you hold face-to-face sessions</p>
          {formatPlace(place) ? (
            <p className="mt-1 text-sm text-slate-600">
              {formatPlace(place)}
              {' · '}
              <Link to="/profile" className="font-medium text-brand-600 hover:underline">Change it on your Profile</Link>
            </p>
          ) : (
            <p className="mt-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Add your address on your{' '}
              <Link to="/profile" className="font-semibold underline">Profile</Link>
              {' '}so beneficiaries near you can be matched to you for face-to-face sessions.
            </p>
          )}
          <p className="mt-1 text-xs text-slate-500">
            Taken from your Profile address. Beneficiaries in your barangay are matched to you first, then those in your city or municipality.
          </p>
        </div>
      )}

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-brand-900 transition hover:bg-accent-550 disabled:opacity-50"
      >
        {saving ? 'Saving…' : submitLabel || 'Save preferred setup'}
      </button>
    </form>
  );
}
