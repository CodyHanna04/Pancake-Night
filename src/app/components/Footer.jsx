'use client'
import React from "react";

export default function Footer() {
  const instagramUsername = "phimudelta_stevenson";

  const openInstagram = () => {
    const appLink = `instagram://user?username=${instagramUsername}`;
    const webLink = `https://instagram.com/${instagramUsername}`;

    window.location.href = appLink;

    setTimeout(() => {
      window.open(webLink, "_blank");
    }, 800);
  };

  return (
    <footer
      style={{
        width: "100%",
        background: "#111827",
        color: "white",
        padding: "20px",
        textAlign: "center",

        /* makes it stick to bottom if page content is short */
        marginTop: "auto",
      }}
    >
      <p style={{ marginBottom: "12px", fontSize: "14px", opacity: 0.8 }}>
        Since 2018 - Phi Mu Delta
      </p>

      <button
        onClick={openInstagram}
        style={{
          background: "#ff8f00",
          color: "white",
          padding: "10px 20px",
          borderRadius: "8px",
          fontSize: "16px",
          border: "none",
          cursor: "pointer",
        }}
      >
        Follow us on Instagram 📸
      </button>
    </footer>
  );
}
