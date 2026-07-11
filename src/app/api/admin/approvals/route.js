// POST /api/admin/approvals — manage user accounts.
// Actions: approve | deny | revoke (any admin), promote | demote (super admin
// only). The custom claims are the enforcement; users-doc fields mirror them
// for the UI. Super admin accounts cannot be denied, revoked, or demoted.
import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

const ADMIN_ACTIONS = ['approve', 'deny', 'revoke'];
const SUPER_ACTIONS = ['promote', 'demote'];

async function getCaller(request) {
  const session = request.cookies.get('__session')?.value;
  if (!session) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(session);
    return decoded.admin === true ? decoded : null;
  } catch {
    return null;
  }
}

export async function POST(request) {
  const caller = await getCaller(request);
  if (!caller) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const { uid, action } = await request.json().catch(() => ({}));
  if (!uid || ![...ADMIN_ACTIONS, ...SUPER_ACTIONS].includes(action)) {
    return NextResponse.json(
      { error: 'Expected { uid, action: approve | deny | revoke | promote | demote }' },
      { status: 400 }
    );
  }

  // Promoting/demoting admins is reserved for the super admin
  if (SUPER_ACTIONS.includes(action) && caller.superadmin !== true) {
    return NextResponse.json(
      { error: 'Only the super admin can manage admins' },
      { status: 403 }
    );
  }

  const auth = adminAuth();
  const db = adminDb();

  const target = await auth.getUser(uid).catch(() => null);
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  const targetClaims = target.customClaims || {};

  // Super admin accounts are untouchable (except redundant approves)
  if (targetClaims.superadmin === true && action !== 'approve') {
    return NextResponse.json(
      { error: 'The super admin account cannot be modified' },
      { status: 400 }
    );
  }

  // Admins must be demoted before they can be denied or revoked
  if (['deny', 'revoke'].includes(action) && targetClaims.admin === true) {
    return NextResponse.json(
      { error: 'Demote this admin before denying or revoking them' },
      { status: 400 }
    );
  }

  const userRef = db.doc(`users/${uid}`);

  switch (action) {
    case 'approve':
      await auth.setCustomUserClaims(uid, { ...targetClaims, approved: true });
      await userRef.set(
        {
          email: target.email ?? null,
          approved: true,
          approvedAt: FieldValue.serverTimestamp(),
          approvedBy: caller.email ?? caller.uid,
        },
        { merge: true }
      );
      return NextResponse.json({ status: 'approved' });

    case 'revoke':
      await auth.setCustomUserClaims(uid, { ...targetClaims, approved: false });
      // Their current token can stay valid up to ~1h; revoking refresh
      // tokens stops it from being renewed.
      await auth.revokeRefreshTokens(uid);
      await userRef.set({ approved: false }, { merge: true });
      return NextResponse.json({ status: 'revoked' });

    case 'deny':
      await auth.deleteUser(uid);
      await userRef.delete().catch(() => {});
      return NextResponse.json({ status: 'denied' });

    case 'promote':
      await auth.setCustomUserClaims(uid, {
        ...targetClaims,
        admin: true,
        approved: true,
      });
      await userRef.set(
        { email: target.email ?? null, admin: true, approved: true },
        { merge: true }
      );
      return NextResponse.json({ status: 'promoted' });

    case 'demote':
      await auth.setCustomUserClaims(uid, { ...targetClaims, admin: false });
      await auth.revokeRefreshTokens(uid);
      await userRef.set({ admin: false }, { merge: true });
      return NextResponse.json({ status: 'demoted' });
  }
}
