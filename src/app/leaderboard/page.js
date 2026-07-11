// src/app/leaderboard/page.js — podium + ranked list, Tonight / All-Time.
// 1 order = 1 plate of 2 pancakes. Counts orders that were actually made
// (Done or completed). Live-updates as the kitchen works.
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { motion, AnimatePresence } from "framer-motion";
import RequireAuth from "../components/RequireAuth";
import { useAuth } from "../context/AuthContext";
import { FULFILLED_STATUSES, PANCAKES_PER_ORDER } from "@/lib/constants";
import { nightKeyOf } from "@/lib/nights";

const MEDALS = [
  { emoji: "👑", color: "#FFD700", label: "1st" },
  { emoji: "🥈", color: "#C0C0C0", label: "2nd" },
  { emoji: "🥉", color: "#CD7F32", label: "3rd" },
];

function buildBoard(orders, uid, profileNameKey) {
  const entries = new Map(); // nameKey -> entry
  for (const order of orders) {
    const displayName = order.name?.trim() || "Unknown";
    const key = displayName.toLowerCase();
    if (!entries.has(key)) {
      entries.set(key, { key, name: displayName, orders: 0, isYou: false });
    }
    const entry = entries.get(key);
    entry.orders += 1;
    if ((uid && order.userId === uid) || (profileNameKey && key === profileNameKey)) {
      entry.isYou = true;
    }
  }

  return [...entries.values()]
    .map((e) => ({ ...e, pancakes: e.orders * PANCAKES_PER_ORDER }))
    .sort((a, b) => b.orders - a.orders || a.name.localeCompare(b.name))
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

function LeaderboardInner() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [tab, setTab] = useState(null); // null = auto until data loads

  // Profile name so we can tag "you" on rows from table-side orders too
  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.uid))
      .then((snap) => setProfileName(snap.exists() ? snap.data().name || "" : ""))
      .catch(() => {});
  }, [user]);

  // All fulfilled orders, live
  useEffect(() => {
    const q = query(
      collection(db, "orders"),
      where("status", "in", FULFILLED_STATUSES)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (!data.createdAt?.toDate) return;
        list.push({
          name: data.name,
          userId: data.userId,
          createdAt: data.createdAt.toDate(),
        });
      });
      setOrders(list);
      setLoaded(true);
    });

    return () => unsub();
  }, []);

  const { tonightBoard, allTimeBoard, totalPancakes, champ } = useMemo(() => {
    const uid = user?.uid ?? null;
    const nameKey = profileName.trim().toLowerCase() || null;
    const tonightKey = nightKeyOf(new Date());

    const tonight = orders.filter((o) => nightKeyOf(o.createdAt) === tonightKey);
    const all = buildBoard(orders, uid, nameKey);

    return {
      tonightBoard: buildBoard(tonight, uid, nameKey),
      allTimeBoard: all,
      totalPancakes: orders.length * PANCAKES_PER_ORDER,
      champ: all[0] ?? null,
    };
  }, [orders, user, profileName]);

  // Default to Tonight during an event, All-Time otherwise
  const activeTab = tab ?? (tonightBoard.length > 0 ? "tonight" : "alltime");
  const board = activeTab === "tonight" ? tonightBoard : allTimeBoard;

  const podium = board.slice(0, 3);
  const rest = board.slice(3);
  const leaderOrders = board[0]?.orders || 1;
  const you = board.find((e) => e.isYou);

  return (
    <div style={S.page}>
      <h2 style={S.title}>🥞 Pancake Leaderboard</h2>

      {/* Stat chips */}
      <div style={S.chipRow}>
        <span style={S.chip}>
          🥞 <strong>{totalPancakes}</strong>&nbsp;pancakes served all-time
        </span>
        {champ && (
          <span style={S.chip}>
            👑 Reigning champ: <strong>&nbsp;{champ.name}</strong>
          </span>
        )}
      </div>

      {/* Tabs */}
      <div style={S.tabRow}>
        <button
          onClick={() => setTab("tonight")}
          style={{ ...S.tab, ...(activeTab === "tonight" ? S.tabActive : {}) }}
        >
          Tonight
        </button>
        <button
          onClick={() => setTab("alltime")}
          style={{ ...S.tab, ...(activeTab === "alltime" ? S.tabActive : {}) }}
        >
          All-Time
        </button>
      </div>

      {!loaded ? (
        <p style={S.muted}>Loading the legends…</p>
      ) : board.length === 0 ? (
        <p style={S.muted}>
          {activeTab === "tonight"
            ? "No pancakes yet tonight — be the first! 🥞"
            : "No pancake legends yet!"}
        </p>
      ) : (
        <>
          {/* Podium: 2nd | 1st | 3rd */}
          <div style={S.podiumRow}>
            {[podium[1], podium[0], podium[2]].map((entry, slot) => {
              if (!entry) return <div key={`empty-${slot}`} style={{ flex: 1 }} />;
              const medal = MEDALS[entry.rank - 1];
              const isFirst = entry.rank === 1;
              return (
                <motion.div
                  key={entry.key}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    ...S.podiumCard,
                    borderColor: medal.color,
                    paddingTop: isFirst ? "26px" : "14px",
                    marginTop: isFirst ? 0 : "22px",
                    boxShadow: isFirst
                      ? `0 0 24px ${medal.color}44`
                      : "0 2px 8px rgba(0,0,0,0.4)",
                    outline: entry.isYou ? "2px solid #ff8f00" : "none",
                  }}
                >
                  <div style={{ fontSize: isFirst ? "2.4rem" : "1.8rem" }}>
                    {medal.emoji}
                  </div>
                  <div style={S.podiumName} title={entry.name}>
                    {entry.name}
                    {entry.isYou && <span style={S.youTag}>you</span>}
                  </div>
                  <div style={{ ...S.podiumCount, color: medal.color }}>
                    {entry.pancakes}
                  </div>
                  <div style={S.podiumSub}>
                    pancakes · {entry.orders}{" "}
                    {entry.orders === 1 ? "order" : "orders"}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Everyone else: ranked rows with relative bars */}
          {rest.length > 0 && (
            <div style={S.list}>
              <AnimatePresence>
                {rest.map((entry) => (
                  <motion.div
                    key={entry.key}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    style={{
                      ...S.row,
                      outline: entry.isYou ? "2px solid #ff8f00" : "none",
                    }}
                  >
                    {/* relative-to-leader fill */}
                    <div
                      style={{
                        ...S.rowFill,
                        width: `${(entry.orders / leaderOrders) * 100}%`,
                      }}
                    />
                    <span style={S.rowRank}>#{entry.rank}</span>
                    <span style={S.rowName} title={entry.name}>
                      {entry.name}
                      {entry.isYou && <span style={S.youTag}>you</span>}
                    </span>
                    <span style={S.rowCount}>
                      {entry.pancakes} 🥞
                      <span style={S.rowOrders}>
                        {entry.orders} {entry.orders === 1 ? "order" : "orders"}
                      </span>
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Your rank, always visible */}
          {you && (
            <div style={S.youBar}>
              You're <strong>&nbsp;#{you.rank}&nbsp;</strong>
              {activeTab === "tonight" ? "tonight" : "all-time"} with{" "}
              <strong>&nbsp;{you.pancakes}&nbsp;</strong> pancakes
            </div>
          )}
        </>
      )}
    </div>
  );
}

const S = {
  page: {
    maxWidth: "640px",
    margin: "0 auto",
    padding: "24px 14px 90px",
  },
  title: {
    textAlign: "center",
    color: "#ff8f00",
    fontSize: "2rem",
    marginBottom: "14px",
  },
  chipRow: {
    display: "flex",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: "8px",
    marginBottom: "18px",
  },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    background: "#1c1c1c",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "999px",
    padding: "6px 14px",
    fontSize: "0.85rem",
    color: "#ddd",
  },
  tabRow: {
    display: "flex",
    justifyContent: "center",
    gap: "8px",
    marginBottom: "22px",
  },
  tab: {
    padding: "10px 26px",
    borderRadius: "999px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "rgba(255,255,255,0.15)",
    background: "#1c1c1c",
    color: "#bbb",
    fontWeight: 700,
    fontSize: "0.95rem",
    cursor: "pointer",
  },
  tabActive: {
    background: "#ff8f00",
    borderColor: "#ff8f00",
    color: "#000",
  },
  muted: {
    textAlign: "center",
    color: "#999",
    padding: "30px 0",
  },
  podiumRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    marginBottom: "22px",
  },
  podiumCard: {
    flex: 1,
    minWidth: 0,
    background: "#1c1c1c",
    borderWidth: "2px",
    borderStyle: "solid",
    borderRadius: "14px",
    padding: "14px 10px",
    textAlign: "center",
  },
  podiumName: {
    fontWeight: 700,
    color: "#fff",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    marginTop: "4px",
  },
  podiumCount: {
    fontSize: "1.7rem",
    fontWeight: 800,
    lineHeight: 1.2,
    marginTop: "2px",
  },
  podiumSub: {
    fontSize: "0.75rem",
    color: "#999",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  row: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "#161616",
    borderRadius: "10px",
    padding: "12px 14px",
    overflow: "hidden",
  },
  rowFill: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    background: "rgba(255, 143, 0, 0.13)",
    borderRadius: "10px 0 0 10px",
    pointerEvents: "none",
  },
  rowRank: {
    color: "#ff8f00",
    fontWeight: 800,
    minWidth: "40px",
    position: "relative",
  },
  rowName: {
    flex: 1,
    minWidth: 0,
    color: "#fff",
    fontWeight: 600,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    position: "relative",
  },
  rowCount: {
    color: "#ffb84d",
    fontWeight: 700,
    textAlign: "right",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    lineHeight: 1.2,
  },
  rowOrders: {
    color: "#888",
    fontWeight: 400,
    fontSize: "0.72rem",
  },
  youTag: {
    marginLeft: "6px",
    background: "#ff8f00",
    color: "#000",
    borderRadius: "999px",
    padding: "1px 8px",
    fontSize: "0.65rem",
    fontWeight: 800,
    verticalAlign: "middle",
  },
  youBar: {
    position: "fixed",
    left: "50%",
    transform: "translateX(-50%)",
    bottom: "calc(14px + env(safe-area-inset-bottom))",
    display: "flex",
    alignItems: "center",
    background: "#1c1c1c",
    border: "1px solid #ff8f00",
    borderRadius: "999px",
    padding: "10px 20px",
    color: "#fff",
    fontSize: "0.9rem",
    boxShadow: "0 6px 18px rgba(0,0,0,0.5)",
    zIndex: 50,
    whiteSpace: "nowrap",
  },
};

export default function Leaderboard() {
  return (
    <RequireAuth>
      <LeaderboardInner />
    </RequireAuth>
  );
}
