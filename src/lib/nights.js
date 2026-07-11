// src/lib/nights.js — group timestamps into "pancake nights".
// A night runs 6 AM to 6 AM so orders past midnight stay with the
// night they belong to.

const NIGHT_SHIFT_MS = 6 * 60 * 60 * 1000;

export function nightKeyOf(date) {
  const shifted = new Date(date.getTime() - NIGHT_SHIFT_MS);
  const y = shifted.getFullYear();
  const m = String(shifted.getMonth() + 1).padStart(2, '0');
  const d = String(shifted.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function nightLabel(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
}
