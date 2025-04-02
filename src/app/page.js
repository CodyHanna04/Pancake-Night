"use client";

import { useState, useEffect } from "react";
import { db, collection, query, where, onSnapshot } from "../../lib/firebase"; // Import necessary Firebase functions

export default function Home() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    // Fetch orders in real-time
    const q = query(collection(db, "orders"), where("status", "in", ["pending", "in progress"])); // Fetch pending and in-progress orders

    // Listen to Firestore collection changes
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const ordersList = [];
      querySnapshot.forEach((doc) => {
        ordersList.push({ ...doc.data(), id: doc.id });
      });
      setOrders(ordersList); // Set the fetched orders to state
    });

    // Cleanup function to unsubscribe from the Firestore listener
    return () => unsubscribe();
  }, []);

  return (
    <div className="home-container">
      <h1>Welcome to Pancake Night!</h1>
      <div className="orders-list">
        {orders.length === 0 ? (
          <p>No orders yet. Be the first to submit one!</p>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="order-card">
              <h3>Order from: {order.name}</h3>
              <p>Status: {order.status}</p>
              <p>Options: {order.selectedOptions.join(", ")}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
