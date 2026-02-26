import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Send, Bot, User, Trash2, FlaskConical, Zap, ZapOff, RefreshCw, BookOpen, GitBranch, Shield } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ScrollArea } from "../components/ui/scroll-area";
import { Badge } from "../components/ui/badge";
import { Card, CardContent } from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function formatTime(ts) {
  if (!ts) return "";
  try { return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}

export default function ChatTestPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [config, setConfig] = useState(null);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [kbCount, setKbCount] = useState(0);
  const [workflowActive, setWorkflowActive] = useState(false);
  const messagesEndRef = useRef(null);

  const loadAll = async () => {
    try {
      const [msgsR, configR, statsR, kbR, wfR] = await Promise.all([
        axios.get(`${API}/chat-test/messages`, { withCredentials: true }),
        axios.get(`${API}/config`, { withCredentials: true }),
        axios.get(`${API}/stats`, { withCredentials: true }),
        axios.get(`${API}/knowledge`, { withCredentials: true }),
        axios.get(`${API}/workflow`, { withCredentials: true }),
      ]);
      setMessages(msgsR.data);
      setConfig(configR.data);
      setAiEnabled(statsR.data.ai_enabled ?? true);
      setKbCount(kbR.data.filter((d) => d.enabled).length);
      setWorkflowActive(wfR.data.active && wfR.data.nodes?.length > 0);
    } catch {}
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);

    // Optimistically add user message
    const tempMsg = { id: `tmp_${Date.now()}`, role: "user", text, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const resp = await axios.post(`${API}/chat-test`, { message: text }, { withCredentials: true });
      // Reload messages from server to get proper IDs and timestamps
      const msgsR = await axios.get(`${API}/chat-test/messages`, { withCredentials: true });
      setMessages(msgsR.data);
      if (resp.data.booking_detected) {
        toast.info("Booking intent detected — simulated pending action created");
      }
    } catch {
      toast.error("Failed to get AI response.");
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
    }
    setSending(false);
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      await axios.delete(`${API}/chat-test/messages`, { withCredentials: true });
      setMessages([]);
      toast.success("Conversation cleared.");
    } catch { toast.error("Failed to clear."); }
    setClearing(false);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" data-testid="chat-test-page">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-white flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
            <FlaskConical size={14} className="text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-semibold">Chat Test</h1>
            <p className="text-[11px] text-muted-foreground">Simulate how your bot responds to messages</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={loadAll} className="h-7 text-xs text-muted-foreground gap-1.5">
            <RefreshCw size={12} /> Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            disabled={clearing || messages.length === 0}
            className="h-7 text-xs gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5"
            data-testid="clear-test-btn"
          >
            <Trash2 size={12} /> New test
          </Button>
        </div>
      </div>

      {/* Config strip */}
      <div className="flex items-center gap-2 px-5 py-2 border-b border-border bg-muted/30 flex-shrink-0 flex-wrap">
        {/* AI Status */}
        <Badge
          variant="outline"
          className={`text-[10px] gap-1 font-normal ${aiEnabled ? "bg-green-50 text-green-700 border-green-200" : "bg-orange-50 text-orange-700 border-orange-200"}`}
          data-testid="ai-status-badge"
        >
          {aiEnabled ? <Zap size={9} /> : <ZapOff size={9} />}
          {aiEnabled ? "AI Active" : "AI Paused"}
        </Badge>

        {config && (
          <>
            <Badge variant="secondary" className="text-[10px] font-normal">{config.model_name}</Badge>
            {config.strict_mode && (
              <Badge variant="outline" className="text-[10px] gap-1 font-normal text-blue-700 border-blue-200 bg-blue-50">
                <Shield size={9} /> Strict Mode
              </Badge>
            )}
          </>
        )}
        {kbCount > 0 && (
          <Badge variant="outline" className="text-[10px] gap-1 font-normal text-purple-700 border-purple-200 bg-purple-50">
            <BookOpen size={9} /> {kbCount} KB doc{kbCount > 1 ? "s" : ""}
          </Badge>
        )}
        {workflowActive && (
          <Badge variant="outline" className="text-[10px] gap-1 font-normal text-indigo-700 border-indigo-200 bg-indigo-50">
            <GitBranch size={9} /> Workflow active
          </Badge>
        )}

        {!aiEnabled && (
          <span className="text-[10px] text-orange-600 ml-auto">
            AI is paused — toggle it active in the sidebar to get responses
          </span>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 bg-muted/20">
        <div className="px-4 py-4 space-y-3 max-w-2xl mx-auto">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <FlaskConical size={20} className="text-primary" />
              </div>
              <p className="text-sm font-medium">Ready to test</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Type a message below to see exactly how your bot would respond. Uses your full current config — system prompt, knowledge base, workflow, and strict mode.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} items-end gap-2`}
              data-testid={`test-msg-${msg.role}`}
            >
              {msg.role === "assistant" && (
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot size={11} className="text-primary" />
                </div>
              )}
              <div className={`max-w-xs lg:max-w-sm px-3 py-2 rounded-xl text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-white border border-border rounded-bl-sm"
              }`}>
                <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                <p className={`text-[10px] mt-1 text-right ${msg.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {formatTime(msg.timestamp)}
                </p>
              </div>
              {msg.role === "user" && (
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <User size={11} className="text-muted-foreground" />
                </div>
              )}
            </div>
          ))}

          {sending && (
            <div className="flex justify-start items-end gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot size={11} className="text-primary" />
              </div>
              <div className="bg-white border border-border px-3 py-2 rounded-xl rounded-bl-sm">
                <div className="flex gap-1 items-center h-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border bg-white flex-shrink-0">
        <form onSubmit={handleSend} className="flex items-center gap-2 px-4 py-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={aiEnabled ? "Type a test message..." : "AI is paused — activate it to test"}
            className="flex-1 text-sm"
            disabled={sending}
            data-testid="chat-test-input"
          />
          <Button
            type="submit"
            size="sm"
            disabled={sending || !input.trim()}
            data-testid="chat-test-send-btn"
          >
            <Send size={13} />
          </Button>
        </form>
      </div>
    </div>
  );
}
