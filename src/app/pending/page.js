// src/app/pending/page.js — holding room for accounts awaiting admin approval.
// Watches the user's own profile doc; when an admin approves, we force a
// token refresh (to pick up the new claim) and send them to ordering.
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useAuth } from "../context/AuthContext";

export default function PendingPage() {
  const { user, isApproved, loading } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  // Already approved (or admin)? Straight through.
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
    } else if (isApproved) {
      router.push("/guest");
    }
  }, [user, isApproved, loading, router]);

  // Live-watch the profile doc; the moment an admin flips it, refresh the
  // token so the new claim is on board, then reload into the app.
  useEffect(() => {
    if (!user) return;

    const unsub = onSnapshot(doc(db, "users", user.uid), async (snap) => {
      if (snap.exists() && snap.data().approved === true) {
        setChecking(true);
        try {
          await user.getIdToken(true); // force-refresh to pick up the claim
          window.location.href = "/guest"; // full reload re-reads claims
        } catch (err) {
          console.error("Token refresh failed:", err);
          setChecking(false);
        }
      }
    });

    return () => unsub();
  }, [user]);

  async function handleSignOut() {
    await signOut(auth);
    window.location.href = "/login";
  }

  return (
    <div className="login-page-container">
      <div className="login-form">
        <div style={{ fontSize: "3rem", marginBottom: "8px" }}>🥞⏳</div>
        <h2>Almost there!</h2>
        <p className="login-subtext" style={{ marginBottom: "1rem" }}>
          Your account was created, but an admin needs to approve it before
          you can order. Ask a brother to approve you — this page will let
          you in automatically the moment they do.
        </p>

        {checking ? (
          <p style={{ color: "#fbbf24", fontWeight: 600 }}>
            You're approved! Letting you in…
          </p>
        ) : (
          <p style={{ color: "#888", fontSize: "0.85rem" }}>
            Waiting for approval… ⏳
          </p>
        )}

        <button
          onClick={handleSignOut}
          className="login-button"
          style={{ marginTop: "1.25rem", background: "#333", color: "#fff" }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
