// src/lib/constants.js — single source of truth for order lifecycle and menu.
// Safe to import from both client components and server routes.

// Lifecycle: Pending -> Cooking (-> Delayed) -> Done (food ready, completedAt set)
// -> Completed (picked up / removed from the home board)
export const ORDER_STATUS = {
  PENDING: 'Pending',
  COOKING: 'Cooking',
  DELAYED: 'Delayed',
  DONE: 'Done',
  COMPLETED: 'completed',
};

// Statuses shown on the kitchen display (still being worked on)
export const KITCHEN_STATUSES = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.COOKING,
  ORDER_STATUS.DELAYED,
];

// Statuses shown on the home board (everything not yet picked up)
export const BOARD_STATUSES = [...KITCHEN_STATUSES, ORDER_STATUS.DONE];

// Orders that count for the leaderboard (food was actually made)
export const FULFILLED_STATUSES = [ORDER_STATUS.DONE, ORDER_STATUS.COMPLETED];

export const GUEST_PANCAKE_OPTIONS = [
  'Plain',
  'Chocolate Chip',
  'Banana',
  'Blueberry',
];

// Admins can also ring up the weekly special
export const ADMIN_PANCAKE_OPTIONS = [...GUEST_PANCAKE_OPTIONS, 'Special'];

// Every order is one plate of two pancakes
export const PANCAKES_PER_ORDER = 2;

// Guests must wait this long between orders
export const GUEST_COOLDOWN_MS = 15 * 60 * 1000;

// Wait-time card coloring defaults (admin-configurable via config/display)
export const DEFAULT_WAIT_THRESHOLDS = {
  warnMinutes: 7, // card turns yellow
  dangerMinutes: 12, // card turns red
};
