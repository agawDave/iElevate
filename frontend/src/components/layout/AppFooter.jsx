import ctuSeal from '../../assets/seal-ctu.webp';
import bsitSeal from '../../assets/seal-ctu-tuburan-bsit.webp';

// The bottom of every signed-in page: the university's and the program's
// seals, who runs ELEVATE, and the tagline. Not printed. dark: in the landing page's navy band.
export default function AppFooter({ dark = false }) {
  return (
    <footer className={`mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 py-5 print:hidden ${dark ? '' : 'mt-12 border-t border-stone-200'}`}>
      <div className="flex items-center gap-3.5">
        <span className="flex shrink-0 gap-1.5">
          <img src={ctuSeal} alt="Cebu Technological University seal" width="40" height="40" className="h-10 w-10 rounded-full" />
          <img src={bsitSeal} alt="BSIT, CTU Tuburan Campus seal" width="40" height="40" className="h-10 w-10 rounded-full" />
        </span>
        <div className="min-w-0">
          <p className={`text-[13px] font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>ELEVATE Program</p>
          <p className={`text-xs ${dark ? 'text-brand-100' : 'text-slate-500'}`}>Cebu Technological University – Tuburan Campus · Bachelor of Science in Information Technology</p>
        </div>
      </div>
      <p className={`text-xs ${dark ? 'text-brand-100' : 'text-stone-500'}`}>© {new Date().getFullYear()} iELEVATE · Learn. Teach. Elevate.</p>
    </footer>
  );
}
