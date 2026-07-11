// src/app/kitchen-display/page.js
"use client";

import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import RequireAdmin from "../components/RequireAdmin";
import ChatWidget from "../components/ChatWidget";
import { ORDER_STATUS, KITCHEN_STATUSES } from "@/lib/constants";
import {
  getWaitMinutes,
  getWaitLevel,
  WAIT_LEVEL_STYLES,
  useWaitThresholds,
  useNowTicker,
} from "@/lib/waitTime";

function KitchenDisplayInner() {
  const [orders, setOrders] = useState([]);
  const [notification, setNotification] = useState(null);

  const thresholds = useWaitThresholds();
  const now = useNowTicker(30000);

  useEffect(() => {
    const q = query(
      collection(db, "orders"),
      where("status", "in", KITCHEN_STATUSES),
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

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const orderRef = doc(db, "orders", orderId);
      const update = { status: newStatus };
      // "Done" = food ready; stamp it for the wait-time analytics
      if (newStatus === ORDER_STATUS.DONE) {
        update.completedAt = serverTimestamp();
      }
      await updateDoc(orderRef, update);
      setNotification(`Order marked as ${newStatus}`);
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error("Error updating order:", error);
      setNotification("Failed to update order.");
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const groupedOrders = Object.fromEntries(
    KITCHEN_STATUSES.map((status) => [status, []])
  );

  orders.forEach((order) => {
    if (groupedOrders[order.status]) {
      groupedOrders[order.status].push(order);
    }
  });

  return (
    <div className="kitchen-display-container">
      {/* Floating chat widget */}
      <ChatWidget />

      {notification && <div className="notification">{notification}</div>}

      <h2 className="text-2xl font-bold">Kitchen Display</h2>

      <div className="columns-container">
        {Object.entries(groupedOrders).map(([status, statusOrders]) => (
          <div key={status} className="order-column">
            <h3 className="text-xl font-semibold mb-2">{status}</h3>
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
                  {order.selectedOptions?.join(", ")}
                </p>
                {order.notes && (
                  <p className="text-sm italic">Notes: {order.notes}</p>
                )}
                <p className="text-xs">
                  Submitted:{" "}
                  {order.createdAt?.toDate
                    ? order.createdAt.toDate().toLocaleTimeString()
                    : "Loading..."}
                  {" · ⏱ "}{Math.floor(waitMinutes)}m
                </p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() =>
                      updateOrderStatus(order.id, ORDER_STATUS.COOKING)
                    }
                  >
                    Cooking
                  </button>
                  <button
                    onClick={() =>
                      updateOrderStatus(order.id, ORDER_STATUS.DELAYED)
                    }
                  >
                    Delayed
                  </button>
                  <button
                    onClick={() =>
                      updateOrderStatus(order.id, ORDER_STATUS.DONE)
                    }
                  >
                    Done
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// Admin-only wrapper
export default function KitchenDisplay() {
  return (
    <RequireAdmin>
      <KitchenDisplayInner />
    </RequireAdmin>
  );
}
