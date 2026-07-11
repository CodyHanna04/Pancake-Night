// src/app/components/RequireAuth.jsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";

export default function RequireAuth({ children }) {
  const { user, isApproved, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
    } else if (!isApproved) {
      // Signed up but not approved by an admin yet
      router.push("/pending");
    }
  }, [loading, user, isApproved, router]);

  if (loading || !user || !isApproved) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Checking your access…</p>
      </div>
    );
  }

  return <>{children}</>;
}
