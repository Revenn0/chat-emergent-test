import { useState, useEffect } from "react";
import axios from "axios";
import { RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { ScrollArea } from "../components/ui/scroll-area";
import { Separator } from "../components/ui/separator";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLogs = async () => {
    try {
      const resp = await axios.get(`${API}/logs?limit=150`);
      setLogs(resp.data);
    } catch {}
  };

  useEffect(() => { fetchLogs(); }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 4000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Logs do sistema</h1>
          <p className="text-sm text-muted-foreground">Registro de atividade em tempo real</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh((v) => !v)}
            className="text-xs"
            data-testid="auto-refresh-btn"
          >
            {autoRefresh ? "Auto: On" : "Auto: Off"}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchLogs} data-testid="refresh-logs-btn">
            <RefreshCw size={13} />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium">Entradas recentes</CardTitle>
          <Badge variant="secondary" className="text-xs font-normal">{logs.length} registros</Badge>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-220px)]">
            {logs.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Nenhum log disponível</div>
            ) : (
              <div className="divide-y divide-border" data-testid="logs-terminal">
                {logs.map((log, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors duration-100">
                    <span className="text-[10px] text-muted-foreground flex-shrink-0 mt-0.5 font-mono tabular-nums">
                      {log.timestamp ? new Date(log.timestamp).toLocaleTimeString("pt-BR") : "--:--:--"}
                    </span>
                    <Badge
                      variant="outline"
                      className={`px-1.5 py-0 h-4 text-[10px] flex-shrink-0 font-normal ${
                        log.level === "error" ? "text-red-600 border-red-200 bg-red-50" :
                        log.level === "warn" ? "text-yellow-600 border-yellow-200 bg-yellow-50" :
                        "text-green-600 border-green-200 bg-green-50"
                      }`}
                    >
                      {log.level || "info"}
                    </Badge>
                    <span className="text-xs text-foreground leading-relaxed">{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
