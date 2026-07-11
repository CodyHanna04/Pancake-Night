// src/app/components/ChatWidget.jsx
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/app/context/AuthContext';

const MAX_MESSAGE_LENGTH = 300;

export default function ChatWidget() {
  const { user } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [muted, setMuted] = useState(false);

  const messagesEndRef = useRef(null);
  const audioCtxRef = useRef(null);
  const initialLoadRef = useRef(true);
  // Mirrors of state the snapshot listener needs, without re-subscribing
  const uidRef = useRef(null);
  const isOpenRef = useRef(false);
  const mutedRef = useRef(false);

  uidRef.current = user?.uid ?? null;
  isOpenRef.current = isOpen;
  mutedRef.current = muted;

  // Restore mute preference
  useEffect(() => {
    setMuted(localStorage.getItem('chatSoundMuted') === 'true');
  }, []);

  // Load the sender's profile name once
  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, 'users', user.uid))
      .then((snap) => setProfileName(snap.exists() ? snap.data().name || '' : ''))
      .catch((err) => console.error('Error loading chat profile:', err));
  }, [user]);

  // Browsers only allow audio after a user gesture — grab an AudioContext on
  // the first interaction so the bell can ring even if chat was never opened.
  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtxRef.current = new Ctx();
    }
    return audioCtxRef.current;
  }, []);

  useEffect(() => {
    const unlock = () => {
      const ctx = getAudioCtx();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [getAudioCtx]);

  // Soft two-tone bell, synthesized — no audio file needed
  const playBell = useCallback(() => {
    const ctx = getAudioCtx();
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.12 / (i + 1), now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.75);
    });
  }, [getAudioCtx]);

  // Subscribe to the latest messages (once — refs keep the handler current)
  useEffect(() => {
    const q = query(
      collection(db, 'chatMessages'),
      orderBy('createdAt', 'desc'),
      limit(15)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setMessages(data.reverse()); // oldest -> newest for rendering

      // The first snapshot delivers history — don't ring for it
      if (initialLoadRef.current) {
        initialLoadRef.current = false;
        return;
      }

      const incoming = snapshot
        .docChanges()
        .filter(
          (change) =>
            change.type === 'added' &&
            change.doc.data().userId !== uidRef.current
        ).length;

      if (incoming > 0) {
        if (!mutedRef.current) playBell();
        if (!isOpenRef.current) setUnreadCount((prev) => prev + incoming);
      }
    });

    return () => unsub();
  }, [playBell]);

  // Auto-scroll to the newest message while open
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleToggle = () => {
    setIsOpen((prev) => {
      if (!prev) setUnreadCount(0); // opening clears unread
      return !prev;
    });
  };

  const toggleMute = () => {
    setMuted((prev) => {
      localStorage.setItem('chatSoundMuted', String(!prev));
      return !prev;
    });
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isSending || !user) return;

    setIsSending(true);
    try {
      await addDoc(collection(db, 'chatMessages'), {
        userId: user.uid,
        name: profileName || user.email || 'Guest',
        text: text.slice(0, MAX_MESSAGE_LENGTH),
        createdAt: serverTimestamp(),
      });
      setInput('');
    } catch (err) {
      console.error('Error sending chat message:', err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="chat-widget-container">
      {/* Floating button with unread badge */}
      <button
        type="button"
        className="chat-toggle-button"
        onClick={handleToggle}
        style={{ position: 'relative' }}
      >
        {isOpen ? '✖' : '💬 Chat'}
        {!isOpen && unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-8px',
              right: '-8px',
              background: '#e53935',
              color: '#fff',
              borderRadius: '999px',
              minWidth: '20px',
              height: '20px',
              fontSize: '12px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 5px',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="chat-panel">
          <div
            className="chat-header"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>Pancake Night Chat</span>
            <button
              type="button"
              onClick={toggleMute}
              title={muted ? 'Unmute notifications' : 'Mute notifications'}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                lineHeight: 1,
              }}
            >
              {muted ? '🔕' : '🔔'}
            </button>
          </div>

          <div className="chat-body">
            <div
              className="chat-messages"
              style={{
                maxHeight: '260px',
                overflowY: 'auto',
              }}
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={
                    msg.userId && msg.userId === user?.uid
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

                    <span className="chat-message-timestamp">
                      {msg.createdAt?.toDate
                        ? (() => {
                            const d = msg.createdAt.toDate();
                            const time = d.toLocaleTimeString([], {
                              hour: 'numeric',
                              minute: '2-digit',
                            });
                            const date = `${d.getMonth() + 1}/${d.getDate()}`;
                            return ` • ${time} • ${date}`;
                          })()
                        : ' • Sending...'}
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
                maxLength={MAX_MESSAGE_LENGTH}
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
