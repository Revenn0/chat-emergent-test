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
            required_fields = ['system_prompt', 'model_provider', 'model_name', 'bot_name']
            for field in required_fields:
                if field not in config_data:
                    print(f"❌ Missing required config field: {field}")
                    return False
        
        # Test POST config (save)
        test_config = {
            "system_prompt": "Test prompt for WhatsApp bot",
            "model_provider": "openai", 
            "model_name": "gpt-4o",
            "bot_name": "Test Bot"
        }
        
        post_success, _ = self.run_test(
            "Save Bot Config",
            "POST", 
            "api/config",
            200,
            data=test_config
        )
        
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