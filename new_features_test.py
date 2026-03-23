#!/usr/bin/env python3
"""
NEW FEATURES TESTING for Mzansi Distribution Tracker
Specifically testing:
1. Automatic Invoice Number Generation (INV-YYYYMMDD-ROUTE-####)
2. Cash Shortage Tracking
3. Daily Route Total Accumulation
"""

import requests
import json
import sys
from datetime import datetime

class NewFeaturesTester:
    def __init__(self, base_url="https://expo-production-2.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.driver_token = None
        self.admin_token = None
        self.test_data = {}
        self.passed_tests = 0
        self.failed_tests = 0
        
    def log_test(self, test_name, success, message="", details=""):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        if message:
            print(f"    {message}")
        if details and not success:
            print(f"    Details: {details}")
        print()
        
        if success:
            self.passed_tests += 1
        else:
            self.failed_tests += 1
            
    def make_request(self, method, endpoint, token=None, data=None, params=None):
        """Make HTTP request with error handling"""
        url = f"{self.base_url}{endpoint}"
        headers = {"Content-Type": "application/json"}
        
        if token:
            headers["Authorization"] = f"Bearer {token}"
            
        try:
            if method == "GET":
                response = requests.get(url, headers=headers, params=params, timeout=30)
            elif method == "POST":
                response = requests.post(url, headers=headers, json=data, timeout=30)
            elif method == "PUT":
                response = requests.put(url, headers=headers, json=data, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            return response
        except Exception as e:
            print(f"Request error ({method} {endpoint}): {str(e)}")
            return None
    
    def setup_test_environment(self):
        """Seed data and authenticate"""
        print("🌱 SETTING UP TEST ENVIRONMENT...")
        
        # 1. Seed data
        response = self.make_request("POST", "/seed-all")
        if not response or response.status_code != 200:
            self.log_test("Seed Data", False, f"Failed to seed data: {response.status_code if response else 'No response'}")
            return False
        
        self.log_test("Seed Data", True, "Demo data seeded successfully")
        
        # 2. Driver login
        driver_data = {"phone": "0812345678", "pin": "1234"}
        response = self.make_request("POST", "/auth/login", data=driver_data)
        if not response or response.status_code != 200:
            self.log_test("Driver Login", False, f"Login failed: {response.status_code if response else 'No response'}")
            return False
            
        data = response.json()
        self.driver_token = data.get("token")
        self.log_test("Driver Login", True, f"Logged in as: {data['user']['name']}")
        
        # 3. Admin login 
        admin_data = {"phone": "0800000001", "pin": "0000"}
        response = self.make_request("POST", "/auth/login", data=admin_data)
        if response and response.status_code == 200:
            data = response.json()
            self.admin_token = data.get("token")
            self.log_test("Admin Login", True, f"Logged in as admin: {data['user']['name']}")
        
        # 4. Get test data (routes, customers, products, vehicles)
        for endpoint, key in [("/routes", "routes"), ("/customers", "customers"), 
                              ("/products", "products"), ("/vehicles", "vehicles")]:
            response = self.make_request("GET", endpoint, token=self.admin_token)
            if response and response.status_code == 200:
                items = response.json()
                if items:
                    self.test_data[key] = items
                    
        return bool(self.driver_token and self.test_data.get("routes"))
    
    def test_daily_route_start(self):
        """Start a daily route for testing sales"""
        print("🚛 STARTING DAILY ROUTE...")
        
        if not self.test_data.get("routes") or not self.test_data.get("vehicles"):
            self.log_test("Start Route Prerequisites", False, "Missing routes or vehicles data")
            return False
            
        route = self.test_data["routes"][0]
        vehicle = self.test_data["vehicles"][0]
        
        start_route_data = {
            "route_id": route["id"],
            "vehicle_id": vehicle["id"],
            "opening_km": 15000.0,
            "crates_out": 100
        }
        
        response = self.make_request("POST", "/daily-routes/start", token=self.driver_token, data=start_route_data)
        if response and response.status_code == 200:
            route_data = response.json()
            self.test_data["active_route"] = route_data
            self.log_test("Start Daily Route", True, f"Route started with vehicle: {route_data.get('vehicle_name')}")
            return True
        else:
            error_msg = response.text if response else "No response"
            self.log_test("Start Daily Route", False, f"Status: {response.status_code if response else 'None'}", error_msg)
            return False
    
    def test_invoice_number_generation(self):
        """Test automatic invoice number generation"""
        print("🧾 TESTING INVOICE NUMBER GENERATION...")
        
        if not self.test_data.get("customers") or not self.test_data.get("products") or not self.test_data.get("routes"):
            self.log_test("Invoice Generation Prerequisites", False, "Missing required data")
            return False
            
        customer = self.test_data["customers"][0]
        product = self.test_data["products"][0]
        route = self.test_data["routes"][0]
        
        # Create sale with invoice R180, cash R150 = shortage R30 (as per test requirements)
        sale_data = {
            "route_id": route["id"],
            "customer_id": customer["id"],
            "customer_name": customer["name"],
            "items": [
                {
                    "product_id": product["id"],
                    "product_name": product["name"],
                    "quantity_delivered": 12,  # 12 units at R15 = R180
                    "quantity_returned": 0,
                    "damages": 0,
                    "unit_price": 15.0
                }
            ],
            "crates_dropped": 2,
            "crates_collected": 1,
            "cash_collected": 150.0,  # R30 shortage (180 - 150 = 30)
            "payment_type": "cash",
            "delivery_status": "delivered",
            "notes": "Test sale for invoice number generation"
        }
        
        response = self.make_request("POST", "/sales", token=self.driver_token, data=sale_data)
        if response and response.status_code == 200:
            sale_response = response.json()
            invoice_number = sale_response.get("invoice_number")
            shortage_amount = sale_response.get("shortage_amount", 0)
            total_amount = sale_response.get("total_amount", 0)
            
            # Store for later tests
            self.test_data["first_sale"] = sale_response
            
            # Check invoice number format: INV-YYYYMMDD-ROUTE-####
            today = datetime.now().strftime("%Y%m%d")
            route_code = route["name"][:4].upper().replace(" ", "")
            expected_pattern = f"INV-{today}-{route_code}-"
            
            if invoice_number and invoice_number.startswith(expected_pattern):
                # Extract and validate sequence number
                sequence_part = invoice_number.split("-")[-1]
                if sequence_part == "0001":  # First sale should be 0001
                    self.log_test("Invoice Number Generation", True, 
                                f"Invoice: {invoice_number} (Format: INV-YYYYMMDD-{route_code}-XXXX)")
                else:
                    self.log_test("Invoice Number Generation", False, 
                                f"Wrong sequence number: {sequence_part}, expected 0001")
            else:
                self.log_test("Invoice Number Generation", False, 
                            f"Wrong format: {invoice_number}, expected: {expected_pattern}XXXX")
                
            # Check shortage calculation
            expected_shortage = total_amount - 150.0  # cash_collected
            if abs(shortage_amount - expected_shortage) < 0.01:
                self.log_test("Shortage Calculation", True, 
                            f"Shortage: R{shortage_amount} (Total: R{total_amount}, Cash: R150)")
            else:
                self.log_test("Shortage Calculation", False, 
                            f"Wrong shortage: R{shortage_amount}, expected: R{expected_shortage}")
                
            return True
        else:
            error_msg = response.text if response else "No response"
            self.log_test("Invoice Number Generation", False, 
                        f"Sale creation failed: {response.status_code if response else 'None'}", error_msg)
            return False
    
    def test_invoice_sequence_increment(self):
        """Test that invoice sequence numbers increment correctly"""
        print("📊 TESTING INVOICE SEQUENCE INCREMENT...")
        
        if not self.test_data.get("customers") or not self.test_data.get("products") or not self.test_data.get("routes"):
            self.log_test("Sequence Test Prerequisites", False, "Missing required data")
            return False
            
        customer = self.test_data["customers"][0]
        product = self.test_data["products"][0]
        route = self.test_data["routes"][0]
        
        # Create second sale to test sequence increment
        sale_data = {
            "route_id": route["id"],
            "customer_id": customer["id"],
            "customer_name": customer["name"],
            "items": [
                {
                    "product_id": product["id"],
                    "product_name": product["name"],
                    "quantity_delivered": 8,  # 8 units at R20 = R160
                    "quantity_returned": 0,
                    "damages": 0,
                    "unit_price": 20.0
                }
            ],
            "crates_dropped": 1,
            "crates_collected": 1,
            "cash_collected": 140.0,  # R20 shortage (160 - 140 = 20)
            "payment_type": "cash",
            "delivery_status": "delivered",
            "notes": "Second test sale for sequence increment"
        }
        
        response = self.make_request("POST", "/sales", token=self.driver_token, data=sale_data)
        if response and response.status_code == 200:
            sale_response = response.json()
            invoice_number = sale_response.get("invoice_number")
            
            # Store for route totals test
            self.test_data["second_sale"] = sale_response
            
            # Check that sequence incremented to 0002
            if invoice_number and invoice_number.endswith("-0002"):
                self.log_test("Invoice Sequence Increment", True, 
                            f"Second invoice: {invoice_number} (sequence: 0002)")
                return True
            else:
                self.log_test("Invoice Sequence Increment", False, 
                            f"Wrong sequence: {invoice_number}, expected to end with -0002")
                return False
        else:
            error_msg = response.text if response else "No response"
            self.log_test("Invoice Sequence Increment", False, 
                        f"Second sale failed: {response.status_code if response else 'None'}", error_msg)
            return False
    
    def test_daily_route_accumulation(self):
        """Test that daily route totals accumulate correctly"""
        print("📈 TESTING DAILY ROUTE ACCUMULATION...")
        
        # Get active route data to check totals
        response = self.make_request("GET", "/daily-routes/active", token=self.driver_token)
        if response and response.status_code == 200:
            active_routes = response.json()
            if not active_routes:
                self.log_test("Route Accumulation", False, "No active routes found")
                return False
                
            route = active_routes[0]  # Get the active route
            
            # Check if totals exist
            total_expected = route.get("total_expected", 0)
            total_collected = route.get("total_collected", 0)
            total_shortage = route.get("total_shortage", 0)
            sales_count = route.get("sales_count", 0)
            
            # Expected values based on our two test sales:
            # Sale 1: Total R180, Cash R150, Shortage R30
            # Sale 2: Total R160, Cash R140, Shortage R20
            # Expected totals: Total R340, Cash R290, Shortage R50
            expected_total_amount = 180.0 + 160.0  # R340
            expected_total_cash = 150.0 + 140.0    # R290  
            expected_total_shortage = 30.0 + 20.0   # R50
            expected_sales_count = 2
            
            tests_passed = 0
            
            # Check total expected amount
            if abs(total_expected - expected_total_amount) < 0.01:
                self.log_test("Total Expected Amount", True, f"R{total_expected} (correct)")
                tests_passed += 1
            else:
                self.log_test("Total Expected Amount", False, 
                            f"R{total_expected}, expected R{expected_total_amount}")
            
            # Check total collected amount
            if abs(total_collected - expected_total_cash) < 0.01:
                self.log_test("Total Collected Amount", True, f"R{total_collected} (correct)")
                tests_passed += 1
            else:
                self.log_test("Total Collected Amount", False, 
                            f"R{total_collected}, expected R{expected_total_cash}")
            
            # Check total shortage
            if abs(total_shortage - expected_total_shortage) < 0.01:
                self.log_test("Total Shortage Amount", True, f"R{total_shortage} (correct)")
                tests_passed += 1
            else:
                self.log_test("Total Shortage Amount", False, 
                            f"R{total_shortage}, expected R{expected_total_shortage}")
            
            # Check sales count
            if sales_count == expected_sales_count:
                self.log_test("Sales Count", True, f"{sales_count} sales (correct)")
                tests_passed += 1
            else:
                self.log_test("Sales Count", False, f"{sales_count}, expected {expected_sales_count}")
            
            # Overall accumulation test
            if tests_passed == 4:
                self.log_test("Daily Route Accumulation", True, 
                            "All daily route totals accumulated correctly")
                return True
            else:
                self.log_test("Daily Route Accumulation", False, 
                            f"Only {tests_passed}/4 accumulation tests passed")
                return False
                
        else:
            error_msg = response.text if response else "No response"
            self.log_test("Daily Route Accumulation", False, 
                        f"Failed to get active routes: {response.status_code if response else 'None'}", error_msg)
            return False
    
    def run_new_features_test(self):
        """Run all new feature tests"""
        print("🚀 TESTING NEW FEATURES: Invoice Generation & Cash Shortage Tracking")
        print("=" * 80)
        
        try:
            # Setup environment
            if not self.setup_test_environment():
                print("❌ CRITICAL: Failed to setup test environment. Stopping tests.")
                return False
                
            # Start daily route
            if not self.test_daily_route_start():
                print("❌ CRITICAL: Failed to start daily route. Stopping tests.")
                return False
                
            # Test new features
            self.test_invoice_number_generation()
            self.test_invoice_sequence_increment()
            self.test_daily_route_accumulation()
            
        except Exception as e:
            print(f"❌ CRITICAL ERROR: {str(e)}")
            import traceback
            traceback.print_exc()
        
        # Print summary
        print("\n" + "=" * 80)
        print("📋 NEW FEATURES TEST SUMMARY")
        print("=" * 80)
        print(f"✅ PASSED: {self.passed_tests}")
        print(f"❌ FAILED: {self.failed_tests}")
        print(f"📊 TOTAL:  {self.passed_tests + self.failed_tests}")
        
        if self.failed_tests == 0:
            print("\n🎉 ALL NEW FEATURES TESTS PASSED!")
            print("✅ Automatic Invoice Number Generation: Working")
            print("✅ Cash Shortage Tracking: Working")
            print("✅ Daily Route Accumulation: Working")
        else:
            print(f"\n⚠️  {self.failed_tests} test(s) failed. Check details above.")
            
        return self.failed_tests == 0

def main():
    """Main entry point"""
    tester = NewFeaturesTester()
    success = tester.run_new_features_test()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()