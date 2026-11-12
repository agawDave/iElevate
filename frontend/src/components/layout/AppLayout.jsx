import Sidebar from './Sidebar';
import AppFooter from './AppFooter';

// The sidebar, and the page centred in the space beside it (so wide screens
// don't leave a big empty area on the right), with the footer at the bottom
// (at the bottom of the window when the page is short).
export default function AppLayout({ children }) {
  return (
    <div className="min-h-screen bg-stone-50 text-slate-900 flex print:block print:bg-white">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col px-8 pt-8 print:block print:p-0">
        <div className="page-enter mx-auto w-full max-w-6xl flex-1 print:max-w-none">{children}</div>
        <AppFooter />
      </main>
    </div>
  );
}
