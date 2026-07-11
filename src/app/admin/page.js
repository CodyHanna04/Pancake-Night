// src/app/admin/page.js — admin settings (analytics live at /admin/metrics)
"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import RequireAdmin from "../components/RequireAdmin";
import { DEFAULT_WAIT_THRESHOLDS } from "@/lib/constants";

function AdminSettingsInner() {
  // Guest ordering config
  const [guestEnabled, setGuestEnabled] = useState(true);
  const [guestDay, setGuestDay] = useState(3); // Wednesday default
  const [startHour, setStartHour] = useState(22); // 10pm
  const [endHour, setEndHour] = useState(0); // midnight
  const [savingConfig, setSavingConfig] = useState(false);

  // Wait-time card coloring thresholds (kitchen + home)
  const [warnMinutes, setWarnMinutes] = useState(
    DEFAULT_WAIT_THRESHOLDS.warnMinutes
  );
  const [dangerMinutes, setDangerMinutes] = useState(
    DEFAULT_WAIT_THRESHOLDS.dangerMinutes
  );
  const [savingDisplay, setSavingDisplay] = useState(false);

  // QR code for guest ordering
  const qrCanvasRef = useRef(null);
  const [qrUrl, setQrUrl] = useState("");

  // Load guest ordering config
  useEffect(() => {
    async function loadGuestConfig() {
      try {
        const snap = await getDoc(doc(db, "config", "guestOrdering"));
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

  // Load wait-time thresholds
  useEffect(() => {
    async function loadDisplayConfig() {
      try {
        const snap = await getDoc(doc(db, "config", "display"));
        if (snap.exists()) {
          const data = snap.data();
          if (typeof data.warnMinutes === "number") setWarnMinutes(data.warnMinutes);
          if (typeof data.dangerMinutes === "number") setDangerMinutes(data.dangerMinutes);
        }
      } catch (err) {
        console.error("Error loading display config:", err);
      }
    }

    loadDisplayConfig();
  }, []);

  // Render the guest-ordering QR code (encodes this deployment's domain)
  useEffect(() => {
    const url = `${window.location.origin}/guest`;
    setQrUrl(url);
    if (qrCanvasRef.current) {
      QRCode.toCanvas(qrCanvasRef.current, url, {
        width: 220,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      }).catch((err) => console.error("QR render failed:", err));
    }
  }, []);

  function downloadQr() {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "pancake-night-qr.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

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

  async function saveDisplayConfig() {
    if (dangerMinutes <= warnMinutes) {
      alert("Red threshold must be higher than yellow.");
      return;
    }
    setSavingDisplay(true);
    try {
      await setDoc(doc(db, "config", "display"), {
        warnMinutes,
        dangerMinutes,
      });
      alert("Wait-time settings saved!");
    } catch (err) {
      console.error("Error saving display config:", err);
      alert("Failed to save settings.");
    }
    setSavingDisplay(false);
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.header}>⚙️ Settings</h2>

      <Link
        href="/admin/metrics"
        style={{
          display: "inline-block",
          marginBottom: "30px",
          padding: "12px 24px",
          background: "#ff8f00",
          color: "#000",
          fontWeight: "bold",
          borderRadius: "8px",
          textDecoration: "none",
        }}
      >
        📊 Open Metrics Dashboard →
      </Link>

      {/* Guest Ordering Settings */}
      <div style={styles.section}>
        <h3 style={{ color: "#ff8f00" }}>Guest Ordering</h3>

        <div style={styles.field}>
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

        <div style={styles.field}>
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

        <div style={styles.field}>
          <label style={styles.label}>Start Hour (24h):</label>
          <input
            type="number"
            min="0"
            max="23"
            value={startHour}
            onChange={(e) => setStartHour(Number(e.target.value))}
            style={{ ...styles.select, width: "90px", textAlign: "center" }}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>End Hour (24h):</label>
          <input
            type="number"
            min="0"
            max="23"
            value={endHour}
            onChange={(e) => setEndHour(Number(e.target.value))}
            style={{ ...styles.select, width: "90px", textAlign: "center" }}
          />
        </div>

        <button onClick={saveGuestConfig} disabled={savingConfig} style={styles.saveButton}>
          {savingConfig ? "Saving…" : "Save Guest Settings"}
        </button>
      </div>

      {/* Wait-time card coloring */}
      <div style={styles.section}>
        <h3 style={{ color: "#ff8f00" }}>Wait-Time Card Colors</h3>
        <p style={styles.hint}>
          Kitchen and Home cards turn yellow, then red, as customers wait.
          The timer freezes when an order is marked Done.
        </p>

        <div style={styles.field}>
          <label style={styles.label}>🟡 Yellow after (minutes):</label>
          <input
            type="number"
            min="1"
            max="60"
            value={warnMinutes}
            onChange={(e) => setWarnMinutes(Number(e.target.value))}
            style={{ ...styles.select, width: "90px", textAlign: "center" }}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>🔴 Red after (minutes):</label>
          <input
            type="number"
            min="2"
            max="120"
            value={dangerMinutes}
            onChange={(e) => setDangerMinutes(Number(e.target.value))}
            style={{ ...styles.select, width: "90px", textAlign: "center" }}
          />
        </div>

        <button onClick={saveDisplayConfig} disabled={savingDisplay} style={styles.saveButton}>
          {savingDisplay ? "Saving…" : "Save Wait-Time Settings"}
        </button>
      </div>

      {/* QR code */}
      <div style={styles.section}>
        <h3 style={{ color: "#ff8f00" }}>Guest Ordering QR Code</h3>
        <p style={styles.hint}>
          Print this and put it on the tables. It links to <strong>{qrUrl}</strong> —
          signed-in guests go straight to ordering; new people are sent to
          log in / sign up first.
        </p>
        <canvas
          ref={qrCanvasRef}
          style={{ borderRadius: "8px", display: "block", marginBottom: "15px", maxWidth: "100%" }}
        />
        <button onClick={downloadQr} style={styles.saveButton}>
          ⬇ Download PNG
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: "24px 16px",
    maxWidth: "760px",
    margin: "0 auto",
    color: "#fff",
    minHeight: "100vh",
  },
  header: {
    fontSize: "2.2rem",
    color: "#ff8f00",
    marginBottom: "20px",
  },
  section: {
    marginBottom: "24px",
    padding: "20px",
    backgroundColor: "#1c1c1c",
    borderRadius: "12px",
    boxShadow: "0 2px 6px rgba(255, 143, 0, 0.3)",
  },
  field: {
    marginBottom: "15px",
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "8px",
  },
  label: {
    fontWeight: "bold",
    color: "#ff8f00",
  },
  hint: {
    color: "#bbb",
    fontSize: "0.9rem",
    marginBottom: "15px",
  },
  select: {
    padding: "10px 12px",
    fontSize: "16px",
    borderRadius: "6px",
    backgroundColor: "#000",
    color: "#fff",
    border: "1px solid #ff8f00",
    outline: "none",
  },
  saveButton: {
    padding: "12px 20px",
    background: "#ff8f00",
    borderRadius: "8px",
    border: "none",
    color: "#000",
    fontWeight: "bold",
    cursor: "pointer",
    marginTop: "6px",
  },
};

export default function AdminSettings() {
  return (
    <RequireAdmin>
      <AdminSettingsInner />
    </RequireAdmin>
  );
}
