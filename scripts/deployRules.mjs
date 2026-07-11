// Deploy firestore.rules via the Firebase Rules REST API using the Admin SDK
// credentials from .env.local — no firebase CLI or interactive login needed.
//
// Usage: node --env-file=.env.local scripts/deployRules.mjs
import { readFileSync } from 'fs';
import { cert } from 'firebase-admin/app';

const projectId =
  process.env.NEXT_FIREBASE_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.NEXT_FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.NEXT_FIREBASE_PRIVATE_KEY;

if (!projectId || !clientEmail || !privateKey) {
  console.error('Missing NEXT_FIREBASE_* vars. Run with: node --env-file=.env.local scripts/deployRules.mjs');
  process.exit(1);
}

const credential = cert({
  projectId,
  clientEmail,
  privateKey: privateKey.replace(/\\n/g, '\n'),
});
const { access_token: token } = await credential.getAccessToken();

const API = 'https://firebaserules.googleapis.com/v1';
const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
};

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

// 1. Upload the rules as a new ruleset
const source = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const ruleset = await api('POST', `/projects/${projectId}/rulesets`, {
  source: { files: [{ name: 'firestore.rules', content: source }] },
});
console.log('Created ruleset:', ruleset.name);

// 2. Point the cloud.firestore release at it (create it if this is the first deploy)
const releaseName = `projects/${projectId}/releases/cloud.firestore`;
try {
  await api('PATCH', `/${releaseName}`, {
    release: { name: releaseName, rulesetName: ruleset.name },
  });
  console.log('Updated release cloud.firestore -> live!');
} catch (err) {
  if (String(err).includes('404')) {
    await api('POST', `/projects/${projectId}/releases`, {
      name: releaseName,
      rulesetName: ruleset.name,
    });
    console.log('Created release cloud.firestore -> live!');
  } else {
    throw err;
  }
}
