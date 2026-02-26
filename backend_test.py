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
        success, response = self.run_test(
            "WhatsApp Status",
            "GET",
            "api/wa/status",
            200
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
        success, response = self.run_test(
            "WhatsApp QR Code",
            "GET",
            "api/wa/qr",
            200
        )
        if success:
            if 'qr' not in response:
                print(f"❌ Missing 'qr' field in response")
                return False
        return success

    def test_config_api(self):
        """Test bot configuration endpoints"""
        # Test GET config
        get_success, config_data = self.run_test(
            "Get Bot Config",
            "GET",
            "api/config",
            200
        )
        
        if get_success:
            # Check all new expanded config fields from redesign
            required_fields = [
                # Identity fields
                'bot_name', 'greeting_message', 'fallback_message',
                # Model fields  
                'model_provider', 'model_name', 'temperature', 'max_tokens', 'top_p', 'system_prompt',
                # Behavior fields
                'language', 'tone', 'response_length',
                # Context fields
                'business_context', 'faq_text',
                # Security fields
                'rate_limit_enabled', 'rate_limit_msgs', 'rate_limit_window_minutes',
                'blocked_words', 'blocked_contacts', 'schedule_enabled', 'schedule_start', 'schedule_end'
            ]
            for field in required_fields:
                if field not in config_data:
                    print(f"❌ Missing required config field: {field}")
                    return False
            
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
            boolean_fields = ['rate_limit_enabled', 'schedule_enabled']
            for field in boolean_fields:
                if not isinstance(config_data[field], bool):
                    print(f"❌ Config field {field} should be boolean, got {type(config_data[field])}")
                    return False
            
            # Check array fields
            array_fields = ['blocked_words', 'blocked_contacts']
            for field in array_fields:
                if not isinstance(config_data[field], list):
                    print(f"❌ Config field {field} should be array, got {type(config_data[field])}")
                    return False
        
        # Test POST config (save) with comprehensive config
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
            # Security
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
            "Save Bot Config",
            "POST", 
            "api/config",
            200,
            data=test_config
        )
        
        # Verify the config was actually saved by fetching it again
        if post_success:
            verify_success, verify_data = self.run_test(
                "Verify Config Save",
                "GET",
                "api/config", 
                200
            )
            
            if verify_success:
                # Check a few key fields were updated
                key_fields_to_check = ['bot_name', 'temperature', 'language', 'tone']
                for field in key_fields_to_check:
                    if verify_data.get(field) != test_config[field]:
                        print(f"❌ Config field {field} was not saved correctly. Expected: {test_config[field]}, Got: {verify_data.get(field)}")
                        return False
                print("✅ Config save verification passed")
        
        return get_success and post_success

    def test_stats_api(self):
        """Test statistics endpoint"""
        success, response = self.run_test(
            "Get Stats",
            "GET",
            "api/stats", 
            200
        )
        if success:
            required_fields = ['total_conversations', 'total_messages', 'user_messages', 'bot_messages']
            for field in required_fields:
                if field not in response:
                    print(f"❌ Missing required stats field: {field}")
                    return False
        return success

    def test_logs_api(self):
        """Test logs endpoint"""
        success, response = self.run_test(
            "Get Logs",
            "GET",
            "api/logs",
            200
        )
        if success:
            if not isinstance(response, list):
                print(f"❌ Expected array of log entries")
                return False
        return success

    def test_conversations_api(self):
        """Test conversations endpoint"""
        success, response = self.run_test(
            "Get Conversations",
            "GET",
            "api/conversations",
            200
        )
        if success:
            if not isinstance(response, list):
                print(f"❌ Expected array of conversations")
                return False
        return success

    def test_root_api(self):
        """Test root API endpoint"""
        success, response = self.run_test(
            "Root API",
            "GET",
            "api/",
            200
        )
        return success

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

        # Test all endpoints
        test_methods = [
            self.test_root_api,
            self.test_wa_status_api,
            self.test_wa_qr_api,
            self.test_config_api,
            self.test_stats_api,
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