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
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

# ── Config ──────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("ravensharp-imageopt")

# --- Self-healing startup config -------------------------------------------
# Some vars have a safe auto-fix (app boots in a slightly degraded mode with a
# loud warning). MONGO_URL has no safe default — if it's missing, we can't
# invent a working database, so we fail fast with ONE clear diagnostic line
# instead of a bare KeyError traceback that's hard to read in Railway logs.
_startup_warnings = []

MONGO_URL = os.environ.get("MONGO_URL")
if not MONGO_URL:
    log.critical(
        "STARTUP FAILURE: MONGO_URL is not set on this deployment. "
        "The app cannot start without a database connection string. "
        "Set MONGO_URL in Railway's environment variables for this service and redeploy."
    )
    raise RuntimeError("Missing required environment variable: MONGO_URL")

DB_NAME = os.environ.get("DB_NAME")
if not DB_NAME:
    DB_NAME = "ravensharp_imageopt"
    _startup_warnings.append(f"DB_NAME was not set — defaulting to '{DB_NAME}'.")

JWT_SECRET = os.environ.get("JWT_SECRET")
if not JWT_SECRET:
    import secrets as _secrets
    JWT_SECRET = _secrets.token_hex(32)
    _startup_warnings.append(
        "JWT_SECRET was not set — auto-generated a temporary one for this boot. "
        "Existing user sessions will be invalidated on every restart until a permanent "
        "JWT_SECRET is set in Railway's environment variables."
    )

for _w in _startup_warnings:
    log.warning("STARTUP: %s", _w)

REPLICATE_KEY = os.environ.get("REPLICATE_API_KEY", "")
STRIPE_KEY    = os.environ.get("STRIPE_API_KEY", "")
RESEND_KEY    = os.environ.get("RESEND_API_KEY", "")
RESEND_FROM   = os.environ.get("RESEND_FROM_EMAIL", "Raven Sharp <noreply@ravensharptools.com>")
if not RESEND_KEY:
    _resend_warning = (
        "RESEND_API_KEY was not set — password reset emails will NOT be sent to customers. "
        "Only the owner account will see a usable reset token (for testing). "
        "Set RESEND_API_KEY in Railway's environment variables to enable real reset emails."
    )
    _startup_warnings.append(_resend_warning)
    log.warning("STARTUP: %s", _resend_warning)
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

async def send_email(to: str, subject: str, html: str) -> bool:
    """Send an email via Resend's HTTP API. Returns True if sent, False if
    RESEND_API_KEY isn't configured or the send failed — callers should treat
    False as 'log it and degrade gracefully', never as a reason to crash a
    request (a failed reset email shouldn't break the forgot-password flow
    for the user, it should just mean they don't get the email)."""
    if not RESEND_KEY:
        log.warning("send_email skipped (no RESEND_API_KEY configured): to=%s subject=%r", to, subject)
        return False
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {RESEND_KEY}", "Content-Type": "application/json"},
                json={"from": RESEND_FROM, "to": [to], "subject": subject, "html": html},
            )
            if resp.status_code >= 400:
                log.error("Resend email failed (%s): %s", resp.status_code, resp.text[:500])
                return False
            return True
    except Exception as e:
        log.error("Resend email exception: %s", e)
        return False

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

class RemoveBgIn(BaseModel):
    image_base64: str
    mime: str = "image/jpeg"

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
    import base64 as _b64mod
    image_bytes = _b64mod.b64decode(payload.image_base64)

    async with httpx.AsyncClient(timeout=180) as c:
        # Large images can't be embedded as base64 in the JSON body (413 Payload
        # Too Large on Replicate's API). Upload to Replicate's file storage first
        # and reference it by URL instead.
        upload_res = await c.post(
            "https://api.replicate.com/v1/files",
            headers={"Authorization": f"Token {REPLICATE_KEY}"},
            files={"content": (f"upload.{payload.mime.split('/')[-1]}", image_bytes, payload.mime)},
        )
        if upload_res.status_code not in (200, 201):
            log.error(f"Replicate file upload error: {upload_res.status_code} {upload_res.text}")
            raise HTTPException(500, "Upscaling service error - please try again")

        image_url = upload_res.json().get("urls", {}).get("get") or upload_res.json().get("serving_url")
        if not image_url:
            log.error(f"Replicate file upload - no URL in response: {upload_res.text}")
            raise HTTPException(500, "Upscaling service error - please try again")

        # Submit to Replicate Real-ESRGAN
        res = await c.post(
            "https://api.replicate.com/v1/predictions",
            headers={"Authorization": f"Token {REPLICATE_KEY}",
                     "Content-Type": "application/json"},
            json={
                "version": "42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b",
                "input": {
                    "image": image_url,
                    "scale": scale,
                    "face_enhance": False,
                }
            }
        )
        if res.status_code != 201:
            log.error(f"Replicate submit error: {res.text}")
            raise HTTPException(500, "Upscaling service error - please try again")

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

# ── Background Removal via Replicate ─────────────────────────────────────────
@api.post("/remove-background")
async def remove_background_endpoint(payload: RemoveBgIn, user: dict = Depends(get_user)):
    """
    AI background removal via Replicate (851-labs/background-remover).
    Reuses the same file-upload pattern as /upscale to avoid 413 payload errors.
    """
    tier = user.get("tier", "free")
    tier_cfg = TIERS.get(tier, TIERS["free"])

    # Shares the same monthly image limit/counter as AI upscale — both cost
    # real Replicate credits, so they draw from one pool per user.
    if tier != "owner":
        images_used = user.get("images_used", 0)
        limit = tier_cfg["images_per_month"]
        if images_used >= limit:
            raise HTTPException(403, f"Monthly image limit reached ({limit}). Upgrade your plan.")

    if not REPLICATE_KEY:
        raise HTTPException(500, "Replicate API key not configured")

    import base64 as _b64mod
    image_bytes = _b64mod.b64decode(payload.image_base64)

    async with httpx.AsyncClient(timeout=180) as c:
        upload_res = await c.post(
            "https://api.replicate.com/v1/files",
            headers={"Authorization": f"Token {REPLICATE_KEY}"},
            files={"content": (f"upload.{payload.mime.split('/')[-1]}", image_bytes, payload.mime)},
        )
        if upload_res.status_code not in (200, 201):
            log.error(f"Replicate file upload error: {upload_res.status_code} {upload_res.text}")
            raise HTTPException(500, "Background removal service error - please try again")

        image_url = upload_res.json().get("urls", {}).get("get") or upload_res.json().get("serving_url")
        if not image_url:
            log.error(f"Replicate file upload - no URL in response: {upload_res.text}")
            raise HTTPException(500, "Background removal service error - please try again")

        # Uses Replicate's model-latest-version endpoint so we don't need to
        # hardcode a version hash that can go stale.
        res = await c.post(
            "https://api.replicate.com/v1/models/851-labs/background-remover/predictions",
            headers={"Authorization": f"Token {REPLICATE_KEY}",
                     "Content-Type": "application/json"},
            json={"input": {"image": image_url}}
        )
        if res.status_code != 201:
            log.error(f"Replicate bg-remove submit error: {res.text}")
            raise HTTPException(500, "Background removal service error - please try again")

        prediction_id = res.json()["id"]

        for attempt in range(60):
            await asyncio.sleep(3)
            poll = await c.get(
                f"https://api.replicate.com/v1/predictions/{prediction_id}",
                headers={"Authorization": f"Token {REPLICATE_KEY}"}
            )
            data = poll.json()
            status = data.get("status")

            if status == "succeeded":
                output_url = data["output"]
                img_res = await c.get(output_url)
                b64 = _b64mod.b64encode(img_res.content).decode()

                if tier != "owner":
                    await db.users.update_one({"id": user["id"]}, {"$inc": {"images_used": 1}})

                return {"base64": b64, "mime": "image/png", "status": "success"}

            elif status == "failed":
                raise HTTPException(500, f"Background removal failed: {data.get('error', 'Unknown error')}")

    raise HTTPException(504, "Background removal timed out")

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

class ForgotPasswordIn(BaseModel):
    email: str

class ResetPasswordIn(BaseModel):
    token: str
    new_password: str

# Simple in-memory token store (upgrade to DB for production)
_reset_tokens: dict = {}

@api.post("/auth/forgot-password")
async def forgot_password(payload: ForgotPasswordIn):
    """Generate a password reset token and email it to the user via Resend."""
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user:
        # Don't reveal if email exists
        return {"message": "If that email exists, a reset link has been sent."}
    token = str(uuid.uuid4())
    _reset_tokens[token] = {"email": email, "expires": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()}
    reset_link = f"{FRONTEND_URL}/reset-password?token={token}"
    log.info(f"Password reset token for {email}: {token}")

    sent = await send_email(
        to=email,
        subject="Reset your Raven Sharp Image Optimiser password",
        html=f"""
            <p>Someone requested a password reset for your Raven Sharp Image Optimiser account.</p>
            <p><a href="{reset_link}">Click here to reset your password</a> — this link expires in 1 hour.</p>
            <p>If you didn't request this, you can safely ignore this email.</p>
        """,
    )
    return {
        "message": "If that email exists, a reset link has been sent.",
        # Fallback for owner testing, or if email sending isn't configured yet —
        # never shown to anyone but the owner account, for security.
        "debug_token": token if email == OWNER_EMAIL.lower() else None
    }

@api.post("/auth/reset-password")
async def reset_password(payload: ResetPasswordIn, response: Response):
    """Reset password using a valid token."""
    entry = _reset_tokens.get(payload.token)
    if not entry:
        raise HTTPException(400, "Invalid or expired reset token")
    from datetime import datetime as _dt
    if _dt.fromisoformat(entry["expires"]) < datetime.now(timezone.utc):
        del _reset_tokens[payload.token]
        raise HTTPException(400, "Reset token has expired")
    email = entry["email"]
    new_hash = hash_pw(payload.new_password)
    result = await db.users.update_one({"email": email}, {"$set": {"password_hash": new_hash}})
    if result.matched_count == 0:
        raise HTTPException(404, "User not found")
    del _reset_tokens[payload.token]
    return {"message": "Password reset successfully. Please sign in."}

@api.get("/auth/verify-reset-token/{token}")
async def verify_reset_token(token: str):
    """Check if a reset token is valid before showing the reset form."""
    entry = _reset_tokens.get(token)
    if not entry:
        raise HTTPException(400, "Invalid or expired reset token")
    from datetime import datetime as _dt
    if _dt.fromisoformat(entry["expires"]) < datetime.now(timezone.utc):
        del _reset_tokens[token]
        raise HTTPException(400, "Reset token has expired")
    return {"valid": True, "email": entry["email"]}


@api.get("/health/detailed")
async def health_detailed():
    """Detailed health check for monitoring dashboard."""
    checks = {}
    
    # MongoDB check
    try:
        await db.command("ping")
        checks["mongodb"] = {"status": "ok"}
    except Exception as e:
        checks["mongodb"] = {"status": "error", "detail": str(e)}
    
    # Replicate check
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.get(
                "https://api.replicate.com/v1/account",
                headers={"Authorization": f"Token {REPLICATE_KEY}"}
            )
            checks["replicate"] = {"status": "ok" if r.status_code == 200 else "error", "code": r.status_code}
    except Exception as e:
        checks["replicate"] = {"status": "error", "detail": str(e)}
    
    # Stripe check
    checks["stripe"] = {"status": "ok" if STRIPE_KEY else "not_configured"}
    
    overall = "ok" if all(v["status"] == "ok" for v in checks.values()) else "degraded"
    return {
        "status": overall,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "services": checks
    }

@api.get("/health/stats")
async def health_stats(user: dict = Depends(get_user)):
    """Usage stats for owner dashboard."""
    if user.get("tier") != "owner":
        raise HTTPException(403, "Owner only")
    
    total_users = await db.users.count_documents({})
    total_jobs = await db.jobs.count_documents({})
    
    # Users by tier
    pipeline = [{"$group": {"_id": "$tier", "count": {"$sum": 1}}}]
    tier_cursor = db.users.aggregate(pipeline)
    tiers = {}
    async for doc in tier_cursor:
        tiers[doc["_id"]] = doc["count"]
    
    # Jobs today
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    jobs_today = await db.jobs.count_documents({"created_at": {"$gte": today}})
    
    return {
        "total_users": total_users,
        "total_jobs": total_jobs,
        "jobs_today": jobs_today,
        "users_by_tier": tiers,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

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

# ── Global error visibility ──────────────────────────────────────────────────
# Any exception not already handled by a specific try/except becomes a bare
# 500 by default, with nothing useful in the response and no easy way to match
# a customer's "it broke" report to the right line in the logs. This catches
# everything, logs the full traceback under a short error ID, and returns that
# same ID to the frontend so it can be shown to the customer — if they report
# "error 7F3K2Q", you can grep Railway logs for that exact ID and see the full
# trace immediately instead of guessing.
import traceback as _traceback
import secrets as _secrets_err

@app.exception_handler(Exception)
async def _global_exception_handler(request: Request, exc: Exception):
    error_id = _secrets_err.token_hex(4).upper()
    log.error(
        "UNHANDLED ERROR [%s] on %s %s: %s\n%s",
        error_id, request.method, request.url.path, repr(exc),
        "".join(_traceback.format_exception(type(exc), exc, exc.__traceback__)),
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": f"Something went wrong ({type(exc).__name__}). "
                     f"If this keeps happening, report error {error_id} to support.",
            "error_id": error_id,
        },
    )

@app.get("/health")
async def health():
    checks = {}
    overall_ok = True
    try:
        await asyncio.wait_for(client.admin.command("ping"), timeout=3.0)
        checks["mongodb"] = "ok"
    except Exception as e:
        checks["mongodb"] = f"unreachable: {type(e).__name__}"
        overall_ok = False
    checks["replicate_configured"] = bool(REPLICATE_KEY)
    checks["stripe_configured"] = bool(STRIPE_KEY)
    if _startup_warnings:
        checks["startup_warnings"] = _startup_warnings
    return JSONResponse(
        status_code=200 if overall_ok else 503,
        content={"status": "ok" if overall_ok else "degraded", "service": "raven-sharp-optimiser", "checks": checks},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8001, reload=True)
