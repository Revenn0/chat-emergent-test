import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { MessageSquare, Send, User, Bot, RefreshCw } from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ScrollArea } from "../components/ui/scroll-area";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function formatTime(ts) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
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
      const resp = await axios.get(`${API}/conversations`);
      setConversations(resp.data);
    } catch {}
  };

  const loadMessages = async (jid) => {
    if (!jid) return;
    try {
      const resp = await axios.get(`${API}/messages/${encodeURIComponent(jid)}`);
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

  const handleSelectConv = (jid) => {
    setSelectedJid(jid);
    setMessages([]);
  };

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
    <div className="flex h-full overflow-hidden fade-in" data-testid="chats-page">
      {/* Conversations list */}
      <div
        className={`${
          selectedJid ? "hidden md:flex" : "flex"
        } flex-col w-full md:w-72 border-r border-border bg-card/30 flex-shrink-0`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-border">
          <h2 className="font-mono font-bold text-sm text-foreground">Conversas</h2>
          <Button variant="ghost" size="icon" onClick={loadConversations} className="w-7 h-7">
            <RefreshCw size={13} className="text-muted-foreground" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          {conversations.length === 0 ? (
            <div className="py-12 text-center px-4">
              <MessageSquare size={28} className="text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma conversa</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.jid}
                onClick={() => handleSelectConv(conv.jid)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-border/30 transition-colors duration-150 ${
                  selectedJid === conv.jid ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-secondary/30"
                }`}
                data-testid={`conv-item-${conv.jid}`}
              >
                <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/20 flex items-center justify-center text-primary font-mono font-bold text-sm flex-shrink-0">
                  {(conv.push_name || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground truncate">{conv.push_name}</p>
                    <span className="text-xs text-muted-foreground font-mono ml-1 flex-shrink-0">{conv.message_count}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{conv.last_message}</p>
                </div>
              </button>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className={`${selectedJid ? "flex" : "hidden md:flex"} flex-1 flex-col min-w-0`}>
        {!selectedJid ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare size={48} className="text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-muted-foreground font-mono">Selecione uma conversa</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/30">
              <button
                onClick={() => setSelectedJid(null)}
                className="md:hidden text-muted-foreground hover:text-foreground mr-1"
              >
                ←
              </button>
              <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/20 flex items-center justify-center text-primary font-mono font-bold text-sm">
                {(selectedConv?.push_name || "?")[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{selectedConv?.push_name || selectedJid}</p>
                <p className="text-xs text-muted-foreground font-mono">{selectedJid.split("@")[0]}</p>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-4 py-4">
              <div className="space-y-3 max-w-2xl mx-auto">
                {messages.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">Nenhuma mensagem</div>
                )}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} items-end gap-2`}
                    data-testid={`msg-${msg.role}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/20 flex items-center justify-center flex-shrink-0">
                        <Bot size={12} className="text-primary" />
                      </div>
                    )}
                    <div
                      className={`max-w-xs lg:max-w-md px-3 py-2 rounded-xl text-sm ${
                        msg.role === "user" ? "bubble-user text-foreground" : "bubble-bot text-foreground"
                      }`}
                    >
                      <p className="leading-relaxed">{msg.text}</p>
                      <p className="text-xs text-muted-foreground mt-1 text-right font-mono">
                        {formatTime(msg.timestamp)}
                      </p>
                    </div>
                    {msg.role === "user" && (
                      <div className="w-6 h-6 rounded-full bg-secondary border border-border flex items-center justify-center flex-shrink-0">
                        <User size={12} className="text-muted-foreground" />
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Send message */}
            <form onSubmit={handleSend} className="flex items-center gap-2 px-4 py-3 border-t border-border bg-card/20">
              <Input
                value={manualMsg}
                onChange={(e) => setManualMsg(e.target.value)}
                placeholder="Enviar mensagem manual..."
                className="flex-1 bg-secondary/50 border-input text-sm font-mono"
                data-testid="manual-message-input"
              />
              <Button
                type="submit"
                disabled={sendingMsg || !manualMsg.trim()}
                className="bg-primary text-primary-foreground btn-glow hover:bg-primary/90"
                data-testid="send-message-btn"
              >
                <Send size={14} />
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
