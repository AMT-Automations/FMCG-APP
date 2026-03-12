import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "https://route-sales-ops.preview.emergentagent.com/api"
DEMO_PHONE = "0812345678"
DEMO_PIN = "1234"

class EdgeCaseTester:
    def __init__(self):
        self.token = None
        self.user_data = None
        
    def log(self, message, status="INFO"):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] [{status}] {message}")
    
    def make_request(self, method, endpoint, data=None, headers=None):
        url = f"{BASE_URL}{endpoint}"
        
        if headers is None:
            headers = {}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
            
        try:
            if method == "GET":
                response = requests.get(url, headers=headers, params=data, timeout=30)
            elif method == "POST":
                headers["Content-Type"] = "application/json"
                response = requests.post(url, headers=headers, json=data, timeout=30)
            elif method == "PUT":
                headers["Content-Type"] = "application/json"
                response = requests.put(url, headers=headers, json=data, timeout=30)
                
            self.log(f"{method} {endpoint} -> {response.status_code}")
            return response.status_code, response.text
            
        except Exception as e:
            self.log(f"Request failed: {str(e)}", "ERROR")
            return None, str(e)
    
    def login(self):
        """Login to get token"""
        login_data = {"phone": DEMO_PHONE, "pin": DEMO_PIN}
        status, text = self.make_request("POST", "/auth/login", login_data)
        if status == 200:
            result = json.loads(text)
            self.token = result["token"]
            self.user_data = result["user"]
            return True
        return False
    
    def test_authentication_edge_cases(self):
        """Test authentication edge cases"""
        self.log("=== Testing Authentication Edge Cases ===")
        
        # Wrong PIN
        status, _ = self.make_request("POST", "/auth/login", {"phone": DEMO_PHONE, "pin": "0000"})
        if status == 401:
            self.log("✅ Wrong PIN correctly rejected", "SUCCESS")
        else:
            self.log(f"❌ Wrong PIN returned {status}, expected 401", "ERROR")
        
        # Non-existent phone
        status, _ = self.make_request("POST", "/auth/login", {"phone": "0999999999", "pin": "1234"})
        if status == 401:
            self.log("✅ Non-existent phone correctly rejected", "SUCCESS")
        else:
            self.log(f"❌ Non-existent phone returned {status}, expected 401", "ERROR")
        
        # Invalid token access
        headers = {"Authorization": "Bearer invalid_token"}
        status, _ = self.make_request("GET", "/auth/me", headers=headers)
        if status == 401:
            self.log("✅ Invalid token correctly rejected", "SUCCESS")
        else:
            self.log(f"❌ Invalid token returned {status}, expected 401", "ERROR")
    
    def test_duplicate_daily_route_start(self):
        """Test starting route when already active"""
        self.log("=== Testing Duplicate Daily Route Start ===")
        
        if not self.token:
            return
        
        # Get a route
        status, text = self.make_request("GET", "/routes")
        if status != 200:
            return
        
        routes = json.loads(text)
        if not routes:
            return
        
        route_id = routes[0]["id"]
        
        # Start first route
        start_data = {"route_id": route_id, "opening_km": 1000, "crates_out": 30}
        status1, _ = self.make_request("POST", "/daily-routes/start", start_data)
        
        # Try to start another route
        status2, _ = self.make_request("POST", "/daily-routes/start", start_data)
        
        if status1 == 200 and status2 == 400:
            self.log("✅ Duplicate route start correctly prevented", "SUCCESS")
        else:
            self.log(f"❌ Duplicate route handling failed: {status1}, {status2}", "ERROR")
    
    def test_sales_without_active_route(self):
        """Test recording sale without active route"""
        self.log("=== Testing Sales Without Active Route ===")
        
        if not self.token:
            return
        
        # Get customers and products
        status, text = self.make_request("GET", "/customers")
        if status != 200:
            return
        customers = json.loads(text)
        
        status, text = self.make_request("GET", "/products")  
        if status != 200:
            return
        products = json.loads(text)
        
        if not customers or not products:
            return
        
        # End any active route first by trying to get it
        status, text = self.make_request("GET", "/daily-routes/active")
        if status == 200 and text != "null":
            route_data = json.loads(text)
            if route_data:
                # End the route
                end_data = {"closing_km": 1100, "crates_in": 20}
                self.make_request("PUT", f"/daily-routes/{route_data['id']}/end", end_data)
        
        # Now try to record sale without active route
        sale_data = {
            "route_id": customers[0].get("route_id", "fake_route"),
            "customer_id": customers[0]["id"],
            "customer_name": customers[0]["name"],
            "items": [{
                "product_id": products[0]["id"],
                "product_name": products[0]["name"],
                "quantity_delivered": 5,
                "unit_price": products[0]["price"]
            }],
            "cash_collected": 5 * products[0]["price"]
        }
        
        status, _ = self.make_request("POST", "/sales", sale_data)
        
        # Sale should work even without active route (business requirement check)
        if status in [200, 201]:
            self.log("ℹ️  Sale allowed without active route (design choice)", "WARNING")
        else:
            self.log(f"ℹ️  Sale rejected without active route: {status}", "INFO")
    
    def test_reports_with_no_data(self):
        """Test reports with no data"""
        self.log("=== Testing Reports With No Data ===")
        
        if not self.token:
            return
        
        # Test with future date (should have no data)
        future_date = "2026-12-31"
        status, text = self.make_request("GET", "/reports/daily-summary", {"date_str": future_date})
        
        if status == 200:
            data = json.loads(text)
            if data["total_sales"] == 0 and data["total_collected"] == 0:
                self.log("✅ Empty report correctly returned for future date", "SUCCESS")
            else:
                self.log("❌ Report should be empty for future date", "ERROR")
        else:
            self.log(f"❌ Report request failed: {status}", "ERROR")
    
    def run_edge_case_tests(self):
        """Run edge case tests"""
        self.log("🔍 Starting Edge Case Tests for Backend APIs")
        
        # Login first
        if self.login():
            self.log("✅ Authentication successful for edge case testing")
        else:
            self.log("❌ Could not authenticate for edge case testing", "ERROR")
            return
        
        self.test_authentication_edge_cases()
        self.test_duplicate_daily_route_start()
        self.test_sales_without_active_route()
        self.test_reports_with_no_data()
        
        self.log("✅ Edge case testing completed")


if __name__ == "__main__":
    tester = EdgeCaseTester()
    tester.run_edge_case_tests()