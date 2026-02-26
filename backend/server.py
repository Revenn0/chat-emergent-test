from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

BAILEYS_URL = os.environ.get('BAILEYS_URL', 'http://localhost:3001')
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ---- Pydantic Models ----

class BotConfig(BaseModel):
    system_prompt: str = "Você é um assistente virtual prestativo e amigável. Responda em português de forma clara e concisa."
    model_provider: str = "openai"
    model_name: str = "gpt-4o"
    bot_name: str = "AI Bot"
    updated_at: Optional[str] = None

class MessageModel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    from_jid: str
    push_name: str
    text: str
    role: str  # "user" | "assistant"
    timestamp: str

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

    class Config:
        populate_by_name = True

class WAEvent(BaseModel):
    event: str
    data: Optional[Dict] = None

class LogEntry(BaseModel):
    level: str
    message: str
    timestamp: str

class SendMessageRequest(BaseModel):
    jid: str
    message: str

# ---- Helpers ----

async def get_bot_config() -> BotConfig:
    doc = await db.bot_config.find_one({}, {"_id": 0})
    if doc:
        return BotConfig(**doc)
    return BotConfig()

async def get_or_create_llm_chat(session_id: str, config: BotConfig) -> LlmChat:
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=config.system_prompt,
    ).with_model(config.model_provider, config.model_name)
    return chat

async def add_log(level: str, message: str):
    entry = {
        "level": level,
        "message": message,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await db.logs.insert_one(entry)
    logger.info(f"[{level.upper()}] {message}")

# ---- Routes ----

@api_router.get("/wa/status")
async def get_wa_status():
    """Proxy to Baileys status"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client_http:
            resp = await client_http.get(f"{BAILEYS_URL}/status")
            return resp.json()
    except Exception as e:
        return {"status": "disconnected", "connected": False, "jid": None, "error": str(e)}

@api_router.get("/wa/qr")
async def get_qr():
    """Get QR code from Baileys"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client_http:
            resp = await client_http.get(f"{BAILEYS_URL}/qr")
            return resp.json()
    except Exception as e:
        return {"qr": None, "status": "disconnected", "error": str(e)}

@api_router.post("/wa/disconnect")
async def disconnect_wa():
    try:
        async with httpx.AsyncClient(timeout=10.0) as client_http:
            resp = await client_http.post(f"{BAILEYS_URL}/disconnect")
            await add_log("info", "WhatsApp disconnected by user")
            return resp.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/wa/reconnect")
async def reconnect_wa():
    try:
        async with httpx.AsyncClient(timeout=10.0) as client_http:
            resp = await client_http.post(f"{BAILEYS_URL}/reconnect")
            await add_log("info", "WhatsApp reconnect requested")
            return resp.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/wa/event")
async def handle_wa_event(event: WAEvent):
    """Receive events from Baileys service"""
    await add_log("info", f"WA Event: {event.event} — {event.data}")
    return {"ok": True}

@api_router.post("/wa/message")
async def handle_incoming_message(msg: IncomingMessage):
    """Handle incoming WhatsApp message, generate AI reply"""
    jid = msg.from_
    push_name = msg.pushName or jid.split("@")[0]
    text = msg.text
    ts = datetime.now(timezone.utc).isoformat()

    await add_log("info", f"Message from {push_name}: {text[:60]}")

    # Save user message
    user_msg = {
        "id": str(uuid.uuid4()),
        "from_jid": jid,
        "push_name": push_name,
        "text": text,
        "role": "user",
        "timestamp": ts,
    }
    await db.messages.insert_one({**user_msg})

    # Get bot config
    config = await get_bot_config()

    # Build chat history for LLM (last 20 messages)
    history = await db.messages.find(
        {"from_jid": jid}, {"_id": 0}
    ).sort("timestamp", -1).limit(20).to_list(20)
    history.reverse()

    # Create LLM chat with history
    chat = await get_or_create_llm_chat(f"wa_{jid}", config)

    # Rebuild history in LLM session
    # Since emergentintegrations manages history by session_id, we just send current message
    user_message = UserMessage(text=text)
    try:
        reply = await chat.send_message(user_message)
    except Exception as e:
        await add_log("error", f"LLM error: {str(e)}")
        reply = "Desculpe, ocorreu um erro ao processar sua mensagem."

    reply_ts = datetime.now(timezone.utc).isoformat()

    # Save assistant message
    bot_msg = {
        "id": str(uuid.uuid4()),
        "from_jid": jid,
        "push_name": push_name,
        "text": reply,
        "role": "assistant",
        "timestamp": reply_ts,
    }
    await db.messages.insert_one({**bot_msg})

    # Update conversation
    await db.conversations.update_one(
        {"jid": jid},
        {
            "$set": {
                "jid": jid,
                "push_name": push_name,
                "last_message": text,
                "last_timestamp": ts,
            },
            "$inc": {"message_count": 1},
        },
        upsert=True,
    )

    await add_log("info", f"Replied to {push_name}: {reply[:60]}")
    return {"reply": reply}

@api_router.get("/conversations", response_model=List[ConversationModel])
async def get_conversations():
    convs = await db.conversations.find({}, {"_id": 0}).sort("last_timestamp", -1).to_list(100)
    result = []
    for c in convs:
        result.append(ConversationModel(
            id=str(c.get("_id", c.get("jid", ""))),
            jid=c["jid"],
            push_name=c.get("push_name", c["jid"].split("@")[0]),
            last_message=c.get("last_message", ""),
            last_timestamp=c.get("last_timestamp", ""),
            message_count=c.get("message_count", 0),
        ))
    return result

@api_router.get("/messages/{jid}")
async def get_messages(jid: str):
    # URL-decode the jid
    decoded_jid = jid.replace("%40", "@").replace("%3A", ":")
    msgs = await db.messages.find(
        {"from_jid": decoded_jid}, {"_id": 0}
    ).sort("timestamp", 1).to_list(500)
    return msgs

@api_router.post("/wa/send")
async def send_message(req: SendMessageRequest):
    try:
        async with httpx.AsyncClient(timeout=10.0) as client_http:
            resp = await client_http.post(
                f"{BAILEYS_URL}/send",
                json={"to": req.jid, "message": req.message}
            )
            return resp.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/config", response_model=BotConfig)
async def get_config():
    return await get_bot_config()

@api_router.post("/config")
async def save_config(config: BotConfig):
    config.updated_at = datetime.now(timezone.utc).isoformat()
    doc = config.model_dump()
    await db.bot_config.replace_one({}, doc, upsert=True)
    await add_log("info", "Bot configuration updated")
    return {"ok": True}

@api_router.get("/logs")
async def get_logs(limit: int = 100):
    # Combine backend logs + baileys logs
    backend_logs = await db.logs.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)

    baileys_logs = []
    try:
        async with httpx.AsyncClient(timeout=5.0) as client_http:
            resp = await client_http.get(f"{BAILEYS_URL}/logs")
            baileys_logs = resp.json().get("logs", [])
    except Exception:
        pass

    all_logs = backend_logs + baileys_logs
    all_logs.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return all_logs[:limit]

@api_router.get("/stats")
async def get_stats():
    total_convs = await db.conversations.count_documents({})
    total_msgs = await db.messages.count_documents({})
    user_msgs = await db.messages.count_documents({"role": "user"})
    bot_msgs = await db.messages.count_documents({"role": "assistant"})
    return {
        "total_conversations": total_convs,
        "total_messages": total_msgs,
        "user_messages": user_msgs,
        "bot_messages": bot_msgs,
    }

@api_router.get("/")
async def root():
    return {"message": "WhatsApp AI Bot Backend"}

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
