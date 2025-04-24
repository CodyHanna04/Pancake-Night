"use client";

import { useEffect, useState } from "react";
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { app } from "../../../lib/firebase";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const db = getFirestore(app);

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    const q = query(
      collection(db, "orders"),
      where("status", "==", "completed")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pancakeCount = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        const name = data.name?.trim() || "Unknown";
        pancakeCount[name] = (pancakeCount[name] || 0) + 2;
      });

      const sorted = Object.entries(pancakeCount)
        .map(([name, pancakes]) => ({ name, pancakes }))
        .sort((a, b) => b.pancakes - a.pancakes);

      setLeaderboard(sorted);
    });

    return () => unsubscribe();
  }, []);

  const getRankEmoji = (index) => {
    if (index === 0) return "👑";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return `#${index + 1}`;
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-4xl font-extrabold mb-8 text-center text-orange-500">
        🥞 Pancake Leaderboard
      </h1>

      <div className="mb-12">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={leaderboard}>
            <XAxis dataKey="name" stroke="#ffffff" />
            <YAxis stroke="#ffffff" />
            <Tooltip />
            <Bar dataKey="pancakes">
              {leaderboard.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    index === 0
                      ? "#FFD700"
                      : index === 1
                      ? "#C0C0C0"
                      : index === 2
                      ? "#CD7F32"
                      : "#FF8F00"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {leaderboard.length === 0 ? (
        <p className="text-center text-gray-400">No pancake legends yet!</p>
      ) : (
        <div className="space-y-10">
          <AnimatePresence>
            {leaderboard.map((entry, index) => (
              <motion.div
                key={entry.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="flex items-center justify-between px-6 py-4 bg-white/10 border border-white/20 rounded-2xl shadow backdrop-blur hover:bg-white/20 transition"
              >
                <div className="flex items-center space-x-6">
                  <div className="text-3xl font-bold text-orange-300">
                    {getRankEmoji(index)}
                  </div>
                  <div className="text-xl font-semibold text-white tracking-wide">
                    {entry.name}
                  </div>
                </div>
                <div className="text-lg text-orange-200 font-medium">
                  {entry.pancakes} pancakes
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
