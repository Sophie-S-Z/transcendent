// The CSV for the action logs of the extension and the desktop app.

/** One CSV cell. Quotes every cell, and stops a spreadsheet from reading page or app text as a formula. */
const cell = (s: string) => `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`

/** A header line, then one quoted line for each row. */
export function toCsv(header: string[], rows: string[][]): string {
  return [header.join(','), ...rows.map((r) => r.map(cell).join(','))].join('\n')
}
