"""
Raven Sharp Image Optimiser — FastAPI Backend
Browser-side image processing + subscription billing
Part of Ascension Digital Group
"""
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pymongo import AsyncMongoClient as AsyncIOMotorClient
import os, uuid, logging, stripe
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
import bcrypt as bcrypt_mod
import jwt as pyjwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# --- Config -----------------------------------------------------------------
MONGO_URL     = os.environ["MONGO_URL"]
DB_NAME       = os.environ["DB_NAME"]
JWT_SECRET    = os.environ.get("JWT_SECRET", "changeme")
STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
OWNER_EMAIL   = os.environ.get("OWNER_EMAIL", "ascensiondigitalagency@outlook.com")
FRONTEND_URL  = os.environ.get("FRONTEND_URL", "http://localhost:3000")

stripe.api_key = STRIPE_API_KEY

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Raven Sharp Optimiser API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("ravensharp-optimiser")

# --- Tiers ------------------------------------------------------------------
TIER_LIMITS = {
    "free":     {"optimisations": 10,  "upscales": 0,   "batch_size": 1},
    "standard": {"optimisations": 200, "upscales": 20,  "batch_size": 10},
    "pro":      {"optimisations": 999, "upscales": 100, "batch_size": 50},
    "owner":    {"optimisations": 9999,"upscales": 9999,"batch_size": 50},
}

TIER_PRICES = {
    "standard": {"amount": 10.0, "name": "Standard", "monthly": "price_1TcNqD2NTuOJBly9dc9NHw6g", "annual": "price_1TcNqE2NTuOJBly9oPBiJwrC"},
    "pro":      {"amount": 15.0, "name": "Pro",      "monthly": "price_1TcNqF2NTuOJBly9BS0quG9s", "annual": "price_1TcNqG2NTuOJBly9iK5QGn2j"},
}

# --- Auth helpers -----------------------------------------------------------
JWT_ALGO = "HS256"

def make_token(user_id: str, email: str) -> str:
    payload = {"user_id": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(days=30)}
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

async def require_user(request: Request) -> dict:
    token = request.cookies.get("token") or request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        data = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = await db.users.find_one({"user_id": data["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def month_key():
    now = datetime.now(timezone.utc)
    return f"{now.year}-{now.month:02d}"

async def check_and_increment(user_id: str, tier: str, metric: str) -> dict:
    if tier in ("owner",):
        return {"ok": True, "limit": 9999, "used": 0}
    limit = TIER_LIMITS.get(tier, TIER_LIMITS["free"]).get(metric, 0)
    mk = month_key()
    doc = await db.usage.find_one({"user_id": user_id, "month": mk}) or {}
    used = doc.get(metric, 0)
    if used >= limit:
        return {"ok": False, "limit": limit, "used": used}
    await db.usage.update_one({"user_id": user_id, "month": mk}, {"$inc": {metric: 1}}, upsert=True)
    return {"ok": True, "limit": limit, "used": used + 1}

# --- Pydantic models --------------------------------------------------------
class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str

class LoginRequest(BaseModel):
    email: str
    password: str

class JobIn(BaseModel):
    name: str
    original_size: Optional[int] = 0
    output_size: Optional[int] = 0
    width: Optional[int] = 0
    height: Optional[int] = 0
    dpi: Optional[int] = 300
    format: Optional[str] = "png"
    settings: Optional[Dict[str, Any]] = {}

class CheckoutRequest(BaseModel):
    tier: str
    billing: str = "monthly"
    origin_url: str

# --- Auth endpoints ---------------------------------------------------------
@api.post("/auth/register")
async def register(body: RegisterRequest, response: Response):
    existing = await db.users.find_one({"email": body.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed = bcrypt_mod.hashpw(body.password.encode(), bcrypt_mod.gensalt()).decode()
    user_id = f"usr_{uuid.uuid4().hex[:12]}"
    tier = "owner" if body.email == OWNER_EMAIL else "free"
    user = {
        "user_id": user_id, "email": body.email, "name": body.name,
        "password_hash": hashed, "tier": tier,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    token = make_token(user_id, body.email)
    response.set_cookie("token", token, httponly=True, max_age=86400*30, samesite="lax")
    return {"user_id": user_id, "email": body.email, "name": body.name, "tier": tier, "token": token}

@api.post("/auth/login")
async def login(body: LoginRequest, response: Response):
    user = await db.users.find_one({"email": body.email}, {"_id": 0})
    if not user or not bcrypt_mod.checkpw(body.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = make_token(user["user_id"], body.email)
    response.set_cookie("token", token, httponly=True, max_age=86400*30, samesite="lax")
    return {"user_id": user["user_id"], "email": user["email"], "name": user["name"], "tier": user.get("tier","free"), "token": token}

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("token")
    return {"ok": True}

@api.get("/auth/me")
async def me(request: Request):
    user = await require_user(request)
    return {k: v for k, v in user.items() if k != "password_hash"}

# --- Usage ------------------------------------------------------------------
@api.get("/usage")
async def get_usage(request: Request):
    user = await require_user(request)
    doc = await db.usage.find_one({"user_id": user["user_id"], "month": month_key()}) or {}
    tier = user.get("tier", "free")
    limits = TIER_LIMITS.get(tier, TIER_LIMITS["free"])
    return {"usage": {k: doc.get(k, 0) for k in limits}, "limits": limits, "tier": tier}

@api.post("/usage/optimise")
async def track_optimise(request: Request):
    user = await require_user(request)
    check = await check_and_increment(user["user_id"], user.get("tier","free"), "optimisations")
    if not check["ok"]:
        raise HTTPException(status_code=402, detail=f"Monthly optimisation limit ({check['limit']}) reached. Upgrade your plan.")
    return check

@api.post("/usage/upscale")
async def track_upscale(request: Request):
    user = await require_user(request)
    check = await check_and_increment(user["user_id"], user.get("tier","free"), "upscales")
    if not check["ok"]:
        raise HTTPException(status_code=402, detail=f"Monthly upscale limit ({check['limit']}) reached. Upgrade your plan.")
    return check

# --- Jobs -------------------------------------------------------------------
@api.post("/jobs")
async def create_job(body: JobIn, request: Request):
    user = await require_user(request)
    job = {
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "name": body.name,
        "original_size": body.original_size,
        "output_size": body.output_size,
        "width": body.width,
        "height": body.height,
        "dpi": body.dpi,
        "format": body.format,
        "settings": body.settings,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.jobs.insert_one(job)
    job.pop("_id", None)
    return job

@api.get("/jobs")
async def list_jobs(request: Request):
    user = await require_user(request)
    cursor = db.jobs.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).limit(200)
    return [j async for j in cursor]

@api.delete("/jobs/{job_id}")
async def delete_job(job_id: str, request: Request):
    user = await require_user(request)
    result = await db.jobs.delete_one({"id": job_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"ok": True}

# --- Stripe billing ---------------------------------------------------------
@api.post("/billing/checkout")
async def billing_checkout(body: CheckoutRequest, request: Request):
    user = await require_user(request)
    tier_data = TIER_PRICES.get(body.tier)
    if not tier_data:
        raise HTTPException(status_code=400, detail="Invalid tier")
    price_id = tier_data.get(body.billing)
    if not price_id:
        raise HTTPException(status_code=400, detail="Invalid billing period")
    origin = body.origin_url.rstrip("/")
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{origin}/account?session_id={{CHECKOUT_SESSION_ID}}&tier={body.tier}",
            cancel_url=f"{origin}/pricing?cancelled=1",
            customer_email=user["email"],
            metadata={"user_id": user["user_id"], "tier": body.tier},
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Stripe error: {e}")
    await db.payment_transactions.insert_one({
        "session_id": session.id, "user_id": user["user_id"],
        "tier": body.tier, "amount": tier_data["amount"],
        "payment_status": "initiated",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"url": session.url, "session_id": session.id}

@api.get("/billing/status/{session_id}")
async def billing_status(session_id: str, request: Request):
    await require_user(request)
    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if session.payment_status == "paid" and tx and tx.get("payment_status") != "paid":
        await db.payment_transactions.update_one({"session_id": session_id}, {"$set": {"payment_status": "paid"}})
        await db.users.update_one({"user_id": tx["user_id"]}, {"$set": {"tier": tx.get("tier","free")}})
    return {"status": session.status, "payment_status": session.payment_status}

@api.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    try:
        ev = stripe.Webhook.construct_event(body, sig, STRIPE_WEBHOOK_SECRET)
    except Exception:
        return JSONResponse({"received": False}, status_code=400)
    if ev["type"] == "checkout.session.completed":
        s = ev["data"]["object"]
        if s.get("payment_status") == "paid":
            meta = s.get("metadata", {})
            user_id = meta.get("user_id")
            tier = meta.get("tier", "free")
            if user_id:
                await db.users.update_one({"user_id": user_id}, {"$set": {"tier": tier}})
    return {"received": True}

# --- Health -----------------------------------------------------------------
@app.get("/health")
async def health():
    return {"status": "ok", "service": "raven-sharp-optimiser"}

app.add_middleware(CORSMiddleware, 
    allow_origins=[
        "https://opt.raven-sharp.com",
        "https://raven-sharp-image-optimiser-and-upscaler.pages.dev",
        "http://localhost:3000",
        "http://localhost:3001",
    ], 
    allow_credentials=True, 
    allow_methods=["*"], 
    allow_headers=["*"]
)
app.include_router(api)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8001, reload=True)
