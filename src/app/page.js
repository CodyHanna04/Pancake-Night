"use client";

import { useState, useEffect } from "react";
import {
  db,
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  orderBy,
  serverTimestamp,
} from "../../lib/firebase";

export default function HomeOrders() {
  const [orders, setOrders] = useState([]);
  const [notification, setNotification] = useState([]);

  useEffect(() => {
    const q = query(
      collection(db, "orders"),
      where("status", "in", ["Pending", "Cooking", "Delayed", "Done"]),
      orderBy("createdAt")
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const ordersList = [];
      querySnapshot.forEach((doc) => {
        ordersList.push({ ...doc.data(), id: doc.id });
      });
      setOrders(ordersList);
    });

    return () => unsubscribe();
  }, []);

  const handleRemoveOrder = async (orderId) => {
    try {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(doc(db, "orders", orderId), {
        status: "completed",
        completedAt: serverTimestamp(),
      });
      setNotification("Order removed from Home View");
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error("Error removing order:", error);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const groupedOrders = {
    Pending: [],
    Cooking: [],
    Delayed: [],
    Done: [],
  };

  orders.forEach((order) => {
    if (groupedOrders[order.status]) {
      groupedOrders[order.status].push(order);
    }
  });

  return (
    <div className="home-orders-container">
      <h2 className="text-2xl font-bold">Current Orders</h2>
      {notification && (
        <div className="notification ${notification ? '' : 'hidden">
          {notification}
        </div>
      )}
      <div className="columns-container">
        {Object.entries(groupedOrders).map(([status, orders]) => (
          <div key={status} className="order-column">
            <h3 className="text-xl font-semibold mb-2">{status}</h3>
            {orders.map((order) => (
              <div key={order.id} className="order-card">
                <h4 className="font-bold">{order.name}</h4>
                <p className="text-sm">{order.selectedOptions.join(", ")}</p>
                {order.notes && <p className="text-sm italic">Notes: {order.notes}</p>}
                <p className="text-xs">
                  Submitted:{" "}
                  {order.createdAt
                    ? new Date(order.createdAt.seconds * 1000).toLocaleTimeString()
                    : "Loading..."}
                </p>
                <button onClick={() => handleRemoveOrder(order.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
