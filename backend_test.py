#!/usr/bin/env python3
"""
WhatsApp AI Chatbot Backend API Tests
Tests all backend endpoints for the WA AI Bot
"""
import requests
import sys
import json
from datetime import datetime

class WhatsAppBotAPITester:
    def __init__(self, base_url="https://qr-chat-ai.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        # Test session created from MongoDB
        self.test_session_token = "test_session_1772108495690"
        self.test_user_id = "test-user-1772108495690"

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {method} {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                response_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text
                print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")

            # Store result
            result = {
                "name": name,
                "endpoint": endpoint,
                "method": method,
                "expected_status": expected_status,
                "actual_status": response.status_code,
                "success": success,
                "response_preview": str(response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text)[:100]
            }
            self.test_results.append(result)

            return success, response.json() if success and response.headers.get('content-type', '').startswith('application/json') else {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            result = {
                "name": name,
                "endpoint": endpoint,
                "method": method,
                "expected_status": expected_status,
                "actual_status": "ERROR",
                "success": False,
                "error": str(e)
            }
            self.test_results.append(result)
            return False, {}

    def test_wa_status_api(self):
        """Test WhatsApp status endpoint"""
        auth_headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.test_session_token}'
        }
        
        success, response = self.run_test(
            "WhatsApp Status (Authenticated)",
            "GET",
            "api/wa/status",
            200,
            headers=auth_headers
        )
        if success:
            required_fields = ['status', 'connected']
            for field in required_fields:
                if field not in response:
                    print(f"❌ Missing required field: {field}")
                    return False
        return success

    def test_wa_qr_api(self):
        """Test WhatsApp QR code endpoint"""
        auth_headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.test_session_token}'
        }
        
        success, response = self.run_test(
            "WhatsApp QR Code (Authenticated)",
            "GET",
            "api/wa/qr",
            200,
            headers=auth_headers
        )
        if success:
            if 'qr' not in response:
                print(f"❌ Missing 'qr' field in response")
                return False
        return success

    def test_config_api(self):
        """Test bot configuration endpoints with authentication"""
        # Setup authenticated headers
        auth_headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.test_session_token}'
        }
        
        # Test GET config
        get_success, config_data = self.run_test(
            "Get Bot Config (Authenticated)",
            "GET",
            "api/config",
            200,
            headers=auth_headers
        )
        
        if get_success:
            # Check all new expanded config fields from redesign including new requirements
            required_fields = [
                # Identity fields
                'bot_name', 'greeting_message', 'fallback_message',
                # Model fields  
                'model_provider', 'model_name', 'temperature', 'max_tokens', 'top_p', 'system_prompt',
                # Behavior fields
                'language', 'tone', 'response_length',
                # Context fields
                'business_context', 'faq_text',
                # Security fields - including strict_mode and booking_types as per requirements
                'strict_mode', 'booking_types',
                'rate_limit_enabled', 'rate_limit_msgs', 'rate_limit_window_minutes',
                'blocked_words', 'blocked_contacts', 'schedule_enabled', 'schedule_start', 'schedule_end'
            ]
            for field in required_fields:
                if field not in config_data:
                    print(f"❌ Missing required config field: {field}")
                    return False
            
            # Verify strict_mode is boolean
            if not isinstance(config_data['strict_mode'], bool):
                print(f"❌ strict_mode should be boolean, got {type(config_data['strict_mode'])}")
                return False
            
            # Verify booking_types is array
            if not isinstance(config_data['booking_types'], list):
                print(f"❌ booking_types should be array, got {type(config_data['booking_types'])}")
                return False
            
            # Check booking types structure
            if len(config_data['booking_types']) > 0:
                first_booking = config_data['booking_types'][0]
                booking_fields = ['id', 'name', 'enabled', 'keywords', 'confirmation_message']
                for field in booking_fields:
                    if field not in first_booking:
                        print(f"❌ Missing booking type field: {field}")
                        return False
            
            print(f"✅ Config structure verified - strict_mode: {config_data['strict_mode']}, booking_types: {len(config_data['booking_types'])} types")
            
            # Check data types for numeric fields
            numeric_checks = {
                'temperature': (float, (0.0, 2.0)),
                'top_p': (float, (0.1, 1.0)), 
                'max_tokens': (int, (128, 4096)),
                'rate_limit_msgs': (int, (1, 60)),
                'rate_limit_window_minutes': (int, (1, 60))
            }
            
            for field, (expected_type, valid_range) in numeric_checks.items():
                if not isinstance(config_data[field], expected_type):
                    print(f"❌ Config field {field} should be {expected_type.__name__}, got {type(config_data[field])}")
                    return False
                if not (valid_range[0] <= config_data[field] <= valid_range[1]):
                    print(f"❌ Config field {field} should be between {valid_range}, got {config_data[field]}")
                    return False
            
            # Check boolean fields
            boolean_fields = ['rate_limit_enabled', 'schedule_enabled', 'strict_mode']
            for field in boolean_fields:
                if not isinstance(config_data[field], bool):
                    print(f"❌ Config field {field} should be boolean, got {type(config_data[field])}")
                    return False
            
            # Check array fields
            array_fields = ['blocked_words', 'blocked_contacts', 'booking_types']
            for field in array_fields:
                if not isinstance(config_data[field], list):
                    print(f"❌ Config field {field} should be array, got {type(config_data[field])}")
                    return False
        
        # Test POST config (save) with comprehensive config including booking_types and strict_mode
        test_config = {
            # Identity
            "bot_name": "Test Bot Updated",
            "greeting_message": "Hello! I'm a test bot.",
            "fallback_message": "Sorry, I don't understand.",
            # Model
            "model_provider": "openai",
            "model_name": "gpt-4o",
            "temperature": 0.8,
            "max_tokens": 512,
            "top_p": 0.9,
            "system_prompt": "You are a helpful assistant for testing.",
            # Behavior
            "language": "en-US", 
            "tone": "professional",
            "response_length": "concise",
            # Context
            "business_context": "We are a test company.",
            "faq_text": "Q: Test question?\nA: Test answer.",
            # Security - including required fields
            "strict_mode": False,  # Test changing this
            "booking_types": [
                {
                    "id": "test_booking",
                    "name": "Test Booking",
                    "enabled": True,
                    "keywords": ["test", "booking"],
                    "confirmation_message": "Test booking confirmed"
                }
            ],
            "rate_limit_enabled": True,
            "rate_limit_msgs": 5,
            "rate_limit_window_minutes": 2,
            "blocked_words": ["spam", "test"],
            "blocked_contacts": ["123@s.whatsapp.net"],
            "schedule_enabled": True,
            "schedule_start": "09:00",
            "schedule_end": "17:00",
            "outside_hours_message": "We're closed now."
        }
        
        post_success, _ = self.run_test(
            "Save Bot Config (booking_types & strict_mode)",
            "POST", 
            "api/config",
            200,
            data=test_config,
            headers=auth_headers
        )
        
        # Verify the config was actually saved by fetching it again
        if post_success:
            verify_success, verify_data = self.run_test(
                "Verify Config Save (booking_types & strict_mode)",
                "GET",
                "api/config", 
                200,
                headers=auth_headers
            )
            
            if verify_success:
                # Check key fields were updated including required ones
                key_fields_to_check = ['bot_name', 'temperature', 'language', 'tone', 'strict_mode']
                for field in key_fields_to_check:
                    if verify_data.get(field) != test_config[field]:
                        print(f"❌ Config field {field} was not saved correctly. Expected: {test_config[field]}, Got: {verify_data.get(field)}")
                        return False
                
                # Check booking_types was saved
                if len(verify_data.get('booking_types', [])) == 0:
                    print(f"❌ booking_types was not saved correctly")
                    return False
                
                saved_booking = verify_data['booking_types'][0]
                if saved_booking['id'] != 'test_booking' or saved_booking['name'] != 'Test Booking':
                    print(f"❌ booking_types data was not saved correctly")
                    return False
                
                print("✅ Config save verification passed including booking_types and strict_mode")
        
        return get_success and post_success

    def test_stats_api(self):
        """Test statistics endpoint with authentication"""
        auth_headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.test_session_token}'
        }
        
        success, response = self.run_test(
            "Get Stats (Authenticated)",
            "GET",
            "api/stats", 
            200,
            headers=auth_headers
        )
        if success:
            # Check all required fields including pending_actions
            required_fields = ['total_conversations', 'total_messages', 'user_messages', 'bot_messages', 'pending_actions']
            for field in required_fields:
                if field not in response:
                    print(f"❌ Missing required stats field: {field}")
                    return False
            
            # Verify pending_actions is a number
            if not isinstance(response['pending_actions'], int) or response['pending_actions'] < 0:
                print(f"❌ pending_actions should be non-negative integer, got {response['pending_actions']}")
                return False
            
            print(f"✅ Stats verified - pending_actions: {response['pending_actions']}")
        return success

    def test_actions_api(self):
        """Test bot actions endpoints with authentication"""
        auth_headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.test_session_token}'
        }
        
        # Test GET /api/actions (list actions)
        list_success, actions_data = self.run_test(
            "Get Actions List (Authenticated)",
            "GET",
            "api/actions",
            200,
            headers=auth_headers
        )
        
        if not list_success:
            return False
        
        if not isinstance(actions_data, list):
            print(f"❌ Expected array of actions, got {type(actions_data)}")
            return False
        
        print(f"📋 Found {len(actions_data)} actions")
        
        # If there are existing actions, test updating one
        if len(actions_data) > 0:
            action_id = actions_data[0]['action_id']
            
            # Test PATCH /api/actions/{id} (update action status)
            update_data = {
                "status": "approved", 
                "admin_note": "Test approval"
            }
            
            update_success, update_response = self.run_test(
                "Update Action Status",
                "PATCH",
                f"api/actions/{action_id}",
                200,
                data=update_data,
                headers=auth_headers
            )
            
            if update_success:
                if update_response.get('status') != 'approved':
                    print(f"❌ Action status not updated correctly")
                    return False
                print(f"✅ Action {action_id[:8]} status updated to approved")
        else:
            print("ℹ️  No existing actions to test update functionality")
        
        # Test filtering by status
        filter_success, filtered_actions = self.run_test(
            "Get Pending Actions",
            "GET",
            "api/actions?status=pending",
            200,
            headers=auth_headers
        )
        
        if not filter_success:
            return False
        
        if not isinstance(filtered_actions, list):
            print(f"❌ Expected array of filtered actions, got {type(filtered_actions)}")
            return False
        
        print(f"📋 Found {len(filtered_actions)} pending actions")
        
        return list_success and filter_success

    def test_logs_api(self):
        """Test logs endpoint with authentication"""
        auth_headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.test_session_token}'
        }
        
        success, response = self.run_test(
            "Get Logs (Authenticated)",
            "GET",
            "api/logs",
            200,
            headers=auth_headers
        )
        if success:
            if not isinstance(response, list):
                print(f"❌ Expected array of log entries")
                return False
        return success

    def test_conversations_api(self):
        """Test conversations endpoint with authentication"""
        auth_headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.test_session_token}'
        }
        
        success, response = self.run_test(
            "Get Conversations (Authenticated)",
            "GET",
            "api/conversations",
            200,
            headers=auth_headers
        )
        if success:
            if not isinstance(response, list):
                print(f"❌ Expected array of conversations")
                return False
        return success

    def test_root_api(self):
        """Test root API endpoint returns WhatsApp 365 Bot message"""
        success, response = self.run_test(
            "Root API - WhatsApp 365 Bot",
            "GET",
            "api/",
            200
        )
        if success:
            # Verify the response contains the correct message
            if response.get('message') != 'WhatsApp 365 Bot API':
                print(f"❌ Expected 'WhatsApp 365 Bot API' message, got: {response.get('message')}")
                return False
            print(f"✅ Correct WhatsApp 365 Bot API message returned")
        return success

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        # Test 1: GET /api/auth/me without cookie should return 401
        success_unauth, _ = self.run_test(
            "Auth Me - Unauthenticated (Should Return 401)",
            "GET",
            "api/auth/me",
            401
        )
        
        if not success_unauth:
            return False
        
        # Test 2: GET /api/auth/me with valid session token should return 200
        auth_headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.test_session_token}'
        }
        
        success_auth, user_data = self.run_test(
            "Auth Me - Authenticated with Bearer Token",
            "GET", 
            "api/auth/me",
            200,
            headers=auth_headers
        )
        
        if success_auth:
            # Verify user data structure
            required_fields = ['user_id', 'email', 'name']
            for field in required_fields:
                if field not in user_data:
                    print(f"❌ Missing required user field: {field}")
                    return False
            
            if user_data['user_id'] != self.test_user_id:
                print(f"❌ User ID mismatch. Expected: {self.test_user_id}, Got: {user_data['user_id']}")
                return False
            
            print(f"✅ Authenticated user data correct: {user_data['email']}")
        
        return success_unauth and success_auth

    def test_knowledge_base_apis(self):
        """Test Knowledge Base APIs"""
        print("\n📚 Testing Knowledge Base endpoints...")
        
        # Test 1: GET /api/knowledge (list documents)
        list_success, initial_docs = self.run_test(
            "List Knowledge Documents",
            "GET",
            "api/knowledge",
            200
        )
        if not list_success:
            return False
        
        if not isinstance(initial_docs, list):
            print(f"❌ Expected array of documents, got {type(initial_docs)}")
            return False
        
        print(f"📋 Found {len(initial_docs)} existing documents")
        
        # Test 2: Create a test TXT file for upload
        test_content = "This is a test knowledge base document.\n\nIt contains sample information about our test company.\n\nWe provide excellent testing services."
        
        # Test 3: POST /api/knowledge/upload (upload document)
        files = {'file': ('test_knowledge.txt', test_content.encode(), 'text/plain')}
        
        try:
            # Use requests to upload file
            url = f"{self.base_url}/api/knowledge/upload"
            print(f"\n🔍 Testing File Upload...")
            print(f"   URL: POST {url}")
            
            response = requests.post(url, files=files, timeout=30)
            
            if response.status_code == 200:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                upload_data = response.json()
                
                # Verify upload response structure
                required_fields = ['id', 'filename', 'file_type', 'char_count', 'enabled']
                for field in required_fields:
                    if field not in upload_data:
                        print(f"❌ Missing field in upload response: {field}")
                        return False
                
                doc_id = upload_data['id']
                print(f"📄 Uploaded document ID: {doc_id}")
                
            else:
                print(f"❌ Failed - Expected 200, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")
                return False
                
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False
        
        self.tests_run += 1
        
        # Test 4: Verify document appears in list
        list_success_2, updated_docs = self.run_test(
            "Verify Document in List",
            "GET", 
            "api/knowledge",
            200
        )
        if not list_success_2:
            return False
        
        # Check if our uploaded doc appears in the list
        uploaded_doc = next((doc for doc in updated_docs if doc.get('id') == doc_id), None)
        if not uploaded_doc:
            print(f"❌ Uploaded document not found in list")
            return False
        
        print(f"✅ Document found in list: {uploaded_doc['filename']}")
        
        # Test 5: GET /api/knowledge/{id}/preview (preview document)
        preview_success, preview_data = self.run_test(
            "Preview Document",
            "GET",
            f"api/knowledge/{doc_id}/preview",
            200
        )
        if not preview_success:
            return False
        
        if 'preview' not in preview_data:
            print(f"❌ Missing 'preview' field in response")
            return False
        
        if len(preview_data['preview']) == 0:
            print(f"❌ Preview is empty")
            return False
        
        print(f"✅ Preview retrieved: {len(preview_data['preview'])} characters")
        
        # Test 6: PATCH /api/knowledge/{id}/toggle (toggle enabled state)
        initial_state = uploaded_doc['enabled']
        toggle_success, toggle_data = self.run_test(
            "Toggle Document State",
            "PATCH",
            f"api/knowledge/{doc_id}/toggle",
            200
        )
        if not toggle_success:
            return False
        
        if 'enabled' not in toggle_data:
            print(f"❌ Missing 'enabled' field in toggle response")
            return False
        
        if toggle_data['enabled'] == initial_state:
            print(f"❌ Document state did not change after toggle")
            return False
        
        print(f"✅ Document state toggled: {initial_state} → {toggle_data['enabled']}")
        
        # Test 7: DELETE /api/knowledge/{id} (delete document)
        delete_success, _ = self.run_test(
            "Delete Document",
            "DELETE",
            f"api/knowledge/{doc_id}",
            200
        )
        if not delete_success:
            return False
        
        # Test 8: Verify document is removed from list
        final_list_success, final_docs = self.run_test(
            "Verify Document Deleted",
            "GET",
            "api/knowledge",
            200
        )
        if not final_list_success:
            return False
        
        deleted_doc = next((doc for doc in final_docs if doc.get('id') == doc_id), None)
        if deleted_doc:
            print(f"❌ Document still exists after deletion")
            return False
        
        print(f"✅ Document successfully deleted")
        
        # Test 9: Test error handling - try to access deleted document
        error_success, _ = self.run_test(
            "Access Deleted Document (Should Fail)",
            "GET",
            f"api/knowledge/{doc_id}/preview",
            404
        )
        
        return error_success

    def run_test_with_file_upload(self, name, method, endpoint, expected_status, files=None, data=None):
        """Helper method for file upload tests"""
        url = f"{self.base_url}/{endpoint}"
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {method} {url}")
        
        try:
            if method == 'POST' and files:
                response = requests.post(url, files=files, data=data, timeout=30)
            else:
                return self.run_test(name, method, endpoint, expected_status, data)

            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                response_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text
                print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")

            return success, response.json() if success and response.headers.get('content-type', '').startswith('application/json') else {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def run_all_tests(self):
        """Run all API tests"""
        print("="*60)
        print("🤖 WhatsApp AI Bot - Backend API Testing")
        print(f"🌐 Base URL: {self.base_url}")
        print(f"🕒 Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("="*60)

        # Test all endpoints in proper order
        test_methods = [
            self.test_root_api,                # Test root API returns WhatsApp 365 Bot message
            self.test_auth_endpoints,          # Test authentication (401 without cookie, 200 with token)
            self.test_wa_status_api,          # Test WhatsApp endpoints (these might not require auth)
            self.test_wa_qr_api,
            self.test_config_api,             # Test config save with booking_types and strict_mode
            self.test_stats_api,              # Test stats returns pending_actions count
            self.test_actions_api,            # Test actions list and update
            self.test_logs_api,
            self.test_conversations_api,
            self.test_knowledge_base_apis,
        ]

        for test_method in test_methods:
            try:
                test_method()
            except Exception as e:
                print(f"❌ Test method {test_method.__name__} failed with error: {e}")

        # Print final results
        print("\n" + "="*60)
        print("📊 TEST SUMMARY")
        print("="*60)
        print(f"✅ Tests Passed: {self.tests_passed}")
        print(f"❌ Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"📈 Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%" if self.tests_run > 0 else "No tests run")

        # Print failed tests
        failed_tests = [test for test in self.test_results if not test['success']]
        if failed_tests:
            print(f"\n❌ FAILED TESTS ({len(failed_tests)}):")
            for test in failed_tests:
                status = test.get('actual_status', 'UNKNOWN')
                error = test.get('error', 'HTTP Error')
                print(f"   - {test['name']}: {status} ({error})")

        return self.tests_passed == self.tests_run

def main():
    tester = WhatsAppBotAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())