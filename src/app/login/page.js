// src/app/login/page.js
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';

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

      // Admin status comes from the custom claim on the token
      const tokenResult = await user.getIdTokenResult();
      const isAdmin = tokenResult.claims.admin === true;

      if (isAdmin) {
        // Mint the session cookie the middleware checks on admin pages
        const res = await fetch('/api/sessionLogin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: tokenResult.token }),
        });

        if (!res.ok) {
          throw new Error(`Session login failed (${res.status})`);
        }

        router.push('/');
      } else {
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

        <p className="login-subtext" style={{ marginTop: '1rem' }}>
          Need an account?{' '}
          <Link href="/signup" style={{ textDecoration: 'underline', color: '#fbbf24' }}>
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
}
