// Create the composite indexes from firestore.indexes.json via the Firestore
// Admin REST API using the credentials from .env.local. Indexes that already
// exist are skipped.
//
// Usage: node --env-file=.env.local scripts/deployIndexes.mjs
import { readFileSync } from 'fs';
import { cert } from 'firebase-admin/app';

const projectId =
  process.env.NEXT_FIREBASE_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.NEXT_FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.NEXT_FIREBASE_PRIVATE_KEY;

if (!projectId || !clientEmail || !privateKey) {
  console.error('Missing NEXT_FIREBASE_* vars. Run with: node --env-file=.env.local scripts/deployIndexes.mjs');
  process.exit(1);
}

const credential = cert({
  projectId,
  clientEmail,
  privateKey: privateKey.replace(/\\n/g, '\n'),
});
const { access_token: token } = await credential.getAccessToken();

const { indexes } = JSON.parse(
  readFileSync(new URL('../firestore.indexes.json', import.meta.url), 'utf8')
);

for (const index of indexes) {
  const { collectionGroup, queryScope, fields } = index;
  const url =
    `https://firestore.googleapis.com/v1/projects/${projectId}` +
    `/databases/(default)/collectionGroups/${collectionGroup}/indexes`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ queryScope, fields }),
  });

  const label = `${collectionGroup} [${fields.map((f) => `${f.fieldPath} ${f.order}`).join(', ')}]`;
  if (res.ok) {
    console.log(`Creating index: ${label} (builds in the background)`);
  } else {
    const data = await res.json().catch(() => ({}));
    if (res.status === 409) {
      console.log(`Already exists: ${label}`);
    } else {
      console.error(`FAILED ${label}: ${res.status} ${JSON.stringify(data)}`);
      process.exitCode = 1;
    }
  }
}
