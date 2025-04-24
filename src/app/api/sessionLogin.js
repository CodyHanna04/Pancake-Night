// /pages/api/sessionLogin.js
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, cert } from 'firebase-admin/app';

const firebasePrivateKey = process.env.NEXT_FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

const app = initializeApp({
  credential: cert({
    projectId: process.env.NEXT_FIREBASE_PROJECT_ID,
    clientEmail: process.env.NEXT_FIREBASE_CLIENT_EMAIL,
    privateKey: firebasePrivateKey,
  }),
});

export default async function handler(req, res) {
  const { token } = req.body;

  try {
    const expiresIn = 60 * 60 * 24 * 5 * 1000;
    const sessionCookie = await getAuth(app).createSessionCookie(token, { expiresIn });

    const options = {
      maxAge: expiresIn,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    };

    res.setHeader('Set-Cookie', `__session=${sessionCookie}; ${Object.entries(options).map(([k, v]) => `${k}=${v}`).join('; ')}`);
    res.status(200).send({ status: 'success' });
  } catch (error) {
    res.status(401).send('Unauthorized request');
  }
}
