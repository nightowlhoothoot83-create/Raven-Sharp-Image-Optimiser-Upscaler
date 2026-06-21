import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import TopNav from "./components/TopNav";
import Landing from "./pages/Landing";
import Optimiser from "./pages/Optimiser";
import Login from "./pages/Login";
import Register from "./pages/Register";
import History from "./pages/History";
import Legal from "./pages/Legal";
import About from "./pages/About";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 rounded-full border-2 border-[var(--raven)] border-t-transparent animate-spin"/></div>;
  return user ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <>
      <TopNav />
      <Routes>
        <Route path="/"           element={<Landing />} />
        <Route path="/optimiser"  element={<Optimiser />} />
        <Route path="/login"      element={<Login />} />
        <Route path="/register"   element={<Register />} />
        <Route path="/history"    element={<Protected><History /></Protected>} />
        <Route path="/legal/:page" element={<Legal />} />
        <Route path="/about"      element={<About />} />
        <Route path="*"           element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="bottom-right" toastOptions={{style:{background:"var(--surface-2)",border:"1px solid var(--border)",color:"var(--text)",fontFamily:"'Outfit',sans-serif",fontSize:"14px"}}}/>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
