'use client'

import { useState } from "react";
import { db, collection, addDoc } from "../../../lib/firebase";

export default function OrderSubmission() {
  const [name, setName] = useState("");
  const [selectedOptions, setSelectedOptions] = useState([]);

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
    try {
      const orderRef = collection(db, "orders");
      await addDoc(orderRef, {
        name: name,
        selectedOptions: selectedOptions,
        status: "Pending", // Set the initial status to "pending"
      });
      alert("Order submitted!");
      setName(""); // Reset name field
      setSelectedOptions([]); // Reset options
    } catch (error) {
      console.error("Error submitting order:", error);
    }
  };

  return (
    <div className="order-submission-container">
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
          <label>
            <input
              type="checkbox"
              value="Plain"
              onChange={handleOptionChange}
              className="order-checkbox"
            />
            Plain
          </label>
          <label>
            <input
              type="checkbox"
              value="Chocolate Chip"
              onChange={handleOptionChange}
              className="order-checkbox"
            />
            Chocolate Chip
          </label>
          <label>
            <input
              type="checkbox"
              value="Banana"
              onChange={handleOptionChange}
              className="order-checkbox"
            />
            Banana
          </label>
          <label>
            <input
              type="checkbox"
              value="Blueberry"
              onChange={handleOptionChange}
              className="order-checkbox"
            />
            Blueberry
          </label>
        </div>
        <button type="submit" className="submit-button">Submit Order</button>
      </form>
    </div>
  );
}
