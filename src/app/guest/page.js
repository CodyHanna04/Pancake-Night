// src/app/guest/page.js
"use client";

import { useEffect, useState } from "react";
import { db } from "../../../lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  orderBy,
  limit,
  serverTimestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import RequireAuth from "../components/RequireAuth";
import { useAuth } from "../context/AuthContext";

function GuestPageInner() {
  const { user } = useAuth();

  const [profileName, setProfileName] = useState("");
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [notes, setNotes] = useState("");
  const [notification, setNotification] = useState(null);

  // 15-minute cooldown state
  const [canOrder, setCanOrder] = useState(true);
  const [timeLeft, setTimeLeft] = useState(null); // minutes
  const [lastOrderTimeMs, setLastOrderTimeMs] = useState(null);

  const [myOrders, setMyOrders] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 🔧 Guest ordering schedule / toggle (configurable)
  const [guestOrderingEnabled, setGuestOrderingEnabled] = useState(true);
  const [schedule, setSchedule] = useState({
    dayOfWeek: 3,  // 0=Sun...6=Sat, 3 = Wednesday
    startHour: 22, // 10 PM
    endHour: 0,    // 0 = midnight (crosses midnight window)
  });
  const [isWithinWindow, setIsWithinWindow] = useState(true);

  // ------- Helpers for time window (America/New_York) -------

  function computeIsWithinWindow(currentSchedule, enabled) {
    if (!enabled) return false;

    const now = new Date();
    const nyString = now.toLocaleString("en-US", {
      timeZone: "America/New_York",
    });
    const nyDate = new Date(nyString);

    const dow = nyDate.getDay();   // 0–6
    const hour = nyDate.getHours(); // 0–23

    const dayOfWeek = currentSchedule.dayOfWeek ?? 3;
    const startHour = currentSchedule.startHour ?? 22;
    const endHour = currentSchedule.endHour ?? 0;

    if (dow !== dayOfWeek) {
      return false;
    }

    // If endHour > startHour: simple window (e.g., 10 → 18)
    // If endHour <= startHour: cross-midnight (e.g., 22 → 0)
    if (endHour > startHour) {
      return hour >= startHour && hour < endHour;
    } else if (endHour < startHour) {
      // Crosses midnight: 22 → 0 = 10PM–12AM
      return hour >= startHour || hour < endHour;
    } else {
      // startHour === endHour -> whole day
      return true;
    }
  }

  // ------- Load guest ordering config (for admin control) -------

  useEffect(() => {
    async function fetchGuestConfig() {
      try {
        const configRef = doc(db, "config", "guestOrdering");
        const snap = await getDoc(configRef);
        if (snap.exists()) {
          const data = snap.data();
          setGuestOrderingEnabled(
            typeof data.enabled === "boolean" ? data.enabled : true
          );
          setSchedule({
            dayOfWeek:
              typeof data.dayOfWeek === "number" ? data.dayOfWeek : 3,
            startHour:
              typeof data.startHour === "number" ? data.startHour : 22,
            endHour: typeof data.endHour === "number" ? data.endHour : 0,
          });
        } else {
          // no config doc -> use defaults above
          setGuestOrderingEnabled(true);
        }
      } catch (err) {
        console.error("Error loading guest ordering config:", err);
        // Fallback to defaults if config fails
        setGuestOrderingEnabled(true);
      }
    }

    fetchGuestConfig();
  }, []);

  // Recompute isWithinWindow on schedule / enabled change, and every minute
  useEffect(() => {
    function updateWindow() {
      setIsWithinWindow(computeIsWithinWindow(schedule, guestOrderingEnabled));
    }

    updateWindow();

    const interval = setInterval(updateWindow, 60000); // every 60s
    return () => clearInterval(interval);
  }, [schedule, guestOrderingEnabled]);

  // ------- Load the user's profile name from Firestore -------

  useEffect(() => {
    if (!user) return;

    async function fetchProfile() {
      try {
        const userDocRef = doc(db, "users", user.uid);
        const snap = await getDoc(userDocRef);
        if (snap.exists()) {
          const data = snap.data();
          if (data.name) {
            setProfileName(data.name);
          } else {
            setProfileName("");
          }
        } else {
          setProfileName("");
        }
      } catch (err) {
        console.error("Error loading user profile:", err);
        setProfileName("");
      }
    }

    fetchProfile();
  }, [user]);

  // ------- Listen to this user's recent orders (for cooldown + status) -------

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

      // Use the most recent order to enforce 15 min rule
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

  // Update timeLeft every 30s while under cooldown
  useEffect(() => {
    if (!lastOrderTimeMs) return;

    const interval = setInterval(() => {
      updateCooldownFromTimestamp(lastOrderTimeMs);
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [lastOrderTimeMs]);

  const updateCooldownFromTimestamp = (lastMs) => {
    const now = Date.now();
    const diff = now - lastMs;
    const COOLDOWN = 15 * 60 * 1000; // 15 minutes

    if (diff >= COOLDOWN) {
      setCanOrder(true);
      setTimeLeft(null);
    } else {
      const remainingMs = COOLDOWN - diff;
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      setCanOrder(false);
      setTimeLeft(remainingMinutes);
    }
  };

  // ------- Form logic -------

  const handleOptionChange = (e) => {
    const { value, checked } = e.target;
    if (checked) {
      setSelectedOptions((prev) => [...prev, value]);
    } else {
      setSelectedOptions((prev) => prev.filter((opt) => opt !== value));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;

    // Check global toggle
    if (!guestOrderingEnabled) {
      setNotification("Guest ordering is currently disabled.");
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    // Check time window (Wed 10pm–12am ET, or whatever config says)
    const withinWindow = computeIsWithinWindow(schedule, guestOrderingEnabled);
    if (!withinWindow) {
      setNotification(
        "Guest ordering is only open on Wednesday from 10:00 PM to 12:00 AM (Eastern)."
      );
      setTimeout(() => setNotification(null), 4000);
      return;
    }

    // 15-minute per-guest cooldown
    if (!canOrder) {
      setNotification("You need to wait before placing another order.");
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    if (selectedOptions.length === 0) {
      setNotification("Please select at least one option.");
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    const displayName = profileName || user.email || "Guest";

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "orders"), {
        userId: user.uid,
        name: displayName,
        selectedOptions,
        notes,
        status: "Pending",
        createdAt: serverTimestamp(),
      });

      setNotification("Order submitted! You can order again in 15 minutes.");
      setSelectedOptions([]);
      setNotes("");

      // Optimistically lock ordering for 15 minutes
      setCanOrder(false);
      setTimeLeft(15);
      setLastOrderTimeMs(Date.now());
    } catch (err) {
      console.error("Error placing order:", err);
      setNotification("Failed to submit order. Please try again.");
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const displayName = profileName || user?.email || "Guest";

  // Final combined flag: can this user click Submit *right now*?
  const canSubmitNow =
    guestOrderingEnabled && isWithinWindow && canOrder && !isSubmitting;

  return (
    <div className="order-page-layout">
      <div className="order-submission-container">
        {notification && <div className="notification">{notification}</div>}

        <h2>Guest Order</h2>
        <p style={{ marginBottom: "10px" }}>
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
            Your name is missing from your profile. Please update it in your
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
            Guest ordering is only open on Wednesday from 10:00 PM to 12:00 AM
            (Eastern).
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
              {["Plain", "Chocolate Chip", "Banana", "Blueberry"].map(
                (option) => (
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
                )
              )}
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
