"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { auth, db } from "../../../lib/firebase";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

export default function HeaderClient() {
  const { user } = useAuth();
  const [role, setRole] = useState(null);

  async function handleLogout() {
    try {
      await signOut(auth);
      window.location.href = "/login";
    } catch (err) {
      console.error("Logout error:", err);
    }
  }

  // Load the user's role from Firestore
  useEffect(() => {
    if (!user) {
      setRole(null);
      return;
    }

    async function fetchRole() {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          setRole(snap.data().role || "customer");
        } else {
          setRole("customer");
        }
      } catch (err) {
        console.error("Error fetching role:", err);
        setRole("customer");
      }
    }

    fetchRole();
  }, [user]);

  return (
    <header className="header">
      <div className="logo-container">
        <h1 className="logo">Pancake Night</h1>
      </div>

      <nav className="navbar">
        {/* Not logged in */}
        {!user && (
          <>
            <Link href="/login" className="nav-link">Login</Link>
            <Link href="/signup" className="nav-link">Sign Up</Link>
          </>
        )}

        {/* Logged in as ADMIN */}
        {user && role === "admin" && (
          <>
            <Link href="/" className="nav-link">Home</Link>
            <Link href="/order-submission" className="nav-link">Order Submission</Link>
            <Link href="/kitchen-display" className="nav-link">Kitchen</Link>

            <button
              onClick={handleLogout}
              className="nav-link"
              style={{ background: "transparent", border: "none" }}
            >
              Sign Out
            </button>
          </>
        )}

        {/* Logged in as GUEST / CUSTOMER */}
        {user && role !== "admin" && (
          <>
            <Link href="/guest" className="nav-link">Guest Order</Link>

            <button
              onClick={handleLogout}
              className="nav-link"
              style={{ background: "transparent", border: "none" }}
            >
              Sign Out
            </button>
          </>
        )}
      </nav>
    </header>
  );
}
