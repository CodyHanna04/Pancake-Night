import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "KDS System",
  description: "Kitchen Display System for Pancake Night",
};

export default function Layout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="header">
          <div className="logo-container">
            <h1 className="logo">
            Pancake Night
            </h1>
          </div>
          <nav className="navbar">
            <Link href="/" className="nav-link">Home</Link>
            <Link href="/order-submission" className="nav-link">Order Submission</Link>
            <Link href="/kitchen-display" className="nav-link">Kitchen</Link>
          </nav>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
