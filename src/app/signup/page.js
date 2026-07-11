// src/app/signup/page.js
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password should be at least 6 characters.');
      return;
    }

    try {
      setLoading(true);

      // Create auth user
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCred.user;

      // Profile doc. Enforcement of approval is the custom claim (set by an
      // admin) — this field just drives the pending list and UI.
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        email: user.email,
        name: name || null,
        approved: false,
        createdAt: serverTimestamp(),
      });

      // New accounts wait for admin approval before they can order
      router.push('/pending');
    } catch (err) {
      console.error('Signup failed:', err);
      let message = 'Signup failed. Please try again.';

      if (err.code === 'auth/email-already-in-use') {
        message = 'That email is already in use.';
      } else if (err.code === 'auth/invalid-email') {
        message = 'That email address is invalid.';
      } else if (err.code === 'auth/weak-password') {
        message = 'Password is too weak.';
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-container">
      <form onSubmit={handleSignup} className="login-form">
        <h2>Sign Up</h2>
        <p className="login-subtext">
          Create an account to place orders. A brother will need to approve
          your account before your first order.
        </p>

        <input
          type="text"
          placeholder="Name (First L)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="login-input"
        />

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

        <input
          type="password"
          placeholder="Confirm Password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          className="login-input"
        />

        <button type="submit" disabled={loading} className="login-button">
          {loading ? 'Creating account…' : 'Sign Up'}
        </button>

        {error && <p className="login-error">{error}</p>}

        <p className="login-subtext" style={{ marginTop: '1rem' }}>
          Already have an account?{" "}
          <Link href="/login" style={{ textDecoration: 'underline', color: '#fbbf24' }}>
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
