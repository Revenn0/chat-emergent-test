import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { CheckCircle2, RefreshCw, Loader2, WifiOff } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const steps = [
  "Open WhatsApp on your mobile device",
  'Tap "More options" or "Settings"',
  'Select "Linked devices"',
  'Tap "Link a device"',
  "Scan the QR code on the left",
];

export default function ConnectionPage() {
  const [qrData, setQrData] = useState(null);
  const [status, setStatus] = useState({ status: "disconnected", connected: false, jid: null });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const fetchQR = async () => {
    try {
      const resp = await axios.get(`${API}/wa/qr`, { withCredentials: true });
      setQrData(resp.data.qr);
    } catch {}
  };

  const fetchStatus = async () => {
    try {
      const resp = await axios.get(`${API}/wa/status`, { withCredentials: true });
      setStatus(resp.data);
      if (resp.data.connected) setTimeout(() => navigate("/"), 1500);
    } catch {}
  };

  useEffect(() => {
    fetchStatus();
    fetchQR();
    const interval = setInterval(() => { fetchStatus(); fetchQR(); }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleReconnect = async () => {
    setLoading(true);
    setQrData(null);
    try { await axios.post(`${API}/wa/reconnect`, { withCredentials: true }); } catch {}
    setTimeout(() => setLoading(false), 1500);
  };

  const handleDisconnect = async () => {
    try {
      await axios.post(`${API}/wa/disconnect`, { withCredentials: true });
      setQrData(null);
      setStatus({ status: "disconnected", connected: false, jid: null });
    } catch {}
  };

  return (
    <div className="p-6 max-w-3xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold">WhatsApp Connection</h1>
        <p className="text-sm text-muted-foreground">Scan the QR code to link your number</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* QR Card */}
        <Card data-testid="qr-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">QR Code</CardTitle>
              <Badge
                variant="outline"
                className={`text-xs font-normal ${
                  status.connected ? "text-green-700 border-green-200 bg-green-50" :
                  status.status === "qr_ready" ? "text-blue-700 border-blue-200 bg-blue-50" :
                  "text-muted-foreground"
                }`}
                data-testid="connection-status-badge"
              >
                {status.connected ? "Connected" : status.status === "qr_ready" ? "Awaiting scan" : status.status === "connecting" ? "Connecting..." : "Disconnected"}
              </Badge>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="pt-5 flex flex-col items-center gap-4">
            {status.connected ? (
              <>
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 size={32} className="text-green-600" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-sm">Connected</p>
                  {status.jid && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      +{status.jid.split(":")[0].replace("@s.whatsapp.net", "")}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  className="text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
                  data-testid="disconnect-btn"
                >
                  <WifiOff size={13} className="mr-1.5" />
                  Disconnect
                </Button>
              </>
            ) : (
              <>
                <div
                  className="w-48 h-48 border border-border rounded-lg overflow-hidden flex items-center justify-center bg-white"
                  data-testid="qr-container"
                >
                  {qrData ? (
                    <img src={qrData} alt="WhatsApp QR Code" className="w-full h-full object-contain" />
                  ) : loading || status.status === "connecting" ? (
                    <Loader2 size={28} className="text-muted-foreground animate-spin" />
                  ) : (
                    <div className="text-center p-4">
                      <div className="w-8 h-8 rounded border-2 border-muted-foreground/30 mx-auto mb-2 flex items-center justify-center">
                        <div className="w-4 h-4 bg-muted-foreground/20 rounded-sm" />
                      </div>
                      <p className="text-xs text-muted-foreground">QR code will appear here</p>
                    </div>
                  )}
                </div>
                <Button
                  onClick={handleReconnect}
                  disabled={loading}
                  size="sm"
                  className="w-full"
                  data-testid="reconnect-btn"
                >
                  {loading ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <RefreshCw size={13} className="mr-1.5" />}
                  {loading ? "Please wait..." : "Generate new QR"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Instructions Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">How to connect</CardTitle>
            <CardDescription className="text-xs">Follow the steps below</CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="pt-4">
            <ol className="space-y-3">
              {steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-sm text-muted-foreground leading-snug">{step}</span>
                </li>
              ))}
            </ol>
            <div className="mt-5 p-3 rounded-md bg-muted text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Note:</strong> WhatsApp allows up to 4 linked devices. Your session is maintained automatically by the service.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
