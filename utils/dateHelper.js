/**
 * Parses dates in various formats (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, ISO)
 * and returns a valid JavaScript Date object or null.
 */
export function parseFlexibleDate(val) {
  if (!val) return null;
  const str = String(val).trim();
  if (!str) return null;

  // Match DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const dmy = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmy) {
    const day = parseInt(dmy[1], 10);
    const month = parseInt(dmy[2], 10) - 1;
    const year = parseInt(dmy[3], 10);
    const d = new Date(year, month, day);
    if (!Number.isNaN(d.getTime())) return d;
  }

  // Fallback to standard Date parsing
  const d = new Date(str);
  if (!Number.isNaN(d.getTime())) return d;

  return null;
}
