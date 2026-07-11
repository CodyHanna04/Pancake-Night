// src/app/guest/page.js
"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  doc,
  getDoc,
} from "firebase/firestore";
import RequireAuth from "../components/RequireAuth";
import { useAuth } from "../context/AuthContext";
import { GUEST_PANCAKE_OPTIONS, GUEST_COOLDOWN_MS } from "@/lib/constants";
import {
  isWithinOrderingWindow,
  describeOrderingWindow,
  DEFAULT_SCHEDULE,
} from "@/lib/orderWindow";

function GuestPageInner() {
  const { user } = useAuth();

  const [profileName, setProfileName] = useState("");
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [notes, setNotes] = useState("");
  const [notification, setNotification] = useState(null);

  // Cooldown state (client-side display only — the API enforces it for real)
  const [canOrder, setCanOrder] = useState(true);
  const [timeLeft, setTimeLeft] = useState(null); // minutes
  const [lastOrderTimeMs, setLastOrderTimeMs] = useState(null);

  const [myOrders, setMyOrders] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [guestOrderingEnabled, setGuestOrderingEnabled] = useState(true);
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE);
  const [isWithinWindow, setIsWithinWindow] = useState(true);

  const notify = (message, ms = 4000) => {
    setNotification(message);
    setTimeout(() => setNotification(null), ms);
  };

  // Live guest-ordering config — admin toggles take effect immediately
  useEffect(() => {
    const configRef = doc(db, "config", "guestOrdering");
    const unsub = onSnapshot(
      configRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setGuestOrderingEnabled(
            typeof data.enabled === "boolean" ? data.enabled : true
          );
          setSchedule({
            dayOfWeek:
              typeof data.dayOfWeek === "number"
                ? data.dayOfWeek
                : DEFAULT_SCHEDULE.dayOfWeek,
            startHour:
              typeof data.startHour === "number"
                ? data.startHour
                : DEFAULT_SCHEDULE.startHour,
            endHour:
              typeof data.endHour === "number"
                ? data.endHour
                : DEFAULT_SCHEDULE.endHour,
          });
        } else {
          setGuestOrderingEnabled(true);
          setSchedule(DEFAULT_SCHEDULE);
        }
      },
      (err) => {
        console.error("Error loading guest ordering config:", err);
        setGuestOrderingEnabled(true);
      }
    );

    return () => unsub();
  }, []);

  // Recompute window flag on config change and every minute
  useEffect(() => {
    function updateWindow() {
      setIsWithinWindow(isWithinOrderingWindow(schedule, guestOrderingEnabled));
    }

    updateWindow();
    const interval = setInterval(updateWindow, 60000);
    return () => clearInterval(interval);
  }, [schedule, guestOrderingEnabled]);

  // Load the user's profile name
  useEffect(() => {
    if (!user) return;

    async function fetchProfile() {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        setProfileName(snap.exists() ? snap.data().name || "" : "");
      } catch (err) {
        console.error("Error loading user profile:", err);
        setProfileName("");
      }
    }

    fetchProfile();
  }, [user]);

  // Listen to this user's recent orders (cooldown display + status tracking)
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "orders"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setMyOrders(orders);

      if (orders.length > 0 && orders[0].createdAt?.toMillis) {
        const lastMs = orders[0].createdAt.toMillis();
        setLastOrderTimeMs(lastMs);
        updateCooldownFromTimestamp(lastMs);
      } else {
        setLastOrderTimeMs(null);
        setCanOrder(true);
        setTimeLeft(null);
      }
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Tick the cooldown countdown every 30s
  useEffect(() => {
    if (!lastOrderTimeMs) return;

    const interval = setInterval(() => {
      updateCooldownFromTimestamp(lastOrderTimeMs);
    }, 30000);

    return () => clearInterval(interval);
  }, [lastOrderTimeMs]);

  const updateCooldownFromTimestamp = (lastMs) => {
    const diff = Date.now() - lastMs;

    if (diff >= GUEST_COOLDOWN_MS) {
      setCanOrder(true);
      setTimeLeft(null);
    } else {
      setCanOrder(false);
      setTimeLeft(Math.ceil((GUEST_COOLDOWN_MS - diff) / 60000));
    }
  };

  const handleOptionChange = (e) => {
    const { value, checked } = e.target;
    setSelectedOptions((prev) =>
      checked ? [...prev, value] : prev.filter((opt) => opt !== value)
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user || isSubmitting) return;

    if (selectedOptions.length === 0) {
      notify("Please select at least one option.", 3000);
      return;
    }

    setIsSubmitting(true);
    try {
      // The server re-checks the window, enabled flag, and cooldown
      const token = await user.getIdToken();
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ selectedOptions, notes }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        notify(data.error || "Failed to submit order. Please try again.");
        return;
      }

      notify("Order submitted! You can order again in 15 minutes.");
      setSelectedOptions([]);
      setNotes("");

      // Optimistically lock ordering until the snapshot catches up
      setCanOrder(false);
      setTimeLeft(15);
      setLastOrderTimeMs(Date.now());
    } catch (err) {
      console.error("Error placing order:", err);
      notify("Failed to submit order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayName = profileName || user?.email || "Guest";
  const windowLabel = describeOrderingWindow(schedule);

  const canSubmitNow =
    guestOrderingEnabled && isWithinWindow && canOrder && !isSubmitting;

  return (
    <div className="order-page-layout">
      <div className="order-submission-container">
        {notification && <div className="notification">{notification}</div>}

        <h2>Guest Order</h2>
        <p style={{ marginBottom: "10px", color: "white" }}>
          Submit your order and track its status below.
        </p>

        <div
          style={{
            marginBottom: "10px",
            padding: "8px 10px",
            borderRadius: "6px",
            backgroundColor: "#222",
            color: "#fff",
            fontSize: "0.9rem",
          }}
        >
          Ordering as: <strong>{displayName}</strong>
        </div>

        {!profileName && (
          <p
            style={{
              color: "#ff6b6b",
              fontSize: "0.85rem",
              marginBottom: "10px",
            }}
          >
            Your name is missing from your profile. Please ask a brother to help update it in your
            account to ensure your orders are labeled correctly.
          </p>
        )}

        {!guestOrderingEnabled && (
          <p
            style={{
              color: "#ff6b6b",
              fontSize: "0.9rem",
              marginBottom: "10px",
            }}
          >
            Guest ordering is currently disabled by an admin.
          </p>
        )}

        {guestOrderingEnabled && !isWithinWindow && (
          <p
            style={{
              color: "#ff8f00",
              fontSize: "0.9rem",
              marginBottom: "10px",
            }}
          >
            Guest ordering is only open {windowLabel}.
          </p>
        )}

        {!canOrder && timeLeft !== null && guestOrderingEnabled && isWithinWindow && (
          <p style={{ color: "#ff8f00", marginBottom: "10px" }}>
            You recently placed an order. You can order again in about{" "}
            {timeLeft} minute(s).
          </p>
        )}

        <form onSubmit={handleSubmit} className="order-form">
          <div className="options-container">
            <ul className="options-list">
              {GUEST_PANCAKE_OPTIONS.map((option) => (
                <li key={option}>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      value={option}
                      checked={selectedOptions.includes(option)}
                      onChange={handleOptionChange}
                      className="order-checkbox"
                    />
                    {option}
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <textarea
            placeholder="Additional instructions (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="order-textarea"
          />

          <button
            type="submit"
            className="submit-button"
            disabled={!canSubmitNow}
          >
            {isSubmitting ? "Submitting..." : "Submit Order"}
          </button>
        </form>
      </div>

      {/* Right side: user's recent orders + status */}
      <aside className="recent-orders-container">
        <h3>Your Recent Orders</h3>
        <p className="recent-help-text">
          You’ll see your last orders and their status here.
        </p>

        {myOrders.length === 0 ? (
          <p className="recent-empty">No orders yet.</p>
        ) : (
          <ul className="recent-orders-list">
            {myOrders.map((order) => {
              const createdAt = order.createdAt?.toDate
                ? order.createdAt.toDate()
                : null;
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
                  <div className="recent-order-notes">
                    Status: <strong>{order.status || "Pending"}</strong>
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
        )}
      </aside>
    </div>
  );
}

export default function GuestPage() {
  return (
    <RequireAuth>
      <GuestPageInner />
    </RequireAuth>
  );
}
