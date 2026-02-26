import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { MessageSquare, Users, Bot, TrendingUp, ArrowRight, Wifi, WifiOff, Loader2, Zap, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { useAuth } from "../components/AuthProvider";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function StatCard({ icon: Icon, label, value, description, highlight }) {
  return (
    <Card className={highlight ? "border-red-200 bg-red-50/50" : ""}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={`text-2xl font-semibold ${highlight ? "text-red-600" : ""}`}>{value}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <div className={`w-9 h-9 rounded-md flex items-center justify-center ${highlight ? "bg-red-100" : "bg-muted"}`}>
            <Icon size={16} className={highlight ? "text-red-500" : "text-muted-foreground"} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total_conversations: 0, total_messages: 0, user_messages: 0, bot_messages: 0, pending_actions: 0 });
  const [waStatus, setWaStatus] = useState({ connected: false, status: "disconnected" });
  const [recentConvs, setRecentConvs] = useState([]);
  const [pendingActions, setPendingActions] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsR, statusR, convsR, actionsR, logsR] = await Promise.all([
          axios.get(`${API}/stats`, { withCredentials: true }),
          axios.get(`${API}/wa/status`, { withCredentials: true }),
          axios.get(`${API}/conversations`, { withCredentials: true }),
          axios.get(`${API}/actions?status=pending`, { withCredentials: true }),
          axios.get(`${API}/logs?limit=5`, { withCredentials: true }),
        ]);
        setStats(statsR.data);
        setWaStatus(statusR.data);
        setRecentConvs(convsR.data.slice(0, 4));
        setPendingActions(actionsR.data.slice(0, 3));
        setRecentLogs(logsR.data.slice(0, 5));
      } catch {}
    };
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, []);

  const isConnected = waStatus.connected;
  const isConnecting = waStatus.status === "connecting" || waStatus.status === "qr_ready";

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Welcome back, {user?.name?.split(" ")[0] || "there"}</p>
        </div>
        <Link to="/connect">
          <Badge variant="outline" className={`gap-1.5 cursor-pointer ${isConnected ? "text-green-700 border-green-200 bg-green-50" : isConnecting ? "text-yellow-700 border-yellow-200 bg-yellow-50" : "text-muted-foreground"}`} data-testid="status-pill">
            {isConnected ? <Wifi size={11} /> : isConnecting ? <Loader2 size={11} className="animate-spin" /> : <WifiOff size={11} />}
            {isConnected ? "Connected" : isConnecting ? "Awaiting QR" : "Disconnected"}
          </Badge>
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4" data-testid="stats-grid">
        <StatCard icon={Users} label="Conversations" value={stats.total_conversations} description="unique contacts" />
        <StatCard icon={MessageSquare} label="Messages" value={stats.total_messages} description="total exchanged" />
        <StatCard icon={TrendingUp} label="Received" value={stats.user_messages} description="from users" />
        <StatCard icon={Bot} label="Sent" value={stats.bot_messages} description="by the bot" />
        <StatCard icon={Zap} label="Pending" value={stats.pending_actions} description="awaiting approval" highlight={stats.pending_actions > 0} />
      </div>

      {/* Pending Actions Alert */}
      {pendingActions.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-orange-700">
              <AlertCircle size={14} />
              Pending Actions — Awaiting Approval
            </CardTitle>
            <Link to="/actions">
              <Button variant="ghost" size="sm" className="h-7 text-xs text-orange-600 hover:text-orange-700 gap-1">
                View all <ArrowRight size={11} />
              </Button>
            </Link>
          </CardHeader>
          <Separator className="bg-orange-200" />
          <CardContent className="pt-3 space-y-2">
            {pendingActions.map((action) => (
              <div key={action.action_id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-orange-100 text-orange-700 border-orange-200">{action.action_label}</Badge>
                  <span className="font-medium">{action.push_name}</span>
                  <span className="text-muted-foreground text-xs truncate max-w-xs">{action.trigger_message}</span>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">{new Date(action.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card data-testid="recent-conversations">
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Recent conversations</CardTitle>
            <Link to="/chats"><Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground gap-1">View all <ArrowRight size={11} /></Button></Link>
          </CardHeader>
          <Separator />
          <CardContent className="pt-3 space-y-1">
            {recentConvs.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">{isConnected ? "Waiting for messages..." : "Connect WhatsApp first"}</div>
            ) : (
              recentConvs.map((conv) => (
                <Link key={conv.jid} to={`/chats?jid=${encodeURIComponent(conv.jid)}`} className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted transition-colors duration-100">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold flex-shrink-0">{(conv.push_name || "?")[0].toUpperCase()}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{conv.push_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{conv.last_message}</p>
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">{conv.message_count} msg</span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card data-testid="activity-log">
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Recent activity</CardTitle>
            <Link to="/logs"><Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground gap-1">View logs <ArrowRight size={11} /></Button></Link>
          </CardHeader>
          <Separator />
          <CardContent className="pt-3 space-y-2">
            {recentLogs.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">No recent activity</div>
            ) : recentLogs.map((log, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <Badge variant="outline" className={`px-1.5 py-0 h-4 text-[10px] flex-shrink-0 font-normal ${log.level === "error" ? "text-red-600 border-red-200 bg-red-50" : log.level === "warn" ? "text-yellow-600 border-yellow-200 bg-yellow-50" : "text-green-600 border-green-200 bg-green-50"}`}>
                  {log.level || "info"}
                </Badge>
                <span className="text-muted-foreground truncate">{log.message}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
