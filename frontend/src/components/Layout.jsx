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
} from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const navItems = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/connect", icon: Wifi, label: "Conexão" },
  { path: "/chats", icon: MessageSquare, label: "Conversas" },
  { path: "/config", icon: Settings, label: "Configurações" },
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

  const StatusIcon = status.connected ? Wifi : status.status === "connecting" || status.status === "qr_ready" ? Loader2 : WifiOff;
  const statusColor = status.connected
    ? "text-green-400"
    : status.status === "connecting" || status.status === "qr_ready"
    ? "text-yellow-400"
    : "text-red-400";
  const statusLabel = status.connected ? "CONECTADO" : status.status === "qr_ready" ? "AGUARDANDO QR" : status.status === "connecting" ? "CONECTANDO" : "DESCONECTADO";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:relative z-50 h-full w-64 flex flex-col border-r border-border bg-card/50 backdrop-blur-xl transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
            <MessageSquare size={16} className="text-primary" />
          </div>
          <div>
            <span className="font-mono font-bold text-sm text-foreground">WA AI Bot</span>
            <p className="text-xs text-muted-foreground font-mono">Commander</p>
          </div>
          <button
            className="ml-auto md:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setMobileOpen(false)}
          >
            <X size={16} />
          </button>
        </div>

        {/* Status */}
        <div className="mx-4 my-3 px-3 py-2 rounded-lg bg-background/50 border border-border/50">
          <div className="flex items-center gap-2">
            {status.connected && <span className="w-2 h-2 rounded-full bg-green-400 pulse-green" />}
            <StatusIcon
              size={13}
              className={`${statusColor} ${status.status === "connecting" ? "animate-spin" : ""}`}
            />
            <span className={`font-mono text-xs font-medium ${statusColor}`}>{statusLabel}</span>
          </div>
          {status.jid && (
            <p className="text-xs text-muted-foreground font-mono mt-1 truncate">
              {status.jid.split(":")[0]}
            </p>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                  active
                    ? "bg-primary/15 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <item.icon size={16} strokeWidth={1.5} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border">
          <p className="text-xs text-muted-foreground font-mono">v1.0.0 · Powered by GPT-4o</p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50 backdrop-blur-md">
          <button
            data-testid="mobile-menu-btn"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={20} />
          </button>
          <span className="font-mono font-bold text-sm">WA AI Bot</span>
          <div className={`ml-auto flex items-center gap-1.5 ${statusColor}`}>
            <StatusIcon size={14} className={status.status === "connecting" ? "animate-spin" : ""} />
            <span className="font-mono text-xs">{statusLabel}</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-background" data-testid="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
