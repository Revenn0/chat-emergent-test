import { useState, useEffect } from "react";
import axios from "axios";
import { Save, Loader2, Plus, X, Shield } from "lucide-react";
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
  { value: "en-GB", label: "English (UK)" },
  { value: "en-US", label: "English (US)" },
  { value: "pt-BR", label: "Portuguese (Brazil)" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "auto", label: "Auto-detect language" },
];

const TONES = [
  { value: "friendly", label: "Friendly and informal" },
  { value: "professional", label: "Professional and formal" },
  { value: "technical", label: "Technical and concise" },
  { value: "empathetic", label: "Empathetic and supportive" },
];

const RESPONSE_LENGTHS = [
  { value: "concise", label: "Concise (1–2 sentences)" },
  { value: "normal", label: "Normal (1–3 paragraphs)" },
  { value: "detailed", label: "Detailed (comprehensive)" },
];

const defaultConfig = {
  bot_name: "AI Bot",
  greeting_message: "Hello! I'm a virtual assistant. How can I help you?",
  avatar_emoji: "🤖",
  model_provider: "openai",
  model_name: "gpt-4o",
  temperature: 0.7,
  max_tokens: 1024,
  top_p: 1.0,
  system_prompt: "You are a helpful and friendly virtual assistant. Respond clearly and concisely.",
  language: "en-GB",
  tone: "friendly",
  response_length: "normal",
  fallback_message: "I'm sorry, I didn't quite understand that. Could you rephrase your question?",
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
  outside_hours_message: "We're currently outside business hours. We'll be back shortly.",
  strict_mode: true,
  booking_types: [
    { id: "breakdown", name: "Breakdown", enabled: true, keywords: ["breakdown","broke down","broken down"], confirmation_message: "I've logged a breakdown request. Our team will be in touch shortly." },
    { id: "arrange_collection", name: "Arrange Collection", enabled: true, keywords: ["collection","collect","pick up","pickup"], confirmation_message: "I've arranged a collection request. Please await admin confirmation." },
    { id: "arrange_delivery", name: "Arrange Delivery", enabled: true, keywords: ["delivery","deliver","drop off","dropoff"], confirmation_message: "I've arranged a delivery request. Please await admin confirmation." },
  ],
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
        const resp = await axios.get(`${API}/config`, { withCredentials: true });
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
      toast.success("Settings saved successfully.");
    } catch {
      toast.error("Failed to save settings. Please try again.");
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

  return (
    <div className="p-6 max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Agent Settings</h1>
          <p className="text-sm text-muted-foreground">Customise identity, AI model, behaviour, and security</p>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm" data-testid="save-config-btn">
          {saving ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <Save size={13} className="mr-1.5" />}
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      <Tabs defaultValue="identity">
        <TabsList className="grid w-full grid-cols-6 h-8">
          <TabsTrigger value="identity" className="text-xs">Identity</TabsTrigger>
          <TabsTrigger value="model" className="text-xs">AI Model</TabsTrigger>
          <TabsTrigger value="behavior" className="text-xs">Behaviour</TabsTrigger>
          <TabsTrigger value="context" className="text-xs">Context</TabsTrigger>
          <TabsTrigger value="bookings" className="text-xs">Bookings</TabsTrigger>
          <TabsTrigger value="security" className="text-xs">Security</TabsTrigger>
        </TabsList>

        {/* ── IDENTITY ── */}
        <TabsContent value="identity">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Bot identity</CardTitle>
              <CardDescription className="text-xs">Name, greeting, and presentation</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="pt-0 divide-y divide-border">
              <div className="py-4 space-y-1.5">
                <Label className="text-sm">Bot name</Label>
                <Input
                  value={config.bot_name}
                  onChange={(e) => set("bot_name", e.target.value)}
                  placeholder="e.g. Virtual Assistant"
                  className="text-sm"
                  data-testid="bot-name-input"
                />
              </div>
              <div className="py-4 space-y-1.5">
                <Label className="text-sm">Welcome message</Label>
                <p className="text-xs text-muted-foreground">Sent automatically on first contact</p>
                <Textarea
                  value={config.greeting_message}
                  onChange={(e) => set("greeting_message", e.target.value)}
                  placeholder="Hello! How can I help you?"
                  className="text-sm min-h-[80px] resize-none"
                />
              </div>
              <div className="py-4 space-y-1.5">
                <Label className="text-sm">Fallback message</Label>
                <p className="text-xs text-muted-foreground">When the bot doesn't understand the message</p>
                <Input
                  value={config.fallback_message}
                  onChange={(e) => set("fallback_message", e.target.value)}
                  placeholder="I'm sorry, I didn't understand..."
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
              <CardTitle className="text-sm font-medium">Language model</CardTitle>
              <CardDescription className="text-xs">Provider, model, and generation parameters</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="pt-0 divide-y divide-border">
              <div className="py-4 space-y-1.5">
                <Label className="text-sm">Model</Label>
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
                <p className="text-xs text-muted-foreground">Controls creativity. 0 = precise, 2 = creative</p>
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
                <p className="text-xs text-muted-foreground">Token diversity. Recommended: 1.0</p>
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
                <p className="text-xs text-muted-foreground">Maximum length of the generated response</p>
              </div>

              <div className="py-4 space-y-1.5">
                <Label className="text-sm">System prompt</Label>
                <Textarea
                  value={config.system_prompt}
                  onChange={(e) => set("system_prompt", e.target.value)}
                  placeholder="You are a helpful assistant..."
                  className="text-sm min-h-[120px] resize-none font-mono"
                  data-testid="system-prompt-input"
                />
                <p className="text-xs text-muted-foreground">Initial instruction sent to the model for every conversation</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── BEHAVIOUR ── */}
        <TabsContent value="behavior">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Behaviour</CardTitle>
              <CardDescription className="text-xs">Language, tone, and response style</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="pt-0 divide-y divide-border">
              <div className="py-4 space-y-1.5">
                <Label className="text-sm">Response language</Label>
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
                <Label className="text-sm">Tone of voice</Label>
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
                <Label className="text-sm">Response length</Label>
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
              <CardTitle className="text-sm font-medium">Business context</CardTitle>
              <CardDescription className="text-xs">Information the bot uses to respond more accurately</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="pt-0 divide-y divide-border">
              <div className="py-4 space-y-1.5">
                <Label className="text-sm">About your business</Label>
                <p className="text-xs text-muted-foreground">Describe your company, products, and services so the bot understands the context</p>
                <Textarea
                  value={config.business_context}
                  onChange={(e) => set("business_context", e.target.value)}
                  placeholder="e.g. We are an electronics retailer specialising in... Our products include... Our key differentiator is..."
                  className="text-sm min-h-[120px] resize-none"
                />
              </div>
              <div className="py-4 space-y-1.5">
                <Label className="text-sm">FAQ — Frequently asked questions</Label>
                <p className="text-xs text-muted-foreground">List questions and answers. The bot will use these as a reference.</p>
                <Textarea
                  value={config.faq_text}
                  onChange={(e) => set("faq_text", e.target.value)}
                  placeholder={"Q: What are your opening hours?\nA: Monday to Friday, 9am to 6pm.\n\nQ: How do I make a return?\nA: ..."}
                  className="text-sm min-h-[160px] resize-none font-mono"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── BOOKINGS ── */}
        <TabsContent value="bookings">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Booking Detection</CardTitle>
              <CardDescription className="text-xs">Configure which booking types the AI should detect and how to respond</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4 space-y-4">
              {(config.booking_types || []).map((bt, idx) => (
                <div key={bt.id} className="p-3 rounded-md border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={bt.enabled}
                        onCheckedChange={(v) => {
                          const updated = [...config.booking_types];
                          updated[idx] = { ...bt, enabled: v };
                          set("booking_types", updated);
                        }}
                        data-testid={`booking-toggle-${bt.id}`}
                      />
                      <span className="text-sm font-medium">{bt.name}</span>
                    </div>
                    <Badge variant={bt.enabled ? "default" : "secondary"} className="text-[10px]">
                      {bt.enabled ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Trigger keywords (comma-separated)</Label>
                    <Input
                      value={(bt.keywords || []).join(", ")}
                      onChange={(e) => {
                        const updated = [...config.booking_types];
                        updated[idx] = { ...bt, keywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean) };
                        set("booking_types", updated);
                      }}
                      className="text-xs"
                      placeholder="e.g. breakdown, broke down, need help"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Confirmation message sent to client</Label>
                    <Textarea
                      value={bt.confirmation_message}
                      onChange={(e) => {
                        const updated = [...config.booking_types];
                        updated[idx] = { ...bt, confirmation_message: e.target.value };
                        set("booking_types", updated);
                      }}
                      className="text-xs min-h-[60px] resize-none"
                      placeholder="Message sent when this booking is detected..."
                    />
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newId = `custom_${Date.now()}`;
                  set("booking_types", [...(config.booking_types || []), { id: newId, name: "New Booking Type", enabled: true, keywords: [], confirmation_message: "" }]);
                }}
                className="w-full gap-1.5"
                data-testid="add-booking-type-btn"
              >
                <Plus size={13} /> Add booking type
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── SECURITY ── */}
        <TabsContent value="security">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Security &amp; limits</CardTitle>
              <CardDescription className="text-xs">Rate limiting, blocking, and business hours</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="pt-0 divide-y divide-border">
              {/* Strict mode */}
              <SettingRow
                label="Strict mode"
                description="AI only answers questions based on business context, FAQ, and knowledge base. All other questions are declined."
              >
                <Switch
                  checked={config.strict_mode ?? true}
                  onCheckedChange={(v) => set("strict_mode", v)}
                  data-testid="strict-mode-switch"
                />
              </SettingRow>

              {/* Rate limit */}
              <SettingRow
                label="Message rate limit"
                description="Limit how many messages a contact can send per time period"
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
                      <Label className="text-sm">Maximum messages</Label>
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
                      <Label className="text-sm">Time window (minutes)</Label>
                      <Badge variant="secondary" className="text-xs font-mono">{config.rate_limit_window_minutes} min</Badge>
                    </div>
                    <Slider
                      min={1} max={60} step={1}
                      value={[config.rate_limit_window_minutes]}
                      onValueChange={([v]) => set("rate_limit_window_minutes", v)}
                      className="py-1"
                    />
                    <p className="text-xs text-muted-foreground">
                      The bot will respond to at most {config.rate_limit_msgs} messages every {config.rate_limit_window_minutes} minute(s) per contact
                    </p>
                  </div>
                </div>
              )}

              {/* Blocked words */}
              <div className="py-4 space-y-2">
                <Label className="text-sm">Blocked words</Label>
                <p className="text-xs text-muted-foreground">The bot will ignore messages containing these words</p>
                <TagInput
                  values={config.blocked_words}
                  onChange={(v) => set("blocked_words", v)}
                  placeholder="Add a word..."
                />
              </div>

              {/* Blocked contacts */}
              <div className="py-4 space-y-2">
                <Label className="text-sm">Blocked contacts</Label>
                <p className="text-xs text-muted-foreground">Numbers the bot should not reply to (e.g. 4477...@s.whatsapp.net)</p>
                <TagInput
                  values={config.blocked_contacts}
                  onChange={(v) => set("blocked_contacts", v)}
                  placeholder="Number@s.whatsapp.net"
                />
              </div>

              {/* Schedule */}
              <SettingRow
                label="Business hours"
                description="The bot will only respond within the defined hours"
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
                      <Label className="text-sm">Opens at</Label>
                      <Input
                        type="time"
                        value={config.schedule_start}
                        onChange={(e) => set("schedule_start", e.target.value)}
                        className="text-sm"
                        data-testid="schedule-start"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Closes at</Label>
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
                    <Label className="text-sm">Out-of-hours message</Label>
                    <Input
                      value={config.outside_hours_message}
                      onChange={(e) => set("outside_hours_message", e.target.value)}
                      placeholder="We're currently outside business hours..."
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
          {saving ? "Saving..." : "Save settings"}
        </Button>
      </div>
    </div>
  );
}
