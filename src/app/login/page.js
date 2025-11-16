// src/app/login/page.js
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      const user = userCred.user;

      // Look up role in Firestore
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      let role = 'customer';
      if (userDocSnap.exists()) {
        const data = userDocSnap.data();
        if (data.role) {
          role = data.role;
        }
      }

      if (role === 'admin') {
        // Admin → main admin page at "/"
        const token = await user.getIdToken();

        await fetch('/api/sessionLogin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        router.push('/');
      } else {
        // Guests/customers → guest page
        router.push('/guest');
      }
    } catch (err) {
      console.error(err);
      setError('Login failed. Check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-container">
      <form onSubmit={handleLogin} className="login-form">
        <h2>Sign In</h2>
        <p className="login-subtext">
          Admins go to the dashboard. Guests go to the guest ordering page.
        </p>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="login-input"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="login-input"
        />

        <button type="submit" disabled={loading} className="login-button">
          {loading ? 'Signing in…' : 'Login'}
        </button>

        {error && <p className="login-error">{error}</p>}
      </form>
    </div>
  );
}
