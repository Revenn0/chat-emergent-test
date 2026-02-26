import { useState, useEffect } from "react";
import axios from "axios";
import { Settings, Save, Loader2, Bot } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MODELS = [
  { provider: "openai", name: "gpt-4o", label: "GPT-4o (OpenAI)" },
  { provider: "openai", name: "gpt-4o-mini", label: "GPT-4o Mini (OpenAI)" },
  { provider: "openai", name: "gpt-4.1", label: "GPT-4.1 (OpenAI)" },
  { provider: "anthropic", name: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5 (Anthropic)" },
  { provider: "gemini", name: "gemini-2.5-flash", label: "Gemini 2.5 Flash (Google)" },
];

export default function ConfigPage() {
  const [config, setConfig] = useState({
    system_prompt: "Você é um assistente virtual prestativo e amigável. Responda em português de forma clara e concisa.",
    model_provider: "openai",
    model_name: "gpt-4o",
    bot_name: "AI Bot",
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const resp = await axios.get(`${API}/config`);
        setConfig(resp.data);
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const handleModelChange = (value) => {
    const model = MODELS.find((m) => `${m.provider}::${m.name}` === value);
    if (model) {
      setConfig((prev) => ({ ...prev, model_provider: model.provider, model_name: model.name }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/config`, config);
      toast.success("Configurações salvas com sucesso!");
    } catch (e) {
      toast.error("Erro ao salvar configurações");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 fade-in">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight font-mono text-foreground">Configurações</h1>
        <p className="text-muted-foreground mt-1">Personalize o comportamento do seu bot</p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Bot identity */}
        <Card className="bg-card border-border/50 card-hover">
          <CardHeader className="pb-3">
            <CardTitle className="font-mono text-base flex items-center gap-2">
              <Bot size={16} className="text-primary" />
              Identidade do Bot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-mono text-muted-foreground mb-1.5 block">Nome do Bot</Label>
              <Input
                value={config.bot_name}
                onChange={(e) => setConfig((prev) => ({ ...prev, bot_name: e.target.value }))}
                className="bg-secondary/50 border-input font-mono text-sm"
                placeholder="Ex: Assistente Virtual"
                data-testid="bot-name-input"
              />
            </div>
          </CardContent>
        </Card>

        {/* Model selection */}
        <Card className="bg-card border-border/50 card-hover">
          <CardHeader className="pb-3">
            <CardTitle className="font-mono text-base flex items-center gap-2">
              <Settings size={16} className="text-primary" />
              Modelo de IA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Label className="text-sm font-mono text-muted-foreground mb-1.5 block">Selecione o modelo</Label>
            <Select
              value={`${config.model_provider}::${config.model_name}`}
              onValueChange={handleModelChange}
            >
              <SelectTrigger className="bg-secondary/50 border-input font-mono text-sm" data-testid="model-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border font-mono text-sm">
                {MODELS.map((m) => (
                  <SelectItem key={`${m.provider}::${m.name}`} value={`${m.provider}::${m.name}`}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
              Todos os modelos são alimentados pela chave universal Emergent.
            </p>
          </CardContent>
        </Card>

        {/* System prompt */}
        <Card className="bg-card border-border/50 card-hover">
          <CardHeader className="pb-3">
            <CardTitle className="font-mono text-base flex items-center gap-2">
              <Settings size={16} className="text-primary" />
              Prompt do Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Label className="text-sm font-mono text-muted-foreground mb-1.5 block">
              Instrução inicial do bot (system prompt)
            </Label>
            <Textarea
              value={config.system_prompt}
              onChange={(e) => setConfig((prev) => ({ ...prev, system_prompt: e.target.value }))}
              className="bg-secondary/50 border-input font-mono text-sm min-h-[180px] resize-y"
              placeholder="Você é um assistente virtual..."
              data-testid="system-prompt-input"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Este texto define a personalidade e comportamento do bot em todas as conversas.
            </p>
          </CardContent>
        </Card>

        {/* Save */}
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-primary text-primary-foreground btn-glow hover:bg-primary/90 font-mono"
          data-testid="save-config-btn"
        >
          {saving ? (
            <Loader2 size={16} className="mr-2 animate-spin" />
          ) : (
            <Save size={16} className="mr-2" />
          )}
          {saving ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>
    </div>
  );
}
