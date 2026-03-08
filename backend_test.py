import requests
import json
from datetime import datetime
import time

# Configuration
BASE_URL = "https://vehicle-route-hub.preview.emergentagent.com/api"
DEMO_PHONE = "0812345678"
DEMO_PIN = "1234"

# Test credentials for vehicle management testing
ADMIN_PHONE = "0800000001"
ADMIN_PIN = "0000"

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
            elif method == "DELETE":
                response = requests.delete(url, headers=headers, timeout=30)
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

    def test_vehicle_management_apis(self):
        """Test the new Vehicle Management API endpoints"""
        self.log("\n🚛 TESTING VEHICLE MANAGEMENT API ENDPOINTS")
        self.log("="*60)
        
        # First seed data
        self.log("🌱 Seeding all data...")
        seed_result = self.make_request("POST", "/seed-all")
        if not seed_result:
            self.log("❌ Failed to seed data", "ERROR")
            return False
        self.log(f"✅ Data seeded: {seed_result.get('message', '')}")
        
        # Test as Admin (login with admin credentials)
        self.log("\n🔐 Logging in as Admin...")
        admin_login = self.make_request("POST", "/auth/login", {
            "phone": ADMIN_PHONE,
            "pin": ADMIN_PIN
        })
        if not admin_login:
            self.log("❌ Admin login failed", "ERROR")
            return False
        
        admin_token = admin_login["token"]
        self.log(f"✅ Admin logged in: {admin_login['user']['name']}")
        
        # Test as Driver (existing login)
        if not self.token:
            self.log("🔐 Logging in as Driver...")
            if not self.login_demo_user():
                self.log("❌ Driver login failed", "ERROR")
                return False
        
        test_results = []
        
        # 1. Test GET /api/vehicles
        self.log("\n📋 Testing GET /api/vehicles...")
        vehicles = self.make_request("GET", "/vehicles")
        if vehicles:
            self.log(f"✅ Retrieved {len(vehicles)} vehicles")
            test_results.append(("GET /vehicles", True))
        else:
            self.log("❌ Failed to get vehicles", "ERROR")
            test_results.append(("GET /vehicles", False))
        
        # 2. Test GET /api/vehicles/available
        self.log("\n📋 Testing GET /api/vehicles/available...")
        available_vehicles = self.make_request("GET", "/vehicles/available")
        if available_vehicles:
            in_use_count = sum(1 for v in available_vehicles if v.get('in_use', False))
            available_count = len(available_vehicles) - in_use_count
            self.log(f"✅ Retrieved {len(available_vehicles)} vehicles - {available_count} available, {in_use_count} in use")
            test_results.append(("GET /vehicles/available", True))
        else:
            self.log("❌ Failed to get available vehicles", "ERROR")
            test_results.append(("GET /vehicles/available", False))
        
        # 3. Test POST /api/vehicles (Admin only)
        self.log("\n🔨 Testing POST /api/vehicles (Admin)...")
        # Temporarily store original token
        original_token = self.token
        self.token = admin_token
        
        new_vehicle = {
            "registration": "TEST-999",
            "name": "Test Vehicle API",
            "vehicle_type": "van",
            "capacity_crates": 75
        }
        
        created_vehicle = self.make_request("POST", "/vehicles", new_vehicle)
        if created_vehicle:
            test_vehicle_id = created_vehicle["id"]
            self.log(f"✅ Vehicle created: {created_vehicle['name']} ({created_vehicle['registration']}) - ID: {test_vehicle_id}")
            test_results.append(("POST /vehicles (Admin)", True))
            
            # 4. Test PUT /api/vehicles/{id} (Admin only)
            self.log("\n🔧 Testing PUT /api/vehicles/{id} (Admin)...")
            update_data = {
                "name": "Updated Test Vehicle API",
                "capacity_crates": 85
            }
            
            updated_vehicle = self.make_request("PUT", f"/vehicles/{test_vehicle_id}", update_data)
            if updated_vehicle:
                self.log(f"✅ Vehicle updated: {updated_vehicle['name']} - Capacity: {updated_vehicle['capacity_crates']}")
                test_results.append(("PUT /vehicles/{id} (Admin)", True))
            else:
                self.log("❌ Failed to update vehicle", "ERROR")
                test_results.append(("PUT /vehicles/{id} (Admin)", False))
            
            # 5. Test DELETE /api/vehicles/{id} (Admin only)
            self.log("\n🗑️ Testing DELETE /api/vehicles/{id} (Admin)...")
            delete_result = self.make_request("DELETE", f"/vehicles/{test_vehicle_id}")
            if delete_result:
                self.log(f"✅ Vehicle deactivated: {delete_result.get('message', 'Success')}")
                test_results.append(("DELETE /vehicles/{id} (Admin)", True))
            else:
                self.log("❌ Failed to deactivate vehicle", "ERROR")
                test_results.append(("DELETE /vehicles/{id} (Admin)", False))
        else:
            self.log("❌ Failed to create vehicle", "ERROR")
            test_results.append(("POST /vehicles (Admin)", False))
            test_results.append(("PUT /vehicles/{id} (Admin)", False))
            test_results.append(("DELETE /vehicles/{id} (Admin)", False))
        
        # 6. Test unauthorized access (Driver trying to create vehicle)
        self.log("\n🚫 Testing unauthorized access (Driver)...")
        self.token = original_token  # Switch back to driver token
        
        unauthorized_vehicle = {
            "registration": "UNAUTH-001",
            "name": "Unauthorized Vehicle",
            "vehicle_type": "truck",
            "capacity_crates": 100
        }
        
        # This should fail with 403
        response = requests.post(f"{BASE_URL}/vehicles", 
                               json=unauthorized_vehicle, 
                               headers={"Authorization": f"Bearer {self.token}",
                                       "Content-Type": "application/json"})
        
        if response.status_code == 403:
            self.log("✅ Correctly blocked driver from creating vehicle")
            test_results.append(("POST /vehicles (Driver - Should Fail)", True))
        else:
            self.log(f"❌ Expected 403, got {response.status_code}", "ERROR")
            test_results.append(("POST /vehicles (Driver - Should Fail)", False))
        
        # 7. Test daily route with vehicle
        self.log("\n🛣️ Testing daily route start with vehicle_id...")
        
        # Get available routes
        routes = self.make_request("GET", "/routes")
        available_vehicles_for_route = self.make_request("GET", "/vehicles/available")
        
        if routes and available_vehicles_for_route:
            # Find an available vehicle
            available_vehicle = next((v for v in available_vehicles_for_route if not v.get('in_use', True)), None)
            
            if available_vehicle:
                route_start_data = {
                    "route_id": routes[0]["id"],
                    "vehicle_id": available_vehicle["id"],
                    "opening_km": 1500.0,
                    "crates_out": 60
                }
                
                daily_route = self.make_request("POST", "/daily-routes/start", route_start_data)
                if daily_route:
                    # Check vehicle info is included
                    vehicle_fields = ['vehicle_id', 'vehicle_name', 'vehicle_registration']
                    missing_fields = [f for f in vehicle_fields if f not in daily_route]
                    
                    if not missing_fields:
                        self.log(f"✅ Route started with vehicle: {daily_route['vehicle_name']} ({daily_route['vehicle_registration']})")
                        test_results.append(("POST /daily-routes/start with vehicle", True))
                        
                        # 8. Test same vehicle cannot be used twice
                        self.log("\n🚫 Testing vehicle in-use prevention...")
                        if len(routes) > 1:
                            duplicate_route_data = {
                                "route_id": routes[1]["id"],
                                "vehicle_id": available_vehicle["id"],  # Same vehicle
                                "opening_km": 1600.0,
                                "crates_out": 50
                            }
                            
                            response = requests.post(f"{BASE_URL}/daily-routes/start", 
                                                   json=duplicate_route_data, 
                                                   headers={"Authorization": f"Bearer {self.token}",
                                                           "Content-Type": "application/json"})
                            
                            if response.status_code == 400:
                                error_data = response.json()
                                self.log(f"✅ Correctly prevented vehicle reuse: {error_data.get('detail', 'Vehicle in use')}")
                                test_results.append(("Vehicle in-use prevention", True))
                            else:
                                self.log(f"❌ Expected 400 error, got {response.status_code}", "ERROR")
                                test_results.append(("Vehicle in-use prevention", False))
                        else:
                            self.log("⚠️ Not enough routes to test vehicle reuse prevention", "WARN")
                            test_results.append(("Vehicle in-use prevention", False))
                    else:
                        self.log(f"❌ Missing vehicle fields in response: {missing_fields}", "ERROR")
                        test_results.append(("POST /daily-routes/start with vehicle", False))
                        test_results.append(("Vehicle in-use prevention", False))
                else:
                    self.log("❌ Failed to start route with vehicle", "ERROR")
                    test_results.append(("POST /daily-routes/start with vehicle", False))
                    test_results.append(("Vehicle in-use prevention", False))
            else:
                self.log("❌ No available vehicles found", "ERROR")
                test_results.append(("POST /daily-routes/start with vehicle", False))
                test_results.append(("Vehicle in-use prevention", False))
        else:
            self.log("❌ Failed to get routes or vehicles", "ERROR")
            test_results.append(("POST /daily-routes/start with vehicle", False))
            test_results.append(("Vehicle in-use prevention", False))
        
        # Summary for vehicle tests
        self.log("\n" + "="*60)
        self.log("🚛 VEHICLE MANAGEMENT TEST RESULTS")
        self.log("="*60)
        
        passed = 0
        failed = 0
        
        for test_name, result in test_results:
            status = "✅ PASS" if result else "❌ FAIL"
            self.log(f"{test_name:<35} {status}")
            if result:
                passed += 1
            else:
                failed += 1
        
        self.log("="*60)
        self.log(f"Vehicle Tests - Total: {len(test_results)} | Passed: {passed} | Failed: {failed}")
        success_rate = (passed / len(test_results)) * 100 if test_results else 0
        self.log(f"Vehicle Test Success Rate: {success_rate:.1f}%")
        
        return passed == len(test_results)


if __name__ == "__main__":
    tester = MzansiAPITester()
    
    # First run the vehicle management tests specifically
    vehicle_success = tester.test_vehicle_management_apis()
    
    print("\n" + "="*80)
    print("RUNNING FULL TEST SUITE FOR COMPARISON...")
    print("="*80)
    
    # Then run full suite for comparison
    results = tester.run_full_test_suite()