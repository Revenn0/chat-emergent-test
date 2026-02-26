import { useState, useEffect } from "react";
import axios from "axios";
import { CheckCircle, XCircle, Clock, Zap, RefreshCw, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

function statusBadge(status) {
  switch (status) {
    case "pending": return <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200 gap-1"><Clock size={9} /> Pending</Badge>;
    case "approved": return <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 gap-1"><CheckCircle size={9} /> Approved</Badge>;
    case "rejected": return <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200 gap-1"><XCircle size={9} /> Rejected</Badge>;
    default: return <Badge variant="secondary" className="text-[10px]">{status}</Badge>;
  }
}

export default function ActionsPage() {
  const [actions, setActions] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [notes, setNotes] = useState({});
  const [processing, setProcessing] = useState({});

  const loadActions = async () => {
    setLoading(true);
    try {
      const url = filter === "all" ? `${API}/actions` : `${API}/actions?status=${filter}`;
      const resp = await axios.get(url, { withCredentials: true });
      setActions(resp.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadActions(); }, [filter]);

  useEffect(() => {
    const interval = setInterval(loadActions, 10000);
    return () => clearInterval(interval);
  }, [filter]);

  const handleAction = async (actionId, status) => {
    setProcessing((p) => ({ ...p, [actionId]: true }));
    try {
      await axios.patch(`${API}/actions/${actionId}`, { status, admin_note: notes[actionId] || null }, { withCredentials: true });
      toast.success(status === "approved" ? "Action approved — confirmation sent to client." : "Action rejected — client notified.");
      setExpanded(null);
      await loadActions();
    } catch {
      toast.error("Failed to update action.");
    }
    setProcessing((p) => ({ ...p, [actionId]: false }));
  };

  const pending = actions.filter((a) => a.status === "pending").length;

  return (
    <div className="p-6 max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            Bot Actions
            {pending > 0 && <Badge className="bg-red-500 text-white text-xs">{pending} pending</Badge>}
          </h1>
          <p className="text-sm text-muted-foreground">Review and approve bookings detected by the AI</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="text-sm w-36 h-8"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value} className="text-sm">{o.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadActions} disabled={loading}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium">Actions list</CardTitle>
          <Badge variant="secondary" className="text-xs font-normal">{actions.length} records</Badge>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          {actions.length === 0 ? (
            <div className="py-12 text-center">
              <Zap size={28} className="text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No actions found</p>
              <p className="text-xs text-muted-foreground mt-1">Actions are created when the AI detects a booking keyword</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {actions.map((action) => (
                <div key={action.action_id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {statusBadge(action.status)}
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{action.action_label}</Badge>
                        <span className="text-sm font-medium">{action.push_name}</span>
                        <span className="text-xs text-muted-foreground font-mono">{action.jid.split("@")[0]}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        <span className="font-medium text-foreground">Message: </span>{action.trigger_message}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(action.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        {action.action_id && <span className="ml-1.5 font-mono">Ref: {action.action_id.slice(0, 8).toUpperCase()}</span>}
                      </p>
                      {action.admin_note && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          <span className="font-medium">Note: </span>{action.admin_note}
                        </p>
                      )}
                    </div>

                    {action.status === "pending" && (
                      <button
                        onClick={() => setExpanded(expanded === action.action_id ? null : action.action_id)}
                        className="flex items-center gap-1 text-xs text-primary hover:underline flex-shrink-0"
                        data-testid={`expand-action-${action.action_id}`}
                      >
                        Review <ChevronDown size={12} className={`transition-transform ${expanded === action.action_id ? "rotate-180" : ""}`} />
                      </button>
                    )}
                  </div>

                  {expanded === action.action_id && action.status === "pending" && (
                    <div className="mt-3 space-y-3 p-3 rounded-md bg-muted/50 border border-border/50">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Note for client (optional)</Label>
                        <Textarea
                          value={notes[action.action_id] || ""}
                          onChange={(e) => setNotes((n) => ({ ...n, [action.action_id]: e.target.value }))}
                          placeholder="e.g. Our technician will arrive between 9am–11am tomorrow."
                          className="text-xs min-h-[60px] resize-none"
                          data-testid={`action-note-${action.action_id}`}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleAction(action.action_id, "approved")}
                          disabled={processing[action.action_id]}
                          data-testid={`approve-action-${action.action_id}`}
                        >
                          <CheckCircle size={13} /> Approve & Notify Client
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => handleAction(action.action_id, "rejected")}
                          disabled={processing[action.action_id]}
                          data-testid={`reject-action-${action.action_id}`}
                        >
                          <XCircle size={13} /> Reject
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
