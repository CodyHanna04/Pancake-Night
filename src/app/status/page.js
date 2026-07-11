// src/app/status/page.js — live status of the signed-in user's own orders.
// Firestore rules + the userId query mean users can only ever see their own.
"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import RequireAuth from "../components/RequireAuth";
import { useAuth } from "../context/AuthContext";
import { ORDER_STATUS } from "@/lib/constants";

const STATUS_DISPLAY = {
  [ORDER_STATUS.PENDING]: {
    label: "Pending",
    emoji: "🕐",
    color: "#9e9e9e",
    hint: "Your order is in line — hang tight!",
  },
  [ORDER_STATUS.COOKING]: {
    label: "Cooking",
    emoji: "🍳",
    color: "#ff8f00",
    hint: "On the griddle right now.",
  },
  [ORDER_STATUS.DELAYED]: {
    label: "Delayed",
    emoji: "⏳",
    color: "#e53935",
    hint: "Running a little behind — sorry!",
  },
  [ORDER_STATUS.DONE]: {
    label: "Ready!",
    emoji: "✅",
    color: "#2e7d32",
    hint: "Come grab your pancakes!",
  },
  [ORDER_STATUS.COMPLETED]: {
    label: "Picked up",
    emoji: "🥞",
    color: "#555",
    hint: "Enjoy!",
  },
};

function StatusPageInner() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "orders"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(5)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      setOrders(
        snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      );
      setLoaded(true);
    });

    return () => unsub();
  }, [user]);

  return (
    <div style={{ maxWidth: "560px", margin: "0 auto", padding: "24px 16px" }}>
      <h2
        style={{
          color: "#ff8f00",
          fontSize: "1.8rem",
          textAlign: "center",
          marginBottom: "6px",
        }}
      >
        🥞 Order Status
      </h2>
      <p style={{ color: "#bbb", textAlign: "center", marginBottom: "24px" }}>
        Updates live — no need to refresh.
      </p>

      {!loaded ? (
        <p style={{ color: "#bbb", textAlign: "center" }}>Loading…</p>
      ) : orders.length === 0 ? (
        <p style={{ color: "#bbb", textAlign: "center" }}>
          You haven’t placed any orders yet.
        </p>
      ) : (
        orders.map((order, index) => {
          const display =
            STATUS_DISPLAY[order.status] || STATUS_DISPLAY[ORDER_STATUS.PENDING];
          const createdAt = order.createdAt?.toDate
            ? order.createdAt.toDate()
            : null;
          const isLatest = index === 0;

          return (
            <div
              key={order.id}
              style={{
                background: "#1c1c1c",
                borderRadius: "12px",
                padding: isLatest ? "24px" : "14px 18px",
                marginBottom: "14px",
                borderLeft: `6px solid ${display.color}`,
                opacity: isLatest ? 1 : 0.75,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                }}
              >
                <span
                  style={{
                    color: display.color,
                    fontWeight: "bold",
                    fontSize: isLatest ? "1.6rem" : "1.1rem",
                  }}
                >
                  {display.emoji} {display.label}
                </span>
                <span style={{ color: "#888", fontSize: "0.85rem" }}>
                  {createdAt
                    ? createdAt.toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : "Just now"}
                </span>
              </div>

              {isLatest && (
                <p style={{ color: "#ddd", margin: "8px 0 12px" }}>
                  {display.hint}
                </p>
              )}

              <p style={{ color: "#fff", margin: 0, fontSize: "0.95rem" }}>
                {order.selectedOptions?.join(", ") || "No options"}
              </p>
              {order.notes && (
                <p
                  style={{
                    color: "#aaa",
                    margin: "6px 0 0",
                    fontSize: "0.85rem",
                    fontStyle: "italic",
                  }}
                >
                  Notes: {order.notes}
                </p>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

export default function StatusPage() {
  return (
    <RequireAuth>
      <StatusPageInner />
    </RequireAuth>
  );
}
