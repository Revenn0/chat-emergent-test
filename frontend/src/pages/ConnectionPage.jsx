import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Wifi, WifiOff, RefreshCw, Loader2, Smartphone, CheckCircle2, QrCode } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ConnectionPage() {
  const [qrData, setQrData] = useState(null);
  const [status, setStatus] = useState({ status: "disconnected", connected: false });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const fetchQR = async () => {
    try {
      const resp = await axios.get(`${API}/wa/qr`);
      setQrData(resp.data.qr);
      setStatus((prev) => ({ ...prev, status: resp.data.status }));
    } catch {}
  };

  const fetchStatus = async () => {
    try {
      const resp = await axios.get(`${API}/wa/status`);
      setStatus(resp.data);
      if (resp.data.connected) {
        setTimeout(() => navigate("/"), 1500);
      }
    } catch {}
  };

  useEffect(() => {
    fetchStatus();
    fetchQR();
    const interval = setInterval(() => {
      fetchStatus();
      fetchQR();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleReconnect = async () => {
    setLoading(true);
    setQrData(null);
    try {
      await axios.post(`${API}/wa/reconnect`);
    } finally {
      setTimeout(() => setLoading(false), 1500);
    }
  };

  const handleDisconnect = async () => {
    try {
      await axios.post(`${API}/wa/disconnect`);
      setQrData(null);
      setStatus({ status: "disconnected", connected: false });
    } catch {}
  };

  const steps = [
    "Abra o WhatsApp no seu celular",
    "Toque em Menu ou Configurações",
    "Toque em Aparelhos conectados",
    "Toque em Conectar um aparelho",
    "Escaneie o código QR abaixo",
  ];

  return (
    <div className="p-6 md:p-8 fade-in">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight font-mono text-foreground">Conexão</h1>
        <p className="text-muted-foreground mt-1">Conecte seu WhatsApp via QR code</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl">
        {/* QR Code Card */}
        <Card className="bg-card border-border/50 card-hover">
          <CardHeader className="pb-3">
            <CardTitle className="font-mono text-lg flex items-center gap-2">
              <QrCode size={18} className="text-primary" />
              QR Code
            </CardTitle>
          </CardHeader>
          <CardContent>
            {status.connected ? (
              <div className="flex flex-col items-center py-10 gap-4">
                <div className="w-20 h-20 rounded-full bg-green-900/30 border border-green-500/30 flex items-center justify-center pulse-green">
                  <CheckCircle2 size={40} className="text-green-400" />
                </div>
                <div className="text-center">
                  <p className="font-mono font-bold text-green-400 text-lg">CONECTADO</p>
                  {status.jid && (
                    <p className="text-sm text-muted-foreground font-mono mt-1">
                      {status.jid.split(":")[0].replace("@s.whatsapp.net", "")}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={handleDisconnect}
                  className="border-red-900/50 text-red-400 hover:bg-red-900/20 hover:text-red-300"
                  data-testid="disconnect-btn"
                >
                  <WifiOff size={14} className="mr-2" />
                  Desconectar
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                {/* QR Container */}
                <div
                  className="relative w-64 h-64 rounded-xl border-2 border-primary/30 bg-white overflow-hidden flex items-center justify-center"
                  data-testid="qr-container"
                >
                  {qrData ? (
                    <>
                      <img src={qrData} alt="WhatsApp QR Code" className="w-full h-full object-contain" />
                      <div className="scan-line" />
                    </>
                  ) : loading || status.status === "connecting" ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 size={32} className="text-primary animate-spin" />
                      <span className="font-mono text-xs text-background/60">Gerando QR...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 p-4">
                      <QrCode size={40} className="text-gray-400" />
                      <span className="font-mono text-xs text-gray-400 text-center">
                        QR code aparecerá aqui
                      </span>
                    </div>
                  )}
                </div>

                {/* Status Badge */}
                <div
                  className={`px-3 py-1 rounded-full text-xs font-mono font-medium border ${
                    status.status === "qr_ready"
                      ? "bg-yellow-900/30 text-yellow-400 border-yellow-900/50"
                      : status.status === "connecting"
                      ? "bg-blue-900/30 text-blue-400 border-blue-900/50"
                      : "bg-red-900/30 text-red-400 border-red-900/50"
                  }`}
                  data-testid="connection-status-badge"
                >
                  {status.status === "qr_ready"
                    ? "AGUARDANDO SCAN"
                    : status.status === "connecting"
                    ? "CONECTANDO..."
                    : "DESCONECTADO"}
                </div>

                <Button
                  onClick={handleReconnect}
                  disabled={loading}
                  className="bg-primary text-primary-foreground btn-glow hover:bg-primary/90"
                  data-testid="reconnect-btn"
                >
                  {loading ? (
                    <Loader2 size={14} className="mr-2 animate-spin" />
                  ) : (
                    <RefreshCw size={14} className="mr-2" />
                  )}
                  {loading ? "Aguardando..." : "Gerar QR Code"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions Card */}
        <Card className="bg-card border-border/50 card-hover">
          <CardHeader className="pb-3">
            <CardTitle className="font-mono text-lg flex items-center gap-2">
              <Smartphone size={18} className="text-primary" />
              Como conectar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4 mt-2">
              {steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 border border-primary/30 text-primary text-xs font-mono font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-sm text-muted-foreground leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>

            <div className="mt-8 p-4 rounded-lg bg-secondary/30 border border-border/50">
              <p className="text-xs font-mono text-muted-foreground leading-relaxed">
                <span className="text-primary font-medium">NOTA:</span> O WhatsApp permite até 4 aparelhos conectados simultaneamente. A conexão é mantida pelo serviço Baileys.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
