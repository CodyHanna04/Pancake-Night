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
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import RequireAdmin from "../components/RequireAdmin";
import ChatWidget from "../components/ChatWidget";
import { ORDER_STATUS, ADMIN_PANCAKE_OPTIONS } from "@/lib/constants";

function OrderPageInner() {
  const [name, setName] = useState("");
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [notes, setNotes] = useState("");
  const [isPriority, setIsPriority] = useState(false);
  const [notification, setNotification] = useState(null);

  const [customerId, setCustomerId] = useState(null); // still useful to tag which device
  const [recentOrders, setRecentOrders] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Name autocomplete: known accounts + names from past orders
  const [knownNames, setKnownNames] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

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

  // Build the suggestion list once: account names + last 200 order names
  useEffect(() => {
    async function loadNames() {
      try {
        const [userSnap, orderSnap] = await Promise.all([
          getDocs(collection(db, "users")),
          getDocs(
            query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(200))
          ),
        ]);

        const seen = new Map(); // lowercase -> original spelling
        const add = (raw) => {
          const name = (raw || "").trim();
          if (name && !seen.has(name.toLowerCase())) {
            seen.set(name.toLowerCase(), name);
          }
        };
        userSnap.forEach((d) => add(d.data().name));
        orderSnap.forEach((d) => add(d.data().name));

        setKnownNames(
          [...seen.values()].sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: "base" })
          )
        );
      } catch (err) {
        console.error("Error loading name suggestions:", err);
      }
    }

    loadNames();
  }, []);

  const nameSuggestions =
    name.trim().length > 0
      ? knownNames
          .filter(
            (n) =>
              n.toLowerCase().includes(name.trim().toLowerCase()) &&
              n.toLowerCase() !== name.trim().toLowerCase()
          )
          .slice(0, 8)
      : [];

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
        priority: isPriority,
        status: ORDER_STATUS.PENDING,
        createdAt: serverTimestamp(),
      });

      setNotification(isPriority ? "⚡ Priority order submitted!" : "Order submitted!");
      setName("");
      setSelectedOptions([]);
      setNotes("");
      setIsPriority(false);
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
          <div style={{ position: "relative" }}>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setShowSuggestions(false);
              }}
              placeholder="Name (e.g., John D)"
              required
              className="order-input"
              style={{ width: "100%" }}
              autoComplete="off"
            />
            {showSuggestions && nameSuggestions.length > 0 && (
              <ul
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  zIndex: 20,
                  margin: 0,
                  padding: "4px 0",
                  listStyle: "none",
                  background: "#1c1c1c",
                  border: "1px solid #ff8f00",
                  borderRadius: "6px",
                  maxHeight: "220px",
                  overflowY: "auto",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                }}
              >
                {nameSuggestions.map((suggestion) => (
                  <li key={suggestion}>
                    <button
                      type="button"
                      // onMouseDown fires before the input's onBlur hides the list
                      onMouseDown={() => {
                        setName(suggestion);
                        setShowSuggestions(false);
                      }}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "8px 12px",
                        background: "transparent",
                        border: "none",
                        color: "#fff",
                        textAlign: "left",
                        cursor: "pointer",
                        fontSize: "0.95rem",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "#333")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      {suggestion}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="options-container">
            <ul className="options-list">
              {ADMIN_PANCAKE_OPTIONS.map(
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
          <label
            className="checkbox-label"
            style={{
              color: isPriority ? "#ffd54f" : "#ff8f00",
              fontWeight: isPriority ? 700 : 400,
            }}
          >
            <input
              type="checkbox"
              checked={isPriority}
              onChange={(e) => setIsPriority(e.target.checked)}
              className="order-checkbox"
            />
            ⚡ Priority — jumps to the top of the kitchen queue
          </label>
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
