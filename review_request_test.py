#!/usr/bin/env python3
"""
REVIEW REQUEST TESTING - New Features
Testing specific features mentioned in the review request:
1. Support Info Endpoint
2. Clear Data Endpoint (Admin Only) 
3. Split Payments in Sale
4. Comprehensive Sale Response
5. PDF/Excel Export

Following exact test scenarios from review request.
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from frontend/.env
BASE_URL = "https://order-system-preview-2.preview.emergentagent.com/api"

# Credentials from review request
ADMIN_PHONE = "0800000001"
ADMIN_PIN = "0000"
DRIVER_PHONE = "0812345678"  
DRIVER_PIN = "1234"

class ReviewRequestTester:
    def __init__(self):
        self.admin_token = None
        self.driver_token = None
        self.test_data = {}
        self.results = {"passed": 0, "failed": 0, "details": []}

    def log(self, test, success, message=""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = f"{status}: {test}"
        if message:
            result += f" - {message}"
        print(result)
        self.results["details"].append(result)
        
        if success:
            self.results["passed"] += 1
        else:
            self.results["failed"] += 1

    def request(self, method, endpoint, data=None, headers=None, params=None):
        """Make API request"""
        try:
            url = f"{BASE_URL}{endpoint}"
            response = requests.request(
                method=method,
                url=url, 
                json=data,
                headers=headers,
                params=params,
                timeout=30
            )
            return response
        except Exception as e:
            print(f"   Request error: {e}")
            return None

    def authenticate(self):
        """Authenticate users"""
        print("🔐 AUTHENTICATION")
        print("-" * 50)
        
        # Admin login
        admin_creds = {"phone": ADMIN_PHONE, "pin": ADMIN_PIN}
        response = self.request("POST", "/auth/login", admin_creds)
        if response and response.status_code == 200:
            self.admin_token = response.json()["token"]
            print(f"✅ Admin logged in: {ADMIN_PHONE}")
        else:
            print(f"❌ Admin login failed")
            return False

        # Driver login  
        driver_creds = {"phone": DRIVER_PHONE, "pin": DRIVER_PIN}
        response = self.request("POST", "/auth/login", driver_creds)
        if response and response.status_code == 200:
            self.driver_token = response.json()["token"]
            print(f"✅ Driver logged in: {DRIVER_PHONE}")
        else:
            print(f"❌ Driver login failed")
            return False

        return True

    def get_headers(self, role="admin"):
        """Get auth headers"""
        token = self.admin_token if role == "admin" else self.driver_token
        return {"Authorization": f"Bearer {token}"}

    def test_support_info(self):
        """TEST SCENARIO 1: GET /api/support-info"""
        print("\n📋 TEST 1: Support Info Endpoint")
        print("-" * 50)
        
        response = self.request("GET", "/support-info")
        if not response or response.status_code != 200:
            self.log("Support Info", False, f"Request failed: {response.status_code if response else 'No response'}")
            return
        
        try:
            data = response.json()
            required = ["company", "website", "support_email", "contact_number"]
            
            # Check all required fields
            missing = [field for field in required if field not in data]
            if missing:
                self.log("Support Info", False, f"Missing fields: {missing}")
                return
                
            self.log("Support Info", True, "Returns all required fields")
            print(f"   Company: {data['company']}")
            print(f"   Website: {data['website']}")  
            print(f"   Email: {data['support_email']}")
            print(f"   Phone: {data['contact_number']}")
            
        except json.JSONDecodeError:
            self.log("Support Info", False, "Invalid JSON response")

    def seed_test_data(self):
        """Seed test data using POST /api/seed-all"""
        print("\n🌱 SEEDING TEST DATA")
        print("-" * 50)
        
        response = self.request("POST", "/seed-all", headers=self.get_headers("admin"))
        if response and response.status_code == 200:
            print("✅ Test data seeded via POST /api/seed-all")
            return True
        else:
            print("⚠️ Seed may have failed, continuing...")
            return True  # Continue anyway

    def setup_sales_test(self):
        """Setup for sales testing - get IDs and start route"""
        print("\n⚙️ SETUP FOR SALES TESTS") 
        print("-" * 50)
        
        # Get route
        response = self.request("GET", "/routes", headers=self.get_headers("driver"))
        if not response or response.status_code != 200:
            return False
        routes = response.json()
        if not routes:
            return False
        self.test_data["route_id"] = routes[0]["id"]
        
        # Get customer 
        response = self.request("GET", "/customers", headers=self.get_headers("driver"))
        if not response or response.status_code != 200:
            return False
        customers = response.json()
        if not customers:
            return False
        self.test_data["customer_id"] = customers[0]["id"]
        self.test_data["customer_name"] = customers[0]["name"]
        
        # Get vehicle
        response = self.request("GET", "/vehicles/available", headers=self.get_headers("driver"))
        if not response or response.status_code != 200:
            return False
        vehicles = response.json()
        available = [v for v in vehicles if not v.get("in_use")]
        if not available:
            return False
        self.test_data["vehicle_id"] = available[0]["id"]
        
        # Start route
        route_start = {
            "route_id": self.test_data["route_id"],
            "vehicle_id": self.test_data["vehicle_id"],
            "opening_km": 100.0,
            "crates_out": 50
        }
        
        response = self.request("POST", "/daily-routes/start", route_start, headers=self.get_headers("driver"))
        if response and response.status_code == 200:
            print("✅ Route started for testing")
            return True
        else:
            return False

    def test_split_payments_sale(self):
        """TEST SCENARIO 3: Create sale with split payments (Cash: 50, EFT: 30, Shop2Shop: 20)"""
        print("\n💰 TEST 3: Split Payments in Sale")
        print("-" * 50)
        
        # Create sale with exact split from review request
        sale_data = {
            "route_id": self.test_data["route_id"],
            "customer_id": self.test_data["customer_id"], 
            "customer_name": self.test_data["customer_name"],
            "items": [{
                "product_id": "test_product",
                "product_name": "Test Product",
                "quantity_delivered": 5,
                "quantity_returned": 0,
                "damages": 0,
                "unit_price": 20.0  # 5 * 20 = 100
            }],
            "crates_dropped": 3,
            "crates_collected": 1,
            "cash_collected": 100.0,  # Sum of all payment methods
            "payment_type": "split",
            "split_payments": [
                {"method": "cash", "amount": 50.0},
                {"method": "eft", "amount": 30.0, "reference": "EFT123456"},
                {"method": "shop2shop", "amount": 20.0, "reference": "S2S789012"}
            ],
            "delivery_status": "delivered"
        }
        
        response = self.request("POST", "/sales", sale_data, headers=self.get_headers("driver"))
        if not response or response.status_code != 200:
            self.log("Split Payments Sale", False, f"Sale creation failed: {response.status_code if response else 'No response'}")
            return
        
        try:
            sale = response.json()
            
            # Verify total = 100 (sum of splits)
            if sale["total_amount"] != 100.0:
                self.log("Split Payments Sale", False, f"Total incorrect: {sale['total_amount']} != 100")
                return
            
            # Verify split_payments in response
            if not sale.get("split_payments"):
                self.log("Split Payments Sale", False, "split_payments missing from response")
                return
                
            # Check split payments details
            splits = sale["split_payments"]
            if len(splits) != 3:
                self.log("Split Payments Sale", False, f"Expected 3 payment methods, got {len(splits)}")
                return
                
            methods = [sp["method"] for sp in splits]
            expected_methods = ["cash", "eft", "shop2shop"]
            for method in expected_methods:
                if method not in methods:
                    self.log("Split Payments Sale", False, f"Missing payment method: {method}")
                    return
            
            self.test_data["sale_id"] = sale["id"]
            self.log("Split Payments Sale", True, "Split payments stored and returned correctly")
            print(f"   Total: R{sale['total_amount']}")
            print(f"   Payment methods: {len(splits)}")
            print(f"   Sale ID: {sale['id']}")
            
        except json.JSONDecodeError:
            self.log("Split Payments Sale", False, "Invalid JSON response")

    def test_comprehensive_sale_response(self):
        """TEST SCENARIO 4: Verify comprehensive sale response includes all required fields"""
        print("\n📊 TEST 4: Comprehensive Sale Response")
        print("-" * 50)
        
        if "sale_id" not in self.test_data:
            self.log("Comprehensive Sale Response", False, "No sale ID available")
            return
            
        response = self.request("GET", f"/sales/{self.test_data['sale_id']}", headers=self.get_headers("driver"))
        if not response or response.status_code != 200:
            self.log("Comprehensive Sale Response", False, "Failed to retrieve sale")
            return
        
        try:
            sale = response.json()
            
            # Check required fields from review request
            required_fields = [
                "invoice_number", "route_name", "customer_name", 
                "crates_dropped", "crates_collected", "split_payments"
            ]
            
            missing = [field for field in required_fields if field not in sale or sale[field] is None]
            if missing:
                self.log("Comprehensive Sale Response", False, f"Missing fields: {missing}")
                return
            
            # Verify invoice number format
            invoice = sale["invoice_number"]
            if not invoice.startswith("INV-"):
                self.log("Comprehensive Sale Response", False, f"Invalid invoice format: {invoice}")
                return
            
            # Verify crates tracking
            if sale["crates_dropped"] != 3 or sale["crates_collected"] != 1:
                self.log("Comprehensive Sale Response", False, "Crates tracking incorrect")
                return
            
            self.log("Comprehensive Sale Response", True, "All required fields present and correct")
            print(f"   Invoice: {invoice}")
            print(f"   Route: {sale['route_name']}")
            print(f"   Customer: {sale['customer_name']}")
            print(f"   Crates: {sale['crates_dropped']} dropped, {sale['crates_collected']} collected")
            
        except json.JSONDecodeError:
            self.log("Comprehensive Sale Response", False, "Invalid JSON response")

    def test_pdf_export(self):
        """TEST SCENARIO 5: PDF Export - GET /api/reports/export/pdf"""
        print("\n📄 TEST 5: PDF Export")
        print("-" * 50)
        
        response = self.request("GET", "/reports/export/pdf", headers=self.get_headers("driver"))
        if not response or response.status_code != 200:
            self.log("PDF Export", False, f"Export failed: {response.status_code if response else 'No response'}")
            return
        
        # Verify PDF is generated
        content_type = response.headers.get("content-type", "")
        if "application/pdf" not in content_type:
            self.log("PDF Export", False, f"Wrong content type: {content_type}")
            return
        
        pdf_size = len(response.content)
        if pdf_size < 1000:
            self.log("PDF Export", False, f"PDF too small: {pdf_size} bytes")
            return
        
        # Verify PDF format
        if not response.content.startswith(b'%PDF'):
            self.log("PDF Export", False, "Invalid PDF header")
            return
        
        self.log("PDF Export", True, f"PDF generated: {pdf_size} bytes")

    def test_excel_export(self):
        """TEST SCENARIO 6: Excel Export - GET /api/reports/export/excel"""
        print("\n📊 TEST 6: Excel Export")
        print("-" * 50)
        
        response = self.request("GET", "/reports/export/excel", headers=self.get_headers("driver"))
        if not response or response.status_code != 200:
            self.log("Excel Export", False, f"Export failed: {response.status_code if response else 'No response'}")
            return
        
        excel_size = len(response.content)
        if excel_size < 1000:
            self.log("Excel Export", False, f"Excel too small: {excel_size} bytes")
            return
        
        self.log("Excel Export", True, f"Excel generated: {excel_size} bytes")

    def test_clear_data_admin_only(self):
        """TEST SCENARIO 2: Clear Data Endpoint (Admin Only)"""
        print("\n🗑️ TEST 2: Clear Data Endpoint (Admin Only)")
        print("-" * 50)
        
        # Test driver access denied
        response = self.request("POST", "/admin/clear-data", headers=self.get_headers("driver"))
        if not response or response.status_code != 403:
            self.log("Clear Data - Driver Denied", False, f"Expected 403, got {response.status_code if response else 'No response'}")
            return
        
        print("✅ Driver correctly denied access (403)")
        
        # Test admin access
        response = self.request("POST", "/admin/clear-data", headers=self.get_headers("admin"))
        if not response or response.status_code != 200:
            self.log("Clear Data - Admin Access", False, f"Admin request failed: {response.status_code if response else 'No response'}")
            return
        
        try:
            data = response.json()
            
            # Verify expected collections cleared
            expected_collections = ["sales", "daily_routes", "stock_movements", "stock", "crates_tracking"]
            cleared = data.get("cleared", [])
            
            missing = [col for col in expected_collections if col not in cleared]
            if missing:
                self.log("Clear Data - Collections", False, f"Collections not cleared: {missing}")
                return
            
            self.log("Clear Data", True, f"Clears {len(cleared)} collections as expected")
            print(f"   Cleared: {cleared}")
            
        except json.JSONDecodeError:
            self.log("Clear Data", False, "Invalid JSON response")

    def run_all_tests(self):
        """Execute all test scenarios from review request"""
        print("🚀 REVIEW REQUEST TESTING - New Features")
        print("="*60)
        print("Backend URL:", BASE_URL)
        print("Admin:", ADMIN_PHONE)
        print("Driver:", DRIVER_PHONE)
        print("="*60)
        
        # Authentication
        if not self.authenticate():
            return False
        
        # Test 1: Support Info
        self.test_support_info()
        
        # Seed data 
        self.seed_test_data()
        
        # Setup for sales tests
        if not self.setup_sales_test():
            print("⚠️ Sales test setup failed - skipping sales tests")
        else:
            # Test 3: Split Payments
            self.test_split_payments_sale()
            
            # Test 4: Comprehensive Sale Response
            self.test_comprehensive_sale_response()
        
        # Test 5 & 6: Exports
        self.test_pdf_export()
        self.test_excel_export()
        
        # Test 2: Clear Data (run last as it clears data)
        self.test_clear_data_admin_only()
        
        return True

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("📊 REVIEW REQUEST TEST RESULTS")
        print("="*60)
        
        total = self.results["passed"] + self.results["failed"] 
        success_rate = (self.results["passed"] / total * 100) if total > 0 else 0
        
        print(f"✅ PASSED: {self.results['passed']}")
        print(f"❌ FAILED: {self.results['failed']}")
        print(f"📈 SUCCESS RATE: {success_rate:.1f}%")
        
        print(f"\n📋 DETAILED RESULTS:")
        for detail in self.results["details"]:
            print(f"   {detail}")
        
        # Success criteria assessment
        critical_tests = [
            "Support Info", 
            "Split Payments Sale",
            "Comprehensive Sale Response", 
            "PDF Export",
            "Excel Export",
            "Clear Data"
        ]
        
        passed_critical = sum(1 for detail in self.results["details"] if any(test in detail and "✅ PASS" in detail for test in critical_tests))
        
        if passed_critical >= len(critical_tests) * 0.8:  # 80% threshold
            print(f"\n🎉 SUCCESS CRITERIA MET - New features working correctly!")
        else:
            print(f"\n⚠️ ISSUES FOUND - {len(critical_tests) - passed_critical} features need attention")


def main():
    tester = ReviewRequestTester()
    
    try:
        success = tester.run_all_tests()
        tester.print_summary()
        
        exit_code = 0 if tester.results["failed"] == 0 else 1
        sys.exit(exit_code)
        
    except KeyboardInterrupt:
        print("\n⚠️ Testing interrupted by user")
        sys.exit(2)
    except Exception as e:
        print(f"\n💥 FATAL ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(3)

if __name__ == "__main__":
    main()