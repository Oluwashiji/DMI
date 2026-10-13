import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { clearToken, getMe, getToken, type User } from "../lib/api";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  /** True after the user deliberately signed out (so route guards send them home, not to /auth). */
  signedOut: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);

  const setUser = (next: User | null) => {
    setUserState(next);
    if (next) setSignedOut(false);
  };

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    getMe()
      .then(setUser)
      .catch(() => {
        clearToken();
        setUserState(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const logout = () => {
    clearToken();
    setSignedOut(true);
    setUserState(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signedOut, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}