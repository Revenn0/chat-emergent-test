"""
Backend tests for:
- Workflow GET/POST endpoints
- Conversations/Takeover POST endpoint
- Conversations list
- Bot Actions page load
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SESSION_TOKEN = "test_session_t1_iteration5"

@pytest.fixture(scope="module")
def auth_session():
    """Authenticated requests session with session_token cookie"""
    session = requests.Session()
    session.cookies.set("session_token", SESSION_TOKEN, domain="bot-workflow-hub.preview.emergentagent.com")
    session.headers.update({"Content-Type": "application/json"})
    return session

# ─── AUTH CHECK ───────────────────────────────────────────

class TestAuth:
    """Auth endpoint tests"""

    def test_auth_me_no_auth(self):
        """Without auth should return 401"""
        resp = requests.get(f"{BASE_URL}/api/auth/me")
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print(f"PASS: Unauthenticated /api/auth/me returns {resp.status_code}")

    def test_auth_me_with_bearer(self, auth_session):
        """With valid Bearer token should return 200"""
        resp = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {SESSION_TOKEN}"})
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code} - {resp.text}"
        data = resp.json()
        assert "user_id" in data or "email" in data, f"No user_id/email in response: {data}"
        print(f"PASS: Authenticated /api/auth/me returns 200, user: {data.get('email')}")

# ─── WORKFLOW ─────────────────────────────────────────────

class TestWorkflow:
    """Workflow endpoints: GET and POST"""

    def test_workflow_get_unauthenticated(self):
        """GET /api/workflow without auth returns 401"""
        resp = requests.get(f"{BASE_URL}/api/workflow")
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print(f"PASS: Unauthenticated GET /api/workflow returns 401")

    def test_workflow_get_authenticated(self):
        """GET /api/workflow with auth returns nodes array"""
        resp = requests.get(f"{BASE_URL}/api/workflow", headers={"Authorization": f"Bearer {SESSION_TOKEN}"})
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code} - {resp.text}"
        data = resp.json()
        assert "nodes" in data, f"Response missing 'nodes' key: {data}"
        assert isinstance(data["nodes"], list), f"nodes should be list, got: {type(data['nodes'])}"
        print(f"PASS: GET /api/workflow returns {len(data['nodes'])} nodes, active={data.get('active')}")

    def test_workflow_post_authenticated(self):
        """POST /api/workflow saves workflow"""
        nodes = [
            {"id": "n1", "type": "start", "title": "Test Start", "content": "Hello test", "branches": [], "position": 0},
            {"id": "n2", "type": "end", "title": "Test End", "content": "Goodbye test", "branches": [], "position": 1},
        ]
        payload = {"nodes": nodes, "active": True}
        resp = requests.post(
            f"{BASE_URL}/api/workflow",
            json=payload,
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code} - {resp.text}"
        data = resp.json()
        assert data.get("ok") is True, f"Expected ok:True, got: {data}"
        print(f"PASS: POST /api/workflow returns {data}")

    def test_workflow_save_then_get(self):
        """POST then GET - verify persistence"""
        nodes = [
            {"id": "n_persist1", "type": "start", "title": "Persist Test Start", "content": "Hello persist", "branches": [], "position": 0},
            {"id": "n_persist2", "type": "escalate", "title": "Escalate Step", "content": "Escalating...", "branches": [], "position": 1},
        ]
        payload = {"nodes": nodes, "active": False}
        post_resp = requests.post(
            f"{BASE_URL}/api/workflow",
            json=payload,
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"}
        )
        assert post_resp.status_code == 200, f"POST failed: {post_resp.text}"

        get_resp = requests.get(f"{BASE_URL}/api/workflow", headers={"Authorization": f"Bearer {SESSION_TOKEN}"})
        assert get_resp.status_code == 200, f"GET failed: {get_resp.text}"
        data = get_resp.json()
        assert len(data["nodes"]) == 2, f"Expected 2 nodes after save, got {len(data['nodes'])}"
        assert data["active"] is False, f"Expected active=False, got {data.get('active')}"
        print(f"PASS: Workflow persistence verified - {len(data['nodes'])} nodes, active={data['active']}")

# ─── TAKEOVER ─────────────────────────────────────────────

class TestTakeover:
    """Admin takeover endpoints"""

    TEST_JID = "test_user_12345%40s.whatsapp.net"

    def test_takeover_unauthenticated(self):
        """POST /api/conversations/{jid}/takeover without auth returns 401"""
        resp = requests.post(
            f"{BASE_URL}/api/conversations/{self.TEST_JID}/takeover",
            json={"active": True}
        )
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print(f"PASS: Unauthenticated takeover returns 401")

    def test_takeover_set_active(self):
        """POST takeover with active:true"""
        resp = requests.post(
            f"{BASE_URL}/api/conversations/{self.TEST_JID}/takeover",
            json={"active": True},
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code} - {resp.text}"
        data = resp.json()
        assert data.get("ok") is True, f"Expected ok:True"
        assert data.get("taken_over") is True, f"Expected taken_over:True, got {data}"
        print(f"PASS: Takeover active=True: {data}")

    def test_takeover_release(self):
        """POST takeover with active:false"""
        resp = requests.post(
            f"{BASE_URL}/api/conversations/{self.TEST_JID}/takeover",
            json={"active": False},
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code} - {resp.text}"
        data = resp.json()
        assert data.get("ok") is True, f"Expected ok:True"
        assert data.get("taken_over") is False, f"Expected taken_over:False, got {data}"
        print(f"PASS: Takeover active=False (released): {data}")

    def test_get_takeover_status(self):
        """GET /api/conversations/{jid}/takeover status"""
        resp = requests.get(
            f"{BASE_URL}/api/conversations/{self.TEST_JID}/takeover",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code} - {resp.text}"
        data = resp.json()
        assert "taken_over" in data, f"Response missing 'taken_over' key: {data}"
        print(f"PASS: GET takeover status: {data}")

# ─── CONVERSATIONS LIST ────────────────────────────────────

class TestConversations:
    """Conversations endpoints"""

    def test_conversations_get_unauthenticated(self):
        """GET /api/conversations without auth returns 401"""
        resp = requests.get(f"{BASE_URL}/api/conversations")
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print(f"PASS: Unauthenticated GET /api/conversations returns 401")

    def test_conversations_get_authenticated(self):
        """GET /api/conversations with auth returns list"""
        resp = requests.get(f"{BASE_URL}/api/conversations", headers={"Authorization": f"Bearer {SESSION_TOKEN}"})
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code} - {resp.text}"
        data = resp.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"PASS: GET /api/conversations returns {len(data)} conversations")

# ─── BOT ACTIONS ──────────────────────────────────────────

class TestBotActions:
    """Bot actions endpoint"""

    def test_actions_get_unauthenticated(self):
        """GET /api/actions without auth returns 401"""
        resp = requests.get(f"{BASE_URL}/api/actions")
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}"
        print(f"PASS: Unauthenticated GET /api/actions returns 401")

    def test_actions_get_authenticated(self):
        """GET /api/actions with auth returns list"""
        resp = requests.get(f"{BASE_URL}/api/actions", headers={"Authorization": f"Bearer {SESSION_TOKEN}"})
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code} - {resp.text}"
        data = resp.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"PASS: GET /api/actions returns {len(data)} actions")

# ─── INTEGRATIONS STATUS ──────────────────────────────────

class TestIntegrations:
    """Integrations (Gmail/Sheets) status endpoints"""

    def test_gmail_status_authenticated(self):
        """GET /api/integrations/gmail/status"""
        resp = requests.get(
            f"{BASE_URL}/api/integrations/gmail/status",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code} - {resp.text}"
        data = resp.json()
        assert "connected" in data, f"Response missing 'connected' key: {data}"
        print(f"PASS: Gmail status: connected={data.get('connected')}")

    def test_sheets_get_authenticated(self):
        """GET /api/integrations/sheets"""
        resp = requests.get(
            f"{BASE_URL}/api/integrations/sheets",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"}
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code} - {resp.text}"
        data = resp.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"PASS: GET /api/integrations/sheets returns {len(data)} sheets")
