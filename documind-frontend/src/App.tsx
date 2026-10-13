import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Landing } from "./pages/landing";
import { Auth } from "./pages/Auth";
import { Dashboard } from "./pages/Dashboard";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading, signedOut } = useAuth();
  if (loading) return null;
  // Deliberate sign-out goes to the landing page; an anonymous visitor goes to sign-in.
  if (!user) return <Navigate to={signedOut ? "/" : "/auth"} replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<Auth />} />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}