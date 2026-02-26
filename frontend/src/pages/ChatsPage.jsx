import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { Send, Bot, User, RefreshCw, MessageSquare } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ScrollArea } from "../components/ui/scroll-area";
import { Separator } from "../components/ui/separator";
import { Badge } from "../components/ui/badge";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function formatTime(ts) {
  if (!ts) return "";
  try { return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}

export default function ChatsPage() {
  const [conversations, setConversations] = useState([]);
  const [selectedJid, setSelectedJid] = useState(null);
  const [messages, setMessages] = useState([]);
  const [manualMsg, setManualMsg] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const messagesEndRef = useRef(null);
  const [searchParams] = useSearchParams();

  const loadConversations = async () => {
    try {
      const resp = await axios.get(`${API}/conversations`, { withCredentials: true });
      setConversations(resp.data);
    } catch {}
  };

  const loadMessages = async (jid) => {
    if (!jid) return;
    try {
      const resp = await axios.get(`${API}/messages/${encodeURIComponent(jid, { withCredentials: true })}`);
      setMessages(resp.data);
    } catch {}
  };

  useEffect(() => {
    loadConversations();
    const qJid = searchParams.get("jid");
    if (qJid) setSelectedJid(qJid);
  }, []);

  useEffect(() => {
    if (selectedJid) {
      loadMessages(selectedJid);
      const interval = setInterval(() => loadMessages(selectedJid), 4000);
      return () => clearInterval(interval);
    }
  }, [selectedJid]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!manualMsg.trim() || !selectedJid) return;
    setSendingMsg(true);
    try {
      await axios.post(`${API}/wa/send`, { jid: selectedJid, message: manualMsg });
      setManualMsg("");
      setTimeout(() => loadMessages(selectedJid), 1000);
    } catch {}
    setSendingMsg(false);
  };

  const selectedConv = conversations.find((c) => c.jid === selectedJid);

  return (
    <div className="flex h-full overflow-hidden" data-testid="chats-page">
      {/* List */}
      <div className={`${selectedJid ? "hidden md:flex" : "flex"} flex-col w-full md:w-64 border-r border-border bg-white flex-shrink-0`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-medium">Conversations</span>
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={loadConversations}>
            <RefreshCw size={13} className="text-muted-foreground" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          {conversations.length === 0 ? (
            <div className="py-12 text-center px-4">
              <MessageSquare size={24} className="text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No conversations yet</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.jid}
                onClick={() => { setSelectedJid(conv.jid); setMessages([]); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-border/50 transition-colors duration-100 ${
                  selectedJid === conv.jid ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/50"
                }`}
                data-testid={`conv-item-${conv.jid}`}
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold flex-shrink-0">
                  {(conv.push_name || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate">{conv.push_name}</p>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal ml-1 flex-shrink-0">{conv.message_count}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{conv.last_message}</p>
                </div>
              </button>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className={`${selectedJid ? "flex" : "hidden md:flex"} flex-1 flex-col min-w-0 bg-white`}>
        {!selectedJid ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare size={36} className="text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Select a conversation</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <button onClick={() => setSelectedJid(null)} className="md:hidden text-muted-foreground mr-1 text-sm">←</button>
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
                {(selectedConv?.push_name || "?")[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium">{selectedConv?.push_name || selectedJid}</p>
                <p className="text-xs text-muted-foreground">{selectedJid.split("@")[0]}</p>
              </div>
            </div>

            <ScrollArea className="flex-1 bg-muted/20">
              <div className="px-4 py-4 space-y-3 max-w-2xl mx-auto">
                {messages.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">No messages</p>
                )}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} items-end gap-2`}
                    data-testid={`msg-${msg.role}`}
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
                      <p className="leading-relaxed">{msg.text}</p>
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
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="border-t border-border bg-white">
              <form onSubmit={handleSend} className="flex items-center gap-2 px-4 py-3">
                <Input
                  value={manualMsg}
                  onChange={(e) => setManualMsg(e.target.value)}
                  placeholder="Send a manual message..."
                  className="flex-1 text-sm"
                  data-testid="manual-message-input"
                />
                <Button type="submit" disabled={sendingMsg || !manualMsg.trim()} size="sm" data-testid="send-message-btn">
                  <Send size={13} />
                </Button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
