// src/app/order-submission/page.js
"use client";

import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import RequireAdmin from "../components/RequireAdmin";
import ChatWidget from "../components/ChatWidget";

function OrderPageInner() {
  const [name, setName] = useState("");
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [notes, setNotes] = useState("");
  const [notification, setNotification] = useState(null);

  const [customerId, setCustomerId] = useState(null); // still useful to tag which device
  const [recentOrders, setRecentOrders] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Just set a stable customerId per browser (no cooldown logic)
  useEffect(() => {
    let id = localStorage.getItem("customerId");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("customerId", id);
    }
    setCustomerId(id);
  }, []);

  // Live subscription to last 3 orders overall
  useEffect(() => {
    const q = query(
      collection(db, "orders"),
      orderBy("createdAt", "desc"),
      limit(3)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setRecentOrders(orders);
    });

    return () => unsubscribe();
  }, []);

  const handleOptionChange = (e) => {
    const { value, checked } = e.target;
    if (checked) {
      setSelectedOptions((prev) => [...prev, value]);
    } else {
      setSelectedOptions((prev) => prev.filter((option) => option !== value));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting) return; // stop double-click spam
    if (selectedOptions.length === 0) {
      setNotification("Please select at least one option.");
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "orders"), {
        customerId,
        name,
        selectedOptions,
        notes,
        status: "Pending",
        createdAt: serverTimestamp(),
      });

      setNotification("Order submitted!");
      setName("");
      setSelectedOptions([]);
      setNotes("");
    } catch (error) {
      console.error("Error placing order:", error);
      setNotification("Failed to submit order.");
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const renderRecentOrders = () => {
    if (!recentOrders.length) {
      return <p className="recent-empty">No orders yet.</p>;
    }

    return (
      <ul className="recent-orders-list">
        {recentOrders.map((order) => {
          const createdAt =
            order.createdAt?.toDate ? order.createdAt.toDate() : null;
          const timeLabel = createdAt
            ? createdAt.toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })
            : "Just now";

          return (
            <li key={order.id} className="recent-order-item">
              <div className="recent-order-header">
                <span className="recent-order-name">
                  {order.name || "No name"}
                </span>
                <span className="recent-order-time">{timeLabel}</span>
              </div>
              <div className="recent-order-options">
                {order.selectedOptions?.join(", ") || "No options"}
              </div>
              {order.notes && (
                <div className="recent-order-notes">
                  Notes: {order.notes}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="order-page-layout">
      <ChatWidget />
      <div className="order-submission-container">
        {notification && <div className="notification">{notification}</div>}
        <h2>Submit Your Order</h2>

        <form onSubmit={handleSubmit} className="order-form">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (e.g., John D)"
            required
            className="order-input"
          />
          <div className="options-container">
            <ul className="options-list">
              {["Plain", "Chocolate Chip", "Banana", "Blueberry"].map(
                (option) => (
                  <li key={option}>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        value={option}
                        onChange={handleOptionChange}
                        checked={selectedOptions.includes(option)}
                        className="order-checkbox"
                      />
                      {option}
                    </label>
                  </li>
                )
              )}
            </ul>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional instructions (optional)"
            className="order-textarea"
          />
          <button
            type="submit"
            className="submit-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Submit Order"}
          </button>
        </form>
      </div>

      <aside className="recent-orders-container">
        <h3>Most Recent Orders</h3>
        <p className="recent-help-text">
          If you see the order here, it went through ✅
        </p>
        {renderRecentOrders()}
      </aside>
    </div>
  );
}

// Admin-only wrapper
export default function OrderPage() {
  return (
    <RequireAdmin>
      <OrderPageInner />
    </RequireAdmin>
  );
}
