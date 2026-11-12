// CSV download for report tables. Opens correctly in Excel (UTF-8 BOM).

function cell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// columns: [{ label, value: (row) => any }]
export function toCsv(rows, columns) {
  const lines = [columns.map((column) => cell(column.label)).join(',')];
  rows.forEach((row) => lines.push(columns.map((column) => cell(column.value(row))).join(',')));
  return lines.join('\r\n');
}

export function downloadCsv(filename, rows, columns) {
  const blob = new Blob([`﻿${toCsv(rows, columns)}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function csvDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}
