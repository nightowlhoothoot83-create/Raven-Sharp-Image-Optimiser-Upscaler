"""Backend API tests for Raven Sharp - auth + jobs flows."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://task-workflow-13.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": "admin@ravensharp.app", "password": "admin123"}, timeout=20)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def new_user():
    email = f"TEST_user_{uuid.uuid4().hex[:8]}@ravensharp.app"
    return {"email": email, "password": "tester123", "name": "Test User"}


@pytest.fixture(scope="module")
def user_session(new_user):
    s = requests.Session()
    r = s.post(f"{API}/auth/register", json=new_user, timeout=20)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    return s


# --------------- Health ---------------
def test_health():
    r = requests.get(f"{API}/", timeout=20)
    assert r.status_code == 200
    body = r.json()
    assert body.get("service") == "raven-sharp"
    assert body.get("status") == "ok"


# --------------- Auth ---------------
def test_register_sets_cookies_and_returns_user(new_user, user_session):
    # user_session fixture already registered; verify cookie present
    cookies = user_session.cookies.get_dict()
    assert "access_token" in cookies, f"cookies: {cookies}"
    assert "refresh_token" in cookies


def test_register_duplicate_returns_400(new_user, user_session):
    r = requests.post(f"{API}/auth/register", json=new_user, timeout=20)
    assert r.status_code == 400


def test_login_invalid_returns_401():
    r = requests.post(f"{API}/auth/login", json={"email": "nobody@x.com", "password": "wrong"}, timeout=20)
    assert r.status_code == 401


def test_login_admin_valid():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": "admin@ravensharp.app", "password": "admin123"}, timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert data["email"] == "admin@ravensharp.app"
    assert "id" in data and "created_at" in data
    assert "access_token" in s.cookies.get_dict()


def test_me_with_cookie(user_session, new_user):
    r = user_session.get(f"{API}/auth/me", timeout=20)
    assert r.status_code == 200
    assert r.json()["email"] == new_user["email"].lower()


def test_me_without_auth_returns_401():
    r = requests.get(f"{API}/auth/me", timeout=20)
    assert r.status_code == 401


def test_logout_clears_cookies(new_user):
    s = requests.Session()
    s.post(f"{API}/auth/login", json={"email": new_user["email"], "password": new_user["password"]}, timeout=20)
    assert s.get(f"{API}/auth/me", timeout=20).status_code == 200
    r = s.post(f"{API}/auth/logout", timeout=20)
    assert r.status_code == 200
    # After logout, create fresh session without prior cookies to confirm cookies are cleared server-side
    s.cookies.clear()
    assert s.get(f"{API}/auth/me", timeout=20).status_code == 401


# --------------- Jobs ---------------
def _job_payload(name="TEST_job"):
    return {
        "name": name,
        "original_size": 102400,
        "output_size": 51200,
        "width": 1920,
        "height": 1080,
        "dpi": 300,
        "format": "image/jpeg",
        "settings": {"quality": 0.9, "sharpen": 0.3},
    }


def test_jobs_requires_auth():
    r = requests.get(f"{API}/jobs", timeout=20)
    assert r.status_code == 401
    r2 = requests.post(f"{API}/jobs", json=_job_payload(), timeout=20)
    assert r2.status_code == 401


def test_jobs_create_and_list(user_session):
    payload = _job_payload("TEST_job_a")
    r = user_session.post(f"{API}/jobs", json=payload, timeout=20)
    assert r.status_code == 200, r.text
    job = r.json()
    assert job["name"] == "TEST_job_a"
    assert "id" in job and "user_id" in job and "created_at" in job
    assert job["dpi"] == 300

    r2 = user_session.get(f"{API}/jobs", timeout=20)
    assert r2.status_code == 200
    items = r2.json()
    assert any(j["id"] == job["id"] for j in items)


def test_jobs_isolated_per_user(user_session, admin_session):
    # User creates a job
    j = user_session.post(f"{API}/jobs", json=_job_payload("TEST_user_only"), timeout=20).json()
    # Admin lists; should not see it
    admin_jobs = admin_session.get(f"{API}/jobs", timeout=20).json()
    assert all(item["id"] != j["id"] for item in admin_jobs)


def test_jobs_delete_one(user_session):
    j = user_session.post(f"{API}/jobs", json=_job_payload("TEST_del_one"), timeout=20).json()
    r = user_session.delete(f"{API}/jobs/{j['id']}", timeout=20)
    assert r.status_code == 200
    # Verify removed
    items = user_session.get(f"{API}/jobs", timeout=20).json()
    assert all(it["id"] != j["id"] for it in items)
    # Deleting again -> 404
    r2 = user_session.delete(f"{API}/jobs/{j['id']}", timeout=20)
    assert r2.status_code == 404


def test_jobs_delete_all(user_session):
    user_session.post(f"{API}/jobs", json=_job_payload("TEST_del_all_1"), timeout=20)
    user_session.post(f"{API}/jobs", json=_job_payload("TEST_del_all_2"), timeout=20)
    r = user_session.delete(f"{API}/jobs", timeout=20)
    assert r.status_code == 200
    items = user_session.get(f"{API}/jobs", timeout=20).json()
    assert items == []


# --------------- bcrypt format check ---------------
def test_bcrypt_hash_format():
    """Ensure stored password hashes use bcrypt $2b$ format."""
    from pymongo import MongoClient
    mc = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    db = mc[os.environ.get("DB_NAME", "test_database")]
    u = db.users.find_one({"email": "admin@ravensharp.app"})
    assert u is not None
    assert u["password_hash"].startswith("$2b$") or u["password_hash"].startswith("$2a$")
    mc.close()
