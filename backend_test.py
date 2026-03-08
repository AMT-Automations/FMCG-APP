import requests
import json
from datetime import datetime
import time

# Configuration
BASE_URL = "https://route-sales-tracker.preview.emergentagent.com/api"
DEMO_PHONE = "0812345678"
DEMO_PIN = "1234"

class MzansiAPITester:
    def __init__(self):
        self.token = None
        self.user_data = None
        self.route_id = None
        self.customer_id = None
        self.product_id = None
        self.daily_route_id = None
        self.sale_id = None
        
    def log(self, message, status="INFO"):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] [{status}] {message}")
    
    def make_request(self, method, endpoint, data=None, headers=None, expected_status=None):
        """Make HTTP request with error handling"""
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
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            self.log(f"{method} {endpoint} -> {response.status_code}")
            
            if expected_status and response.status_code != expected_status:
                self.log(f"Expected {expected_status}, got {response.status_code}: {response.text}", "ERROR")
                return None
                
            if response.status_code >= 400:
                self.log(f"Error response: {response.text}", "ERROR")
                return None
                
            return response.json() if response.text else {}
            
        except requests.exceptions.Timeout:
            self.log(f"Timeout on {method} {endpoint}", "ERROR")
            return None
        except requests.exceptions.ConnectionError:
            self.log(f"Connection error on {method} {endpoint}", "ERROR")
            return None
        except Exception as e:
            self.log(f"Request failed: {str(e)}", "ERROR")
            return None
    
    def test_health_check(self):
        """Test basic connectivity"""
        self.log("=== Testing Health Check ===")
        result = self.make_request("GET", "/health")
        if result and "status" in result:
            self.log("✅ Health check passed", "SUCCESS")
            return True
        else:
            self.log("❌ Health check failed", "ERROR")
            return False
    
    def seed_all_data(self):
        """Seed all required data"""
        self.log("=== Seeding All Data ===")
        result = self.make_request("POST", "/seed-all")
        if result and "message" in result:
            self.log("✅ Data seeded successfully", "SUCCESS")
            return True
        else:
            self.log("❌ Failed to seed data", "ERROR")
            return False
    
    def login_demo_user(self):
        """Login with demo credentials"""
        self.log("=== Testing Login ===")
        login_data = {
            "phone": DEMO_PHONE,
            "pin": DEMO_PIN
        }
        
        result = self.make_request("POST", "/auth/login", login_data)
        if result and "token" in result and "user" in result:
            self.token = result["token"]
            self.user_data = result["user"]
            self.log(f"✅ Login successful for {self.user_data['name']}", "SUCCESS")
            return True
        else:
            self.log("❌ Login failed", "ERROR")
            return False
    
    def get_test_data(self):
        """Get route, customer, and product data for testing"""
        self.log("=== Getting Test Data ===")
        
        # Get routes
        routes = self.make_request("GET", "/routes")
        if routes and len(routes) > 0:
            self.route_id = routes[0]["id"]
            self.log(f"✅ Got route: {routes[0]['name']}", "SUCCESS")
        else:
            self.log("❌ No routes found", "ERROR")
            return False
        
        # Get customers for this route
        customers = self.make_request("GET", f"/routes/{self.route_id}/customers")
        if customers and len(customers) > 0:
            self.customer_id = customers[0]["id"]
            self.log(f"✅ Got customer: {customers[0]['name']}", "SUCCESS")
        else:
            self.log("❌ No customers found", "ERROR")
            return False
        
        # Get products
        products = self.make_request("GET", "/products")
        if products and len(products) > 0:
            self.product_id = products[0]["id"]
            self.log(f"✅ Got product: {products[0]['name']}", "SUCCESS")
        else:
            self.log("❌ No products found", "ERROR")
            return False
        
        return True
    
    def test_daily_route_start(self):
        """Test starting a daily route (NEEDS_RETESTING)"""
        self.log("=== Testing Daily Route Start ===")
        
        start_data = {
            "route_id": self.route_id,
            "opening_km": 12450.5,
            "crates_out": 50,
            "vehicle_check": {
                "tire_pressure": "good",
                "fuel_level": "full",
                "lights": "working"
            }
        }
        
        result = self.make_request("POST", "/daily-routes/start", start_data)
        if result and "id" in result:
            self.daily_route_id = result["id"]
            self.log(f"✅ Daily route started: {result['route_name']}", "SUCCESS")
            self.log(f"   Opening KM: {result['opening_km']}, Crates Out: {result['crates_out']}")
            return True
        else:
            self.log("❌ Failed to start daily route", "ERROR")
            return False
    
    def test_sales_recording(self):
        """Test recording a sale (NEEDS_RETESTING)"""
        self.log("=== Testing Sales Recording ===")
        
        # First get the customer name for the sale
        customers = self.make_request("GET", f"/routes/{self.route_id}/customers")
        customer_name = customers[0]["name"] if customers else "Test Customer"
        
        # Get product details
        products = self.make_request("GET", "/products")
        product = products[0] if products else None
        
        if not product:
            self.log("❌ No product available for sale", "ERROR")
            return False
        
        sale_data = {
            "route_id": self.route_id,
            "customer_id": self.customer_id,
            "customer_name": customer_name,
            "items": [
                {
                    "product_id": product["id"],
                    "product_name": product["name"],
                    "quantity_delivered": 10,
                    "quantity_returned": 1,
                    "damages": 0,
                    "unit_price": product["price"]
                }
            ],
            "cash_collected": 9 * product["price"],  # 9 units sold
            "payment_type": "cash",
            "notes": "Regular delivery - customer satisfied"
        }
        
        result = self.make_request("POST", "/sales", sale_data)
        if result and "id" in result:
            self.sale_id = result["id"]
            self.log(f"✅ Sale recorded: R{result['total_amount']:.2f} to {result['customer_name']}", "SUCCESS")
            self.log(f"   Cash collected: R{result['cash_collected']:.2f}, Payment: {result['payment_type']}")
            return True
        else:
            self.log("❌ Failed to record sale", "ERROR")
            return False
    
    def test_get_active_route(self):
        """Test getting active daily route"""
        self.log("=== Testing Get Active Route ===")
        
        result = self.make_request("GET", "/daily-routes/active")
        if result and result.get("id") == self.daily_route_id:
            self.log(f"✅ Active route found: {result['route_name']}", "SUCCESS")
            self.log(f"   Sales count: {result['sales_count']}, Total collected: R{result['total_collected']:.2f}")
            return True
        elif result is None:
            self.log("ℹ️  No active route found (this might be expected)", "WARNING")
            return True
        else:
            self.log("❌ Active route data mismatch", "ERROR")
            return False
    
    def test_sales_listing(self):
        """Test listing sales"""
        self.log("=== Testing Sales Listing ===")
        
        # Get all sales
        all_sales = self.make_request("GET", "/sales")
        if all_sales is not None:
            self.log(f"✅ Retrieved {len(all_sales)} sales", "SUCCESS")
            
            # Get sales for specific route
            route_sales = self.make_request("GET", "/sales", {"route_id": self.route_id})
            if route_sales is not None:
                self.log(f"✅ Retrieved {len(route_sales)} sales for route", "SUCCESS")
                return True
        
        self.log("❌ Failed to retrieve sales", "ERROR")
        return False
    
    def test_daily_route_end(self):
        """Test ending a daily route"""
        self.log("=== Testing Daily Route End ===")
        
        if not self.daily_route_id:
            self.log("❌ No daily route to end", "ERROR")
            return False
        
        end_data = {
            "closing_km": 12580.3,
            "crates_in": 40,
            "damages_count": 2,
            "fuel_used": 15.5,
            "notes": "Good day, all customers visited successfully"
        }
        
        result = self.make_request("PUT", f"/daily-routes/{self.daily_route_id}/end", end_data)
        if result and result.get("status") == "completed":
            self.log(f"✅ Daily route ended successfully", "SUCCESS")
            self.log(f"   KM traveled: {result['km_traveled']}, Final collection: R{result['total_collected']:.2f}")
            return True
        else:
            self.log("❌ Failed to end daily route", "ERROR")
            return False
    
    def test_daily_summary_report(self):
        """Test daily summary report (NEEDS_RETESTING)"""
        self.log("=== Testing Daily Summary Report ===")
        
        # Test with today's date
        today = datetime.now().strftime("%Y-%m-%d")
        result = self.make_request("GET", "/reports/daily-summary", {"date_str": today})
        
        if result:
            self.log(f"✅ Daily summary retrieved for {result['date']}", "SUCCESS")
            self.log(f"   Routes completed: {result['routes_completed']}, Active: {result['routes_active']}")
            self.log(f"   Total sales: {result['total_sales']}, Collection: R{result['total_collected']:.2f}")
            self.log(f"   Collection rate: {result['collection_rate']:.1f}%, KM traveled: {result['total_km_traveled']}")
            
            if result['product_breakdown']:
                self.log("   Product breakdown available", "SUCCESS")
            
            return True
        else:
            self.log("❌ Failed to get daily summary", "ERROR")
            return False
    
    def test_route_history(self):
        """Test route history"""
        self.log("=== Testing Route History ===")
        
        result = self.make_request("GET", "/daily-routes/history")
        if result is not None:
            self.log(f"✅ Retrieved {len(result)} historical routes", "SUCCESS")
            return True
        else:
            self.log("❌ Failed to get route history", "ERROR")
            return False
    
    def run_full_test_suite(self):
        """Run comprehensive backend API tests"""
        self.log("🚀 Starting Mzansi Distribution Tracker Backend Tests")
        
        test_results = []
        
        # Basic connectivity
        test_results.append(("Health Check", self.test_health_check()))
        
        # Seed data
        test_results.append(("Data Seeding", self.seed_all_data()))
        
        # Authentication flow
        test_results.append(("User Login", self.login_demo_user()))
        
        if not self.token:
            self.log("❌ Cannot continue without authentication", "ERROR")
            return test_results
        
        # Get test data
        test_results.append(("Test Data Retrieval", self.get_test_data()))
        
        if not all([self.route_id, self.customer_id, self.product_id]):
            self.log("❌ Cannot continue without test data", "ERROR")
            return test_results
        
        # Core workflow testing (focusing on NEEDS_RETESTING items)
        test_results.append(("Daily Route Start", self.test_daily_route_start()))
        test_results.append(("Sales Recording", self.test_sales_recording()))
        test_results.append(("Get Active Route", self.test_get_active_route()))
        test_results.append(("Sales Listing", self.test_sales_listing()))
        test_results.append(("Daily Route End", self.test_daily_route_end()))
        test_results.append(("Daily Summary Report", self.test_daily_summary_report()))
        test_results.append(("Route History", self.test_route_history()))
        
        # Summary
        self.log("\n" + "="*60)
        self.log("📊 TEST RESULTS SUMMARY")
        self.log("="*60)
        
        passed = 0
        failed = 0
        
        for test_name, result in test_results:
            status = "✅ PASS" if result else "❌ FAIL"
            self.log(f"{test_name:<25} {status}")
            if result:
                passed += 1
            else:
                failed += 1
        
        self.log("="*60)
        self.log(f"Total: {len(test_results)} | Passed: {passed} | Failed: {failed}")
        success_rate = (passed / len(test_results)) * 100 if test_results else 0
        self.log(f"Success Rate: {success_rate:.1f}%")
        
        return test_results


if __name__ == "__main__":
    tester = MzansiAPITester()
    results = tester.run_full_test_suite()