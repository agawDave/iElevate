// Grey placeholders shaped like the content that's on its way, instead of a
// "Loading…" line. They pulse only when the user allows motion, and screen
// readers still hear what's loading.

export function SkeletonBlock({ className = '' }) {
  return <span className={`block rounded-md bg-stone-200/80 motion-safe:animate-pulse ${className}`} aria-hidden="true" />;
}

const WIDTHS = ['w-2/5', 'w-full', 'w-11/12', 'w-4/5', 'w-3/5', 'w-full', 'w-5/6'];

function Lines({ lines }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: lines }, (_, index) => <SkeletonBlock key={index} className={`h-3.5 ${WIDTHS[index % WIDTHS.length]}`} />)}
    </div>
  );
}

// A few lines of text (panels, forms, short sections).
export function SkeletonLines({ lines = 4, label = 'Loading…', className = '' }) {
  return (
    <div role="status" className={className}>
      <Lines lines={lines} />
      <span className="sr-only">{label}</span>
    </div>
  );
}

function Card({ children, className = '' }) {
  return <div className={`rounded-2xl border border-stone-200 bg-white p-5 ${className}`}>{children}</div>;
}

// A grid of cards (topics, modules).
export function SkeletonCards({ count = 4, label = 'Loading…' }) {
  return (
    <div role="status" className="grid gap-4 md:grid-cols-2">
      {Array.from({ length: count }, (_, index) => (
        <Card key={index}>
          <SkeletonBlock className="mb-3 h-5 w-1/2" />
          <Lines lines={3} />
          <div className="mt-5 flex gap-2"><SkeletonBlock className="h-9 w-32 rounded-lg" /><SkeletonBlock className="h-9 w-24 rounded-lg" /></div>
        </Card>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

// Table rows for a list that's loading (inside a <tbody>).
export function SkeletonTableRows({ columns, rows = 5 }) {
  return Array.from({ length: rows }, (_, row) => (
    <tr key={row} className="border-b border-stone-100 last:border-0">
      {Array.from({ length: columns }, (_, column) => (
        <td key={column} className="px-4 py-3.5">
          {column === 0 ? (
            <span className="flex items-center gap-3">
              <SkeletonBlock className="h-9 w-9 shrink-0 rounded-full" />
              <span className="flex-1 space-y-1.5"><SkeletonBlock className="h-3.5 w-28" /><SkeletonBlock className="h-3 w-36" /></span>
              {row === 0 && <span className="sr-only" role="status">Loading…</span>}
            </span>
          ) : <SkeletonBlock className={`h-3.5 ${column % 2 ? 'w-16' : 'w-24'}`} />}
        </td>
      ))}
    </tr>
  ));
}

// The dashboards: four number tiles, then the two columns of cards.
export function DashboardSkeleton({ label = 'Loading your dashboard…' }) {
  return (
    <div role="status">
      <div className="mb-7 grid grid-cols-2 gap-5 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4">
            <SkeletonBlock className="h-11 w-11 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2"><SkeletonBlock className="h-6 w-10" /><SkeletonBlock className="h-3 w-24" /></div>
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3"><SkeletonBlock className="mb-4 h-5 w-32" /><Lines lines={6} /></Card>
        <div className="space-y-5 lg:col-span-2">
          <Card><SkeletonBlock className="mb-4 h-5 w-40" /><Lines lines={3} /></Card>
          <Card><SkeletonBlock className="mb-4 h-5 w-36" /><Lines lines={3} /></Card>
        </div>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

// A chart area.
export function SkeletonChart({ label = 'Loading the charts…', height = 'h-64' }) {
  return (
    <div role="status" className="grid gap-4 xl:grid-cols-2">
      {[0, 1].map((index) => (
        <Card key={index}><SkeletonBlock className="mb-4 h-5 w-40" /><SkeletonBlock className={`${height} w-full rounded-xl`} /></Card>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}
