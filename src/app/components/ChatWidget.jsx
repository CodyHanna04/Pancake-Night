// src/components/ChatWidget.jsx
'use client';

import { useEffect, useState, useRef } from 'react';
import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [customerId, setCustomerId] = useState(null);

  const messagesEndRef = useRef(null);

  // Stable customerId + stored name
  useEffect(() => {
    let id = localStorage.getItem('customerId');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('customerId', id);
    }
    setCustomerId(id);

    const storedName = localStorage.getItem('chatDisplayName');
    if (storedName) setDisplayName(storedName);
  }, []);

  // Subscribe to latest 10 chat messages
  useEffect(() => {
    const q = query(
      collection(db, 'chatMessages'),
      orderBy('createdAt', 'desc'),
      limit(10) // <-- only keep the last ~10 messages
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // We queried in desc order, but we want to render oldest → newest
      setMessages(data.reverse());
    });

    return () => unsub();
  }, []);

  // auto-scroll to bottom when messages change
  useEffect(() => {
    if (!isOpen) return;
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isSending) return;

    setIsSending(true);
    const nameToUse = displayName.trim() || 'Guest';

    try {
      await addDoc(collection(db, 'chatMessages'), {
        customerId,
        name: nameToUse,
        text: input.trim(),
        createdAt: serverTimestamp(),
      });
      setInput('');
      if (displayName.trim()) {
        localStorage.setItem('chatDisplayName', displayName.trim());
      }
    } catch (err) {
      console.error('Error sending chat message:', err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="chat-widget-container">
      {/* Floating button */}
      <button
        type="button"
        className="chat-toggle-button"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {isOpen ? '✖' : '💬 Chat'}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="chat-panel">
          <div className="chat-header">
            <span>Pancake Night Chat</span>
          </div>

          <div className="chat-body">
            <div className="chat-name-row">
              <input
                className="chat-name-input"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            {/* Messages area with explicit height cap */}
            <div
              className="chat-messages"
              style={{
                maxHeight: '260px', // cap chat height so header/name don't get pushed off
                overflowY: 'auto',
              }}
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={
                    msg.customerId === customerId
                      ? 'chat-message chat-message-self'
                      : 'chat-message'
                  }
                >
                  <div className="chat-message-meta">
  <span
    className="chat-message-name"
    style={{
      maxWidth: '55%',
      display: 'inline-block',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }}
  >
    {msg.name || 'Guest'}
  </span>

  {/* Timestamp */}
  <span className="chat-message-timestamp">
    {msg.createdAt?.toDate
      ? (() => {
          const d = msg.createdAt.toDate();
          const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
          const date = `${d.getMonth() + 1}/${d.getDate()}`;
          return ` • ${time} • ${date}`;
        })()
      : " • Sending..."}
  </span>
</div>

                  <div className="chat-message-text">{msg.text}</div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className="chat-input-row">
              <input
                className="chat-input"
                placeholder="Type a message…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <button
                type="submit"
                className="chat-send-button"
                disabled={isSending || !input.trim()}
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
