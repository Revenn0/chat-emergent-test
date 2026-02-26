import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Plus, Trash2, Save, Play, Pause, GripVertical, ChevronDown, ChevronRight, ArrowDown, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const NODE_TYPES = [
  { value: "start", label: "Start", color: "bg-green-100 border-green-300 text-green-700", dot: "bg-green-500" },
  { value: "message", label: "Message", color: "bg-blue-50 border-blue-200 text-blue-700", dot: "bg-blue-500" },
  { value: "question", label: "Question / Branch", color: "bg-orange-50 border-orange-200 text-orange-700", dot: "bg-orange-500" },
  { value: "collect", label: "Collect Info", color: "bg-purple-50 border-purple-200 text-purple-700", dot: "bg-purple-500" },
  { value: "escalate", label: "Escalate to Agent", color: "bg-red-50 border-red-200 text-red-700", dot: "bg-red-500" },
  { value: "end", label: "End", color: "bg-gray-100 border-gray-300 text-gray-600", dot: "bg-gray-400" },
];

const getTypeStyle = (type) => NODE_TYPES.find((t) => t.value === type) || NODE_TYPES[1];

function NodeCard({ node, index, total, onChange, onDelete, onMoveUp, onMoveDown }) {
  const [expanded, setExpanded] = useState(index === 0);
  const style = getTypeStyle(node.type);

  const addBranch = () => onChange({ ...node, branches: [...(node.branches || []), { label: "Option " + ((node.branches?.length || 0) + 1), description: "" }] });
  const removeBranch = (i) => onChange({ ...node, branches: node.branches.filter((_, bi) => bi !== i) });
  const updateBranch = (i, key, val) => onChange({ ...node, branches: node.branches.map((b, bi) => bi === i ? { ...b, [key]: val } : b) });

  return (
    <div className="relative">
      {/* Connection line from above */}
      {index > 0 && (
        <div className="flex justify-center py-1">
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-px h-4 bg-border" />
            <ArrowDown size={12} className="text-muted-foreground" />
          </div>
        </div>
      )}

      <Card className={`border ${style.color} transition-shadow hover:shadow-sm`} data-testid={`workflow-node-${node.id}`}>
        <CardHeader className="py-2 px-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Select value={node.type} onValueChange={(v) => onChange({ ...node, type: v })}>
                  <SelectTrigger className={`h-6 text-xs border-0 px-1 py-0 bg-transparent font-medium w-auto ${style.color.split(" ")[2]}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NODE_TYPES.map((t) => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input
                  value={node.title}
                  onChange={(e) => onChange({ ...node, title: e.target.value })}
                  className="h-6 text-xs border-0 bg-transparent flex-1 font-medium px-1 py-0 focus-visible:ring-0 focus-visible:border-b focus-visible:border-border"
                  placeholder="Step title..."
                />
              </div>
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button onClick={() => onMoveUp(index)} disabled={index === 0} className="p-1 hover:bg-black/5 rounded text-muted-foreground disabled:opacity-30">
                <ChevronDown size={12} className="rotate-180" />
              </button>
              <button onClick={() => onMoveDown(index)} disabled={index === total - 1} className="p-1 hover:bg-black/5 rounded text-muted-foreground disabled:opacity-30">
                <ChevronDown size={12} />
              </button>
              <button onClick={() => setExpanded((v) => !v)} className="p-1 hover:bg-black/5 rounded text-muted-foreground">
                {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
              <button onClick={() => onDelete(node.id)} className="p-1 hover:bg-red-50 rounded text-muted-foreground hover:text-red-500">
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        </CardHeader>

        {expanded && (
          <CardContent className="pt-0 pb-3 px-3 space-y-2">
            <Separator />
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Bot message / instructions</Label>
              <Textarea
                value={node.content}
                onChange={(e) => onChange({ ...node, content: e.target.value })}
                placeholder={
                  node.type === "start" ? "First message the bot sends..."
                  : node.type === "question" ? "Question the bot asks (e.g. Are you a rider or a partner garage?)"
                  : node.type === "collect" ? "What info to collect (e.g. bike model, plate number, mileage...)"
                  : node.type === "escalate" ? "Message sent before handing off to a human agent..."
                  : node.type === "end" ? "Closing message..."
                  : "Bot message for this step..."
                }
                className="text-xs min-h-[70px] resize-none"
              />
            </div>

            {(node.type === "question") && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Answer branches</Label>
                  <button onClick={addBranch} className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                    <Plus size={10} /> Add option
                  </button>
                </div>
                {(node.branches || []).map((branch, bi) => (
                  <div key={bi} className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0 ml-1" />
                    <Input
                      value={branch.label}
                      onChange={(e) => updateBranch(bi, "label", e.target.value)}
                      placeholder={`Option ${bi + 1}`}
                      className="text-xs h-7 flex-1"
                    />
                    <Input
                      value={branch.description || ""}
                      onChange={(e) => updateBranch(bi, "description", e.target.value)}
                      placeholder="What happens next..."
                      className="text-xs h-7 flex-1"
                    />
                    <button onClick={() => removeBranch(bi)} className="text-muted-foreground hover:text-red-500 p-1">
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

const DEFAULT_WORKFLOW = [
  { id: "n1", type: "start", title: "First Contact / Greeting", content: "Hello! Thanks for getting in touch with 4th Dimension 365 😊\nPlease choose:\n1. To chat in English\n2. Para falar em português", branches: [], position: 0 },
  { id: "n2", type: "question", title: "Identify User Type", content: "Are you a rider / customer, or a garage / partner workshop?", branches: [{ label: "Rider / Customer", description: "Follow customer flow" }, { label: "Garage / Partner", description: "Follow garage/partner flow" }], position: 1 },
  { id: "n3", type: "collect", title: "Collect Incident Details", content: "Collect: bike model (PCX 125, NC750X or NC750D), registration plate, mileage, description of the issue, and location.", branches: [], position: 2 },
  { id: "n4", type: "message", title: "Authorization Notice", content: "Just a heads-up: any service needs to be authorized by us first, otherwise we can't process the payment. I'll need a few details from you…", branches: [], position: 3 },
  { id: "n5", type: "escalate", title: "Escalate to Coordinator", content: "To sort this out properly for you, I'm going to bring in one of our coordinators. They'll be with you very soon!", branches: [], position: 4 },
  { id: "n6", type: "end", title: "Case Closed", content: "Thank you for contacting 4th Dimension 365. Have a safe ride!", branches: [], position: 5 },
];

export default function WorkflowPage() {
  const [nodes, setNodes] = useState([]);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/workflow`, { withCredentials: true }).then((r) => {
      if (r.data.nodes && r.data.nodes.length > 0) {
        setNodes(r.data.nodes);
        setActive(r.data.active ?? true);
      } else {
        setNodes(DEFAULT_WORKFLOW);
      }
    }).catch(() => setNodes(DEFAULT_WORKFLOW)).finally(() => setLoading(false));
  }, []);

  const addNode = () => {
    const id = `n${Date.now()}`;
    setNodes((prev) => [...prev, { id, type: "message", title: "New Step", content: "", branches: [], position: prev.length }]);
  };

  const updateNode = (id, updated) => setNodes((prev) => prev.map((n) => n.id === id ? updated : n));
  const deleteNode = (id) => setNodes((prev) => prev.filter((n) => n.id !== id));

  const moveUp = (idx) => {
    if (idx === 0) return;
    setNodes((prev) => { const a = [...prev]; [a[idx - 1], a[idx]] = [a[idx], a[idx - 1]]; return a; });
  };
  const moveDown = (idx) => {
    setNodes((prev) => { if (idx >= prev.length - 1) return prev; const a = [...prev]; [a[idx], a[idx + 1]] = [a[idx + 1], a[idx]]; return a; });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/workflow`, { nodes: nodes.map((n, i) => ({ ...n, position: i })), active }, { withCredentials: true });
      toast.success("Workflow saved. The AI will follow this flow in all conversations.");
    } catch { toast.error("Failed to save workflow."); }
    setSaving(false);
  };

  const handleReset = () => { setNodes(DEFAULT_WORKFLOW); toast.info("Workflow reset to default."); };

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const escalateCount = nodes.filter((n) => n.type === "escalate").length;

  return (
    <div className="p-6 max-w-2xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Conversation Workflow</h1>
          <p className="text-sm text-muted-foreground">Define the flow the AI follows. Steps can be skipped, but the AI always works toward the end goal.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-white">
            <Switch checked={active} onCheckedChange={setActive} data-testid="workflow-active-toggle" />
            <span className="text-xs text-muted-foreground">{active ? "Active" : "Inactive"}</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleReset}>Reset</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} data-testid="save-workflow-btn">
            {saving ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" /> : <Save size={13} className="mr-1.5" />}
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Hint */}
      {escalateCount === 0 && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-orange-50 border border-orange-100">
          <AlertTriangle size={14} className="text-orange-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-orange-700">We recommend adding at least one <strong>Escalate to Agent</strong> step so the AI knows when to hand off to a human coordinator.</p>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {NODE_TYPES.map((t) => (
          <div key={t.value} className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-medium ${t.color}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
            {t.label}
          </div>
        ))}
      </div>

      {/* Nodes */}
      <div className="space-y-0">
        {nodes.map((node, idx) => (
          <NodeCard
            key={node.id}
            node={node}
            index={idx}
            total={nodes.length}
            onChange={(updated) => updateNode(node.id, updated)}
            onDelete={deleteNode}
            onMoveUp={moveUp}
            onMoveDown={moveDown}
          />
        ))}
      </div>

      <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={addNode} data-testid="add-workflow-node-btn">
        <Plus size={13} /> Add step
      </Button>

      <Card className="bg-muted/40 border-muted">
        <CardContent className="p-4">
          <p className="text-xs font-medium mb-1">How the workflow integrates with the AI</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Each step is injected as structured context into the AI's system prompt. The AI understands the full flow and works toward completing each step naturally — even if the user skips ahead or provides information out of order. The <strong>Escalate</strong> step triggers the admin takeover notification.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
