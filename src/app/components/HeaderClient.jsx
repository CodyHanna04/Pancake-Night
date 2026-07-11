"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";

// Nav structure: flat links and dropdown groups
const ADMIN_NAV = [
  {
    label: "Boards",
    items: [
      { href: "/", label: "Home Board" },
      { href: "/kitchen-display", label: "Kitchen Display" },
    ],
  },
  {
    label: "Ordering",
    items: [
      { href: "/order-submission", label: "Order Submission" },
      { href: "/guest", label: "Guest Order" },
      { href: "/status", label: "Order Status" },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/admin", label: "Settings" },
      { href: "/admin/metrics", label: "Metrics" },
      { href: "/admin/approvals", label: "Approvals" },
    ],
  },
  { href: "/leaderboard", label: "Leaderboard" },
];

const GUEST_NAV = [
  { href: "/guest", label: "Guest Order" },
  { href: "/status", label: "Order Status" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export default function HeaderClient() {
  const { user, isAdmin } = useAuth();
  const pathname = usePathname();

  const [openGroup, setOpenGroup] = useState(null); // dropdown label or null
  const [menuOpen, setMenuOpen] = useState(false); // mobile panel
  const navRef = useRef(null);

  // Close everything when the route changes
  useEffect(() => {
    setOpenGroup(null);
    setMenuOpen(false);
  }, [pathname]);

  // Close dropdowns on click/tap outside the header
  useEffect(() => {
    function handleOutside(e) {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setOpenGroup(null);
        setMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, []);

  async function handleLogout() {
    try {
      await fetch("/api/sessionLogout", { method: "POST" }).catch(() => {});
      await signOut(auth);
      window.location.href = "/login";
    } catch (err) {
      console.error("Logout error:", err);
    }
  }

  const navItems = user ? (isAdmin ? ADMIN_NAV : GUEST_NAV) : null;

  const renderItem = (item) => {
    if (!item.items) {
      return (
        <Link key={item.href} href={item.href} className="nav-link">
          {item.label}
        </Link>
      );
    }

    const isOpen = openGroup === item.label;
    return (
      <div key={item.label} className={`nav-group${isOpen ? " open" : ""}`}>
        <button
          type="button"
          className="nav-link"
          aria-expanded={isOpen}
          onClick={() => setOpenGroup(isOpen ? null : item.label)}
        >
          {item.label}
          <span className="nav-caret">▼</span>
        </button>
        {isOpen && (
          <div className="nav-dropdown">
            {item.items.map((sub) => (
              <Link key={sub.href} href={sub.href} className="nav-link">
                {sub.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <header className="header" ref={navRef}>
      <div className="logo-container">
        <h1 className="logo">Pancake Night</h1>
      </div>

      {/* Hamburger — visible on small screens only (CSS) */}
      <button
        type="button"
        className={`nav-burger${menuOpen ? " open" : ""}`}
        aria-label="Menu"
        aria-expanded={menuOpen}
        onClick={() => {
          setMenuOpen((prev) => !prev);
          setOpenGroup(null);
        }}
      >
        <span />
        <span />
        <span />
      </button>

      <nav className={`navbar${menuOpen ? " open" : ""}`}>
        {!user && (
          <>
            <Link href="/login" className="nav-link">Login</Link>
            <Link href="/signup" className="nav-link">Sign Up</Link>
          </>
        )}

        {navItems && (
          <>
            {navItems.map(renderItem)}
            <button
              type="button"
              onClick={handleLogout}
              className="nav-link"
            >
              Sign Out
            </button>
          </>
        )}
      </nav>
    </header>
  );
}
