// src/app/admin/approvals/page.js — approve new signups, manage members.
"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import RequireAdmin from "../../components/RequireAdmin";
import { useAuth } from "../../context/AuthContext";

function ApprovalsInner() {
  const { isSuperAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [busyUid, setBusyUid] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    // No orderBy: Firestore would silently drop docs missing createdAt
    // (e.g. accounts created outside the signup flow) — sort client-side.
    const unsub = onSnapshot(
      collection(db, "users"),
      (snap) => {
        const list = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
        list.sort(
          (a, b) =>
            (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
        );
        setUsers(list);
        setLoaded(true);
      },
      (err) => console.error("Error loading users:", err)
    );
    return () => unsub();
  }, []);

  async function act(uid, action, confirmMsg) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusyUid(uid);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(data.error || `Failed to ${action}.`);
      }
    } catch (err) {
      console.error(`${action} failed:`, err);
      setNotice(`Failed to ${action}.`);
    } finally {
      setBusyUid(null);
    }
  }

  const pending = users.filter((u) => u.approved !== true);
  const members = users.filter((u) => u.approved === true);

  const renderUser = (u, buttons) => (
    <div key={u.uid} style={S.userRow}>
      <div style={S.userInfo}>
        <div style={S.userName}>
          {u.name || "(no name)"}
          {u.superadmin === true ? (
            <span style={{ ...S.badge, background: "#FFD700", color: "#000" }}>
              ⭐ Super Admin
            </span>
          ) : u.admin === true ? (
            <span style={S.badge}>🛡 Admin</span>
          ) : null}
        </div>
        <div style={S.userEmail}>{u.email}</div>
        {u.createdAt?.toDate && (
          <div style={S.userMeta}>
            signed up {u.createdAt.toDate().toLocaleDateString()}
          </div>
        )}
      </div>
      <div style={S.buttonRow}>{buttons(u)}</div>
    </div>
  );

  return (
    <div style={S.page}>
      <h2 style={S.header}>✅ Account Approvals</h2>
      <p style={S.hint}>
        New signups can't order until you approve them. Deny deletes the
        account entirely — use it for spam.
      </p>

      {notice && <div style={S.notice}>{notice}</div>}

      <div style={S.section}>
        <h3 style={{ color: "#ff8f00", marginTop: 0 }}>
          Pending approval {loaded && `(${pending.length})`}
        </h3>
        {!loaded ? (
          <p style={S.muted}>Loading…</p>
        ) : pending.length === 0 ? (
          <p style={S.muted}>No one waiting. 🎉</p>
        ) : (
          pending.map((u) =>
            renderUser(u, (user) => (
              <>
                <button
                  style={S.approveBtn}
                  disabled={busyUid === user.uid}
                  onClick={() => act(user.uid, "approve")}
                >
                  {busyUid === user.uid ? "…" : "✓ Approve"}
                </button>
                <button
                  style={S.denyBtn}
                  disabled={busyUid === user.uid}
                  onClick={() =>
                    act(
                      user.uid,
                      "deny",
                      `Delete ${user.email}'s account entirely? This cannot be undone.`
                    )
                  }
                >
                  ✕ Deny
                </button>
              </>
            ))
          )
        )}
      </div>

      <div style={S.section}>
        <h3 style={{ color: "#ff8f00", marginTop: 0 }}>
          Members {loaded && `(${members.length})`}
        </h3>
        {members.length === 0 ? (
          <p style={S.muted}>No approved members yet.</p>
        ) : (
          members.map((u) =>
            renderUser(u, (user) => {
              if (user.superadmin === true) return null; // untouchable
              if (user.admin === true) {
                // Admins: only the super admin can demote; nobody can revoke
                return isSuperAdmin ? (
                  <button
                    style={S.revokeBtn}
                    disabled={busyUid === user.uid}
                    onClick={() =>
                      act(
                        user.uid,
                        "demote",
                        `Remove ${user.email}'s admin access? They stay an approved member.`
                      )
                    }
                  >
                    Remove Admin
                  </button>
                ) : null;
              }
              return (
                <>
                  {isSuperAdmin && (
                    <button
                      style={S.promoteBtn}
                      disabled={busyUid === user.uid}
                      onClick={() =>
                        act(
                          user.uid,
                          "promote",
                          `Make ${user.email} an admin? They get the kitchen, boards, and settings.`
                        )
                      }
                    >
                      Make Admin
                    </button>
                  )}
                  <button
                    style={S.revokeBtn}
                    disabled={busyUid === user.uid}
                    onClick={() =>
                      act(
                        user.uid,
                        "revoke",
                        `Revoke ${user.email}'s access? They'll be locked out until re-approved.`
                      )
                    }
                  >
                    Revoke
                  </button>
                </>
              );
            })
          )
        )}
      </div>
    </div>
  );
}

const S = {
  page: { maxWidth: "700px", margin: "0 auto", padding: "24px 16px" },
  header: { fontSize: "2rem", color: "#ff8f00", marginBottom: "6px" },
  hint: { color: "#bbb", fontSize: "0.9rem", marginBottom: "20px" },
  notice: {
    background: "#5c1f1f",
    border: "1px solid #e53935",
    color: "#ffb3b3",
    borderRadius: "8px",
    padding: "10px 14px",
    marginBottom: "16px",
  },
  section: {
    background: "#1c1c1c",
    borderRadius: "12px",
    padding: "18px",
    marginBottom: "20px",
    boxShadow: "0 2px 6px rgba(255, 143, 0, 0.3)",
  },
  muted: { color: "#888", margin: "6px 0" },
  userRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
    padding: "12px 0",
    borderBottom: "1px solid #2a2a2a",
  },
  userInfo: { minWidth: 0, flex: 1 },
  userName: { color: "#fff", fontWeight: 700 },
  userEmail: {
    color: "#bbb",
    fontSize: "0.85rem",
    overflowWrap: "anywhere",
  },
  userMeta: { color: "#777", fontSize: "0.75rem", marginTop: "2px" },
  buttonRow: { display: "flex", gap: "8px", flexShrink: 0 },
  approveBtn: {
    background: "#2e7d32",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "10px 16px",
    fontWeight: 700,
    cursor: "pointer",
  },
  denyBtn: {
    background: "#5c1f1f",
    color: "#ffb3b3",
    border: "1px solid #e53935",
    borderRadius: "8px",
    padding: "10px 16px",
    fontWeight: 700,
    cursor: "pointer",
  },
  revokeBtn: {
    background: "transparent",
    color: "#e53935",
    border: "1px solid #e53935",
    borderRadius: "8px",
    padding: "8px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  promoteBtn: {
    background: "transparent",
    color: "#ff8f00",
    border: "1px solid #ff8f00",
    borderRadius: "8px",
    padding: "8px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  badge: {
    marginLeft: "8px",
    background: "#2a2a2a",
    color: "#ff8f00",
    borderRadius: "999px",
    padding: "2px 10px",
    fontSize: "0.7rem",
    fontWeight: 800,
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  },
};

export default function ApprovalsPage() {
  return (
    <RequireAdmin>
      <ApprovalsInner />
    </RequireAdmin>
  );
}
