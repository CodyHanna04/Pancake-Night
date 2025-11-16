// src/pages/OrderPage.jsx
'use client'

import React, { useEffect, useState } from 'react';
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase'; // Adjust path as needed

const OrderPage = () => {
  const [customerId, setCustomerId] = useState(null);
  const [canOrder, setCanOrder] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [name, setName] = useState('');
  const [orderItem, setOrderItem] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let id = localStorage.getItem('customerId');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('customerId', id);
    }
    setCustomerId(id);
    checkEligibility(id);
  }, []);

  const checkEligibility = async (id) => {
    const q = query(
      collection(db, 'orders'),
      where('customerId', '==', id),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      setCanOrder(true);
      return;
    }

    const lastOrder = snapshot.docs[0].data();
    const now = Date.now();
    const lastTime = lastOrder.createdAt.toMillis();
    const diff = now - lastTime;

    if (diff > 15 * 60 * 1000) {
      setCanOrder(true);
    } else {
      const remaining = 15 * 60 * 1000 - diff;
      setTimeLeft(Math.ceil(remaining / 1000 / 60));
      setCanOrder(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canOrder) return;
    try {
      await addDoc(collection(db, 'orders'), {
        customerId,
        name,
        order: orderItem,
        createdAt: serverTimestamp(),
      });
      setMessage('Order placed! You can order again in 15 minutes.');
      setCanOrder(false);
      setTimeLeft(15);
    } catch (error) {
      console.error('Error placing order:', error);
      setMessage('Something went wrong. Try again later.');
    }
  };

  return (
    <div className="order-page">
      <h1>Order Pancakes</h1>
      {!canOrder && timeLeft !== null && (
        <p>You’ve already ordered. Please wait {timeLeft} more minute(s).</p>
      )}
      {canOrder && (
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Your Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Your Order"
            value={orderItem}
            onChange={(e) => setOrderItem(e.target.value)}
            required
          />
          <button type="submit">Place Order</button>
        </form>
      )}
      {message && <p>{message}</p>}
    </div>
  );
};

export default OrderPage;
