# WhatsApp AI Chatbot PRD

## Problem Statement
Criar um chatbot com IA integrado ao WhatsApp utilizando Baileys e QR code para ler com telefone.

## Architecture
- **Baileys Service** (Node.js, port 3001): Conexão WhatsApp via QR code, recebe/envia mensagens
- **Backend FastAPI** (Python, port 8001): Orquestra IA (GPT-4o via Emergent LLM Key), MongoDB, REST API
- **Frontend React** (port 3000): Dashboard dark theme com 5 páginas
- **MongoDB**: Armazena mensagens, conversas, config do bot, logs

## What's Been Implemented (Jan 2026)

### Baileys Service (`/app/baileys-service/`)
- Conexão WhatsApp via QR code com Baileys v6.7+
- Auto-reconexão em caso de queda
- REST API interna: GET /status, GET /qr, POST /reconnect, POST /disconnect, POST /send, GET /logs
- Persistência de sessão em `/app/baileys-service/auth_info/`

### Backend (`/app/backend/server.py`)
- `GET /api/wa/status` — status da conexão
- `GET /api/wa/qr` — QR code base64 para frontend
- `POST /api/wa/message` — recebe mensagem, gera resposta IA, salva no MongoDB
- `POST /api/wa/send` — envio manual de mensagens
- `GET /api/conversations` — lista de conversas
- `GET /api/messages/{jid}` — histórico de mensagens por contato
- `GET/POST /api/config` — configurações do bot
- `GET /api/stats` — estatísticas gerais
- `GET /api/logs` — logs combinados (backend + Baileys)
- GPT-4o via emergentintegrations com LlmChat (session per JID)

### Frontend (`/app/frontend/src/`)
- `DashboardPage` — stats grid + conversas recentes + atividade
- `ConnectionPage` — QR code com animação de scan, instruções passo a passo
- `ChatsPage` — lista de conversas + visualizador de mensagens + envio manual
- `ConfigPage` — nome do bot, modelo IA, system prompt
- `LogsPage` — terminal estilo hacker com logs em tempo real
- Dark theme: Deep Obsidian + Electric Green (JetBrains Mono)

## Core Requirements (Static)
- WhatsApp connection via Baileys QR code
- AI responses via GPT-4o (Emergent LLM Key)
- Conversation history per contact in MongoDB
- Real-time dashboard with stats
- Bot personality configurable via system prompt

## Backlog (P1/P2)

### P1
- Webhook notifications on new messages
- Multi-session support (multiple WhatsApp numbers)
- Message search functionality
- Media message support (images, audio)

### P2
- Custom response rules / keywords trigger
- Scheduled messages
- Analytics charts (messages per day)
- Export conversations to CSV
- Auto-reply hours configuration (e.g., business hours only)
