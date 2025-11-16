import "./globals.css";
import { AuthProvider } from "./context/AuthContext";
import HeaderClient from "./components/HeaderClient";
import Footer from "./components/Footer";

export const metadata = {
  title: "KDS System",
  description: "Kitchen Display System for Pancake Night",
};

export default function Layout({ children }) {
  return (
    <html lang="en">
      <body className="layout-body">
        <AuthProvider>
          <HeaderClient />
          <main className="layout-main">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
