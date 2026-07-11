// src/app/page.js — admin home board: every order not yet picked up
"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  orderBy,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import ChatWidget from "./components/ChatWidget";
import RequireAdmin from "./components/RequireAdmin";
import { ORDER_STATUS, BOARD_STATUSES } from "@/lib/constants";
import {
  getWaitMinutes,
  getWaitLevel,
  WAIT_LEVEL_STYLES,
  useWaitThresholds,
  useNowTicker,
} from "@/lib/waitTime";

function HomeOrdersInner() {
  const [orders, setOrders] = useState([]);
  const [notification, setNotification] = useState(null);
  const [clearingDone, setClearingDone] = useState(false);

  const thresholds = useWaitThresholds();
  const now = useNowTicker(30000);

  const notify = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    const q = query(
      collection(db, "orders"),
      where("status", "in", BOARD_STATUSES),
      orderBy("createdAt")
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const ordersList = [];
      querySnapshot.forEach((docSnap) => {
        ordersList.push({ ...docSnap.data(), id: docSnap.id });
      });
      // Priority orders first; stable sort keeps createdAt order within groups
      ordersList.sort((a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0));
      setOrders(ordersList);
    });

    return () => unsubscribe();
  }, []);

  const handleRemoveOrder = async (order) => {
    try {
      const orderRef = doc(db, "orders", order.id);
      const update = { status: ORDER_STATUS.COMPLETED };
      // Normally stamped when the kitchen marks it Done; backfill if an
      // order is removed without ever passing through Done.
      if (!order.completedAt) {
        update.completedAt = serverTimestamp();
      }
      await updateDoc(orderRef, update);
      notify("Order removed from Home View");
    } catch (error) {
      console.error("Error removing order:", error);
      notify("Failed to remove order");
    }
  };

  // Clear the whole Done column in one batch
  const handleClearDone = async (doneOrders) => {
    if (doneOrders.length === 0) return;
    if (!window.confirm(`Mark all ${doneOrders.length} Done order(s) as picked up?`)) {
      return;
    }

    setClearingDone(true);
    try {
      const batch = writeBatch(db);
      doneOrders.forEach((order) => {
        const update = { status: ORDER_STATUS.COMPLETED };
        if (!order.completedAt) update.completedAt = serverTimestamp();
        batch.update(doc(db, "orders", order.id), update);
      });
      await batch.commit();
      notify(`Cleared ${doneOrders.length} order(s) from Done`);
    } catch (error) {
      console.error("Error clearing Done orders:", error);
      notify("Failed to clear Done orders");
    } finally {
      setClearingDone(false);
    }
  };

  const groupedOrders = Object.fromEntries(
    BOARD_STATUSES.map((status) => [status, []])
  );

  orders.forEach((order) => {
    if (groupedOrders[order.status]) {
      groupedOrders[order.status].push(order);
    }
  });

  return (
    <div className="home-orders-container">
      {/* Floating chat widget */}
      <ChatWidget />

      <h2 className="text-2xl font-bold">Current Orders</h2>

      {notification && <div className="notification">{notification}</div>}

      <div className="columns-container">
        {Object.entries(groupedOrders).map(([status, statusOrders]) => (
          <div key={status} className="order-column">
            <h3
              className="text-xl font-semibold mb-2"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
              }}
            >
              {status}
              {status === ORDER_STATUS.DONE && statusOrders.length > 0 && (
                <button
                  onClick={() => handleClearDone(statusOrders)}
                  disabled={clearingDone}
                  style={{
                    fontSize: "0.75rem",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    border: "none",
                    background: "#2e7d32",
                    color: "#fff",
                    fontWeight: "bold",
                    cursor: clearingDone ? "default" : "pointer",
                    opacity: clearingDone ? 0.7 : 1,
                  }}
                >
                  {clearingDone ? "Clearing…" : "✓ All Done"}
                </button>
              )}
            </h3>
            {statusOrders.map((order) => {
              const waitMinutes = getWaitMinutes(order, now);
              const level = getWaitLevel(waitMinutes, thresholds);
              return (
                <div
                  key={order.id}
                  className="order-card"
                  style={{
                    ...WAIT_LEVEL_STYLES[level],
                    ...(order.priority ? { boxShadow: "0 0 0 3px #ffd54f" } : {}),
                  }}
                >
                  {order.priority && (
                    <span
                      style={{
                        display: "inline-block",
                        background: "#000",
                        color: "#ffd54f",
                        borderRadius: "999px",
                        padding: "2px 10px",
                        fontSize: "0.7rem",
                        fontWeight: 800,
                        marginBottom: "6px",
                      }}
                    >
                      ⚡ PRIORITY
                    </span>
                  )}
                  <h4 className="font-bold">{order.name}</h4>
                  <p className="text-sm">
                    {order.selectedOptions?.join(", ") || "No options"}
                  </p>
                  {order.notes && (
                    <p className="text-sm italic">Notes: {order.notes}</p>
                  )}
                  <p className="text-xs">
                    Submitted:{" "}
                    {order.createdAt?.toDate
                      ? order.createdAt.toDate().toLocaleTimeString()
                      : "Loading..."}
                    {" · ⏱ "}
                    {Math.floor(waitMinutes)}m
                    {order.status === ORDER_STATUS.DONE ? " (final)" : ""}
                  </p>
                  <button onClick={() => handleRemoveOrder(order)}>
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// Admin-only wrapper for the home page
export default function HomePage() {
  return (
    <RequireAdmin>
      <HomeOrdersInner />
    </RequireAdmin>
  );
}
