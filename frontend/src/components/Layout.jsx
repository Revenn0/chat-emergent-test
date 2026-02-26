import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  MessageSquare,
  Settings,
  Terminal,
  Wifi,
  WifiOff,
  Loader2,
  Menu,
  X,
  Bot,
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Separator } from "../components/ui/separator";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const navItems = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/connect", icon: Wifi, label: "Connection" },
  { path: "/chats", icon: MessageSquare, label: "Conversations" },
  { path: "/config", icon: Settings, label: "Settings" },
  { path: "/logs", icon: Terminal, label: "Logs" },
];

export function Layout({ children }) {
  const [status, setStatus] = useState({ connected: false, status: "disconnected" });
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const resp = await axios.get(`${API}/wa/status`);
        setStatus(resp.data);
      } catch {}
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const isConnected = status.connected;
  const isConnecting = status.status === "connecting" || status.status === "qr_ready";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:relative z-50 h-full w-56 flex flex-col border-r border-border bg-white transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
            <Bot size={14} className="text-white" />
          </div>
          <span className="font-semibold text-sm text-foreground tracking-tight">WA AI Bot</span>
          <button className="ml-auto md:hidden text-muted-foreground" onClick={() => setMobileOpen(false)}>
            <X size={15} />
          </button>
        </div>

        <Separator />

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors duration-100 ${
                  active
                    ? "bg-primary text-white font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <item.icon size={15} strokeWidth={1.75} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <Separator />

        {/* Status */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Wifi size={13} className="text-green-600" />
            ) : isConnecting ? (
              <Loader2 size={13} className="text-yellow-600 animate-spin" />
            ) : (
              <WifiOff size={13} className="text-muted-foreground" />
            )}
            <Badge
              variant={isConnected ? "default" : "secondary"}
              className={`text-xs px-2 py-0 h-5 font-normal ${
                isConnected ? "bg-green-100 text-green-700 border-green-200" : ""
              }`}
            >
              {isConnected ? "Connected" : isConnecting ? "Awaiting QR" : "Disconnected"}
            </Badge>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-white">
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setMobileOpen(true)}>
            <Menu size={16} />
          </Button>
          <span className="font-semibold text-sm">WA AI Bot</span>
        </header>
        <main className="flex-1 overflow-y-auto bg-muted/30" data-testid="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
