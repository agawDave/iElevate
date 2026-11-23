import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import PageHeader, { headerButtonClass } from '../components/layout/PageHeader';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import PlaceFields, { placeError, placeFromProfile, placeHasData, placePayload } from '../components/PlaceFields';
import SelectAllControls from '../components/SelectAllControls';
import LineIcon from '../components/ui/LineIcon';

// Profile = who the person is (demographic and contact data). Everything used
// for matching lives on "My Learning Plan" / "My Teaching Plan".

const USER_TYPE_LABEL = {
  specialist: 'Specialist',
  beneficiary: 'Beneficiary',
};

const SEX_OPTIONS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const WORK_OPTIONS = [
  { value: 'unemployed', label: 'Unemployed' },
  { value: 'employed', label: 'Employed' },
  { value: 'self_employed', label: 'Self-employed or business owner' },
  { value: 'student', label: 'Student' },
];

const CIVIL_STATUS_OPTIONS = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'widowed', label: 'Widowed' },
  { value: 'separated', label: 'Separated' },
];

const EDUCATION_OPTIONS = [
  { value: 'elementary', label: 'Elementary' },
  { value: 'high_school', label: 'High school' },
  { value: 'senior_high', label: 'Senior high school' },
  { value: 'vocational', label: 'Vocational / TESDA' },
  { value: 'college_level', label: 'College level' },
  { value: 'college_graduate', label: 'College graduate' },
  { value: 'postgraduate', label: 'Postgraduate' },
];

const SECTOR_OPTIONS = [
  { value: 'pwd', label: 'Person with disability (PWD)' },
  { value: 'four_ps', label: '4Ps beneficiary' },
  { value: 'indigenous', label: 'Indigenous people (IP)' },
  { value: 'solo_parent', label: 'Solo parent' },
  { value: 'out_of_school_youth', label: 'Out-of-school youth' },
];

function ageFromBirthdate(birthdate) {
  if (!birthdate) return null;
  const born = new Date(`${birthdate}T00:00:00`);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  if (now.getMonth() < born.getMonth() || (now.getMonth() === born.getMonth() && now.getDate() < born.getDate())) age -= 1;
  return age;
}

const inputClass = 'w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent';

function initials(name) {
  return name?.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '?';
}

function formFrom(data) {
  return {
    fullName: data?.full_name || '',
    sex: data?.sex || '',
    birthdate: data?.birthdate || '',
    civilStatus: data?.civil_status || '',
    education: data?.education || '',
    sectorTags: data?.sector_tags || [],
    place: placeFromProfile(data),
    workStatus: data?.work_status || '',
    mobileNumber: data?.mobile_number || '',
    schoolOrOrg: data?.school_or_org || '',
    bio: data?.bio || '',
  };
}

function Field({ label, htmlFor, hint, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-semibold text-slate-800">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Card({ title, description, children }) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-brand-600">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

// How complete the profile is, as a ring.
function CompletionRing({ percent }) {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg viewBox="0 0 72 72" className="h-20 w-20" role="img" aria-label={`Profile ${percent}% complete`}>
      <circle cx="36" cy="36" r={radius} fill="none" stroke="#E8EFF6" strokeWidth="7" />
      <circle
        cx="36" cy="36" r={radius} fill="none" stroke={percent === 100 ? '#10b981' : '#FE8101'} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={circumference * (1 - percent / 100)} transform="rotate(-90 36 36)"
      />
      <text x="36" y="40" textAnchor="middle" className="fill-brand-600 text-[15px] font-extrabold">{percent}%</text>
    </svg>
  );
}

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(formFrom(null));
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function loadProfile() {
    axiosClient.get('/users/me')
      .then((response) => {
        const data = response.data.data;
        setProfile(data);
        setForm(formFrom(data));
        setLoadError('');
        updateUser({ fullName: data.full_name, avatarUrl: data.avatar_url, bio: data.bio });
      })
      .catch((requestError) => setLoadError(requestError.response?.data?.message || 'Could not load your profile.'));
  }

  useEffect(() => {
    loadProfile();
  }, []);

  // Show the chosen photo right away; it's uploaded on Save.
  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview('');
      return undefined;
    }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  const userType = profile?.user_type || user?.userType;
  const isBeneficiary = userType === 'beneficiary';

  function update(changes) {
    setForm((current) => ({ ...current, ...changes }));
    setMessage('');
    setError('');
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!form.fullName.trim()) return setError('Enter your full name.');
    const age = ageFromBirthdate(form.birthdate);
    if (form.birthdate && (age === null || age < 12 || age > 100)) {
      return setError('Check your birthdate: age must be from 12 to 100.');
    }
    const problem = placeError(form.place, isBeneficiary);
    if (problem) return setError(problem);
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('fullName', form.fullName.trim());
      formData.append('sex', form.sex);
      formData.append('birthdate', form.birthdate);
      formData.append('civilStatus', form.civilStatus);
      formData.append('education', form.education);
      formData.append('sectorTags', JSON.stringify(form.sectorTags));
      formData.append('workStatus', form.workStatus);
      if (placeHasData(form.place)) {
        Object.entries(placePayload(form.place)).forEach(([key, value]) => formData.append(key, value));
      }
      formData.append('mobileNumber', form.mobileNumber.trim());
      formData.append('schoolOrOrg', form.schoolOrOrg.trim());
      formData.append('bio', form.bio);
      if (avatarFile) formData.append('avatar', avatarFile);
      await axiosClient.patch('/users/me', formData);
      setAvatarFile(null);
      setMessage('Profile saved.');
      loadProfile();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to save your profile.');
    } finally {
      setSaving(false);
    }
  }

  const checklist = [
    ['Profile photo', Boolean(avatarPreview || profile?.avatar_url)],
    ['Sex', Boolean(form.sex)],
    ['Birthdate', Boolean(form.birthdate)],
    ['Civil status', Boolean(form.civilStatus)],
    ['Education', Boolean(form.education)],
    ['Current work', Boolean(form.workStatus)],
    ['Mobile number', Boolean(form.mobileNumber.trim())],
    ['Address', placeHasData(form.place)],
    ['Short bio', Boolean(form.bio.trim())],
  ];
  const missing = checklist.filter(([, done]) => !done).map(([label]) => label);
  const percent = Math.round(((checklist.length - missing.length) / checklist.length) * 100);
  const photo = avatarPreview || profile?.avatar_url;

  return (
    <AppLayout>
      <PageHeader
        eyebrow="Account"
        title="My Profile"
        subtitle={isBeneficiary ? 'Your personal details. Your pre-assessment, topics and preferred setup are on My Learning Plan.' : 'Your personal details. Your topics and preferred setup are on My Teaching Plan.'}
        actions={<Link to="/learning-plan" className={headerButtonClass}>{isBeneficiary ? 'My Learning Plan' : 'My Teaching Plan'} →</Link>}
      />

      {loadError && <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{loadError}</p>}

      {profile && (
        <div className="grid items-start gap-6 lg:grid-cols-3">
          <aside className="rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm lg:sticky lg:top-6">
            <label htmlFor="profile-avatar" className="group relative mx-auto block h-28 w-28 cursor-pointer" title="Change photo">
              {photo
                ? <img src={photo} alt={`${profile.full_name}'s profile`} className="h-28 w-28 rounded-full object-cover ring-4 ring-brand-50" />
                : <span className="flex h-28 w-28 items-center justify-center rounded-full bg-brand-600 text-3xl font-bold text-white ring-4 ring-brand-50">{initials(profile.full_name)}</span>}
              <span className="absolute inset-x-0 bottom-0 rounded-b-full bg-brand-900/70 py-1 text-xs font-semibold text-white opacity-90 group-hover:opacity-100">Change photo</span>
            </label>
            <input
              id="profile-avatar"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => { setAvatarFile(e.target.files?.[0] || null); setMessage(''); }}
              className="sr-only"
            />
            <p className="mt-1 text-[12px] text-slate-400">PNG, JPG, or WEBP up to 5 MB.</p>
            {avatarFile && <p className="mt-1 text-xs font-medium text-amber-700">New photo chosen. Press Save changes to use it.</p>}
            <p className="mt-3 text-lg font-bold text-slate-900">{profile.full_name}</p>
            {profile.user_type && <span className="mt-1 inline-block rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-600">{USER_TYPE_LABEL[profile.user_type]}</span>}
            <p className="mt-1 break-all text-sm text-slate-500">{profile.email}</p>

            <div className="mt-5 flex items-center gap-4 rounded-xl bg-stone-50 p-3 text-left">
              <CompletionRing percent={percent} />
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">Profile complete{percent === 100 && <LineIcon name="check" strokeWidth={2.5} className="h-4 w-4 text-emerald-600" />}</p>
                {missing.length > 0 && <p className="mt-0.5 text-xs text-slate-500">Still missing: {missing.join(', ')}</p>}
              </div>
            </div>
          </aside>

          <form onSubmit={saveProfile} className="space-y-6 lg:col-span-2">
            <Card title="Personal" description="Used for your account and for ELEVATE program reports. Only the extension team can see them.">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Full name" htmlFor="profile-name">
                  <input id="profile-name" value={form.fullName} onChange={(e) => update({ fullName: e.target.value })} maxLength={150} className={inputClass} />
                </Field>
                <Field label="Email" htmlFor="profile-email" hint="Contact the admin to change your sign-in email.">
                  <input id="profile-email" value={profile.email} readOnly className={`${inputClass} bg-stone-50 text-slate-500`} />
                </Field>
                <Field label="Sex" htmlFor="profile-sex">
                  <select id="profile-sex" value={form.sex} onChange={(e) => update({ sex: e.target.value })} className={inputClass}>
                    <option value="">Choose…</option>
                    {SEX_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </Field>
                <Field
                  label="Birthdate"
                  htmlFor="profile-birthdate"
                  hint={ageFromBirthdate(form.birthdate) !== null ? `Age ${ageFromBirthdate(form.birthdate)}` : undefined}
                >
                  <input id="profile-birthdate" type="date" value={form.birthdate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => update({ birthdate: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Civil status" htmlFor="profile-civil">
                  <select id="profile-civil" value={form.civilStatus} onChange={(e) => update({ civilStatus: e.target.value })} className={inputClass}>
                    <option value="">Choose…</option>
                    {CIVIL_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </Field>
                <Field label="Highest education" htmlFor="profile-education">
                  <select id="profile-education" value={form.education} onChange={(e) => update({ education: e.target.value })} className={inputClass}>
                    <option value="">Choose…</option>
                    {EDUCATION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </Field>
                <Field label="Current work" htmlFor="profile-work">
                  <select id="profile-work" value={form.workStatus} onChange={(e) => update({ workStatus: e.target.value })} className={inputClass}>
                    <option value="">Choose…</option>
                    {WORK_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </Field>
              </div>

              <fieldset className="mt-6">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <legend className="text-sm font-semibold text-slate-800">Do any of these apply to you? <span className="font-normal text-slate-500">(optional)</span></legend>
                  <SelectAllControls
                    label="sectors"
                    onCheckAll={() => update({ sectorTags: SECTOR_OPTIONS.map((option) => option.value) })}
                    onClear={() => update({ sectorTags: [] })}
                    allChecked={form.sectorTags.length === SECTOR_OPTIONS.length}
                    noneChecked={!form.sectorTags.length}
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SECTOR_OPTIONS.map((option) => {
                    const checked = form.sectorTags.includes(option.value);
                    return (
                      <label key={option.value} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition ${checked ? 'border-brand-300 bg-brand-50' : 'border-stone-200 hover:bg-stone-50'}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => update({ sectorTags: checked ? form.sectorTags.filter((tag) => tag !== option.value) : [...form.sectorTags, option.value] })}
                          className="h-4 w-4 rounded"
                        />
                        {option.label}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </Card>

            <Card
              title="Contact & address"
              description={isBeneficiary
                ? 'Your address is also used to find specialists who hold face-to-face sessions near you.'
                : 'Your address is also where you hold face-to-face sessions: beneficiaries near it are matched to you first.'}
            >
              <div className="mb-5 max-w-sm">
                <Field label="Mobile number" htmlFor="profile-mobile">
                  <input id="profile-mobile" type="tel" value={form.mobileNumber} onChange={(e) => update({ mobileNumber: e.target.value })} maxLength={20} placeholder="09XX XXX XXXX" className={inputClass} />
                </Field>
              </div>
              <PlaceFields value={form.place} onChange={(place) => update({ place })} idPrefix="profile-place" />
            </Card>

            <Card title="About you">
              <div className="grid gap-5">
                <Field label="School or organization" htmlFor="profile-org">
                  <input id="profile-org" value={form.schoolOrOrg} onChange={(e) => update({ schoolOrOrg: e.target.value })} maxLength={190} className={inputClass} />
                </Field>
                <Field label="Short bio" htmlFor="profile-bio">
                  <textarea id="profile-bio" rows="3" value={form.bio} onChange={(e) => update({ bio: e.target.value })} maxLength={1000} placeholder="Tell people a little about yourself" className={`${inputClass} resize-y`} />
                </Field>
              </div>
            </Card>

            <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white/95 px-5 py-3 shadow-lg backdrop-blur">
              <div className="min-w-0 text-sm">
                {error && <p role="alert" className="text-red-600">{error}</p>}
                {message && <p role="status" className="text-emerald-700">{message}</p>}
                {!error && !message && <p className="text-slate-500">Remember to save your changes.</p>}
              </div>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-accent-500 px-5 py-2.5 text-sm font-bold text-brand-900 transition hover:bg-accent-550 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </AppLayout>
  );
}
