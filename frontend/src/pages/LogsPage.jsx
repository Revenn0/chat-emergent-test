import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Terminal, RefreshCw, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function levelColor(level) {
  switch (level?.toLowerCase()) {
    case "error": return "text-red-400";
    case "warn":
    case "warning": return "text-yellow-400";
    case "info": return "text-green-400";
    default: return "text-muted-foreground";
  }
}

export default function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const bottomRef = useRef(null);

  const fetchLogs = async () => {
    try {
      const resp = await axios.get(`${API}/logs?limit=150`);
      setLogs(resp.data);
    } catch {}
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 4000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  return (
    <div className="p-6 md:p-8 fade-in h-full flex flex-col">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight font-mono text-foreground">Logs</h1>
          <p className="text-muted-foreground mt-1">Terminal de atividade do sistema</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh((v) => !v)}
            className={`font-mono text-xs border ${autoRefresh ? "border-primary/50 text-primary" : "border-border text-muted-foreground"}`}
            data-testid="auto-refresh-btn"
          >
            {autoRefresh ? "AUTO ON" : "AUTO OFF"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            className="border-border text-muted-foreground"
            data-testid="refresh-logs-btn"
          >
            <RefreshCw size={13} />
          </Button>
        </div>
      </div>

      <Card className="flex-1 bg-[hsl(224_71%_3%)] border-border/50 overflow-hidden">
        <CardHeader className="py-3 px-4 border-b border-border/50">
          <CardTitle className="font-mono text-xs text-muted-foreground flex items-center gap-2">
            <Terminal size={13} className="text-primary" />
            SYSTEM LOG — {logs.length} entradas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 h-full">
          <ScrollArea className="h-[calc(100vh-280px)] px-4 py-3">
            {logs.length === 0 ? (
              <div className="py-12 text-center">
                <Terminal size={32} className="text-muted-foreground/20 mx-auto mb-2" />
                <p className="font-mono text-sm text-muted-foreground">Nenhum log disponível</p>
              </div>
            ) : (
              <div className="terminal space-y-0.5" data-testid="logs-terminal">
                {[...logs].reverse().map((log, i) => (
                  <div key={i} className="flex items-start gap-2 hover:bg-white/[0.02] px-1 py-0.5 rounded">
                    <span className="text-muted-foreground/40 flex-shrink-0 text-[10px] pt-px">
                      {log.timestamp ? new Date(log.timestamp).toLocaleTimeString("pt-BR") : "--:--:--"}
                    </span>
                    <span className={`flex-shrink-0 font-bold text-[10px] pt-px ${levelColor(log.level)}`}>
                      [{(log.level || "info").toUpperCase()}]
                    </span>
                    <span className="text-gray-300 text-xs break-all">{log.message}</span>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
