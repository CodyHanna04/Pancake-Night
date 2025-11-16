// src/app/signup/page.js
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../../../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

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

      // Create Firestore user doc with default role "customer"
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        email: user.email,
        name: name || null,
        role: 'customer', // default role, you can change manually to 'admin' in Firestore
        createdAt: new Date(),
      });

      // After signup, send them to login
      router.push('/login');
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
          Create an account to place orders and access Pancake Night tools.
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
