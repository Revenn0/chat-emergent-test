import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  MessageSquare,
  Users,
  Activity,
  Bot,
  ArrowRight,
  TrendingUp,
  Wifi,
  WifiOff,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function StatCard({ icon: Icon, label, value, sub, color = "text-primary" }) {
  return (
    <Card className="bg-card border-border/50 card-hover">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">{label}</p>
            <p className={`text-3xl font-mono font-bold mt-1 ${color}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`w-10 h-10 rounded-lg bg-secondary/50 border border-border/50 flex items-center justify-center ${color}`}>
            <Icon size={18} strokeWidth={1.5} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState({ total_conversations: 0, total_messages: 0, user_messages: 0, bot_messages: 0 });
  const [waStatus, setWaStatus] = useState({ connected: false, status: "disconnected" });
  const [recentConvs, setRecentConvs] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsR, statusR, convsR, logsR] = await Promise.all([
          axios.get(`${API}/stats`),
          axios.get(`${API}/wa/status`),
          axios.get(`${API}/conversations`),
          axios.get(`${API}/logs?limit=8`),
        ]);
        setStats(statsR.data);
        setWaStatus(statusR.data);
        setRecentConvs(convsR.data.slice(0, 5));
        setRecentLogs(logsR.data.slice(0, 8));
      } catch {}
    };
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, []);

  const statusColor = waStatus.connected ? "text-green-400" : waStatus.status === "connecting" || waStatus.status === "qr_ready" ? "text-yellow-400" : "text-red-400";
  const statusLabel = waStatus.connected ? "CONECTADO" : waStatus.status === "qr_ready" ? "AGUARDANDO QR" : waStatus.status === "connecting" ? "CONECTANDO" : "DESCONECTADO";

  return (
    <div className="p-6 md:p-8 fade-in space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight font-mono text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Central de controle do seu chatbot</p>
        </div>
        <Link to="/connect">
          <Button
            variant="outline"
            size="sm"
            className={`font-mono text-xs border gap-2 ${
              waStatus.connected ? "border-green-900/50 text-green-400" : "border-red-900/50 text-red-400"
            }`}
            data-testid="status-pill"
          >
            {waStatus.connected ? (
              <Wifi size={12} />
            ) : waStatus.status === "connecting" ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <WifiOff size={12} />
            )}
            {statusLabel}
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="stats-grid">
        <StatCard icon={Users} label="Conversas" value={stats.total_conversations} sub="contatos únicos" />
        <StatCard icon={MessageSquare} label="Mensagens" value={stats.total_messages} sub="total trocadas" />
        <StatCard icon={TrendingUp} label="Do usuário" value={stats.user_messages} sub="recebidas" color="text-blue-400" />
        <StatCard icon={Bot} label="Do bot" value={stats.bot_messages} sub="enviadas" color="text-purple-400" />
      </div>

      {/* Recent Activity + Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Conversations */}
        <Card className="bg-card border-border/50" data-testid="recent-conversations">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-mono text-base flex items-center gap-2">
                <MessageSquare size={15} className="text-primary" />
                Conversas Recentes
              </CardTitle>
              <Link to="/chats">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-primary">
                  Ver todas <ArrowRight size={12} className="ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentConvs.length === 0 ? (
              <div className="py-8 text-center">
                <MessageSquare size={32} className="text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma conversa ainda</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {waStatus.connected ? "Aguardando mensagens..." : "Conecte o WhatsApp primeiro"}
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {recentConvs.map((conv) => (
                  <li key={conv.jid}>
                    <Link
                      to={`/chats?jid=${encodeURIComponent(conv.jid)}`}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary/40 transition-colors duration-150"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/20 flex items-center justify-center text-primary font-mono font-bold text-sm flex-shrink-0">
                        {(conv.push_name || "?")[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{conv.push_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{conv.last_message}</p>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono flex-shrink-0">
                        {conv.message_count} msg
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Activity Log */}
        <Card className="bg-card border-border/50" data-testid="activity-log">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-mono text-base flex items-center gap-2">
                <Activity size={15} className="text-primary" />
                Atividade Recente
              </CardTitle>
              <Link to="/logs">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-primary">
                  Ver logs <ArrowRight size={12} className="ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentLogs.length === 0 ? (
              <div className="py-8 text-center">
                <Activity size={32} className="text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Sem atividade recente</p>
              </div>
            ) : (
              <ul className="space-y-1.5 terminal">
                {recentLogs.map((log, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span
                      className={`flex-shrink-0 font-medium ${
                        log.level === "error" ? "text-red-400" : log.level === "warn" ? "text-yellow-400" : "text-green-400"
                      }`}
                    >
                      [{log.level?.toUpperCase() || "INFO"}]
                    </span>
                    <span className="text-muted-foreground truncate">{log.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
