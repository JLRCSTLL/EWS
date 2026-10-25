export const logCategories = {
  all: 'All events', alerts: 'Alerts', groups: 'Groups', requests: 'Assistance', operations: 'Operations', access: 'Access',
} as const;
export type LogCategory = keyof typeof logCategories;
export interface ActivityEntry {
  id: string; action: string; category: Exclude<LogCategory, 'all'>; actor: string;
  target: string; reference: string | null; createdAt: string;
}
export interface ActivityPage { entries: ActivityEntry[]; nextCursor: string | null }

/** Quote CSV correctly and neutralize spreadsheet formulas in user-supplied labels. */
export function activityCsv(entries: ActivityEntry[]) {
  const cell = (value: string) => `"${(/^[\s\u0000-\u001f]*[=+@-]/.test(value) ? `'${value}` : value).replace(/"/g, '""')}"`;
  return '\uFEFF' + [
    ['Time (UTC)', 'Event', 'Category', 'Operator / actor', 'Record', 'Reference'],
    ...entries.map(entry => [entry.createdAt, entry.action, logCategories[entry.category], entry.actor, entry.target, entry.reference || '']),
  ].map(row => row.map(cell).join(',')).join('\r\n');
}
