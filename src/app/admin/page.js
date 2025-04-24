'use client';
import React, { useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../../lib/firebase';

const AdminDashboard = () => {
  const [allOrders, setAllOrders] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState('');
  const [weeks, setWeeks] = useState([]);

  const [analytics, setAnalytics] = useState({
    avgWait: 0,
    pancakeCounts: {},
    quarterHourCounts: {},
    totalOrders: 0,
  });

  useEffect(() => {
    const fetchOrders = async () => {
      const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);

      const orders = [];
      const weekSet = new Set();

      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.createdAt) {
          const createdDate = data.createdAt.toDate();
          const year = createdDate.getFullYear();
          const week = getWeek(createdDate);
          const weekKey = `${year}-W${week}`;
          weekSet.add(weekKey);
          orders.push({ ...data, createdAt: createdDate, weekKey });
        }
      });

      setWeeks(Array.from(weekSet).sort().reverse());
      setAllOrders(orders);
      setSelectedWeek(Array.from(weekSet)[0]); // default to latest
    };

    onAuthStateChanged(auth, (user) => {
      if (user) fetchOrders();
    });
  }, []);

  useEffect(() => {
    const filtered = allOrders.filter((order) => order.weekKey === selectedWeek);
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
      const timeSlot = `${order.createdAt.getHours()}:${roundedMins.toString().padStart(2, '0')}`;
      quarterHourCounts[timeSlot] = (quarterHourCounts[timeSlot] || 0) + 1;
    });

    setAnalytics({
      avgWait: totalOrders > 0 ? (totalWait / totalOrders / 60).toFixed(2) : 0,
      pancakeCounts,
      quarterHourCounts,
      totalOrders,
    });
  }, [selectedWeek, allOrders]);

  const getWeek = (date) => {
    const firstDay = new Date(date.getFullYear(), 0, 1);
    const dayDiff = (date - firstDay + ((firstDay.getTimezoneOffset() - date.getTimezoneOffset()) * 60000)) / 86400000;
    return Math.floor((dayDiff + firstDay.getDay() + 1) / 7);
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.header}>🥞 Pancake Night Dashboard</h2>

      <div style={styles.section}>
        <label style={styles.label}>Filter by Week:</label>
        <select value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)} style={styles.select}>
          {weeks.map((week) => (
            <option key={week} value={week}>{week}</option>
          ))}
        </select>
      </div>

      <div style={styles.section}>
        <h3>Summary</h3>
        <p><strong>Total Orders:</strong> {analytics.totalOrders}</p>
        <p><strong>Average Wait Time:</strong> {analytics.avgWait} minutes</p>
      </div>

      <div style={styles.section}>
        <h3>Pancake Counts</h3>
        <ul>
          {Object.entries(analytics.pancakeCounts).map(([type, count]) => (
            <li key={type}>{type}: {count}</li>
          ))}
        </ul>
      </div>

      <div style={styles.section}>
        <h3>Busy Periods (15-min intervals)</h3>
        <ul>
          {Object.entries(analytics.quarterHourCounts)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([time, count]) => (
              <li key={time}>{time} → {count} orders</li>
            ))}
        </ul>
      </div>
    </div>
  );
};

const styles = {
    container: {
      padding: '30px',
      fontFamily: 'Arial, sans-serif',
      background: '#000', // Black background
      color: '#fff',      // White text
      minHeight: '100vh',
    },
    header: {
      fontSize: '2.5rem',
      color: '#ff8f00', // Princeton orange
      marginBottom: '30px',
    },
    section: {
      marginBottom: '30px',
      padding: '20px',
      backgroundColor: '#1c1c1c', // Dark gray for cards
      borderRadius: '12px',
      boxShadow: '0 2px 6px rgba(255, 143, 0, 0.3)',
    },
    label: {
      marginRight: '10px',
      fontWeight: 'bold',
      color: '#ff8f00',
    },
    select: {
      padding: '8px 12px',
      fontSize: '16px',
      borderRadius: '6px',
      backgroundColor: '#000',
      color: '#fff',
      border: '1px solid #ff8f00',
      outline: 'none',
    }
  };
  

export default AdminDashboard;
