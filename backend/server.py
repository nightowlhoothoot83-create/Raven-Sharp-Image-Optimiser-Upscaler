"""
Raven Sharp Image Optimiser — FastAPI Backend
True AI upscaling via Replicate Real-ESRGAN + subscription billing
Part of Ascension Digital Group
"""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os, uuid, json, logging, asyncio
import bcrypt, jwt, httpx
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from pymongo import AsyncMongoClient as AsyncIOMotorClient
from pydantic import BaseModel, Field

# ── Config ──────────────────────────────────────────────────────────────────
MONGO_URL     = os.environ["MONGO_URL"]
DB_NAME       = os.environ["DB_NAME"]
JWT_SECRET    = os.environ["JWT_SECRET"]
REPLICATE_KEY = os.environ.get("REPLICATE_API_KEY", "")
STRIPE_KEY    = os.environ.get("STRIPE_API_KEY", "")
OWNER_EMAIL   = os.environ.get("OWNER_EMAIL", "ascensiondigitalagency@outlook.com")
FRONTEND_URL  = os.environ.get("FRONTEND_URL", "http://localhost:3000")
CORS_ORIGINS  = [
    origin.strip()
    for origin in os.environ.get(
        "CORS_ORIGINS",
        ",".join([
            FRONTEND_URL,
            "https://opt.raven-sharp.com",
            "https://raven-sharp-image-optimiser-and-upscaler.pages.dev",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]),
    ).split(",")
    if origin.strip()
]

client = AsyncIOMotorClient(MONGO_URL)
db     = client[DB_NAME]

app = FastAPI(title="Raven Sharp Optimiser API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("ravensharp-optimiser")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=r"https://.*\.raven-sharp\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Tier config ──────────────────────────────────────────────────────────────
TIERS = {
    "free":     {"images_per_month": 5,    "batch_size": 1,  "upscale": True,  "watermark": True,  "price": 0},
    "standard": {"images_per_month": 100,  "batch_size": 10, "upscale": True,  "watermark": False, "price": 10},
    "pro":      {"images_per_month": 3000, "batch_size": 50, "upscale": True,  "watermark": False, "price": 15},
    "owner":    {"images_per_month": 99999,"batch_size": 99999,"upscale": True, "watermark": False, "price": 0},
}

STRIPE_PRICES = {
    "standard": {"monthly": "price_1TcNqD2NTuOJBly9dc9NHw6g", "annual": "price_1TcNqE2NTuOJBly9oPBiJwrC"},
    "pro":      {"monthly": "price_1TcNqF2NTuOJBly9BS0quG9s", "annual": "price_1TcNqG2NTuOJBly9iK5QGn2j"},
}

# ── Auth helpers ─────────────────────────────────────────────────────────────
def hash_pw(pw): return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
def verify_pw(pw, h):
    if isinstance(h, str):
        h = h.encode('utf-8')
    return bcrypt.checkpw(pw.encode('utf-8'), h)

def make_access(uid, email):
    return jwt.encode({"sub": uid, "email": email, "type": "access",
                       "exp": datetime.now(timezone.utc) + timedelta(days=1)},
                      JWT_SECRET, algorithm="HS256")

def make_refresh(uid):
    return jwt.encode({"sub": uid, "type": "refresh",
                       "exp": datetime.now(timezone.utc) + timedelta(days=7)},
                      JWT_SECRET, algorithm="HS256")

def set_cookies(response, access, refresh):
    kw = dict(httponly=True, secure=True, samesite="none", path="/")
    response.set_cookie("access_token",  access,  max_age=86400,  **kw)
    response.set_cookie("refresh_token", refresh, max_age=604800, **kw)

async def get_user(request: Request):
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "): token = auth[7:]
    if not token: raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user: raise HTTPException(401, "User not found")
        return user
    except jwt.ExpiredSignatureError: raise HTTPException(401, "Token expired")
    except Exception: raise HTTPException(401, "Invalid token")

# ── Models ───────────────────────────────────────────────────────────────────
class RegisterIn(BaseModel):
    email: str; password: str; name: Optional[str] = None

class LoginIn(BaseModel):
    email: str; password: str

class JobIn(BaseModel):
    name: str
    original_size: int
    output_size: int
    width: int; height: int; dpi: int; format: str
    settings: Dict[str, Any] = Field(default_factory=dict)
    used_ai_upscale: bool = False

class UpscaleIn(BaseModel):
    image_base64: str
    mime: str = "image/jpeg"
    scale: int = 4

class StripeCheckoutIn(BaseModel):
    tier: str; billing: str = "monthly"

# ── Auth routes ──────────────────────────────────────────────────────────────
@api.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")
    tier = "owner" if email == OWNER_EMAIL.lower() else "free"
    user = {"id": str(uuid.uuid4()), "email": email,
            "name": payload.name or email.split("@")[0],
            "password_hash": hash_pw(payload.password),
            "tier": tier, "images_used": 0,
            "created_at": datetime.now(timezone.utc).isoformat()}
    await db.users.insert_one(user)
    access = make_access(user["id"], email)
    refresh = make_refresh(user["id"])
    set_cookies(response, access, refresh)
    return {"id": user["id"], "email": email, "name": user["name"],
            "tier": tier, "images_used": 0, "created_at": user["created_at"]}

@api.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_pw(payload.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    access = make_access(user["id"], email)
    refresh = make_refresh(user["id"])
    set_cookies(response, access, refresh)
    return {"id": user["id"], "email": email, "name": user.get("name"),
            "tier": user.get("tier","free"), "images_used": user.get("images_used",0),
            "created_at": user["created_at"]}

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}

@api.get("/auth/me")
async def me(user: dict = Depends(get_user)):
    return {"id": user["id"], "email": user["email"], "name": user.get("name"),
            "tier": user.get("tier","free"), "images_used": user.get("images_used",0),
            "created_at": user["created_at"]}

@api.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token: raise HTTPException(401, "No refresh token")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user = await db.users.find_one({"id": payload["sub"]})
        if not user: raise HTTPException(401, "User not found")
        access = make_access(user["id"], user["email"])
        refresh = make_refresh(user["id"])
        set_cookies(response, access, refresh)
        return {"ok": True}
    except Exception: raise HTTPException(401, "Invalid refresh token")

# ── True AI Upscaling via Replicate Real-ESRGAN ──────────────────────────────
@api.post("/upscale")
async def upscale_image(payload: UpscaleIn, user: dict = Depends(get_user)):
    """
    True AI upscaling — Replicate Real-ESRGAN.
    Genuine pixel reconstruction from a learned model, NOT canvas bicubic resize.
    Cost: ~$0.003/image. Scale: 2x or 4x.
    """
    tier = user.get("tier", "free")
    tier_cfg = TIERS.get(tier, TIERS["free"])

    # Check monthly limit
    if tier != "owner":
        images_used = user.get("images_used", 0)
        limit = tier_cfg["images_per_month"]
        if images_used >= limit:
            raise HTTPException(403, f"Monthly image limit reached ({limit}). Upgrade your plan.")

    if not REPLICATE_KEY:
        raise HTTPException(500, "Replicate API key not configured")

    scale = min(max(payload.scale, 2), 4)
    image_data_url = f"data:{payload.mime};base64,{payload.image_base64}"

    async with httpx.AsyncClient(timeout=180) as c:
        # Submit to Replicate Real-ESRGAN
        res = await c.post(
            "https://api.replicate.com/v1/predictions",
            headers={"Authorization": f"Token {REPLICATE_KEY}",
                     "Content-Type": "application/json"},
            json={
                "version": "42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b",
                "input": {
                    "image": image_data_url,
                    "scale": scale,
                    "face_enhance": False,
                }
            }
        )
        if res.status_code != 201:
            log.error(f"Replicate submit error: {res.text}")
            raise HTTPException(500, "Upscaling service error — please try again")

        prediction_id = res.json()["id"]

        # Poll until done
        for attempt in range(60):
            await asyncio.sleep(5)
            poll = await c.get(
                f"https://api.replicate.com/v1/predictions/{prediction_id}",
                headers={"Authorization": f"Token {REPLICATE_KEY}"}
            )
            data = poll.json()
            status = data.get("status")

            if status == "succeeded":
                output_url = data["output"]
                # Download and return as base64
                img_res = await c.get(output_url)
                import base64
                b64 = base64.b64encode(img_res.content).decode()
                mime_out = "image/png"

                # Track usage
                await db.users.update_one({"id": user["id"]}, {"$inc": {"images_used": 1}})

                return {"base64": b64, "mime": mime_out,
                        "scale": scale, "status": "success"}

            elif status == "failed":
                raise HTTPException(500, f"Upscaling failed: {data.get('error', 'Unknown error')}")

    raise HTTPException(504, "Upscaling timed out — image may be too large")

# ── Job history ───────────────────────────────────────────────────────────────
@api.post("/jobs")
async def create_job(payload: JobIn, user: dict = Depends(get_user)):
    job = {"id": str(uuid.uuid4()), "user_id": user["id"],
           **payload.dict(), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.jobs.insert_one(job)
    job.pop("_id", None)
    return job

@api.get("/jobs")
async def list_jobs(user: dict = Depends(get_user)):
    cursor = db.jobs.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(200)
    return [j async for j in cursor]

@api.delete("/jobs/{job_id}")
async def delete_job(job_id: str, user: dict = Depends(get_user)):
    r = await db.jobs.delete_one({"id": job_id, "user_id": user["id"]})
    if r.deleted_count == 0: raise HTTPException(404, "Job not found")
    return {"ok": True}

@api.delete("/jobs")
async def delete_all_jobs(user: dict = Depends(get_user)):
    await db.jobs.delete_many({"user_id": user["id"]})
    return {"ok": True}

# ── Billing ───────────────────────────────────────────────────────────────────
@api.post("/billing/checkout")
async def create_checkout(payload: StripeCheckoutIn, user: dict = Depends(get_user)):
    if not STRIPE_KEY: raise HTTPException(500, "Stripe not configured")
    price_id = STRIPE_PRICES.get(payload.tier, {}).get(payload.billing)
    if not price_id: raise HTTPException(400, "Invalid tier")
    async with httpx.AsyncClient(timeout=30) as c:
        res = await c.post("https://api.stripe.com/v1/checkout/sessions",
            headers={"Authorization": f"Bearer {STRIPE_KEY}"},
            data={"mode": "subscription",
                  "line_items[0][price]": price_id,
                  "line_items[0][quantity]": "1",
                  "success_url": f"{FRONTEND_URL}/account?session_id={{CHECKOUT_SESSION_ID}}",
                  "cancel_url": f"{FRONTEND_URL}/pricing",
                  "customer_email": user["email"],
                  "metadata[user_id]": user["id"],
                  "metadata[tier]": payload.tier})
        if res.status_code != 200: raise HTTPException(500, "Stripe error")
        return {"checkout_url": res.json()["url"]}

@api.post("/billing/webhook")
async def stripe_webhook(request: Request):
    try:
        event = json.loads(await request.body())
        if event["type"] == "checkout.session.completed":
            s = event["data"]["object"]
            await db.users.update_one(
                {"id": s["metadata"]["user_id"]},
                {"$set": {"tier": s["metadata"]["tier"], "images_used": 0,
                          "subscription_id": s.get("subscription")}})
        elif event["type"] in ["customer.subscription.deleted", "customer.subscription.paused"]:
            sub_id = event["data"]["object"]["id"]
            await db.users.update_one({"subscription_id": sub_id}, {"$set": {"tier": "free"}})
    except Exception as e:
        log.error(f"Webhook error: {e}")
    return {"ok": True}

# ── Health ─────────────────────────────────────────────────────────────────────
@api.get("/")
async def root():
    return {"service": "raven-sharp-optimiser", "status": "ok",
            "version": "2.0", "part_of": "Ascension Digital Group"}

# ── Startup ────────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.jobs.create_index("user_id")
    await db.jobs.create_index("id", unique=True)

@app.on_event("shutdown")
async def shutdown():
    client.close()

app.include_router(api)

@app.get("/health")
async def health():
    return {"status": "ok", "service": "raven-sharp-optimiser"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8001, reload=True)
