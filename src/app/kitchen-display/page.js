"use client";

import { useState, useEffect } from "react";
import { db, collection, query, where, onSnapshot, updateDoc, doc } from "../../../lib/firebase"; // Import `doc` and `updateDoc`

export default function KitchenDisplay() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    // Fetch orders in real-time
    const q = query(collection(db, "orders"), where("status", "==", "Pending")); // Only fetch pending orders

    // Listen to Firestore collection changes
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const ordersList = [];
      querySnapshot.forEach((doc) => {
        ordersList.push({ ...doc.data(), id: doc.id });
      });
      setOrders(ordersList);
    });

    // Cleanup function to unsubscribe from the Firestore listener
    return () => unsubscribe();
  }, []);

  // Handle mark as "done" action
  const handleMarkDone = async (orderId) => {
    try {
      const orderRef = doc(db, "orders", orderId); // Correctly get reference to the order
      await updateDoc(orderRef, { status: "done" }); // Update the status to "done"
      alert("Order marked as done!");
    } catch (error) {
      console.error("Error marking order as done:", error);
    }
  };

  return (
    <div className="kitchen-display-container">
      <h2>Kitchen Display</h2>
      <div className="orders-container">
        {orders.map((order) => (
          <div key={order.id} className="order-block">
            <h3>{order.name}</h3>
            <p>{order.selectedOptions.join(", ")}</p>
            <button onClick={() => handleMarkDone(order.id)} className="mark-done-btn">
              Mark as Done
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
