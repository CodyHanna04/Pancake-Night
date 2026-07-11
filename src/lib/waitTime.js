// src/lib/waitTime.js — wait-time coloring for order cards (kitchen + home).
// The clock freezes at completedAt (stamped when the kitchen marks an order
// Done), so finished cards never keep "aging" into yellow/red.
'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DEFAULT_WAIT_THRESHOLDS } from '@/lib/constants';

export function getWaitMinutes(order, nowMs) {
  const start = order.createdAt?.toMillis?.();
  if (!start) return 0;
  const end = order.completedAt?.toMillis?.() ?? nowMs;
  return Math.max(0, (end - start) / 60000);
}

export function getWaitLevel(minutes, thresholds) {
  const warn = thresholds?.warnMinutes ?? DEFAULT_WAIT_THRESHOLDS.warnMinutes;
  const danger =
    thresholds?.dangerMinutes ?? DEFAULT_WAIT_THRESHOLDS.dangerMinutes;
  if (minutes >= danger) return 'danger';
  if (minutes >= warn) return 'warn';
  return 'ok';
}

// Inline styles layered on top of the .order-card CSS
export const WAIT_LEVEL_STYLES = {
  ok: {},
  warn: {
    borderLeft: '6px solid #ffb300',
    background: 'rgba(255, 179, 0, 0.12)',
  },
  danger: {
    borderLeft: '6px solid #e53935',
    background: 'rgba(229, 57, 53, 0.15)',
  },
};

// Live-updating thresholds from config/display (admin-editable)
export function useWaitThresholds() {
  const [thresholds, setThresholds] = useState(DEFAULT_WAIT_THRESHOLDS);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'config', 'display'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setThresholds({
            warnMinutes:
              typeof data.warnMinutes === 'number'
                ? data.warnMinutes
                : DEFAULT_WAIT_THRESHOLDS.warnMinutes,
            dangerMinutes:
              typeof data.dangerMinutes === 'number'
                ? data.dangerMinutes
                : DEFAULT_WAIT_THRESHOLDS.dangerMinutes,
          });
        }
      },
      (err) => console.error('Error loading display config:', err)
    );
    return () => unsub();
  }, []);

  return thresholds;
}

// Re-render tick so card ages advance without new snapshots
export function useNowTicker(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);

  return now;
}
