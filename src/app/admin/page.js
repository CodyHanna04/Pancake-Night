// src/app/admin/page.js
"use client";

import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { db, auth } from "../../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import RequireAdmin from "../components/RequireAdmin";

function AdminDashboardInner() {
  const [allOrders, setAllOrders] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState("");
  const [weeks, setWeeks] = useState([]);

  // Guest ordering config state
  const [guestEnabled, setGuestEnabled] = useState(true);
  const [guestDay, setGuestDay] = useState(3); // Wednesday default
  const [startHour, setStartHour] = useState(22); // 10pm
  const [endHour, setEndHour] = useState(0); // midnight
  const [savingConfig, setSavingConfig] = useState(false);

  const [analytics, setAnalytics] = useState({
    avgWait: 0,
    pancakeCounts: {},
    quarterHourCounts: {},
    totalOrders: 0,
  });

  // Fetch orders for analytics when an admin is logged in
  useEffect(() => {
    const fetchOrders = async () => {
      const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);

      const orders = [];
      const weekSet = new Set();

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.createdAt) {
          const createdDate = data.createdAt.toDate();
          const year = createdDate.getFullYear();
          const week = getWeek(createdDate);
          const weekKey = `${year}-W${week}`;
          weekSet.add(weekKey);
          orders.push({ ...data, createdAt: createdDate, weekKey });
        }
      });

      const weekArray = Array.from(weekSet).sort().reverse();
      setWeeks(weekArray);
      setAllOrders(orders);
      if (weekArray.length > 0) {
        setSelectedWeek(weekArray[0]); // default to latest
      }
    };

    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) fetchOrders();
    });

    return () => unsub();
  }, []);

  // Load guest ordering config from Firestore
  useEffect(() => {
    async function loadGuestConfig() {
      try {
        const configRef = doc(db, "config", "guestOrdering");
        const snap = await getDoc(configRef);
        if (snap.exists()) {
          const data = snap.data();
          setGuestEnabled(data.enabled ?? true);
          setGuestDay(data.dayOfWeek ?? 3);
          setStartHour(data.startHour ?? 22);
          setEndHour(data.endHour ?? 0);
        }
      } catch (err) {
        console.error("Error loading guest config:", err);
      }
    }

    loadGuestConfig();
  }, []);

  // Recompute analytics when week or orders change
  useEffect(() => {
    if (!selectedWeek) return;

    const filtered = allOrders.filter(
      (order) => order.weekKey === selectedWeek
    );
    const pancakeCounts = {};
    const quarterHourCounts = {};
    let totalWait = 0;
    let totalOrders = 0;

    filtered.forEach((order) => {
      totalOrders += 1;

      if (order.completedAt) {
        const completed = order.completedAt.toDate();
        totalWait += (completed - order.createdAt) / 1000; // seconds
      }

      if (Array.isArray(order.selectedOptions)) {
        order.selectedOptions.forEach((item) => {
          pancakeCounts[item] = (pancakeCounts[item] || 0) + 1;
        });
      }

      const mins = order.createdAt.getMinutes();
      const roundedMins = Math.floor(mins / 15) * 15;
      const timeSlot = `${order.createdAt
        .getHours()
        .toString()
        .padStart(2, "0")}:${roundedMins.toString().padStart(2, "0")}`;
      quarterHourCounts[timeSlot] =
        (quarterHourCounts[timeSlot] || 0) + 1;
    });

    setAnalytics({
      avgWait:
        totalOrders > 0
          ? (totalWait / totalOrders / 60).toFixed(2)
          : 0,
      pancakeCounts,
      quarterHourCounts,
      totalOrders,
    });
  }, [selectedWeek, allOrders]);

  const getWeek = (date) => {
    const firstDay = new Date(date.getFullYear(), 0, 1);
    const dayDiff =
      (date -
        firstDay +
        (firstDay.getTimezoneOffset() - date.getTimezoneOffset()) *
          60000) /
      86400000;
    return Math.floor((dayDiff + firstDay.getDay() + 1) / 7);
  };

  async function saveGuestConfig() {
    setSavingConfig(true);
    try {
      await setDoc(doc(db, "config", "guestOrdering"), {
        enabled: guestEnabled,
        dayOfWeek: guestDay,
        startHour,
        endHour,
      });

      alert("Guest ordering settings saved!");
    } catch (err) {
      console.error("Error saving configuration:", err);
      alert("Failed to save settings.");
    }
    setSavingConfig(false);
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.header}>🥞 Pancake Night Dashboard</h2>

      {/* Week Filter */}
      <div style={styles.section}>
        <label style={styles.label}>Filter by Week:</label>
        <select
          value={selectedWeek}
          onChange={(e) => setSelectedWeek(e.target.value)}
          style={styles.select}
        >
          {weeks.map((week) => (
            <option key={week} value={week}>
              {week}
            </option>
          ))}
        </select>
      </div>

      {/* Summary */}
      <div style={styles.section}>
        <h3>Summary</h3>
        <p>
          <strong>Total Orders:</strong> {analytics.totalOrders}
        </p>
        <p>
          <strong>Average Wait Time:</strong> {analytics.avgWait} minutes
        </p>
      </div>

      {/* Pancake Counts */}
      <div style={styles.section}>
        <h3>Pancake Counts</h3>
        <ul>
          {Object.entries(analytics.pancakeCounts).map(
            ([type, count]) => (
              <li key={type}>
                {type}: {count}
              </li>
            )
          )}
        </ul>
      </div>

      {/* Busy Periods */}
      <div style={styles.section}>
        <h3>Busy Periods (15-min intervals)</h3>
        <ul>
          {Object.entries(analytics.quarterHourCounts)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([time, count]) => (
              <li key={time}>
                {time} → {count} orders
              </li>
            ))}
        </ul>
      </div>

      {/* Guest Ordering Settings */}
      <div style={styles.section}>
        <h3 style={{ color: "#ff8f00" }}>Guest Ordering Settings</h3>

        {/* Enable/disable toggle */}
        <div style={{ marginBottom: "15px" }}>
          <label style={styles.label}>Guest Ordering Enabled:</label>
          <select
            value={guestEnabled ? "true" : "false"}
            onChange={(e) => setGuestEnabled(e.target.value === "true")}
            style={styles.select}
          >
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
        </div>

        {/* Day of week */}
        <div style={{ marginBottom: "15px" }}>
          <label style={styles.label}>Day of Week:</label>
          <select
            value={guestDay}
            onChange={(e) => setGuestDay(Number(e.target.value))}
            style={styles.select}
          >
            <option value={0}>Sunday</option>
            <option value={1}>Monday</option>
            <option value={2}>Tuesday</option>
            <option value={3}>Wednesday</option>
            <option value={4}>Thursday</option>
            <option value={5}>Friday</option>
            <option value={6}>Saturday</option>
          </select>
        </div>

        {/* Start time */}
        <div style={{ marginBottom: "15px" }}>
          <label style={styles.label}>Start Hour (24h):</label>
          <input
            type="number"
            min="0"
            max="23"
            value={startHour}
            onChange={(e) => setStartHour(Number(e.target.value))}
            style={{
              ...styles.select,
              width: "90px",
              textAlign: "center",
            }}
          />
        </div>

        {/* End time */}
        <div style={{ marginBottom: "15px" }}>
          <label style={styles.label}>End Hour (24h):</label>
          <input
            type="number"
            min="0"
            max="23"
            value={endHour}
            onChange={(e) => setEndHour(Number(e.target.value))}
            style={{
              ...styles.select,
              width: "90px",
              textAlign: "center",
            }}
          />
        </div>

        {/* Save button */}
        <button
          onClick={saveGuestConfig}
          disabled={savingConfig}
          style={{
            padding: "10px 20px",
            background: "#ff8f00",
            borderRadius: "6px",
            border: "none",
            color: "#fff",
            fontWeight: "bold",
            cursor: savingConfig ? "default" : "pointer",
            marginTop: "10px",
            opacity: savingConfig ? 0.7 : 1,
          }}
        >
          {savingConfig ? "Saving…" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: "30px",
    fontFamily: "Arial, sans-serif",
    background: "#000", // Black background
    color: "#fff", // White text
    minHeight: "100vh",
  },
  header: {
    fontSize: "2.5rem",
    color: "#ff8f00", // Princeton orange
    marginBottom: "30px",
  },
  section: {
    marginBottom: "30px",
    padding: "20px",
    backgroundColor: "#1c1c1c", // Dark gray for cards
    borderRadius: "12px",
    boxShadow: "0 2px 6px rgba(255, 143, 0, 0.3)",
  },
  label: {
    marginRight: "10px",
    fontWeight: "bold",
    color: "#ff8f00",
  },
  select: {
    padding: "8px 12px",
    fontSize: "16px",
    borderRadius: "6px",
    backgroundColor: "#000",
    color: "#fff",
    border: "1px solid #ff8f00",
    outline: "none",
  },
};

export default function AdminDashboard() {
  return (
    <RequireAdmin>
      <AdminDashboardInner />
    </RequireAdmin>
  );
}
