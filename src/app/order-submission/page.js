'use client'

import { useState } from "react";
import { db, collection, addDoc, serverTimestamp } from "../../../lib/firebase";

export default function OrderSubmission() {
  const [name, setName] = useState("");
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [notes, setNotes] = useState("");
  const [notification, setNotification] = useState(null); // single message

  const handleOptionChange = (e) => {
    const { value, checked } = e.target;
    if (checked) {
      setSelectedOptions([...selectedOptions, value]);
    } else {
      setSelectedOptions(selectedOptions.filter((option) => option !== value));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (selectedOptions.length === 0) {
      setNotification("Please select at least one option.");
      return;
    }

    try {
      const orderRef = collection(db, "orders");
      await addDoc(orderRef, {
        name: name,
        selectedOptions: selectedOptions,
        notes: notes,
        status: "Pending",
        createdAt: serverTimestamp()
      });
      setNotification("Order submitted!");
      setName("");
      setSelectedOptions([]);
      setNotes("");
    } catch (error) {
      console.error("Error submitting order:", error);
      setNotification("Failed to submit order.");
    }

    setTimeout(() => setNotification(null), 3000); // hide after 3s
  };

  return (
    <div className="order-submission-container">
      {notification && (
        <div className="notification ${notification ? '' : 'hidden">
          {notification}
        </div>
      )}
      <h2>Submit Your Order</h2>
      <form onSubmit={handleSubmit} className="order-form">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name"
          required
          className="order-input"
        />
        <div className="options-container">
          <ul className="options-list">
            <li>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  value="Plain"
                  onChange={handleOptionChange}
                  className="order-checkbox"
                />
                Plain
              </label>
            </li>
            <li>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  value="Chocolate Chip"
                  onChange={handleOptionChange}
                  className="order-checkbox"
                />
                Chocolate Chip
              </label>
            </li>
            <li>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  value="Banana"
                  onChange={handleOptionChange}
                  className="order-checkbox"
                />
                Banana
              </label>
            </li>
            <li>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  value="Blueberry"
                  onChange={handleOptionChange}
                  className="order-checkbox"
                />
                Blueberry
              </label>
            </li>
          </ul>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional instructions (optional)"
          className="order-textarea"
        />
        <button type="submit" className="submit-button">Submit Order</button>
      </form>
    </div>
  );
}
