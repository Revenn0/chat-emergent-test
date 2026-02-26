import { useState, useEffect } from "react";
import axios from "axios";
import { Mail, Table, Plus, Trash2, ExternalLink, CheckCircle2, Loader2, AlertCircle, Send } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function IntegrationsPage() {
  const [gmailStatus, setGmailStatus] = useState({ connected: false });
  const [gmailCredentials, setGmailCredentials] = useState({ client_id: "", client_secret: "" });
  const [showCredModal, setShowCredModal] = useState(false);
  const [connectingGmail, setConnectingGmail] = useState(false);
  const [sheets, setSheets] = useState([]);
  const [newSheetTitle, setNewSheetTitle] = useState("");
  const [newSheetMode, setNewSheetMode] = useState("edit");
  const [creatingSheet, setCreatingSheet] = useState(false);
  const [emailForm, setEmailForm] = useState({ to: "", subject: "", body: "" });
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    loadGmailStatus();
    loadSheets();
    // Check if returning from OAuth
    if (window.location.search.includes("connected=true") || window.location.hash.includes("connected=true")) {
      toast.success("Gmail connected successfully!");
      loadGmailStatus();
    }
  }, []);

  const loadGmailStatus = async () => {
    try {
      const resp = await axios.get(`${API}/integrations/gmail/status`, { withCredentials: true });
      setGmailStatus(resp.data);
    } catch {}
  };

  const loadSheets = async () => {
    try {
      const resp = await axios.get(`${API}/integrations/sheets`, { withCredentials: true });
      setSheets(resp.data);
    } catch {}
  };

  const handleGmailConnect = async () => {
    if (!gmailCredentials.client_id || !gmailCredentials.client_secret) {
      toast.error("Please enter your Google Client ID and Secret.");
      return;
    }
    setConnectingGmail(true);
    try {
      const resp = await axios.post(`${API}/integrations/gmail/connect`, gmailCredentials, { withCredentials: true });
      window.location.href = resp.data.auth_url;
    } catch {
      toast.error("Failed to start Gmail connection.");
    }
    setConnectingGmail(false);
  };

  const handleGmailDisconnect = async () => {
    try {
      await axios.post(`${API}/integrations/gmail/disconnect`, {}, { withCredentials: true });
      setGmailStatus({ connected: false });
      toast.success("Gmail disconnected.");
    } catch { toast.error("Failed to disconnect."); }
  };

  const handleCreateSheet = async () => {
    if (!newSheetTitle.trim()) { toast.error("Please enter a title."); return; }
    setCreatingSheet(true);
    try {
      const resp = await axios.post(`${API}/integrations/sheets/create`, { title: newSheetTitle, mode: newSheetMode }, { withCredentials: true });
      toast.success(`Spreadsheet "${resp.data.title}" created.`);
      setNewSheetTitle("");
      await loadSheets();
    } catch { toast.error("Failed to create spreadsheet. Make sure Gmail is connected."); }
    setCreatingSheet(false);
  };

  const handleDeleteSheet = async (id) => {
    await axios.delete(`${API}/integrations/sheets/${id}`, { withCredentials: true });
    setSheets((s) => s.filter((x) => x.spreadsheet_id !== id));
    toast.success("Spreadsheet removed from list.");
  };

  const handleSendEmail = async (e) => {
    e.preventDefault();
    if (!emailForm.to || !emailForm.subject || !emailForm.body) { toast.error("Please fill all fields."); return; }
    setSendingEmail(true);
    try {
      await axios.post(`${API}/integrations/gmail/send`, emailForm, { withCredentials: true });
      toast.success(`Email sent to ${emailForm.to}`);
      setEmailForm({ to: "", subject: "", body: "" });
    } catch { toast.error("Failed to send email. Make sure Gmail is connected."); }
    setSendingEmail(false);
  };

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Integrations</h1>
        <p className="text-sm text-muted-foreground">Connect your Google account once — unlocks Gmail email sending and Google Sheets management</p>
      </div>

      {/* Google Connection */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Mail size={15} className="text-muted-foreground" />
            Google Account
            {gmailStatus.connected ? (
              <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">Connected</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">Not connected</Badge>
            )}
          </CardTitle>
          <CardDescription className="text-xs">One login — Gmail email sending + Google Sheets access, both activated</CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4">
          {gmailStatus.connected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green-600" />
                <div>
                  <p className="text-sm font-medium">{gmailStatus.email}</p>
                  <p className="text-xs text-muted-foreground">Gmail + Google Sheets connected and ready</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleGmailDisconnect} className="text-destructive border-destructive/30">
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 rounded-md bg-blue-50 border border-blue-100 flex items-start gap-2">
                <AlertCircle size={14} className="text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-700">
                  Requires a Google Cloud project with OAuth credentials. Enable <strong>Gmail API</strong> and <strong>Sheets API</strong>.{" "}
                  <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="underline font-medium">Create here</a>
                  {" — "}add <code className="bg-blue-100 px-1 rounded text-[10px]">{process.env.REACT_APP_BACKEND_URL}/api/integrations/gmail/callback</code> as authorised redirect URI.
                </p>
              </div>
              <Button size="sm" onClick={() => setShowCredModal(true)} data-testid="connect-gmail-btn">
                <Mail size={13} className="mr-1.5" /> Connect Google Account
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Send Email */}
      {gmailStatus.connected && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2"><Send size={14} /> Send Email</CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="pt-4">
            <form onSubmit={handleSendEmail} className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">To</Label>
                <Input value={emailForm.to} onChange={(e) => setEmailForm((f) => ({ ...f, to: e.target.value }))} placeholder="recipient@example.com" className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Subject</Label>
                <Input value={emailForm.subject} onChange={(e) => setEmailForm((f) => ({ ...f, subject: e.target.value }))} placeholder="Subject" className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Message</Label>
                <Textarea value={emailForm.body} onChange={(e) => setEmailForm((f) => ({ ...f, body: e.target.value }))} placeholder="Write your message..." className="text-sm min-h-[100px] resize-none" />
              </div>
              <Button type="submit" size="sm" disabled={sendingEmail} data-testid="send-email-btn">
                {sendingEmail ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <Send size={13} className="mr-1.5" />}
                {sendingEmail ? "Sending..." : "Send"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Google Sheets */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Table size={15} className="text-muted-foreground" /> Google Sheets
            {gmailStatus.connected && (
              <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">Active</Badge>
            )}
          </CardTitle>
          <CardDescription className="text-xs">Create and manage spreadsheets linked to your Google account</CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4 space-y-4">
          {gmailStatus.connected ? (
            <>
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs">New spreadsheet title</Label>
                  <Input value={newSheetTitle} onChange={(e) => setNewSheetTitle(e.target.value)} placeholder="e.g. Delivery Log 2025" className="text-sm" />
                </div>
                <Select value={newSheetMode} onValueChange={setNewSheetMode}>
                  <SelectTrigger className="w-32 text-sm h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="edit" className="text-sm">Edit & Read</SelectItem>
                    <SelectItem value="read" className="text-sm">Read only</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleCreateSheet} disabled={creatingSheet} className="h-9" data-testid="create-sheet-btn">
                  {creatingSheet ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                </Button>
              </div>

              {sheets.length > 0 && (
                <div className="divide-y divide-border border rounded-md">
                  {sheets.map((s) => (
                    <div key={s.spreadsheet_id} className="flex items-center gap-3 px-3 py-2.5">
                      <Table size={14} className="text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.title}</p>
                        <p className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString("en-GB")}</p>
                      </div>
                      <Badge variant="secondary" className="text-[10px] font-normal">{s.mode === "edit" ? "Edit & Read" : "Read only"}</Badge>
                      <a href={s.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary">
                        <ExternalLink size={13} />
                      </a>
                      <button onClick={() => handleDeleteSheet(s.spreadsheet_id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Connect Gmail first to create and manage spreadsheets.</p>
          )}
        </CardContent>
      </Card>

      {/* Gmail Credentials Modal */}
      <Dialog open={showCredModal} onOpenChange={setShowCredModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium">Enter Google OAuth Credentials</DialogTitle>
          </DialogHeader>
          <Separator />
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Google Client ID</Label>
              <Input value={gmailCredentials.client_id} onChange={(e) => setGmailCredentials((c) => ({ ...c, client_id: e.target.value }))} placeholder="xxxx.apps.googleusercontent.com" className="text-sm font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Google Client Secret</Label>
              <Input type="password" value={gmailCredentials.client_secret} onChange={(e) => setGmailCredentials((c) => ({ ...c, client_secret: e.target.value }))} placeholder="GOCSPX-xxxx" className="text-sm font-mono" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleGmailConnect} disabled={connectingGmail} className="flex-1" data-testid="confirm-gmail-connect-btn">
                {connectingGmail ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <Mail size={13} className="mr-1.5" />}
                {connectingGmail ? "Redirecting..." : "Connect Gmail"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowCredModal(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
