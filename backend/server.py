from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Depends, Request, Response
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, httpx, uuid, pdfplumber, io, docx as python_docx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from emergentintegrations.llm.chat import LlmChat, UserMessage
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from googleapiclient.discovery import build
import base64, email as email_lib, warnings

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

BAILEYS_URL = os.environ.get('BAILEYS_URL', 'http://localhost:3001')
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

app = FastAPI()
api_router = APIRouter(prefix="/api")
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─── MODELS ───────────────────────────────────────────────

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None

class BookingType(BaseModel):
    id: str
    name: str
    enabled: bool = True
    keywords: List[str] = []
    confirmation_message: str = ""

class BotConfig(BaseModel):
    bot_name: str = "WhatsApp 365 Bot"
    greeting_message: str = "Hello! How can I help you today?"
    fallback_message: str = "I'm sorry, I can only assist with topics related to our business."
    model_provider: str = "openai"
    model_name: str = "gpt-4o"
    temperature: float = 0.3
    max_tokens: int = 1024
    top_p: float = 1.0
    system_prompt: str = "You are a helpful business assistant."
    language: str = "en-GB"
    tone: str = "professional"
    response_length: str = "normal"
    business_context: str = ""
    faq_text: str = ""
    strict_mode: bool = True
    booking_types: List[BookingType] = [
        BookingType(id="breakdown", name="Breakdown", enabled=True, keywords=["breakdown","broke down","broken down","engine failed"], confirmation_message="I've logged a breakdown request. Our team will be in touch shortly to confirm."),
        BookingType(id="arrange_collection", name="Arrange Collection", enabled=True, keywords=["collection","collect","pick up","pickup","come get"], confirmation_message="I've arranged a collection request. Please await admin confirmation."),
        BookingType(id="arrange_delivery", name="Arrange Delivery", enabled=True, keywords=["delivery","deliver","drop off","dropoff","send"], confirmation_message="I've arranged a delivery request. Please await admin confirmation."),
    ]
    rate_limit_enabled: bool = False
    rate_limit_msgs: int = 10
    rate_limit_window_minutes: int = 1
    blocked_words: List[str] = []
    blocked_contacts: List[str] = []
    schedule_enabled: bool = False
    schedule_start: str = "09:00"
    schedule_end: str = "18:00"
    outside_hours_message: str = "We're currently outside business hours. We'll be back shortly."
    updated_at: Optional[str] = None

class BotAction(BaseModel):
    action_id: str
    user_id: str
    jid: str
    push_name: str
    action_type: str
    action_label: str
    trigger_message: str
    status: str = "pending"
    admin_note: Optional[str] = None
    created_at: str
    updated_at: str

class KnowledgeDoc(BaseModel):
    id: str
    filename: str
    file_type: str
    size_bytes: int
    char_count: int
    enabled: bool = True
    uploaded_at: str

class ConversationModel(BaseModel):
    id: str
    jid: str
    push_name: str
    last_message: str
    last_timestamp: str
    message_count: int

class IncomingMessage(BaseModel):
    from_: str = Field(alias="from")
    pushName: str
    text: str
    timestamp: Any
    user_id: Optional[str] = None
    class Config:
        populate_by_name = True

class WAEvent(BaseModel):
    event: str
    data: Optional[Dict] = None
    user_id: Optional[str] = None

class SendMessageRequest(BaseModel):
    jid: str
    message: str

class WorkflowNode(BaseModel):
    id: str
    type: str  # start | message | question | collect | escalate | end
    title: str
    content: str = ""
    branches: List[Dict] = []  # [{label, next_id}]
    position: int = 0

class WorkflowData(BaseModel):
    nodes: List[WorkflowNode] = []
    active: bool = True
    updated_at: Optional[str] = None

class TakeoverRequest(BaseModel):
    active: bool

class ActionUpdateRequest(BaseModel):
    status: str
    admin_note: Optional[str] = None

class GmailCredentials(BaseModel):
    client_id: str
    client_secret: str

class SendEmailRequest(BaseModel):
    to: str
    subject: str
    body: str

class CreateSheetRequest(BaseModel):
    title: str
    mode: str = "edit"  # "edit" or "read"

class AppendSheetRequest(BaseModel):
    spreadsheet_id: str
    sheet_name: str = "Sheet1"
    values: List[List[Any]]

class ReadSheetRequest(BaseModel):
    spreadsheet_id: str
    range: str = "Sheet1"

# ─── AUTH HELPERS ─────────────────────────────────────────

async def get_current_user(request: Request) -> User:
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        token = auth.replace("Bearer ", "") if auth.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user)

# ─── HELPERS ──────────────────────────────────────────────

async def add_log(user_id: str, level: str, message: str):
    await db.logs.insert_one({"user_id": user_id, "level": level, "message": message, "timestamp": datetime.now(timezone.utc).isoformat()})

async def get_bot_config(user_id: str) -> BotConfig:
    doc = await db.bot_config.find_one({"user_id": user_id}, {"_id": 0})
    if doc:
        doc.pop("user_id", None)
        return BotConfig(**doc)
    return BotConfig()

def detect_booking(text: str, booking_types: List[BookingType]):
    tl = text.lower()
    for bt in booking_types:
        if not bt.enabled:
            continue
        for kw in bt.keywords:
            if kw.lower() in tl:
                return bt
    return None

# ─── AUTH ROUTES ──────────────────────────────────────────

@api_router.post("/auth/session")
async def create_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    async with httpx.AsyncClient(timeout=10) as c:
        resp = await c.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session_id")
    data = resp.json()
    email = data["email"]
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"email": email}, {"$set": {"name": data.get("name", ""), "picture": data.get("picture", "")}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({"user_id": user_id, "email": email, "name": data.get("name", ""), "picture": data.get("picture", ""), "created_at": datetime.now(timezone.utc).isoformat()})
    session_token = data["session_token"]
    expires_at = datetime.now(timezone.utc).replace(tzinfo=timezone.utc)
    from datetime import timedelta
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({"user_id": user_id, "session_token": session_token, "expires_at": expires_at.isoformat(), "created_at": datetime.now(timezone.utc).isoformat()})
    response.set_cookie("session_token", session_token, httponly=True, secure=True, samesite="none", path="/", max_age=604800)
    return {"user_id": user_id, "email": email, "name": data.get("name",""), "picture": data.get("picture","")}

@api_router.get("/auth/me")
async def get_me(user: User = Depends(get_current_user)):
    return user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/", samesite="none", secure=True)
    return {"ok": True}

# ─── WHATSAPP ROUTES ──────────────────────────────────────

@api_router.get("/wa/status")
async def get_wa_status(user: User = Depends(get_current_user)):
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            resp = await c.get(f"{BAILEYS_URL}/status", params={"user_id": user.user_id})
            return resp.json()
    except Exception as e:
        return {"status": "disconnected", "connected": False, "jid": None}

@api_router.get("/wa/qr")
async def get_qr(user: User = Depends(get_current_user)):
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            resp = await c.get(f"{BAILEYS_URL}/qr", params={"user_id": user.user_id})
            return resp.json()
    except Exception as e:
        return {"qr": None, "status": "disconnected"}

@api_router.post("/wa/disconnect")
async def disconnect_wa(user: User = Depends(get_current_user)):
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            resp = await c.post(f"{BAILEYS_URL}/disconnect", json={"user_id": user.user_id})
            await add_log(user.user_id, "info", "WhatsApp disconnected by user")
            return resp.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/wa/reconnect")
async def reconnect_wa(user: User = Depends(get_current_user)):
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            resp = await c.post(f"{BAILEYS_URL}/reconnect", json={"user_id": user.user_id})
            await add_log(user.user_id, "info", "WhatsApp reconnect requested")
            return resp.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/wa/event")
async def handle_wa_event(event: WAEvent):
    uid = event.user_id or "system"
    await add_log(uid, "info", f"WA Event: {event.event}")
    return {"ok": True}

@api_router.post("/wa/message")
async def handle_incoming_message(msg: IncomingMessage):
    jid = msg.from_
    push_name = msg.pushName or jid.split("@")[0]
    text = msg.text
    user_id = msg.user_id or "unknown"
    ts = datetime.now(timezone.utc).isoformat()

    await add_log(user_id, "info", f"Message from {push_name}: {text[:60]}")
    config = await get_bot_config(user_id)

    if jid in (config.blocked_contacts or []):
        return {"reply": None}
    for word in (config.blocked_words or []):
        if word.lower() in text.lower():
            return {"reply": None}

    if config.schedule_enabled:
        now_time = datetime.now(timezone.utc).strftime("%H:%M")
        if not (config.schedule_start <= now_time <= config.schedule_end):
            return {"reply": config.outside_hours_message}

    if config.rate_limit_enabled:
        window_start = datetime.now(timezone.utc).timestamp() - (config.rate_limit_window_minutes * 60)
        from datetime import timezone as tz
        recent_count = await db.messages.count_documents({
            "user_id": user_id, "from_jid": jid, "role": "user",
            "timestamp": {"$gte": datetime.fromtimestamp(window_start, tz.utc).isoformat()}
        })
        if recent_count >= config.rate_limit_msgs:
            return {"reply": None}

    # Save user message
    await db.messages.insert_one({"id": str(uuid.uuid4()), "user_id": user_id, "from_jid": jid, "push_name": push_name, "text": text, "role": "user", "timestamp": ts})

    # Detect booking
    booking = detect_booking(text, config.booking_types)
    if booking:
        action_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        await db.bot_actions.insert_one({
            "action_id": action_id, "user_id": user_id, "jid": jid, "push_name": push_name,
            "action_type": booking.id, "action_label": booking.name,
            "trigger_message": text, "status": "pending",
            "admin_note": None, "created_at": now, "updated_at": now,
        })
        reply = f"{booking.confirmation_message}\n\nA reference has been logged (Ref: {action_id[:8].upper()}). An agent will confirm shortly."
        await add_log(user_id, "info", f"Booking detected: {booking.name} from {push_name}")
    else:
        # Build strict AI prompt
        tone_map = {"friendly": "friendly and informal", "professional": "professional and formal", "technical": "technical and concise", "empathetic": "empathetic and supportive"}
        length_map = {"concise": "1-2 sentences", "normal": "1-3 paragraphs", "detailed": "comprehensive"}

        enriched_prompt = config.system_prompt
        if config.strict_mode:
            enriched_prompt += (
                "\n\nCRITICAL: You MUST ONLY answer based on the context provided below (business context, FAQ, and knowledge base). "
                "If you cannot answer using ONLY the provided information, respond exactly with: "
                f"\"I'm sorry, I can only assist with {config.bot_name} related enquiries. Please contact us directly for other questions.\""
                "\nDo NOT answer general knowledge questions. Do NOT make up information."
            )
        enriched_prompt += f"\n\nTone: Be {tone_map.get(config.tone, config.tone)}."
        enriched_prompt += f"\nResponse length: {length_map.get(config.response_length, config.response_length)}."
        if config.language != "auto":
            enriched_prompt += f"\nLanguage: Always respond in {config.language}."
        if config.business_context:
            enriched_prompt += f"\n\nBusiness context:\n{config.business_context}"
        if config.faq_text:
            enriched_prompt += f"\n\nFAQ:\n{config.faq_text}"

        kb_docs = await db.knowledge_docs.find({"user_id": user_id, "enabled": True}, {"_id": 0}).to_list(50)
        if kb_docs:
            kb_text = "\n\n---\n\n".join(f"[Document: {d['filename']}]\n{d['content'][:5000]}" for d in kb_docs)
            enriched_prompt += f"\n\n## Knowledge Base Documents\n{kb_text}"

        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"wa_{user_id}_{jid}", system_message=enriched_prompt).with_model(config.model_provider, config.model_name)
        try:
            reply = await chat.send_message(UserMessage(text=text))
        except Exception as e:
            await add_log(user_id, "error", f"LLM error: {str(e)}")
            reply = config.fallback_message

    reply_ts = datetime.now(timezone.utc).isoformat()
    await db.messages.insert_one({"id": str(uuid.uuid4()), "user_id": user_id, "from_jid": jid, "push_name": push_name, "text": reply, "role": "assistant", "timestamp": reply_ts})
    await db.conversations.update_one(
        {"user_id": user_id, "jid": jid},
        {"$set": {"user_id": user_id, "jid": jid, "push_name": push_name, "last_message": text, "last_timestamp": ts}, "$inc": {"message_count": 1}},
        upsert=True,
    )
    await add_log(user_id, "info", f"Replied to {push_name}: {reply[:60]}")
    return {"reply": reply}

@api_router.post("/wa/send")
async def send_message(req: SendMessageRequest, user: User = Depends(get_current_user)):
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            resp = await c.post(f"{BAILEYS_URL}/send", json={"user_id": user.user_id, "to": req.jid, "message": req.message})
            return resp.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─── CONVERSATIONS ─────────────────────────────────────────

@api_router.get("/conversations", response_model=List[ConversationModel])
async def get_conversations(user: User = Depends(get_current_user)):
    convs = await db.conversations.find({"user_id": user.user_id}, {"_id": 0}).sort("last_timestamp", -1).to_list(100)
    return [ConversationModel(id=c["jid"], jid=c["jid"], push_name=c.get("push_name", c["jid"].split("@")[0]), last_message=c.get("last_message", ""), last_timestamp=c.get("last_timestamp", ""), message_count=c.get("message_count", 0)) for c in convs]

@api_router.get("/messages/{jid}")
async def get_messages(jid: str, user: User = Depends(get_current_user)):
    decoded_jid = jid.replace("%40", "@")
    msgs = await db.messages.find({"user_id": user.user_id, "from_jid": decoded_jid}, {"_id": 0}).sort("timestamp", 1).to_list(500)
    return msgs

# ─── TAKEOVER ─────────────────────────────────────────────

@api_router.post("/conversations/{jid_encoded}/takeover")
async def set_takeover(jid_encoded: str, req: TakeoverRequest, user: User = Depends(get_current_user)):
    jid = jid_encoded.replace("%40", "@")
    await db.conversations.update_one(
        {"user_id": user.user_id, "jid": jid},
        {"$set": {"taken_over": req.active, "takeover_by": user.email if req.active else None}},
        upsert=True,
    )
    action = "taken over" if req.active else "released"
    await add_log(user.user_id, "info", f"Conversation {jid.split('@')[0]} {action} by {user.name}")
    return {"ok": True, "taken_over": req.active}

@api_router.get("/conversations/{jid_encoded}/takeover")
async def get_takeover(jid_encoded: str, user: User = Depends(get_current_user)):
    jid = jid_encoded.replace("%40", "@")
    conv = await db.conversations.find_one({"user_id": user.user_id, "jid": jid}, {"_id": 0})
    if not conv:
        return {"taken_over": False, "takeover_by": None}
    return {"taken_over": conv.get("taken_over", False), "takeover_by": conv.get("takeover_by")}

# ─── WORKFLOW ─────────────────────────────────────────────

@api_router.get("/workflow")
async def get_workflow(user: User = Depends(get_current_user)):
    doc = await db.workflows.find_one({"user_id": user.user_id}, {"_id": 0})
    if doc:
        doc.pop("user_id", None)
        return doc
    return WorkflowData().model_dump()

@api_router.post("/workflow")
async def save_workflow(data: WorkflowData, user: User = Depends(get_current_user)):
    data.updated_at = datetime.now(timezone.utc).isoformat()
    doc = {**data.model_dump(), "user_id": user.user_id}
    await db.workflows.replace_one({"user_id": user.user_id}, doc, upsert=True)
    await add_log(user.user_id, "info", f"Workflow saved ({len(data.nodes)} nodes)")
    return {"ok": True}



@api_router.get("/actions")
async def get_actions(status: Optional[str] = None, user: User = Depends(get_current_user)):
    query = {"user_id": user.user_id}
    if status:
        query["status"] = status
    actions = await db.bot_actions.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return actions

@api_router.patch("/actions/{action_id}")
async def update_action(action_id: str, req: ActionUpdateRequest, user: User = Depends(get_current_user)):
    action = await db.bot_actions.find_one({"action_id": action_id, "user_id": user.user_id}, {"_id": 0})
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    now = datetime.now(timezone.utc).isoformat()
    await db.bot_actions.update_one({"action_id": action_id}, {"$set": {"status": req.status, "admin_note": req.admin_note, "updated_at": now}})
    # If approved, send confirmation to WhatsApp
    if req.status == "approved":
        config = await get_bot_config(user.user_id)
        bt = next((b for b in config.booking_types if b.id == action["action_type"]), None)
        confirm_msg = (bt.confirmation_message if bt else "Your request has been confirmed by our team.") + (f"\n\nNote: {req.admin_note}" if req.admin_note else "")
        try:
            async with httpx.AsyncClient(timeout=10.0) as c:
                await c.post(f"{BAILEYS_URL}/send", json={"user_id": user.user_id, "to": action["jid"], "message": confirm_msg})
        except Exception:
            pass
        await add_log(user.user_id, "info", f"Action {action_id[:8]} approved, confirmation sent to {action['push_name']}")
    elif req.status == "rejected":
        reject_msg = f"We're sorry, we are unable to process your request at this time." + (f" {req.admin_note}" if req.admin_note else "")
        try:
            async with httpx.AsyncClient(timeout=10.0) as c:
                await c.post(f"{BAILEYS_URL}/send", json={"user_id": user.user_id, "to": action["jid"], "message": reject_msg})
        except Exception:
            pass
        await add_log(user.user_id, "info", f"Action {action_id[:8]} rejected")
    return {"ok": True, "status": req.status}

# ─── CONFIG ───────────────────────────────────────────────

@api_router.get("/config")
async def get_config(user: User = Depends(get_current_user)):
    return await get_bot_config(user.user_id)

@api_router.post("/config")
async def save_config(config: BotConfig, user: User = Depends(get_current_user)):
    config.updated_at = datetime.now(timezone.utc).isoformat()
    doc = {**config.model_dump(), "user_id": user.user_id}
    await db.bot_config.replace_one({"user_id": user.user_id}, doc, upsert=True)
    await add_log(user.user_id, "info", "Bot configuration updated")
    return {"ok": True}

# ─── KNOWLEDGE BASE ───────────────────────────────────────

def extract_text_from_pdf(data: bytes) -> str:
    parts = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                parts.append(t)
    return "\n\n".join(parts)

def extract_text_from_docx(data: bytes) -> str:
    doc = python_docx.Document(io.BytesIO(data))
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())

def extract_text_from_txt(data: bytes) -> str:
    for enc in ("utf-8", "latin-1", "cp1252"):
        try:
            return data.decode(enc)
        except Exception:
            continue
    return data.decode("utf-8", errors="replace")

@api_router.post("/knowledge/upload")
async def upload_knowledge_doc(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ("pdf", "docx", "txt", "md"):
        raise HTTPException(status_code=400, detail=f"Unsupported file type: .{ext}")
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max 10 MB.")
    try:
        content = extract_text_from_pdf(data) if ext == "pdf" else extract_text_from_docx(data) if ext == "docx" else extract_text_from_txt(data)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to extract text: {e}")
    if not content.strip():
        raise HTTPException(status_code=422, detail="No readable text found.")
    doc_id = str(uuid.uuid4())
    doc = {"id": doc_id, "user_id": user.user_id, "filename": file.filename, "file_type": ext, "size_bytes": len(data), "char_count": len(content), "content": content, "enabled": True, "uploaded_at": datetime.now(timezone.utc).isoformat()}
    await db.knowledge_docs.insert_one(doc)
    await add_log(user.user_id, "info", f"Knowledge doc uploaded: {file.filename}")
    return {"id": doc_id, "filename": file.filename, "file_type": ext, "size_bytes": len(data), "char_count": len(content), "enabled": True, "uploaded_at": doc["uploaded_at"]}

@api_router.get("/knowledge", response_model=List[KnowledgeDoc])
async def list_knowledge_docs(user: User = Depends(get_current_user)):
    docs = await db.knowledge_docs.find({"user_id": user.user_id}, {"_id": 0, "content": 0}).sort("uploaded_at", -1).to_list(100)
    return docs

@api_router.patch("/knowledge/{doc_id}/toggle")
async def toggle_knowledge_doc(doc_id: str, user: User = Depends(get_current_user)):
    doc = await db.knowledge_docs.find_one({"id": doc_id, "user_id": user.user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    new_state = not doc.get("enabled", True)
    await db.knowledge_docs.update_one({"id": doc_id}, {"$set": {"enabled": new_state}})
    return {"id": doc_id, "enabled": new_state}

@api_router.delete("/knowledge/{doc_id}")
async def delete_knowledge_doc(doc_id: str, user: User = Depends(get_current_user)):
    result = await db.knowledge_docs.delete_one({"id": doc_id, "user_id": user.user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}

@api_router.get("/knowledge/{doc_id}/preview")
async def preview_knowledge_doc(doc_id: str, user: User = Depends(get_current_user)):
    doc = await db.knowledge_docs.find_one({"id": doc_id, "user_id": user.user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return {"id": doc_id, "filename": doc["filename"], "preview": doc.get("content", "")[:3000]}

# ─── LOGS ─────────────────────────────────────────────────

@api_router.get("/logs")
async def get_logs(limit: int = 100, user: User = Depends(get_current_user)):
    backend_logs = await db.logs.find({"user_id": user.user_id}, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    baileys_logs = []
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            resp = await c.get(f"{BAILEYS_URL}/logs", params={"user_id": user.user_id})
            baileys_logs = resp.json().get("logs", [])
    except Exception:
        pass
    all_logs = backend_logs + baileys_logs
    all_logs.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return all_logs[:limit]

@api_router.delete("/logs")
async def clear_logs(user: User = Depends(get_current_user)):
    await db.logs.delete_many({"user_id": user.user_id})
    return {"ok": True}

# ─── STATS ────────────────────────────────────────────────

@api_router.get("/stats")
async def get_stats(user: User = Depends(get_current_user)):
    total_convs = await db.conversations.count_documents({"user_id": user.user_id})
    total_msgs = await db.messages.count_documents({"user_id": user.user_id})
    user_msgs = await db.messages.count_documents({"user_id": user.user_id, "role": "user"})
    bot_msgs = await db.messages.count_documents({"user_id": user.user_id, "role": "assistant"})
    pending_actions = await db.bot_actions.count_documents({"user_id": user.user_id, "status": "pending"})
    return {"total_conversations": total_convs, "total_messages": total_msgs, "user_messages": user_msgs, "bot_messages": bot_msgs, "pending_actions": pending_actions}

# ─── GMAIL / SHEETS INTEGRATION ───────────────────────────

GMAIL_SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
]

async def get_google_creds_for_user(user_id: str):
    token_doc = await db.google_tokens.find_one({"user_id": user_id}, {"_id": 0})
    if not token_doc:
        raise HTTPException(status_code=400, detail="Gmail not connected. Please connect Gmail first in Integrations.")
    creds = Credentials(
        token=token_doc.get("access_token"),
        refresh_token=token_doc.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=token_doc.get("client_id"),
        client_secret=token_doc.get("client_secret"),
        scopes=GMAIL_SCOPES,
    )
    expires_at = token_doc.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if not expires_at or expires_at < datetime.now(timezone.utc):
        creds.refresh(GoogleRequest())
        await db.google_tokens.update_one({"user_id": user_id}, {"$set": {"access_token": creds.token, "expires_at": datetime.now(timezone.utc).isoformat()}})
    return creds

@api_router.get("/integrations/gmail/status")
async def gmail_status(user: User = Depends(get_current_user)):
    doc = await db.google_tokens.find_one({"user_id": user.user_id}, {"_id": 0})
    if doc and doc.get("access_token"):
        return {"connected": True, "email": doc.get("gmail_email", user.email)}
    return {"connected": False}

@api_router.post("/integrations/gmail/connect")
async def gmail_connect_start(req: GmailCredentials, user: User = Depends(get_current_user)):
    await db.google_tokens.update_one(
        {"user_id": user.user_id},
        {"$set": {"user_id": user.user_id, "client_id": req.client_id, "client_secret": req.client_secret}},
        upsert=True,
    )
    backend_url = os.environ.get("REACT_APP_BACKEND_URL", "")
    if not backend_url:
        import httpx as _httpx
    redirect_uri = f"{backend_url}/api/integrations/gmail/callback"
    flow = Flow.from_client_config(
        {"web": {"client_id": req.client_id, "client_secret": req.client_secret, "auth_uri": "https://accounts.google.com/o/oauth2/auth", "token_uri": "https://oauth2.googleapis.com/token"}},
        scopes=GMAIL_SCOPES,
        redirect_uri=redirect_uri,
    )
    url, state = flow.authorization_url(access_type="offline", prompt="consent", state=user.user_id)
    return {"auth_url": url}

@api_router.get("/integrations/gmail/callback")
async def gmail_callback(code: str, state: str):
    user_id = state
    doc = await db.google_tokens.find_one({"user_id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=400, detail="No credentials found")
    backend_url = os.environ.get("REACT_APP_BACKEND_URL", "")
    redirect_uri = f"{backend_url}/api/integrations/gmail/callback"
    flow = Flow.from_client_config(
        {"web": {"client_id": doc["client_id"], "client_secret": doc["client_secret"], "auth_uri": "https://accounts.google.com/o/oauth2/auth", "token_uri": "https://oauth2.googleapis.com/token"}},
        scopes=GMAIL_SCOPES,
        redirect_uri=redirect_uri,
    )
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        flow.fetch_token(code=code)
    creds = flow.credentials
    service = build("oauth2", "v2", credentials=creds)
    info = service.userinfo().get().execute()
    await db.google_tokens.update_one(
        {"user_id": user_id},
        {"$set": {"access_token": creds.token, "refresh_token": creds.refresh_token, "expires_at": creds.expiry.isoformat() if creds.expiry else None, "gmail_email": info.get("email", "")}},
    )
    return RedirectResponse(url="/#integrations?connected=true")

@api_router.post("/integrations/gmail/disconnect")
async def gmail_disconnect(user: User = Depends(get_current_user)):
    await db.google_tokens.delete_one({"user_id": user.user_id})
    return {"ok": True}

@api_router.post("/integrations/gmail/send")
async def send_gmail(req: SendEmailRequest, user: User = Depends(get_current_user)):
    creds = await get_google_creds_for_user(user.user_id)
    service = build("gmail", "v1", credentials=creds)
    message = email_lib.mime.text.MIMEText(req.body)
    message["to"] = req.to
    message["subject"] = req.subject
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
    service.users().messages().send(userId="me", body={"raw": raw}).execute()
    await add_log(user.user_id, "info", f"Email sent to {req.to}: {req.subject}")
    return {"ok": True}

@api_router.post("/integrations/sheets/create")
async def create_sheet(req: CreateSheetRequest, user: User = Depends(get_current_user)):
    creds = await get_google_creds_for_user(user.user_id)
    service = build("sheets", "v4", credentials=creds)
    spreadsheet = service.spreadsheets().create(body={"properties": {"title": req.title}}).execute()
    sheet_id = spreadsheet["spreadsheetId"]
    sheet_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}"
    await db.user_sheets.insert_one({"user_id": user.user_id, "spreadsheet_id": sheet_id, "title": req.title, "mode": req.mode, "url": sheet_url, "created_at": datetime.now(timezone.utc).isoformat()})
    await add_log(user.user_id, "info", f"Spreadsheet created: {req.title}")
    return {"spreadsheet_id": sheet_id, "title": req.title, "url": sheet_url, "mode": req.mode}

@api_router.get("/integrations/sheets")
async def list_sheets(user: User = Depends(get_current_user)):
    sheets = await db.user_sheets.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return sheets

@api_router.delete("/integrations/sheets/{sheet_id}")
async def delete_sheet_record(sheet_id: str, user: User = Depends(get_current_user)):
    await db.user_sheets.delete_one({"user_id": user.user_id, "spreadsheet_id": sheet_id})
    return {"ok": True}

@api_router.post("/integrations/sheets/append")
async def append_to_sheet(req: AppendSheetRequest, user: User = Depends(get_current_user)):
    creds = await get_google_creds_for_user(user.user_id)
    service = build("sheets", "v4", credentials=creds)
    service.spreadsheets().values().append(
        spreadsheetId=req.spreadsheet_id,
        range=req.sheet_name,
        valueInputOption="USER_ENTERED",
        body={"values": req.values},
    ).execute()
    return {"ok": True}

@api_router.post("/integrations/sheets/read")
async def read_sheet(req: ReadSheetRequest, user: User = Depends(get_current_user)):
    creds = await get_google_creds_for_user(user.user_id)
    service = build("sheets", "v4", credentials=creds)
    result = service.spreadsheets().values().get(spreadsheetId=req.spreadsheet_id, range=req.range).execute()
    return {"values": result.get("values", [])}

# ─── ROOT ─────────────────────────────────────────────────

@api_router.get("/")
async def root():
    return {"message": "WhatsApp 365 Bot API"}

app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
