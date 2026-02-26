# WhatsApp 365 Bot — PRD

## Problem Statement
AI-powered WhatsApp chatbot platform using Baileys + QR code pairing. Multi-tenant SaaS where each Google-authenticated user gets an isolated workspace with their own WhatsApp connection, AI config, knowledge base, and conversation history.

## Architecture
- **Baileys Service** (Node.js, port 3001): Manages multiple WhatsApp sessions via QR code
- **Backend FastAPI** (Python, port 8001): AI orchestration (GPT-4o), MongoDB, REST API
- **Frontend React** (port 3000): Minimalist light UI with shadcn/ui components
- **MongoDB**: All data storage, multi-tenant by user_id
- **Auth**: Emergent-managed Google OAuth

## Core Requirements (Static)
- WhatsApp connection via Baileys QR code (multi-tenant)
- AI responses via GPT-4o (Emergent LLM Key)
- RAG from uploaded PDF/DOCX files
- Admin Takeover: pause bot, take live control of any conversation
- Visual Workflow Builder: define step-by-step conversation flow for AI
- Bot Actions: pending booking approvals for admin
- Google Integration: single OAuth login for Gmail email + Google Sheets
- Strict Mode: AI answers only from provided context
- Settings: Identity, AI Model, Behavior, Context, Security tabs

## What's Been Implemented

### Completed (Jan–Feb 2026)
- Full-stack application: React + FastAPI + Baileys Node.js + MongoDB
- Emergent Google Auth (multi-tenant, isolated workspaces)
- WhatsApp QR code connection with session persistence
- GPT-4o AI integration via Emergent LLM Key
- RAG: PDF/DOCX upload → knowledge base → injected into AI context
- Advanced Settings: 5-tab config page (Identity, AI Model, Behavior, Context, Security)
- Strict Mode toggle for AI context adherence
- Booking detection: keywords trigger pending actions
- AI Toggle: button in sidebar (always visible) to activate/pause the AI across all WhatsApp conversations. State persisted in DB. Color-coded: green=active, orange=paused
- Chat Test page (/chat-test): full chat simulation using real AI pipeline (system prompt, strict mode, workflow, knowledge base, booking detection). Multi-turn conversation with history. Clear button to reset session.
  - Visual "Live Agent" badge + orange banner
  - Bot silences itself when conversation is taken over
- Visual Workflow Builder (WorkflowPage): node-based step editor
  - Node types: Start, Message, Question/Branch, Collect Info, Escalate, End
  - Workflow injected into AI system prompt
  - Save/Reset/Active toggle
- Bot Actions page: pending booking approvals with approve/reject
- Google Integrations page: single Google OAuth login for Gmail + Sheets
  - Send emails via Gmail API
  - Create/manage Google Sheets spreadsheets
- Logs page with Clear Logs functionality
- UK English localization throughout

### Navigation (sidebar)
Dashboard → Connection → Conversations → Knowledge Base → Bot Actions → Workflow → Integrations → Settings → Logs

## DB Schema
- **users**: user_id, email, name, picture
- **user_sessions**: session_token, user_id, expires_at
- **bot_config**: per-user AI/bot settings, booking_types
- **conversations**: jid, user_id, push_name, taken_over, takeover_by
- **messages**: id, user_id, from_jid, role, text, timestamp
- **knowledge_base_files**: filename, file_type, char_count, enabled, content
- **workflows**: nodes[], active, user_id
- **bot_actions**: action_id, user_id, jid, action_type, status (pending/approved/rejected)
- **google_tokens**: user_id, access_token, refresh_token, client_id, client_secret, gmail_email
- **user_sheets**: user_id, spreadsheet_id, title, mode, url
- **logs**: user_id, level, message, timestamp

## Prioritized Backlog

### P3 — Dashboard Functional
Connect dashboard metric cards to real backend data (total conversations, messages, pending actions, bot status)

### P4 — Test Strict AI Prompting
Rigorous testing of Strict Mode to ensure AI adheres perfectly to context-only answers and escalation rules

### P5 — Platform Branding Review
Final audit of all frontend text to ensure "WhatsApp 365 Bot" is used consistently

### P6 — Media Message Support
Handle image/audio messages from WhatsApp (currently text-only)

### P7 — Analytics Charts
Messages per day chart, response time metrics

### P8 — Export Conversations
CSV export of conversation history
