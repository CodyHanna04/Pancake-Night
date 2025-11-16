"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { db } from "../../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function RequireAdmin({ children }) {
  const { user, loading } = useAuth();
  const [role, setRole] = useState(null);
  const [checkingRole, setCheckingRole] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchRole() {
      if (!user) {
        setCheckingRole(false);
        return;
      }

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
      } finally {
        setCheckingRole(false);
      }
    }

    if (!loading) {
      fetchRole();
    }
  }, [user, loading]);

  // Still figuring out auth/role
  if (loading || checkingRole) {
    return (
      <div className="home-orders-container">
        <p>Checking admin access…</p>
      </div>
    );
  }

  // Not logged in → go to login
  if (!user) {
    router.push("/login");
    return null;
  }

  // Logged in but not admin → send to guest page
  if (role !== "admin") {
    router.push("/guest");
    return null;
  }

  // Admin → allow access
  return <>{children}</>;
}
