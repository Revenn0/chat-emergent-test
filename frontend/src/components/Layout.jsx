import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, MessageSquare, Settings, Terminal, Wifi, WifiOff,
  Loader2, Menu, X, Bot, BookOpen, Zap, LogOut, ChevronDown, GitBranch,
  FlaskConical, ZapOff
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Separator } from "../components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/ui/dropdown-menu";
import axios from "axios";
import { useAuth } from "./AuthProvider";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const navItems = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/connect", icon: Wifi, label: "Connection" },
  { path: "/chats", icon: MessageSquare, label: "Conversations" },
  { path: "/knowledge", icon: BookOpen, label: "Knowledge Base" },
  { path: "/actions", icon: Zap, label: "Bot Actions" },
  { path: "/workflow", icon: GitBranch, label: "Workflow" },
  { path: "/integrations", icon: Settings, label: "Integrations" },
  { path: "/config", icon: Settings, label: "Settings" },
  { path: "/logs", icon: Terminal, label: "Logs" },
];

export function Layout({ children }) {
  const [status, setStatus] = useState({ connected: false, status: "disconnected" });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const location = useLocation();
  const { user, logout } = useAuth();

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const [st, stats] = await Promise.all([
          axios.get(`${API}/wa/status`, { withCredentials: true }),
          axios.get(`${API}/stats`, { withCredentials: true }),
        ]);
        setStatus(st.data);
        setPendingCount(stats.data.pending_actions || 0);
      } catch {}
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 6000);
    return () => clearInterval(interval);
  }, []);

  const isConnected = status.connected;
  const isConnecting = status.status === "connecting" || status.status === "qr_ready";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setMobileOpen(false)} />}

      <aside className={`fixed md:relative z-50 h-full w-56 flex flex-col border-r border-border bg-white transition-transform duration-200 ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        <div className="flex items-center gap-2.5 px-4 py-4">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
            <Bot size={14} className="text-white" />
          </div>
          <span className="font-semibold text-sm text-foreground tracking-tight">WhatsApp 365 Bot</span>
          <button className="ml-auto md:hidden text-muted-foreground" onClick={() => setMobileOpen(false)}><X size={15} /></button>
        </div>

        <Separator />

        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            const isActions = item.path === "/actions";
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors duration-100 ${active ? "bg-primary text-white font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <item.icon size={15} strokeWidth={1.75} />
                <span className="flex-1">{item.label}</span>
                {isActions && pendingCount > 0 && (
                  <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0 h-4 min-w-[16px] justify-center">{pendingCount}</Badge>
                )}
              </NavLink>
            );
          })}
        </nav>

        <Separator />

        <div className="px-3 py-3 space-y-2">
          <div className="flex items-center gap-1.5 px-2">
            {isConnected ? <Wifi size={12} className="text-green-600" /> : isConnecting ? <Loader2 size={12} className="text-yellow-600 animate-spin" /> : <WifiOff size={12} className="text-muted-foreground" />}
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 font-normal ${isConnected ? "text-green-700 border-green-200 bg-green-50" : ""}`}>
              {isConnected ? "Connected" : isConnecting ? "Awaiting QR" : "Disconnected"}
            </Badge>
          </div>
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted transition-colors text-left">
                  {user.picture ? (
                    <img src={user.picture} alt={user.name} className="w-6 h-6 rounded-full flex-shrink-0" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold flex-shrink-0">
                      {user.name?.[0]?.toUpperCase() || "U"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{user.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <ChevronDown size={12} className="text-muted-foreground flex-shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={logout} className="text-sm text-red-600 gap-2 cursor-pointer">
                  <LogOut size={13} /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-white">
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setMobileOpen(true)}><Menu size={16} /></Button>
          <span className="font-semibold text-sm">WhatsApp 365 Bot</span>
        </header>
        <main className="flex-1 overflow-y-auto bg-muted/30" data-testid="main-content">{children}</main>
      </div>
    </div>
  );
}
