"""
Backend tests for:
- AI Toggle endpoint (POST /api/ai/toggle)
- Stats endpoint with ai_enabled field (GET /api/stats)
- Chat Test endpoints (POST /api/chat-test, GET /api/chat-test/messages, DELETE /api/chat-test/messages)
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SESSION_TOKEN = "test_session_aitest_1772118884701"


@pytest.fixture(scope="module")
def session():
    """Requests session with auth cookie"""
    s = requests.Session()
    s.cookies.set("session_token", SESSION_TOKEN, domain="bot-workflow-hub.preview.emergentagent.com")
    s.headers.update({"Content-Type": "application/json"})
    return s


# ─── Auth sanity check ────────────────────────────────────────────────────────

class TestAuth:
    """Verify session token is valid before running feature tests"""

    def test_auth_me(self, session):
        """Check that session token gives valid user"""
        resp = session.get(f"{BASE_URL}/api/auth/me")
        assert resp.status_code == 200, f"Auth failed: {resp.status_code} {resp.text}"
        data = resp.json()
        assert "user_id" in data
        print(f"Authenticated as: {data.get('name')} ({data.get('user_id')})")


# ─── GET /api/stats includes ai_enabled ───────────────────────────────────────

class TestStats:
    """GET /api/stats returns ai_enabled field"""

    def test_stats_has_ai_enabled(self, session):
        resp = session.get(f"{BASE_URL}/api/stats")
        assert resp.status_code == 200, f"Stats failed: {resp.status_code} {resp.text}"
        data = resp.json()
        assert "ai_enabled" in data, f"ai_enabled missing from stats: {data}"
        assert isinstance(data["ai_enabled"], bool), f"ai_enabled should be bool, got {type(data['ai_enabled'])}"
        print(f"Stats ai_enabled: {data['ai_enabled']}")

    def test_stats_has_expected_fields(self, session):
        resp = session.get(f"{BASE_URL}/api/stats")
        assert resp.status_code == 200
        data = resp.json()
        for field in ["total_conversations", "total_messages", "pending_actions", "ai_enabled"]:
            assert field in data, f"Missing field: {field}"
        print(f"Stats fields present: {list(data.keys())}")


# ─── POST /api/ai/toggle ─────────────────────────────────────────────────────

class TestAiToggle:
    """POST /api/ai/toggle flips ai_enabled state"""

    def test_ai_toggle_returns_ai_enabled(self, session):
        """Toggle call returns ai_enabled boolean"""
        resp = session.post(f"{BASE_URL}/api/ai/toggle")
        assert resp.status_code == 200, f"Toggle failed: {resp.status_code} {resp.text}"
        data = resp.json()
        assert "ai_enabled" in data, f"Response missing ai_enabled: {data}"
        assert isinstance(data["ai_enabled"], bool)
        print(f"After first toggle: ai_enabled={data['ai_enabled']}")

    def test_ai_toggle_flips_state(self, session):
        """Two consecutive toggles restore to original state"""
        # Get current state
        stats_before = session.get(f"{BASE_URL}/api/stats").json()
        state_before = stats_before["ai_enabled"]

        # Toggle once
        resp1 = session.post(f"{BASE_URL}/api/ai/toggle")
        assert resp1.status_code == 200
        state_after_1 = resp1.json()["ai_enabled"]
        assert state_after_1 != state_before, f"State didn't flip: was {state_before}, still {state_after_1}"

        # Toggle again to restore
        resp2 = session.post(f"{BASE_URL}/api/ai/toggle")
        assert resp2.status_code == 200
        state_after_2 = resp2.json()["ai_enabled"]
        assert state_after_2 == state_before, f"State didn't restore: expected {state_before}, got {state_after_2}"
        print(f"Toggle flip: {state_before} → {state_after_1} → {state_after_2} ✓")

    def test_ai_toggle_persists_in_stats(self, session):
        """After toggle, GET /api/stats reflects the new ai_enabled"""
        # Toggle and capture new state
        toggle_resp = session.post(f"{BASE_URL}/api/ai/toggle")
        assert toggle_resp.status_code == 200
        toggled_state = toggle_resp.json()["ai_enabled"]

        # Verify stats reflects the toggle
        stats_resp = session.get(f"{BASE_URL}/api/stats")
        assert stats_resp.status_code == 200
        stats_ai = stats_resp.json()["ai_enabled"]
        assert stats_ai == toggled_state, f"Stats ai_enabled ({stats_ai}) doesn't match toggle result ({toggled_state})"

        # Restore state
        session.post(f"{BASE_URL}/api/ai/toggle")
        print(f"Persistence verified: toggled to {toggled_state}, stats confirmed {stats_ai}")


# ─── GET /api/chat-test/messages ────────────────────────────────────────────

class TestChatTestMessages:
    """GET /api/chat-test/messages returns list"""

    def test_get_messages_returns_list(self, session):
        resp = session.get(f"{BASE_URL}/api/chat-test/messages")
        assert resp.status_code == 200, f"Get messages failed: {resp.status_code} {resp.text}"
        data = resp.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"Got {len(data)} test messages")

    def test_messages_have_expected_fields(self, session):
        """If there are messages, they have required fields"""
        resp = session.get(f"{BASE_URL}/api/chat-test/messages")
        assert resp.status_code == 200
        data = resp.json()
        if data:
            msg = data[0]
            for field in ["id", "role", "text", "timestamp"]:
                assert field in msg, f"Message missing field: {field}"
            assert "_id" not in msg, "MongoDB _id exposed in response"
            print(f"Message fields OK: {list(msg.keys())}")
        else:
            print("No messages found (may have been cleared), structure check skipped")


# ─── DELETE /api/chat-test/messages ─────────────────────────────────────────

class TestClearTestMessages:
    """DELETE /api/chat-test/messages clears messages"""

    def test_delete_clears_messages(self, session):
        # First send a message to ensure there's something to clear
        send_resp = session.post(f"{BASE_URL}/api/chat-test", json={"message": "TEST_CLEAR_CHECK hello"})
        # Give it a moment regardless of success
        time.sleep(1)

        # Delete
        del_resp = session.delete(f"{BASE_URL}/api/chat-test/messages")
        assert del_resp.status_code == 200, f"Delete failed: {del_resp.status_code} {del_resp.text}"
        data = del_resp.json()
        assert data.get("ok") is True, f"Expected ok=true, got {data}"

        # Verify cleared
        get_resp = session.get(f"{BASE_URL}/api/chat-test/messages")
        assert get_resp.status_code == 200
        messages = get_resp.json()
        assert len(messages) == 0, f"Expected empty after clear, got {len(messages)} messages"
        print("Clear messages: OK")


# ─── POST /api/chat-test ────────────────────────────────────────────────────

class TestChatTestSend:
    """POST /api/chat-test returns reply and booking_detected"""

    def test_send_message_response_structure(self, session):
        """Chat test returns reply and booking_detected"""
        # Clear first
        session.delete(f"{BASE_URL}/api/chat-test/messages")

        resp = session.post(f"{BASE_URL}/api/chat-test", json={"message": "Hello, what can you help me with?"}, timeout=30)
        assert resp.status_code == 200, f"Chat test failed: {resp.status_code} {resp.text}"
        data = resp.json()
        assert "reply" in data, f"Missing 'reply' in response: {data}"
        assert "booking_detected" in data, f"Missing 'booking_detected' in response: {data}"
        assert isinstance(data["reply"], str) and len(data["reply"]) > 0, "Reply should be non-empty string"
        assert isinstance(data["booking_detected"], bool), "booking_detected should be bool"
        print(f"Chat test reply: {data['reply'][:80]}... | booking_detected: {data['booking_detected']}")

    def test_send_message_persists_in_messages(self, session):
        """After POST /chat-test, messages are in GET /chat-test/messages"""
        # Clear first
        session.delete(f"{BASE_URL}/api/chat-test/messages")

        send_resp = session.post(f"{BASE_URL}/api/chat-test", json={"message": "TEST_PERSIST: Tell me about your services"}, timeout=30)
        assert send_resp.status_code == 200, f"Send failed: {send_resp.status_code}"

        get_resp = session.get(f"{BASE_URL}/api/chat-test/messages")
        assert get_resp.status_code == 200
        messages = get_resp.json()
        assert len(messages) >= 2, f"Expected at least user+assistant messages, got {len(messages)}"

        roles = [m["role"] for m in messages]
        assert "user" in roles, "No user message in messages"
        assert "assistant" in roles, "No assistant message in messages"

        # Check no _id exposed
        for m in messages:
            assert "_id" not in m, "MongoDB _id exposed in messages"

        print(f"Message persistence OK: {len(messages)} messages, roles: {roles}")

    def test_booking_detection(self, session):
        """Booking keywords trigger booking_detected=True"""
        session.delete(f"{BASE_URL}/api/chat-test/messages")
        resp = session.post(f"{BASE_URL}/api/chat-test", json={"message": "I need to arrange a collection please"}, timeout=30)
        assert resp.status_code == 200
        data = resp.json()
        assert data["booking_detected"] is True, f"Expected booking_detected=True for booking message, got: {data}"
        assert "[BOOKING DETECTED" in data["reply"], f"Reply should mention BOOKING DETECTED: {data['reply'][:100]}"
        print(f"Booking detection: OK — {data['reply'][:80]}")

    def test_multi_turn_conversation(self, session):
        """Multi-turn: send 2 messages and verify history"""
        session.delete(f"{BASE_URL}/api/chat-test/messages")

        msg1 = session.post(f"{BASE_URL}/api/chat-test", json={"message": "My name is Alice"}, timeout=30)
        assert msg1.status_code == 200, f"First msg failed: {msg1.status_code}"
        time.sleep(1)

        msg2 = session.post(f"{BASE_URL}/api/chat-test", json={"message": "What is my name?"}, timeout=30)
        assert msg2.status_code == 200, f"Second msg failed: {msg2.status_code}"

        messages = session.get(f"{BASE_URL}/api/chat-test/messages").json()
        assert len(messages) >= 4, f"Expected 4+ messages (2 user + 2 assistant), got {len(messages)}"

        print(f"Multi-turn: {len(messages)} messages stored")
        for m in messages:
            print(f"  [{m['role']}]: {m['text'][:60]}")

    def test_clear_after_tests(self, session):
        """Cleanup: clear test messages"""
        del_resp = session.delete(f"{BASE_URL}/api/chat-test/messages")
        assert del_resp.status_code == 200
        print("Cleanup complete")
