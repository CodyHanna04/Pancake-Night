// Permission audit for Pancake Night — simulates every role with throwaway
// test identities and checks Firestore rules, API routes, and middleware.
// Run: node --env-file=.env.local <path>/permAudit.mjs   (from the project root)
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const PID = process.env.NEXT_FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const APP = 'http://localhost:3000';
const FS = `https://firestore.googleapis.com/v1/projects/${PID}/databases/(default)/documents`;
const CODY_UID = 'EmJF1M9FNvbtUqNHYTXQShGzao73'; // super admin (untouchable test)

initializeApp({
  credential: cert({
    projectId: PID,
    clientEmail: process.env.NEXT_FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.NEXT_FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});
const auth = getAuth();
const db = getFirestore();

const results = [];
let fixtures = { orderId: null, adminOrderId: null };

function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  <-- ' + detail}`);
}

async function idTokenFor(uid, claims) {
  const custom = await auth.createCustomToken(uid, claims);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: custom, returnSecureToken: true }),
    }
  );
  const data = await res.json();
  if (!data.idToken) throw new Error('token exchange failed: ' + JSON.stringify(data));
  return data.idToken;
}

// ---- Firestore REST helpers (rules apply to these, unlike the Admin SDK) ----
async function fsReq(method, path, token, body) {
  const res = await fetch(`${FS}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.status;
}
const f = (obj) => ({
  fields: Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k,
      typeof v === 'boolean' ? { booleanValue: v } : { stringValue: String(v) },
    ])
  ),
});

async function main() {
  console.log('== setting up test identities ==');
  const pendingTok = await idTokenFor('perm-test-pending', {});
  const guestTok = await idTokenFor('perm-test-guest', { approved: true });
  const adminTok = await idTokenFor('perm-test-admin', { admin: true, approved: true });
  const superTok = await idTokenFor('perm-test-super', { admin: true, superadmin: true, approved: true });
  await idTokenFor('perm-test-target', {}); // exists as a plain account

  const adminCookie = await auth.createSessionCookie(adminTok, { expiresIn: 5 * 60 * 1000 });
  const superCookie = await auth.createSessionCookie(superTok, { expiresIn: 5 * 60 * 1000 });
  const guestCookie = await auth.createSessionCookie(guestTok, { expiresIn: 5 * 60 * 1000 });

  // order fixture (via Admin SDK, bypasses rules)
  const fix = await db.collection('orders').add({
    userId: 'perm-test-guest', name: 'ZZ PermTest', selectedOptions: ['Plain'],
    notes: '', priority: false, status: 'Pending', createdAt: Timestamp.now(),
  });
  fixtures.orderId = fix.id;

  console.log('\n== Firestore rules: anonymous ==');
  check('anon cannot list orders', (await fsReq('GET', '/orders?pageSize=1', null)) === 403);
  check('anon cannot read config', (await fsReq('GET', '/config/guestOrdering', null)) === 403);
  check('anon cannot list users', (await fsReq('GET', '/users?pageSize=1', null)) === 403);

  console.log('\n== Firestore rules: pending (unapproved) user ==');
  check('pending cannot list orders', (await fsReq('GET', '/orders?pageSize=1', pendingTok)) === 403);
  check('pending cannot read config', (await fsReq('GET', '/config/guestOrdering', pendingTok)) === 403);
  check('pending cannot post chat', (await fsReq('POST', '/chatMessages', pendingTok, f({ userId: 'perm-test-pending', text: 'hi' }))) === 403);
  check('pending CAN create own profile (approved:false)',
    (await fsReq('POST', '/users?documentId=perm-test-pending', pendingTok, f({ name: 'Perm Test', approved: false }))) === 200);
  check('pending cannot create own profile pre-approved',
    (await fsReq('POST', '/users?documentId=perm-test-pending2', pendingTok, f({ approved: true }))) === 403,
    'note: also blocked because uid mismatch');
  check('pending CAN read own profile', (await fsReq('GET', '/users/perm-test-pending', pendingTok)) === 200);
  check('pending cannot self-approve via update',
    (await fsReq('PATCH', '/users/perm-test-pending?updateMask.fieldPaths=approved', pendingTok, f({ approved: true }))) === 403);
  check('pending cannot self-grant admin via update',
    (await fsReq('PATCH', '/users/perm-test-pending?updateMask.fieldPaths=admin', pendingTok, f({ admin: true }))) === 403);

  console.log('\n== Firestore rules: approved guest ==');
  check('guest CAN list orders (boards/leaderboard/status)', (await fsReq('GET', '/orders?pageSize=1', guestTok)) === 200);
  check('guest CAN read config (ordering window)', (await fsReq('GET', '/config/guestOrdering', guestTok)) === 200);
  check('guest cannot create order directly (must use API)',
    (await fsReq('POST', '/orders', guestTok, f({ userId: 'perm-test-guest', name: 'x', status: 'Pending' }))) === 403);
  check('guest cannot update an order',
    (await fsReq('PATCH', `/orders/${fixtures.orderId}?updateMask.fieldPaths=status`, guestTok, f({ status: 'Done' }))) === 403);
  check('guest cannot delete an order', (await fsReq('DELETE', `/orders/${fixtures.orderId}`, guestTok)) === 403);
  check('guest cannot write config',
    (await fsReq('POST', '/config?documentId=permTest', guestTok, f({ enabled: false }))) === 403);
  check('guest CAN post chat as self',
    (await fsReq('POST', '/chatMessages', guestTok, f({ userId: 'perm-test-guest', text: 'perm test' }))) === 200);
  check('guest cannot post chat as someone else',
    (await fsReq('POST', '/chatMessages', guestTok, f({ userId: CODY_UID, text: 'impersonation' }))) === 403);
  check('guest cannot post >300 char chat',
    (await fsReq('POST', '/chatMessages', guestTok, f({ userId: 'perm-test-guest', text: 'x'.repeat(301) }))) === 403);
  check('guest cannot read another user profile', (await fsReq('GET', `/users/${CODY_UID}`, guestTok)) === 403);
  check('guest cannot list users', (await fsReq('GET', '/users?pageSize=1', guestTok)) === 403);

  console.log('\n== Firestore rules: admin ==');
  check('admin CAN list users (approvals page)', (await fsReq('GET', '/users?pageSize=1', adminTok)) === 200);
  const st = await fsReq('POST', '/orders', adminTok, f({ userId: 'perm-test-admin', name: 'ZZ AdminCreate', status: 'completed' }));
  check('admin CAN create order (order submission)', st === 200);
  check('admin CAN update order (kitchen)',
    (await fsReq('PATCH', `/orders/${fixtures.orderId}?updateMask.fieldPaths=status`, adminTok, f({ status: 'Cooking' }))) === 200);
  check('admin CAN write config (settings)',
    (await fsReq('POST', '/config?documentId=permTest', adminTok, f({ test: true }))) === 200);

  console.log('\n== API routes ==');
  const api = (path, opts) => fetch(`${APP}${path}`, opts);
  let r = await api('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ selectedOptions: ['Plain'] }) });
  check('/api/orders without token -> 401', r.status === 401, `got ${r.status}`);
  r = await api('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pendingTok}` }, body: JSON.stringify({ selectedOptions: ['Plain'] }) });
  let j = await r.json();
  check('/api/orders pending user -> 403 approval message', r.status === 403 && /approval/i.test(j.error || ''), `got ${r.status} ${JSON.stringify(j)}`);
  r = await api('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${guestTok}` }, body: JSON.stringify({ selectedOptions: ['Plain'] }) });
  j = await r.json();
  check('/api/orders approved guest outside window -> 403 window message', r.status === 403 && /only open/i.test(j.error || ''), `got ${r.status} ${JSON.stringify(j)}`);

  r = await api('/api/sessionLogin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: guestTok }) });
  check('/api/sessionLogin refuses non-admin -> 403', r.status === 403, `got ${r.status}`);
  r = await api('/api/sessionLogin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: 'garbage' }) });
  check('/api/sessionLogin refuses garbage -> 401', r.status === 401, `got ${r.status}`);

  const approvals = (cookie, body) => api('/api/admin/approvals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: `__session=${cookie}` } : {}) },
    body: JSON.stringify(body),
  });
  r = await approvals(null, { uid: 'perm-test-target', action: 'approve' });
  check('approvals API without cookie -> 403', r.status === 403, `got ${r.status}`);
  r = await approvals(guestCookie, { uid: 'perm-test-target', action: 'approve' });
  check('approvals API with guest cookie -> 403', r.status === 403, `got ${r.status}`);
  r = await approvals(adminCookie, { uid: 'perm-test-target', action: 'approve' });
  check('admin can approve -> 200', r.status === 200, `got ${r.status}`);
  r = await approvals(adminCookie, { uid: 'perm-test-target', action: 'promote' });
  check('plain admin cannot promote -> 403', r.status === 403, `got ${r.status}`);
  r = await approvals(superCookie, { uid: 'perm-test-target', action: 'promote' });
  check('super admin can promote -> 200', r.status === 200, `got ${r.status}`);
  r = await approvals(adminCookie, { uid: 'perm-test-target', action: 'demote' });
  check('plain admin cannot demote -> 403', r.status === 403, `got ${r.status}`);
  r = await approvals(superCookie, { uid: 'perm-test-target', action: 'deny' });
  check('cannot deny an admin before demoting -> 400', r.status === 400, `got ${r.status}`);
  r = await approvals(superCookie, { uid: CODY_UID, action: 'demote' });
  check('super admin account untouchable (demote) -> 400', r.status === 400, `got ${r.status}`);
  r = await approvals(superCookie, { uid: CODY_UID, action: 'revoke' });
  check('super admin account untouchable (revoke) -> 400', r.status === 400, `got ${r.status}`);
  r = await approvals(superCookie, { uid: 'perm-test-target', action: 'demote' });
  check('super admin can demote -> 200', r.status === 200, `got ${r.status}`);
  r = await approvals(superCookie, { uid: 'perm-test-target', action: 'deny' });
  check('super admin can deny (deletes account) -> 200', r.status === 200, `got ${r.status}`);

  console.log('\n== Middleware ==');
  r = await fetch(`${APP}/admin`, { redirect: 'manual' });
  check('middleware: /admin no cookie -> redirect', r.status >= 300 && r.status < 400, `got ${r.status}`);
  r = await fetch(`${APP}/admin`, { redirect: 'manual', headers: { Cookie: `__session=${guestCookie}` } });
  check('middleware: /admin guest cookie -> redirect', r.status >= 300 && r.status < 400, `got ${r.status}`);
  r = await fetch(`${APP}/admin`, { redirect: 'manual', headers: { Cookie: `__session=${adminCookie}` } });
  check('middleware: /admin admin cookie -> 200', r.status === 200, `got ${r.status}`);

  // ---- cleanup ----
  console.log('\n== cleanup ==');
  await db.doc(`orders/${fixtures.orderId}`).delete();
  const adminOrders = await db.collection('orders').where('name', '==', 'ZZ AdminCreate').get();
  for (const d of adminOrders.docs) await d.ref.delete();
  const chats = await db.collection('chatMessages').where('userId', 'in', ['perm-test-guest', 'perm-test-pending']).get();
  for (const d of chats.docs) await d.ref.delete();
  await db.doc('config/permTest').delete().catch(() => {});
  for (const uid of ['perm-test-pending', 'perm-test-guest', 'perm-test-admin', 'perm-test-super', 'perm-test-target']) {
    await auth.deleteUser(uid).catch(() => {});
    await db.doc(`users/${uid}`).delete().catch(() => {});
  }
  console.log('test identities and fixtures removed');

  const failed = results.filter((x) => !x.ok);
  console.log(`\n===== ${results.length - failed.length}/${results.length} checks passed =====`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => { console.error('AUDIT CRASHED:', e); process.exit(1); });
