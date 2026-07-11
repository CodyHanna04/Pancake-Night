// src/app/admin/metrics/page.js — full analytics + purchasing forecast.
// A "night" groups everything from 6 AM to 6 AM the next day, so orders that
// roll past midnight stay with the pancake night they belong to.
"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import RequireAdmin from "../../components/RequireAdmin";
import { ADMIN_PANCAKE_OPTIONS, PANCAKES_PER_ORDER } from "@/lib/constants";
import { nightKeyOf, nightLabel } from "@/lib/nights";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

// Validated categorical palette (dark surface #1c1c1c) — semantic where possible
const ITEM_COLORS = {
  Plain: "#C98500",
  "Chocolate Chip": "#A85C2E",
  Banana: "#A38A0E",
  Blueberry: "#3987E5",
  Special: "#9A66E8",
};

const tooltipStyle = {
  backgroundColor: "#1c1c1c",
  border: "1px solid #444",
  borderRadius: "8px",
  color: "#fff",
};

function MetricsInner() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNight, setSelectedNight] = useState(""); // night drill-down

  async function fetchOrders() {
    setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, "orders"), orderBy("createdAt"))
      );
      const list = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (!data.createdAt?.toDate) return;
        list.push({
          ...data,
          createdAt: data.createdAt.toDate(),
          completedAt: data.completedAt?.toDate?.() ?? null,
        });
      });
      setOrders(list);
    } catch (err) {
      console.error("Error loading orders for metrics:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrders();
  }, []);

  const stats = useMemo(() => {
    if (orders.length === 0) return null;

    // ---- group by night ----
    const nights = new Map(); // key -> { orders: [], items: {} }
    for (const order of orders) {
      const key = nightKeyOf(order.createdAt);
      if (!nights.has(key)) nights.set(key, { orders: [], items: {} });
      const night = nights.get(key);
      night.orders.push(order);
      for (const item of order.selectedOptions ?? []) {
        night.items[item] = (night.items[item] || 0) + 1;
      }
    }
    const nightKeys = [...nights.keys()].sort();

    // ---- per-night series (last 12 for the trend, 8 for the mix) ----
    const perNight = nightKeys.map((key) => ({
      key,
      label: nightLabel(key),
      orders: nights.get(key).orders.length,
      ...nights.get(key).items,
    }));
    const trendData = perNight.slice(-12);
    const mixData = perNight.slice(-8);

    // ---- KPIs ----
    const totalOrders = orders.length;
    const avgPerNight = totalOrders / nightKeys.length;

    const waits = orders
      .filter((o) => o.completedAt)
      .map((o) => (o.completedAt - o.createdAt) / 60000)
      .filter((m) => m >= 0 && m < 180); // discard nonsense outliers
    const avgWait =
      waits.length > 0 ? waits.reduce((a, b) => a + b, 0) / waits.length : null;

    const busiestNight = perNight.reduce(
      (best, n) => (n.orders > best.orders ? n : best),
      perNight[0]
    );

    // ---- item totals + purchasing forecast ----
    const recentKeys = nightKeys.slice(-4); // forecast window
    const lastKey = nightKeys[nightKeys.length - 1];
    const itemStats = ADMIN_PANCAKE_OPTIONS.map((item) => {
      let total = 0;
      for (const key of nightKeys) total += nights.get(key).items[item] || 0;
      const recentAvg =
        recentKeys.reduce((sum, key) => sum + (nights.get(key).items[item] || 0), 0) /
        recentKeys.length;
      const lastNight = nights.get(lastKey).items[item] || 0;
      // plan for the bigger of "recent average" and "last night", plus 15% buffer
      const plan = Math.ceil(Math.max(recentAvg, lastNight) * 1.15);
      return { item, total, recentAvg, lastNight, plan };
    }).sort((a, b) => b.total - a.total);

    const expectedOrders = Math.ceil(
      Math.max(
        recentKeys.reduce((s, k) => s + nights.get(k).orders.length, 0) /
          recentKeys.length,
        nights.get(lastKey).orders.length
      ) * 1.15
    );

    // ---- busiest 15-minute windows (average per night) ----
    const slotTotals = {};
    for (const order of orders) {
      const h = order.createdAt.getHours();
      const q15 = Math.floor(order.createdAt.getMinutes() / 15) * 15;
      const slot = `${String(h).padStart(2, "0")}:${String(q15).padStart(2, "0")}`;
      slotTotals[slot] = (slotTotals[slot] || 0) + 1;
    }
    const slotData = Object.entries(slotTotals)
      .map(([slot, count]) => ({
        slot,
        avg: Number((count / nightKeys.length).toFixed(1)),
      }))
      .sort((a, b) => a.slot.localeCompare(b.slot));

    // ---- per-night drill-down details ----
    const nightDetails = {};
    for (const key of nightKeys) {
      const night = nights.get(key);
      const nightWaits = night.orders
        .filter((o) => o.completedAt)
        .map((o) => (o.completedAt - o.createdAt) / 60000)
        .filter((m) => m >= 0 && m < 180);
      const slots = {};
      for (const o of night.orders) {
        const h = o.createdAt.getHours();
        const q15 = Math.floor(o.createdAt.getMinutes() / 15) * 15;
        const slot = `${String(h).padStart(2, "0")}:${String(q15).padStart(2, "0")}`;
        slots[slot] = (slots[slot] || 0) + 1;
      }
      nightDetails[key] = {
        label: nightLabel(key),
        orders: night.orders.length,
        avgWait:
          nightWaits.length > 0
            ? nightWaits.reduce((a, b) => a + b, 0) / nightWaits.length
            : null,
        items: night.items,
        slots: Object.entries(slots)
          .map(([slot, count]) => ({ slot, count }))
          .sort((a, b) => a.slot.localeCompare(b.slot)),
      };
    }

    return {
      nightCount: nightKeys.length,
      nightKeys,
      nightDetails,
      totalOrders,
      avgPerNight,
      avgWait,
      busiestNight,
      trendData,
      mixData,
      itemStats,
      expectedOrders,
      slotData,
      forecastWindow: recentKeys.length,
    };
  }, [orders]);

  // Default the drill-down to the most recent night
  useEffect(() => {
    if (stats && !selectedNight) {
      setSelectedNight(stats.nightKeys[stats.nightKeys.length - 1]);
    }
  }, [stats, selectedNight]);

  const nightDetail =
    stats && selectedNight ? stats.nightDetails[selectedNight] : null;

  const S = styles;

  return (
    <div style={S.page}>
      <div style={S.headerRow}>
        <h2 style={S.header}>📊 Pancake Night Metrics</h2>
        <button onClick={fetchOrders} disabled={loading} style={S.refresh}>
          {loading ? "Loading…" : "↻ Refresh"}
        </button>
      </div>

      {loading && !stats ? (
        <p style={{ color: "#bbb" }}>Crunching the numbers…</p>
      ) : !stats ? (
        <p style={{ color: "#bbb" }}>No orders yet — check back after a pancake night.</p>
      ) : (
        <>
          {/* KPI tiles */}
          <div style={S.tileRow}>
            <div style={S.tile}>
              <div style={S.tileValue}>{stats.totalOrders}</div>
              <div style={S.tileLabel}>orders all-time · {stats.nightCount} nights</div>
            </div>
            <div style={S.tile}>
              <div style={S.tileValue}>{stats.avgPerNight.toFixed(1)}</div>
              <div style={S.tileLabel}>
                avg orders / night ({Math.round(stats.avgPerNight * PANCAKES_PER_ORDER)} pancakes)
              </div>
            </div>
            <div style={S.tile}>
              <div style={S.tileValue}>
                {stats.avgWait !== null ? `${stats.avgWait.toFixed(1)}m` : "—"}
              </div>
              <div style={S.tileLabel}>avg wait (order → ready)</div>
            </div>
            <div style={S.tile}>
              <div style={S.tileValue}>{stats.busiestNight.orders}</div>
              <div style={S.tileLabel}>busiest night ({stats.busiestNight.label})</div>
            </div>
          </div>

          {/* Purchasing forecast */}
          <div style={S.section}>
            <h3 style={S.sectionTitle}>🛒 Shopping Forecast — next pancake night</h3>
            <p style={S.sectionHint}>
              Based on the last {stats.forecastWindow} nights (whichever is higher:
              recent average or last night), plus a 15% buffer. Expect roughly{" "}
              <strong style={{ color: "#ff8f00" }}>
                {stats.expectedOrders} orders (~{stats.expectedOrders * PANCAKES_PER_ORDER} pancakes)
              </strong>.
            </p>
            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Item</th>
                    <th style={S.thNum}>Avg / night</th>
                    <th style={S.thNum}>Last night</th>
                    <th style={S.thNum}>Plan for</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.itemStats.map(({ item, recentAvg, lastNight, plan }) => (
                    <tr key={item}>
                      <td style={S.td}>
                        <span
                          style={{
                            display: "inline-block",
                            width: "10px",
                            height: "10px",
                            borderRadius: "3px",
                            background: ITEM_COLORS[item] || "#888",
                            marginRight: "8px",
                          }}
                        />
                        {item}
                      </td>
                      <td style={S.tdNum}>{recentAvg.toFixed(1)}</td>
                      <td style={S.tdNum}>{lastNight}</td>
                      <td style={{ ...S.tdNum, color: "#ff8f00", fontWeight: "bold" }}>
                        {plan}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={S.footnote}>
              Numbers are order line-items (each = one plate of {PANCAKES_PER_ORDER} pancakes).
            </p>
          </div>

          {/* Per-night drill-down (was the weekly view on the old admin page) */}
          <div style={S.section}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "10px",
                marginBottom: "10px",
              }}
            >
              <h3 style={{ ...S.sectionTitle, margin: 0 }}>🌙 Night Details</h3>
              <select
                value={selectedNight}
                onChange={(e) => setSelectedNight(e.target.value)}
                style={S.nightSelect}
              >
                {[...stats.nightKeys].reverse().map((key) => (
                  <option key={key} value={key}>
                    {stats.nightDetails[key].label} — {stats.nightDetails[key].orders} orders
                  </option>
                ))}
              </select>
            </div>

            {nightDetail && (
              <>
                <div style={S.tileRow}>
                  <div style={S.miniTile}>
                    <div style={S.tileValue}>{nightDetail.orders}</div>
                    <div style={S.tileLabel}>
                      orders ({nightDetail.orders * PANCAKES_PER_ORDER} pancakes)
                    </div>
                  </div>
                  <div style={S.miniTile}>
                    <div style={S.tileValue}>
                      {nightDetail.avgWait !== null
                        ? `${nightDetail.avgWait.toFixed(1)}m`
                        : "—"}
                    </div>
                    <div style={S.tileLabel}>avg wait that night</div>
                  </div>
                </div>

                <div style={S.detailGrid}>
                  <div>
                    <h4 style={S.detailHeading}>Item counts</h4>
                    {Object.keys(nightDetail.items).length === 0 ? (
                      <p style={S.footnote}>No item data.</p>
                    ) : (
                      <ul style={S.detailList}>
                        {Object.entries(nightDetail.items)
                          .sort(([, a], [, b]) => b - a)
                          .map(([item, count]) => (
                            <li key={item} style={S.detailItem}>
                              <span
                                style={{
                                  display: "inline-block",
                                  width: "10px",
                                  height: "10px",
                                  borderRadius: "3px",
                                  background: ITEM_COLORS[item] || "#888",
                                  marginRight: "8px",
                                }}
                              />
                              {item}: <strong>{count}</strong>
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <h4 style={S.detailHeading}>Busy periods (15 min)</h4>
                    <ul style={S.detailList}>
                      {nightDetail.slots.map(({ slot, count }) => (
                        <li key={slot} style={S.detailItem}>
                          {slot} → <strong>{count}</strong> orders
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Orders per night trend */}
          <div style={S.section}>
            <h3 style={S.sectionTitle}>Orders per night (last {stats.trendData.length})</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={stats.trendData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#333" vertical={false} />
                <XAxis dataKey="label" stroke="#888" tickLine={false} />
                <YAxis stroke="#888" allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#bbb" }} />
                <Line
                  type="monotone"
                  dataKey="orders"
                  name="Orders"
                  stroke="#ff8f00"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "#ff8f00" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Item mix per night */}
          <div style={S.section}>
            <h3 style={S.sectionTitle}>What people ordered (last {stats.mixData.length} nights)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.mixData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#333" vertical={false} />
                <XAxis dataKey="label" stroke="#888" tickLine={false} />
                <YAxis stroke="#888" allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#bbb" }} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                <Legend wrapperStyle={{ color: "#bbb" }} />
                {ADMIN_PANCAKE_OPTIONS.map((item) => (
                  <Bar
                    key={item}
                    dataKey={item}
                    stackId="mix"
                    fill={ITEM_COLORS[item]}
                    stroke="#1c1c1c"
                    strokeWidth={2}
                    maxBarSize={48}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Busiest windows */}
          <div style={S.section}>
            <h3 style={S.sectionTitle}>Rush hours — avg orders per 15 min</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={stats.slotData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#333" vertical={false} />
                <XAxis dataKey="slot" stroke="#888" tickLine={false} />
                <YAxis stroke="#888" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#bbb" }} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                <Bar dataKey="avg" name="Avg orders" fill="#ff8f00" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
            <p style={S.footnote}>
              Use this to know when to have extra hands on the griddle.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  page: {
    padding: "30px",
    fontFamily: "Arial, sans-serif",
    background: "#000",
    color: "#fff",
    minHeight: "100vh",
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "12px",
    marginBottom: "24px",
  },
  header: { fontSize: "2.2rem", color: "#ff8f00", margin: 0 },
  refresh: {
    padding: "8px 16px",
    background: "#1c1c1c",
    color: "#ff8f00",
    border: "1px solid #ff8f00",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  tileRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "14px",
    marginBottom: "24px",
  },
  tile: {
    background: "#1c1c1c",
    borderRadius: "12px",
    padding: "18px",
    boxShadow: "0 2px 6px rgba(255, 143, 0, 0.3)",
  },
  tileValue: { fontSize: "2rem", fontWeight: "bold", color: "#ff8f00" },
  tileLabel: { color: "#bbb", fontSize: "0.85rem", marginTop: "4px" },
  section: {
    background: "#1c1c1c",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "24px",
    boxShadow: "0 2px 6px rgba(255, 143, 0, 0.3)",
  },
  sectionTitle: { margin: "0 0 8px", color: "#fff" },
  sectionHint: { color: "#bbb", fontSize: "0.9rem", marginBottom: "14px" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left",
    color: "#bbb",
    fontSize: "0.85rem",
    padding: "8px 10px",
    borderBottom: "1px solid #333",
  },
  thNum: {
    textAlign: "right",
    color: "#bbb",
    fontSize: "0.85rem",
    padding: "8px 10px",
    borderBottom: "1px solid #333",
  },
  td: { padding: "10px", borderBottom: "1px solid #2a2a2a", color: "#fff" },
  tdNum: {
    padding: "10px",
    borderBottom: "1px solid #2a2a2a",
    color: "#fff",
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
  },
  footnote: { color: "#777", fontSize: "0.8rem", marginTop: "10px" },
  nightSelect: {
    padding: "10px 12px",
    fontSize: "16px",
    borderRadius: "6px",
    backgroundColor: "#000",
    color: "#fff",
    border: "1px solid #ff8f00",
    outline: "none",
    maxWidth: "100%",
  },
  miniTile: {
    background: "#111",
    borderRadius: "10px",
    padding: "14px",
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
    marginTop: "16px",
  },
  detailHeading: { color: "#ff8f00", margin: "0 0 8px" },
  detailList: { listStyle: "none", padding: 0, margin: 0 },
  detailItem: {
    padding: "4px 0",
    borderBottom: "1px solid #2a2a2a",
    color: "#ddd",
    fontSize: "0.9rem",
  },
};

export default function MetricsPage() {
  return (
    <RequireAdmin>
      <MetricsInner />
    </RequireAdmin>
  );
}
