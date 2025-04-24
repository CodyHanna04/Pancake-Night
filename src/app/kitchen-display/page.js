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
} from "../../../lib/firebase";
import { AlignCenter } from "lucide-react";

export default function KitchenDisplay() {
  const [orders, setOrders] = useState([]);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    const q = query(
      collection(db, "orders"),
      where("status", "in", ["Pending", "Cooking", "Delayed"]),
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

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, { status: newStatus });
      setNotification(`Order marked as ${newStatus}`);
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error("Error updating order:", error);
      setNotification("Failed to update order.");
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const groupedOrders = {
    Pending: [],
    Cooking: [],
    Delayed: [],
  };

  orders.forEach((order) => {
    if (groupedOrders[order.status]) {
      groupedOrders[order.status].push(order);
    }
  });

  return (
    <div className="kitchen-display-container">
            {notification && (
        <div className="notification ${notification ? '' : 'hidden">
          {notification}
        </div>
      )}
      <h2 className="text-2xl font-bold">Kitchen Display</h2>
      {/* Use columns-container for horizontal columns */}
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
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => updateOrderStatus(order.id, "Cooking")}
                  >
                    Cooking
                  </button>
                  <button
                    onClick={() => updateOrderStatus(order.id, "Delayed")}
                  >
                    Delayed
                  </button>
                  <button
                    onClick={() => updateOrderStatus(order.id, "Done")}
                  >
                    Done
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
