import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

// Learner-pipeline charts. Colors are fixed per category (validated with the
// dataviz palette checker on the white card surface: CVD-safe all-pairs;
// aqua is under 3:1 contrast, so every chart ships direct labels + a table).
export const PIPELINE_SERIES = [
  { key: 'incoming', label: 'Incoming', color: '#eb6834' },
  { key: 'ongoing', label: 'Ongoing', color: '#2a78d6' },
  { key: 'completed', label: 'Completed', color: '#1baf7a' },
];

export const TREND_SERIES = [
  { key: 'newMatches', label: 'New applications', color: '#eb6834' },
  { key: 'completed', label: 'Completed', color: '#1baf7a' },
];

const INK = { primary: '#14202B', secondary: '#4A5866', muted: '#7D8996', grid: '#EDF1F4', axis: '#D9DFE5', surface: '#FFFFFF' };

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(ref.current);
    setWidth(Math.floor(ref.current.getBoundingClientRect().width));
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

function niceMax(value) {
  if (value <= 4) return Math.max(value, 1);
  const step = value <= 10 ? 2 : value <= 25 ? 5 : value <= 50 ? 10 : 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / step) * step;
}

function ticks(max) {
  const step = max <= 4 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : max <= 50 ? 10 : max / 5;
  const values = [];
  for (let value = 0; value <= max + 0.0001; value += step) values.push(Math.round(value));
  return values;
}

function shortWeek(isoDate) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function Tooltip({ tip }) {
  if (!tip) return null;
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 min-w-36 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs shadow-lg"
      style={{ left: tip.x, top: tip.y, transform: `translate(${tip.alignRight ? '-100%' : '0'}, -100%)` }}
    >
      <p className="mb-1 font-semibold text-slate-900">{tip.title}</p>
      {tip.rows.map((row) => (
        <p key={row.label} className="flex items-center justify-between gap-4 text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: row.color }} aria-hidden="true" />
            {row.label}
          </span>
          <span className="font-semibold tabular-nums text-slate-900">{row.value}</span>
        </p>
      ))}
    </div>
  );
}

// The legend is also the category toggle ("toggle the categories").
export function SeriesToggle({ series, visible, onChange }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Show categories">
      {series.map((item) => {
        const on = visible.includes(item.key);
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={on}
            onClick={() => {
              const next = on ? visible.filter((key) => key !== item.key) : series.map((s) => s.key).filter((key) => key === item.key || visible.includes(key));
              if (next.length) onChange(next);
            }}
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${on ? 'border-stone-300 bg-white text-slate-800' : 'border-dashed border-stone-300 bg-stone-50 text-slate-400'}`}
            title={on ? `Hide ${item.label}` : `Show ${item.label}`}
          >
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: on ? item.color : 'transparent', boxShadow: on ? 'none' : `inset 0 0 0 1.5px ${item.color}` }} aria-hidden="true" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function StatTiles({ summary, series = PIPELINE_SERIES }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {series.map((item) => (
        <div key={item.key} className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} aria-hidden="true" />
            {item.label}
          </p>
          <p className="mt-1 text-3xl font-extrabold text-brand-600">{summary?.[item.key] ?? '—'}</p>
        </div>
      ))}
    </div>
  );
}

function TableToggle({ showTable, setShowTable }) {
  return (
    <button type="button" onClick={() => setShowTable(!showTable)} className="text-xs font-semibold text-brand-600 hover:underline print:hidden">
      {showTable ? 'Show as chart' : 'Show as table'}
    </button>
  );
}

// Horizontal stacked bars: one row per topic, one segment per visible category.
export function StackedTopicBars({ rows, series = PIPELINE_SERIES, visible, emptyText = 'No learners yet.' }) {
  const [ref, width] = useWidth();
  const [tip, setTip] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const shown = series.filter((item) => visible.includes(item.key));
  const total = (row) => shown.reduce((sum, item) => sum + (row[item.key] || 0), 0);
  const max = niceMax(Math.max(0, ...rows.map(total)));
  const labelWidth = Math.min(220, Math.max(120, width * 0.32));
  const valueGutter = 32;
  const plotWidth = Math.max(40, width - labelWidth - valueGutter);
  const rowHeight = 30;
  const barHeight = 18;
  const axisHeight = 22;
  const height = rows.length * rowHeight + axisHeight;
  const x = (value) => (value / max) * plotWidth;

  if (!rows.length) return <p className="py-6 text-center text-sm text-slate-500">{emptyText}</p>;

  return (
    <div>
      <div className="mb-2 flex justify-end"><TableToggle showTable={showTable} setShowTable={setShowTable} /></div>
      {showTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-medium">Topic</th>
                {shown.map((item) => <th key={item.key} className="px-3 py-2 text-right font-medium">{item.label}</th>)}
                <th className="py-2 pl-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.moduleId} className="border-b border-stone-100 last:border-0">
                  <td className="py-2 pr-3 text-slate-800">{row.title}</td>
                  {shown.map((item) => <td key={item.key} className="px-3 py-2 text-right tabular-nums">{row[item.key] || 0}</td>)}
                  <td className="py-2 pl-3 text-right font-semibold tabular-nums">{total(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={ref} className="relative" onMouseLeave={() => setTip(null)}>
          {width > 0 && (
            <svg width={width} height={height} role="img" aria-label="Learners per topic by category">
              {ticks(max).map((value) => (
                <g key={value}>
                  <line x1={labelWidth + x(value)} x2={labelWidth + x(value)} y1={0} y2={rows.length * rowHeight} stroke={value === 0 ? INK.axis : INK.grid} strokeWidth="1" />
                  <text x={labelWidth + x(value)} y={height - 6} textAnchor="middle" fontSize="11" fill={INK.muted} style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</text>
                </g>
              ))}
              {rows.map((row, index) => {
                const y = index * rowHeight + (rowHeight - barHeight) / 2;
                const parts = shown.filter((item) => row[item.key] > 0);
                let offset = 0;
                const rowTotal = total(row);
                return (
                  <g key={row.moduleId}>
                    <text x={labelWidth - 10} y={y + barHeight / 2 + 4} textAnchor="end" fontSize="12" fill={INK.secondary}>
                      {row.title.length > 30 && width < 640 ? `${row.title.slice(0, 28)}…` : row.title}
                    </text>
                    {parts.map((item, partIndex) => {
                      const segmentWidth = x(row[item.key]);
                      const gap = partIndex < parts.length - 1 ? 2 : 0;
                      const left = labelWidth + offset;
                      offset += segmentWidth;
                      const isEnd = partIndex === parts.length - 1;
                      const w = Math.max(1, segmentWidth - gap);
                      const r = isEnd ? Math.min(4, w / 2) : 0;
                      // Square at the baseline, 4px rounded at the data end.
                      const d = `M${left},${y} h${w - r} q${r},0 ${r},${r} v${barHeight - 2 * r} q0,${r} -${r},${r} h-${w - r} z`;
                      return (
                        <path
                          key={item.key}
                          d={d}
                          fill={item.color}
                          onMouseMove={(event) => {
                            const box = ref.current.getBoundingClientRect();
                            const px = event.clientX - box.left;
                            setTip({ x: px + 12, y: event.clientY - box.top - 8, alignRight: px > width - 180, title: row.title, rows: shown.map((s) => ({ label: s.label, color: s.color, value: row[s.key] || 0 })) });
                          }}
                        />
                      );
                    })}
                    {/* Larger invisible hit target across the whole row. */}
                    <rect
                      x={labelWidth}
                      y={index * rowHeight}
                      width={plotWidth}
                      height={rowHeight}
                      fill="transparent"
                      onMouseMove={(event) => {
                        const box = ref.current.getBoundingClientRect();
                        const px = event.clientX - box.left;
                        setTip({ x: px + 12, y: event.clientY - box.top - 8, alignRight: px > width - 180, title: row.title, rows: shown.map((s) => ({ label: s.label, color: s.color, value: row[s.key] || 0 })) });
                      }}
                    />
                    <text x={labelWidth + x(rowTotal) + 6} y={y + barHeight / 2 + 4} fontSize="12" fontWeight="600" fill={INK.primary} style={{ fontVariantNumeric: 'tabular-nums' }}>{rowTotal}</text>
                  </g>
                );
              })}
            </svg>
          )}
          <Tooltip tip={tip} />
        </div>
      )}
    </div>
  );
}

// Trend over time: one line per series, crosshair + tooltip on hover.
// unit: 'week' (rows start on Mondays) or 'day'.
export function WeeklyTrendChart({ trend, series = TREND_SERIES, unit = 'week' }) {
  const periodTitle = (iso) => (unit === 'day' ? shortWeek(iso) : `Week of ${shortWeek(iso)}`);
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const height = 220;
  const endText = (item) => `${trend[trend.length - 1]?.[item.key] || 0} ${item.label.replace('New applications', 'new')}`;
  // Room on the right for the longest end label (12px text, about 6.8px a character).
  const margin = { top: 16, right: Math.max(120, Math.ceil(Math.max(0, ...series.map((item) => endText(item).length)) * 6.8) + 18), bottom: 28, left: 32 };
  const plotWidth = Math.max(40, width - margin.left - margin.right);
  const plotHeight = height - margin.top - margin.bottom;
  const max = niceMax(Math.max(0, ...trend.flatMap((week) => series.map((item) => week[item.key] || 0))));
  const x = (index) => margin.left + (trend.length > 1 ? (index / (trend.length - 1)) * plotWidth : plotWidth / 2);
  const y = (value) => margin.top + plotHeight - (value / max) * plotHeight;
  const last = trend.length - 1;

  // Direct end labels; spread apart only where they would overlap (14px apart).
  const endLabels = useMemo(() => {
    const labels = series.map((item) => ({ ...item, y: y(trend[last]?.[item.key] || 0) })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < labels.length; i += 1) {
      if (labels[i].y - labels[i - 1].y < 14) labels[i].y = labels[i - 1].y + 14;
    }
    // If that pushed the bottom label below the plot, shift the group up.
    const overflow = labels.length ? labels[labels.length - 1].y - (margin.top + plotHeight + 4) : 0;
    if (overflow > 0) labels.forEach((label) => { label.y -= overflow; });
    return labels;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trend, series, width]);

  if (!trend.length) return null;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-4 text-xs text-slate-600">
          {series.map((item) => (
            <span key={item.key} className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 rounded" style={{ background: item.color }} aria-hidden="true" />
              {item.label}
            </span>
          ))}
        </div>
        <TableToggle showTable={showTable} setShowTable={setShowTable} />
      </div>
      {showTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-medium">{unit === 'day' ? 'Day' : 'Week of'}</th>
                {series.map((item) => <th key={item.key} className="px-3 py-2 text-right font-medium">{item.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {trend.map((week) => (
                <tr key={week.weekStart} className="border-b border-stone-100 last:border-0">
                  <td className="py-2 pr-3 text-slate-800">{shortWeek(week.weekStart)}</td>
                  {series.map((item) => <td key={item.key} className="px-3 py-2 text-right tabular-nums">{week[item.key] || 0}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={ref} className="relative">
          {width > 0 && (
            <svg
              width={width}
              height={height}
              role="img"
              aria-label="Weekly trend"
              onMouseLeave={() => setHover(null)}
              onMouseMove={(event) => {
                const box = event.currentTarget.getBoundingClientRect();
                const px = event.clientX - box.left;
                const index = Math.max(0, Math.min(last, Math.round(((px - margin.left) / plotWidth) * last)));
                setHover(index);
              }}
            >
              {ticks(max).map((value) => (
                <g key={value}>
                  <line x1={margin.left} x2={margin.left + plotWidth} y1={y(value)} y2={y(value)} stroke={value === 0 ? INK.axis : INK.grid} strokeWidth="1" />
                  <text x={margin.left - 8} y={y(value) + 4} textAnchor="end" fontSize="11" fill={INK.muted} style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</text>
                </g>
              ))}
              {trend.map((week, index) => (
                // Thin out the date labels so they never crowd (about one per 70px).
                (index % Math.max(1, Math.ceil(trend.length / Math.max(1, Math.floor(plotWidth / 70)))) === 0 || index === last) && (
                  <text key={week.weekStart} x={x(index)} y={height - 8} textAnchor="middle" fontSize="11" fill={INK.muted}>{shortWeek(week.weekStart)}</text>
                )
              ))}
              {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={margin.top} y2={margin.top + plotHeight} stroke={INK.axis} strokeWidth="1" />}
              {series.map((item) => (
                <g key={item.key}>
                  <polyline
                    fill="none"
                    stroke={item.color}
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={trend.map((week, index) => `${x(index)},${y(week[item.key] || 0)}`).join(' ')}
                  />
                  {[hover ?? last].map((index) => (
                    <circle key={index} cx={x(index)} cy={y(trend[index][item.key] || 0)} r="4" fill={item.color} stroke={INK.surface} strokeWidth="2" />
                  ))}
                </g>
              ))}
              {endLabels.map((item) => (
                <text key={item.key} x={x(last) + 10} y={item.y + 4} fontSize="12" fill={INK.secondary}>
                  <tspan fontWeight="600" fill={INK.primary}>{trend[last][item.key] || 0}</tspan> {item.label.replace('New applications', 'new')}
                </text>
              ))}
            </svg>
          )}
          {hover !== null && width > 0 && (
            <Tooltip
              tip={{
                x: x(hover) + 10,
                y: margin.top + 4,
                alignRight: x(hover) > width - 190,
                title: periodTitle(trend[hover].weekStart),
                rows: series.map((item) => ({ label: item.label, color: item.color, value: trend[hover][item.key] || 0 })),
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// Keeps the series toggle state per chart, remembering it for the session.
export function useVisibleSeries(storageKey, series = PIPELINE_SERIES) {
  const all = series.map((item) => item.key);
  const [visible, setVisible] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
      return Array.isArray(saved) && saved.length && saved.every((key) => all.includes(key)) ? saved : all;
    } catch {
      return all;
    }
  });
  useEffect(() => {
    try { sessionStorage.setItem(storageKey, JSON.stringify(visible)); } catch { /* storage unavailable */ }
  }, [storageKey, visible]);
  return [visible, setVisible];
}
