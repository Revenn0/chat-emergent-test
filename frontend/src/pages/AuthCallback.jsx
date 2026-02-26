import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Loader2 } from "lucide-react";
import { useAuth } from "../components/AuthProvider";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace("#", "?"));
    const sessionId = params.get("session_id");

    if (!sessionId) {
      navigate("/login");
      return;
    }

    axios
      .post(`${API}/auth/session`, { session_id: sessionId }, { withCredentials: true })
      .then((resp) => {
        setUser(resp.data);
        navigate("/", { replace: true });
      })
      .catch(() => navigate("/login", { replace: true }));
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={24} className="animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Signing you in...</p>
      </div>
    </div>
  );
}
