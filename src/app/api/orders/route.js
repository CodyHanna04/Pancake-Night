// POST /api/orders — guest order submission, validated server-side.
// The client sends { token, selectedOptions, notes }; we verify the Firebase
// ID token and enforce the ordering window, enabled flag, cooldown, and menu
// with the Admin SDK so none of it can be bypassed from the browser console.
import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import {
  ORDER_STATUS,
  GUEST_PANCAKE_OPTIONS,
  GUEST_COOLDOWN_MS,
} from '@/lib/constants';
import {
  isWithinOrderingWindow,
  describeOrderingWindow,
  DEFAULT_SCHEDULE,
} from '@/lib/orderWindow';

export async function POST(request) {
  let decoded;
  try {
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: 'Missing auth token' }, { status: 401 });
    }
    decoded = await adminAuth().verifyIdToken(token);
  } catch (err) {
    return NextResponse.json({ error: 'Invalid auth token' }, { status: 401 });
  }

  if (decoded.approved !== true && decoded.admin !== true) {
    return NextResponse.json(
      { error: 'Your account is waiting for admin approval.' },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const selectedOptions = Array.isArray(body.selectedOptions)
    ? body.selectedOptions.filter((o) => GUEST_PANCAKE_OPTIONS.includes(o))
    : [];
  const notes =
    typeof body.notes === 'string' ? body.notes.trim().slice(0, 500) : '';

  if (selectedOptions.length === 0) {
    return NextResponse.json(
      { error: 'Please select at least one pancake option.' },
      { status: 400 }
    );
  }

  const db = adminDb();

  // Ordering enabled + within the configured window?
  const configSnap = await db.doc('config/guestOrdering').get();
  const config = configSnap.exists ? configSnap.data() : {};
  const enabled = typeof config.enabled === 'boolean' ? config.enabled : true;
  const schedule = {
    dayOfWeek: config.dayOfWeek ?? DEFAULT_SCHEDULE.dayOfWeek,
    startHour: config.startHour ?? DEFAULT_SCHEDULE.startHour,
    endHour: config.endHour ?? DEFAULT_SCHEDULE.endHour,
  };

  if (!enabled) {
    return NextResponse.json(
      { error: 'Guest ordering is currently disabled.' },
      { status: 403 }
    );
  }
  if (!isWithinOrderingWindow(schedule, enabled)) {
    return NextResponse.json(
      { error: `Guest ordering is only open ${describeOrderingWindow(schedule)}.` },
      { status: 403 }
    );
  }

  // 15-minute cooldown, based on the user's most recent order
  const lastOrderSnap = await db
    .collection('orders')
    .where('userId', '==', decoded.uid)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  if (!lastOrderSnap.empty) {
    const lastCreated = lastOrderSnap.docs[0].data().createdAt;
    if (lastCreated) {
      const elapsed = Date.now() - lastCreated.toMillis();
      if (elapsed < GUEST_COOLDOWN_MS) {
        const waitMinutes = Math.ceil((GUEST_COOLDOWN_MS - elapsed) / 60000);
        return NextResponse.json(
          {
            error: `You recently ordered. Try again in about ${waitMinutes} minute(s).`,
            waitMinutes,
          },
          { status: 429 }
        );
      }
    }
  }

  // Display name from the user's profile, falling back to their email
  const userSnap = await db.doc(`users/${decoded.uid}`).get();
  const profileName = userSnap.exists ? userSnap.data().name : null;
  const name = profileName || decoded.email || 'Guest';

  const orderRef = await db.collection('orders').add({
    userId: decoded.uid,
    name,
    selectedOptions,
    notes,
    status: ORDER_STATUS.PENDING,
    createdAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ status: 'success', orderId: orderRef.id });
}
