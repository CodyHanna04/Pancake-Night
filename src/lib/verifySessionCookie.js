// src/lib/verifySessionCookie.js — Edge-compatible Firebase session cookie
// verification. The middleware can't use firebase-admin (Node-only), but
// session cookies are ordinary RS256 JWTs signed by Google, so we verify
// them with jose against Google's published certificates.
import { jwtVerify, importX509, decodeProtectedHeader } from 'jose';

const CERTS_URL =
  'https://www.googleapis.com/identitytoolkit/v3/relyingparty/publicKeys';

// Cache Google's certs until the Cache-Control max-age expires
let certCache = { certs: null, expiresAt: 0 };

async function getGoogleCerts() {
  if (certCache.certs && Date.now() < certCache.expiresAt) {
    return certCache.certs;
  }

  const res = await fetch(CERTS_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch Google certs (${res.status})`);
  }
  const certs = await res.json();

  const cacheControl = res.headers.get('cache-control') || '';
  const maxAge = Number(/max-age=(\d+)/.exec(cacheControl)?.[1] ?? 3600);
  certCache = { certs, expiresAt: Date.now() + maxAge * 1000 };

  return certs;
}

// Returns the decoded payload (including custom claims like `admin`),
// or throws if the cookie is missing/forged/expired.
export async function verifySessionCookie(sessionCookie) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error('NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set');
  }

  const { kid, alg } = decodeProtectedHeader(sessionCookie);
  if (alg !== 'RS256' || !kid) {
    throw new Error('Unexpected token header');
  }

  const certs = await getGoogleCerts();
  const pem = certs[kid];
  if (!pem) {
    throw new Error(`Unknown key id: ${kid}`);
  }

  const publicKey = await importX509(pem, 'RS256');
  const { payload } = await jwtVerify(sessionCookie, publicKey, {
    issuer: `https://session.firebase.google.com/${projectId}`,
    audience: projectId,
  });

  if (!payload.sub) {
    throw new Error('Token has no subject');
  }

  return payload;
}
