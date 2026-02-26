import { useState, useEffect } from "react";
import axios from "axios";
import { Save, Loader2, Plus, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { Slider } from "../components/ui/slider";
import { Separator } from "../components/ui/separator";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MODELS = [
  { provider: "openai", name: "gpt-4o", label: "GPT-4o" },
  { provider: "openai", name: "gpt-4o-mini", label: "GPT-4o Mini" },
  { provider: "openai", name: "gpt-4.1", label: "GPT-4.1" },
  { provider: "anthropic", name: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5" },
  { provider: "anthropic", name: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  { provider: "gemini", name: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { provider: "gemini", name: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
];

const LANGUAGES = [
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "en-US", label: "English (US)" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "auto", label: "Automático (detectar idioma)" },
];

const TONES = [
  { value: "friendly", label: "Amigável e informal" },
  { value: "professional", label: "Profissional e formal" },
  { value: "technical", label: "Técnico e direto" },
  { value: "empathetic", label: "Empático e acolhedor" },
];

const RESPONSE_LENGTHS = [
  { value: "concise", label: "Conciso (1-2 frases)" },
  { value: "normal", label: "Normal (1-3 parágrafos)" },
  { value: "detailed", label: "Detalhado (completo)" },
];

const defaultConfig = {
  bot_name: "AI Bot",
  greeting_message: "Olá! Sou um assistente virtual. Como posso ajudar?",
  avatar_emoji: "🤖",
  model_provider: "openai",
  model_name: "gpt-4o",
  temperature: 0.7,
  max_tokens: 1024,
  top_p: 1.0,
  system_prompt: "Você é um assistente virtual prestativo e amigável. Responda em português de forma clara e concisa.",
  language: "pt-BR",
  tone: "friendly",
  response_length: "normal",
  fallback_message: "Desculpe, não entendi. Pode reformular sua pergunta?",
  business_context: "",
  faq_text: "",
  rate_limit_enabled: false,
  rate_limit_msgs: 10,
  rate_limit_window_minutes: 1,
  blocked_words: [],
  blocked_contacts: [],
  schedule_enabled: false,
  schedule_start: "09:00",
  schedule_end: "18:00",
  outside_hours_message: "Estamos fora do horário de atendimento. Retornaremos em breve.",
};

function SettingRow({ label, description, children }) {
  return (
    <div className="flex items-start justify-between py-4">
      <div className="space-y-0.5 flex-1 pr-8">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function TagInput({ values, onChange, placeholder }) {
  const [input, setInput] = useState("");

  const add = () => {
    const val = input.trim();
    if (val && !values.includes(val)) {
      onChange([...values, val]);
    }
    setInput("");
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="text-sm h-8"
        />
        <Button type="button" variant="outline" size="sm" className="h-8 px-2" onClick={add}>
          <Plus size={13} />
        </Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <Badge key={v} variant="secondary" className="text-xs gap-1 pr-1">
              {v}
              <button onClick={() => onChange(values.filter((x) => x !== v))} className="ml-0.5 hover:text-destructive">
                <X size={10} />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ConfigPage() {
  const [config, setConfig] = useState(defaultConfig);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const resp = await axios.get(`${API}/config`);
        setConfig({ ...defaultConfig, ...resp.data });
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const set = (key, value) => setConfig((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/config`, config);
      toast.success("Configurações salvas com sucesso.");
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selectedModel = MODELS.find((m) => m.provider === config.model_provider && m.name === config.model_name);

  return (
    <div className="p-6 max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Configurações do agente</h1>
          <p className="text-sm text-muted-foreground">Personalize identidade, IA, comportamento e segurança</p>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm" data-testid="save-config-btn">
          {saving ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <Save size={13} className="mr-1.5" />}
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      <Tabs defaultValue="identity">
        <TabsList className="grid w-full grid-cols-5 h-8">
          <TabsTrigger value="identity" className="text-xs">Identidade</TabsTrigger>
          <TabsTrigger value="model" className="text-xs">Modelo IA</TabsTrigger>
          <TabsTrigger value="behavior" className="text-xs">Comportamento</TabsTrigger>
          <TabsTrigger value="context" className="text-xs">Contexto</TabsTrigger>
          <TabsTrigger value="security" className="text-xs">Segurança</TabsTrigger>
        </TabsList>

        {/* ── IDENTITY ── */}
        <TabsContent value="identity">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Identidade do bot</CardTitle>
              <CardDescription className="text-xs">Nome, saudação e apresentação</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="pt-0 divide-y divide-border">
              <div className="py-4 space-y-1.5">
                <Label className="text-sm">Nome do bot</Label>
                <Input
                  value={config.bot_name}
                  onChange={(e) => set("bot_name", e.target.value)}
                  placeholder="Ex: Assistente Virtual"
                  className="text-sm"
                  data-testid="bot-name-input"
                />
              </div>
              <div className="py-4 space-y-1.5">
                <Label className="text-sm">Mensagem de boas-vindas</Label>
                <p className="text-xs text-muted-foreground">Enviada automaticamente ao primeiro contato</p>
                <Textarea
                  value={config.greeting_message}
                  onChange={(e) => set("greeting_message", e.target.value)}
                  placeholder="Olá! Como posso ajudar?"
                  className="text-sm min-h-[80px] resize-none"
                />
              </div>
              <div className="py-4 space-y-1.5">
                <Label className="text-sm">Mensagem de fallback</Label>
                <p className="text-xs text-muted-foreground">Quando o bot não entender a mensagem</p>
                <Input
                  value={config.fallback_message}
                  onChange={(e) => set("fallback_message", e.target.value)}
                  placeholder="Desculpe, não entendi..."
                  className="text-sm"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── MODEL ── */}
        <TabsContent value="model">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Modelo de linguagem</CardTitle>
              <CardDescription className="text-xs">Provedor, modelo e parâmetros de geração</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="pt-0 divide-y divide-border">
              <div className="py-4 space-y-1.5">
                <Label className="text-sm">Modelo</Label>
                <Select
                  value={`${config.model_provider}::${config.model_name}`}
                  onValueChange={(v) => {
                    const m = MODELS.find((x) => `${x.provider}::${x.name}` === v);
                    if (m) { set("model_provider", m.provider); set("model_name", m.name); }
                  }}
                >
                  <SelectTrigger className="text-sm" data-testid="model-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODELS.map((m) => (
                      <SelectItem key={`${m.provider}::${m.name}`} value={`${m.provider}::${m.name}`} className="text-sm">
                        {m.label}
                        <span className="ml-1.5 text-muted-foreground text-xs">{m.provider}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Powered by Emergent Universal Key</p>
              </div>

              <div className="py-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Temperature</Label>
                  <Badge variant="secondary" className="text-xs font-mono">{config.temperature.toFixed(1)}</Badge>
                </div>
                <Slider
                  min={0} max={2} step={0.1}
                  value={[config.temperature]}
                  onValueChange={([v]) => set("temperature", v)}
                  className="py-1"
                />
                <p className="text-xs text-muted-foreground">Controla criatividade. 0 = preciso, 2 = criativo</p>
              </div>

              <div className="py-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Top P</Label>
                  <Badge variant="secondary" className="text-xs font-mono">{config.top_p.toFixed(1)}</Badge>
                </div>
                <Slider
                  min={0.1} max={1} step={0.1}
                  value={[config.top_p]}
                  onValueChange={([v]) => set("top_p", v)}
                  className="py-1"
                />
                <p className="text-xs text-muted-foreground">Diversidade dos tokens. Recomendado: 1.0</p>
              </div>

              <div className="py-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Max tokens</Label>
                  <Badge variant="secondary" className="text-xs font-mono">{config.max_tokens}</Badge>
                </div>
                <Slider
                  min={128} max={4096} step={128}
                  value={[config.max_tokens]}
                  onValueChange={([v]) => set("max_tokens", v)}
                  className="py-1"
                />
                <p className="text-xs text-muted-foreground">Tamanho máximo da resposta gerada</p>
              </div>

              <div className="py-4 space-y-1.5">
                <Label className="text-sm">System prompt</Label>
                <Textarea
                  value={config.system_prompt}
                  onChange={(e) => set("system_prompt", e.target.value)}
                  placeholder="Você é um assistente..."
                  className="text-sm min-h-[120px] resize-none font-mono"
                  data-testid="system-prompt-input"
                />
                <p className="text-xs text-muted-foreground">Instrução inicial enviada ao modelo em cada conversa</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── BEHAVIOR ── */}
        <TabsContent value="behavior">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Comportamento</CardTitle>
              <CardDescription className="text-xs">Idioma, tom e estilo de resposta</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="pt-0 divide-y divide-border">
              <div className="py-4 space-y-1.5">
                <Label className="text-sm">Idioma das respostas</Label>
                <Select value={config.language} onValueChange={(v) => set("language", v)}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l.value} value={l.value} className="text-sm">{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="py-4 space-y-1.5">
                <Label className="text-sm">Tom de voz</Label>
                <Select value={config.tone} onValueChange={(v) => set("tone", v)}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TONES.map((t) => (
                      <SelectItem key={t.value} value={t.value} className="text-sm">{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="py-4 space-y-1.5">
                <Label className="text-sm">Tamanho das respostas</Label>
                <Select value={config.response_length} onValueChange={(v) => set("response_length", v)}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESPONSE_LENGTHS.map((r) => (
                      <SelectItem key={r.value} value={r.value} className="text-sm">{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── CONTEXT ── */}
        <TabsContent value="context">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Contexto do negócio</CardTitle>
              <CardDescription className="text-xs">Informações que o bot usa para responder melhor</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="pt-0 divide-y divide-border">
              <div className="py-4 space-y-1.5">
                <Label className="text-sm">Sobre o negócio / empresa</Label>
                <p className="text-xs text-muted-foreground">Descreva sua empresa, produtos e serviços para o bot entender o contexto</p>
                <Textarea
                  value={config.business_context}
                  onChange={(e) => set("business_context", e.target.value)}
                  placeholder="Ex: Somos uma loja de eletrônicos especializada em... Nossos produtos incluem... Nosso diferencial é..."
                  className="text-sm min-h-[120px] resize-none"
                />
              </div>
              <div className="py-4 space-y-1.5">
                <Label className="text-sm">FAQ — Perguntas frequentes</Label>
                <p className="text-xs text-muted-foreground">Liste perguntas e respostas comuns. O bot usará como referência.</p>
                <Textarea
                  value={config.faq_text}
                  onChange={(e) => set("faq_text", e.target.value)}
                  placeholder={"P: Qual o horário de funcionamento?\nR: Segunda a sexta, 9h às 18h.\n\nP: Como faço uma troca?\nR: ..."}
                  className="text-sm min-h-[160px] resize-none font-mono"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── SECURITY ── */}
        <TabsContent value="security">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Segurança e limites</CardTitle>
              <CardDescription className="text-xs">Rate limiting, bloqueios e horário de atendimento</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="pt-0 divide-y divide-border">
              {/* Rate limit */}
              <SettingRow
                label="Limite de mensagens"
                description="Limitar quantas mensagens um contato pode enviar por período"
              >
                <Switch
                  checked={config.rate_limit_enabled}
                  onCheckedChange={(v) => set("rate_limit_enabled", v)}
                  data-testid="rate-limit-switch"
                />
              </SettingRow>

              {config.rate_limit_enabled && (
                <div className="py-4 space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Máximo de mensagens</Label>
                      <Badge variant="secondary" className="text-xs font-mono">{config.rate_limit_msgs}</Badge>
                    </div>
                    <Slider
                      min={1} max={60} step={1}
                      value={[config.rate_limit_msgs]}
                      onValueChange={([v]) => set("rate_limit_msgs", v)}
                      className="py-1"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Janela de tempo (minutos)</Label>
                      <Badge variant="secondary" className="text-xs font-mono">{config.rate_limit_window_minutes} min</Badge>
                    </div>
                    <Slider
                      min={1} max={60} step={1}
                      value={[config.rate_limit_window_minutes]}
                      onValueChange={([v]) => set("rate_limit_window_minutes", v)}
                      className="py-1"
                    />
                    <p className="text-xs text-muted-foreground">
                      O bot responde no máximo {config.rate_limit_msgs} msg a cada {config.rate_limit_window_minutes} min por contato
                    </p>
                  </div>
                </div>
              )}

              {/* Blocked words */}
              <div className="py-4 space-y-2">
                <Label className="text-sm">Palavras bloqueadas</Label>
                <p className="text-xs text-muted-foreground">O bot ignorará mensagens contendo estas palavras</p>
                <TagInput
                  values={config.blocked_words}
                  onChange={(v) => set("blocked_words", v)}
                  placeholder="Adicionar palavra..."
                />
              </div>

              {/* Blocked contacts */}
              <div className="py-4 space-y-2">
                <Label className="text-sm">Contatos bloqueados</Label>
                <p className="text-xs text-muted-foreground">Números que o bot não deve responder (ex: 5511999...@s.whatsapp.net)</p>
                <TagInput
                  values={config.blocked_contacts}
                  onChange={(v) => set("blocked_contacts", v)}
                  placeholder="Número@s.whatsapp.net"
                />
              </div>

              {/* Schedule */}
              <SettingRow
                label="Horário de atendimento"
                description="O bot só responde dentro do horário definido"
              >
                <Switch
                  checked={config.schedule_enabled}
                  onCheckedChange={(v) => set("schedule_enabled", v)}
                  data-testid="schedule-switch"
                />
              </SettingRow>

              {config.schedule_enabled && (
                <div className="py-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm">Início</Label>
                      <Input
                        type="time"
                        value={config.schedule_start}
                        onChange={(e) => set("schedule_start", e.target.value)}
                        className="text-sm"
                        data-testid="schedule-start"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Fim</Label>
                      <Input
                        type="time"
                        value={config.schedule_end}
                        onChange={(e) => set("schedule_end", e.target.value)}
                        className="text-sm"
                        data-testid="schedule-end"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Mensagem fora do horário</Label>
                    <Input
                      value={config.outside_hours_message}
                      onChange={(e) => set("outside_hours_message", e.target.value)}
                      placeholder="Estamos fora do horário..."
                      className="text-sm"
                      data-testid="outside-hours-msg"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end pb-6">
        <Button onClick={handleSave} disabled={saving} data-testid="save-config-btn-bottom">
          {saving ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <Save size={13} className="mr-1.5" />}
          {saving ? "Salvando..." : "Salvar configurações"}
        </Button>
      </div>
    </div>
  );
}
