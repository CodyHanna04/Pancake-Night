// src/app/context/AuthContext.jsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

const AuthContext = createContext({
  user: null,
  isAdmin: false,
  isSuperAdmin: false,
  isApproved: false,
  loading: true,
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        try {
          // These flags live in custom claims on the auth token —
          // unlike Firestore fields, users can't grant these to themselves.
          const tokenResult = await firebaseUser.getIdTokenResult();
          const admin = tokenResult.claims.admin === true;
          setIsAdmin(admin);
          setIsSuperAdmin(tokenResult.claims.superadmin === true);
          setIsApproved(admin || tokenResult.claims.approved === true);
        } catch (err) {
          console.error("Error reading auth claims:", err);
          setIsAdmin(false);
          setIsSuperAdmin(false);
          setIsApproved(false);
        }
      } else {
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setIsApproved(false);
      }

      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isAdmin, isSuperAdmin, isApproved, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
