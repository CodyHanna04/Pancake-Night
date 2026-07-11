import "./globals.css";
import { AuthProvider } from "./context/AuthContext";
import HeaderClient from "./components/HeaderClient";
import Footer from "./components/Footer";

export const metadata = {
  title: "Pancake Night",
  description: "Order management for Pancake Night",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  // viewport-fit=cover lets the header/chat respect iPhone safe areas
  viewportFit: "cover",
  themeColor: "#ff8f00",
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
