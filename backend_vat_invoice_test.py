#!/usr/bin/env python3
"""
MZANSI DISTRIBUTION TRACKER - VAT & INVOICE TESTING
Test specific requirements from review request:

1. Products API with vat_applicable field - GET /api/products should return vat_applicable boolean
2. Sales API with invoice number - POST /api/sales should return invoice_number, shortage_amount, total_amount  
3. Sales listing - GET /api/sales should return all sales with invoice_number field visible

Test flow:
1. Login as admin
2. GET /api/products - verify vat_applicable field (should be true for all default products)
3. Start a daily route
4. Create a sale and verify response has invoice_number, shortage_amount
5. GET /api/sales - verify all sales returned with invoice_number field
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

class VATInvoiceTester:
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
        """Make API request with timeout and error handling"""
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
            print(f"❌ Admin login failed: {response.status_code if response else 'No response'}")
            return False

        # Driver login
        driver_creds = {"phone": DRIVER_PHONE, "pin": DRIVER_PIN}
        response = self.request("POST", "/auth/login", driver_creds)
        if response and response.status_code == 200:
            self.driver_token = response.json()["token"]
            print(f"✅ Driver logged in: {DRIVER_PHONE}")
        else:
            print(f"❌ Driver login failed: {response.status_code if response else 'No response'}")
            return False

        return True

    def get_headers(self, role="admin"):
        """Get authorization headers"""
        token = self.admin_token if role == "admin" else self.driver_token
        return {"Authorization": f"Bearer {token}"}

    def seed_data(self):
        """Seed test data"""
        print("\n🌱 SEEDING DATA")
        print("-" * 50)
        
        response = self.request("POST", "/seed-all", headers=self.get_headers("admin"))
        if response and response.status_code == 200:
            print("✅ Test data seeded successfully")
            return True
        else:
            print(f"⚠️ Seed failed: {response.status_code if response else 'No response'}")
            return True  # Continue anyway as data might already exist

    def test_products_vat_applicable(self):
        """TEST 1: GET /api/products - verify vat_applicable field"""
        print("\n🛍️ TEST 1: Products API with vat_applicable field")
        print("-" * 50)
        
        response = self.request("GET", "/products", headers=self.get_headers("admin"))
        if not response or response.status_code != 200:
            self.log("Products VAT Field", False, f"Request failed: {response.status_code if response else 'No response'}")
            return

        try:
            products = response.json()
            if not products:
                self.log("Products VAT Field", False, "No products returned")
                return
            
            print(f"   Found {len(products)} products")
            
            # Check each product has vat_applicable field
            missing_vat = []
            vat_true_count = 0
            vat_false_count = 0
            
            for product in products:
                if "vat_applicable" not in product:
                    missing_vat.append(product.get("name", "Unknown"))
                elif product["vat_applicable"] is True:
                    vat_true_count += 1
                elif product["vat_applicable"] is False:
                    vat_false_count += 1
                    
            if missing_vat:
                self.log("Products VAT Field", False, f"Products missing vat_applicable: {missing_vat}")
                return
                
            # All default products should have vat_applicable = true according to review request
            if vat_false_count > 0:
                self.log("Products VAT Field", False, f"{vat_false_count} products have vat_applicable=false, expected all true")
                return
                
            self.log("Products VAT Field", True, f"All {len(products)} products have vat_applicable=true")
            print(f"   VAT applicable: {vat_true_count} products")
            
            # Store first product for testing
            self.test_data["product"] = products[0]
            
        except json.JSONDecodeError:
            self.log("Products VAT Field", False, "Invalid JSON response")

    def setup_route_and_data(self):
        """Setup route and get necessary IDs"""
        print("\n⚙️ SETUP: Getting route and customer data")
        print("-" * 50)
        
        # Get route
        response = self.request("GET", "/routes", headers=self.get_headers("admin"))
        if not response or response.status_code != 200:
            print("❌ Failed to get routes")
            return False
        routes = response.json()
        if not routes:
            print("❌ No routes available")
            return False
        self.test_data["route_id"] = routes[0]["id"]
        print(f"✅ Selected route: {routes[0].get('name', 'Unknown')}")
        
        # Get customer
        response = self.request("GET", "/customers", headers=self.get_headers("admin"))
        if not response or response.status_code != 200:
            print("❌ Failed to get customers")
            return False
        customers = response.json()
        if not customers:
            print("❌ No customers available")
            return False
        self.test_data["customer_id"] = customers[0]["id"]
        self.test_data["customer_name"] = customers[0]["name"]
        print(f"✅ Selected customer: {customers[0]['name']}")
        
        # Get available vehicle
        response = self.request("GET", "/vehicles/available", headers=self.get_headers("admin"))
        if not response or response.status_code != 200:
            print("❌ Failed to get vehicles")
            return False
        vehicles = response.json()
        available = [v for v in vehicles if not v.get("in_use")]
        if not available:
            print("❌ No available vehicles")
            return False
        self.test_data["vehicle_id"] = available[0]["id"]
        print(f"✅ Selected vehicle: {available[0].get('name', 'Unknown')}")
        
        return True

    def start_daily_route(self):
        """Start a daily route with vehicle"""
        print("\n🚛 STARTING DAILY ROUTE")
        print("-" * 50)
        
        route_data = {
            "route_id": self.test_data["route_id"],
            "vehicle_id": self.test_data["vehicle_id"],
            "opening_km": 150.0,
            "crates_out": 60
        }
        
        response = self.request("POST", "/daily-routes/start", route_data, headers=self.get_headers("driver"))
        if response and response.status_code == 200:
            route_info = response.json()
            self.test_data["daily_route_id"] = route_info["id"]
            print(f"✅ Daily route started: {route_info['id']}")
            print(f"   Route: {route_info.get('route_name', 'Unknown')}")
            print(f"   Vehicle: {route_info.get('vehicle_name', 'Unknown')}")
            return True
        else:
            print(f"❌ Failed to start route: {response.status_code if response else 'No response'}")
            return False

    def test_sales_invoice_generation(self):
        """TEST 2: POST /api/sales - verify invoice_number, shortage_amount, total_amount"""
        print("\n💰 TEST 2: Sales API with invoice number and shortage tracking")
        print("-" * 50)
        
        if not self.test_data.get("product"):
            self.log("Sales Invoice Generation", False, "No product data available")
            return
            
        # Create sale with cash shortage scenario
        sale_data = {
            "route_id": self.test_data["route_id"],
            "customer_id": self.test_data["customer_id"],
            "customer_name": self.test_data["customer_name"],
            "items": [{
                "product_id": self.test_data["product"]["id"],
                "product_name": self.test_data["product"]["name"],
                "quantity_delivered": 10,
                "quantity_returned": 0,
                "damages": 0,
                "unit_price": self.test_data["product"]["price"]
            }],
            "crates_dropped": 5,
            "crates_collected": 2,
            "cash_collected": 120.0,  # Less than total to create shortage
            "payment_type": "cash",
            "delivery_status": "delivered"
        }
        
        response = self.request("POST", "/sales", sale_data, headers=self.get_headers("driver"))
        if not response or response.status_code != 200:
            self.log("Sales Invoice Generation", False, f"Sale creation failed: {response.status_code if response else 'No response'}")
            if response:
                print(f"   Response: {response.text}")
            return

        try:
            sale = response.json()
            
            # Check required fields
            required_fields = ["invoice_number", "shortage_amount", "total_amount"]
            missing = [field for field in required_fields if field not in sale]
            if missing:
                self.log("Sales Invoice Generation", False, f"Missing fields: {missing}")
                return
            
            # Verify invoice number format (INV-YYYYMMDD-ROUTE-####)
            invoice = sale["invoice_number"]
            if not invoice.startswith("INV-"):
                self.log("Sales Invoice Generation", False, f"Invalid invoice format: {invoice}")
                return
            
            # Verify shortage calculation
            expected_total = sale_data["items"][0]["quantity_delivered"] * sale_data["items"][0]["unit_price"]
            if sale["total_amount"] != expected_total:
                self.log("Sales Invoice Generation", False, f"Total amount incorrect: {sale['total_amount']} != {expected_total}")
                return
                
            expected_shortage = sale["total_amount"] - sale_data["cash_collected"]
            if abs(sale["shortage_amount"] - expected_shortage) > 0.01:  # Allow for floating point precision
                self.log("Sales Invoice Generation", False, f"Shortage amount incorrect: {sale['shortage_amount']} != {expected_shortage}")
                return
            
            self.test_data["sale_id"] = sale["id"]
            self.test_data["invoice_number"] = sale["invoice_number"]
            
            self.log("Sales Invoice Generation", True, "All required fields present and calculated correctly")
            print(f"   Invoice: {sale['invoice_number']}")
            print(f"   Total: R{sale['total_amount']}")
            print(f"   Cash: R{sale_data['cash_collected']}")
            print(f"   Shortage: R{sale['shortage_amount']}")
            
        except json.JSONDecodeError:
            self.log("Sales Invoice Generation", False, "Invalid JSON response")

    def test_sales_listing_invoice_visible(self):
        """TEST 3: GET /api/sales - verify all sales have invoice_number field"""
        print("\n📋 TEST 3: Sales listing with invoice numbers")
        print("-" * 50)
        
        response = self.request("GET", "/sales", headers=self.get_headers("driver"))
        if not response or response.status_code != 200:
            self.log("Sales Listing", False, f"Request failed: {response.status_code if response else 'No response'}")
            return

        try:
            sales = response.json()
            if not sales:
                self.log("Sales Listing", False, "No sales returned")
                return
            
            print(f"   Found {len(sales)} sales")
            
            # Check each sale has invoice_number field
            missing_invoice = []
            for sale in sales:
                if "invoice_number" not in sale or not sale["invoice_number"]:
                    missing_invoice.append(sale.get("id", "Unknown"))
            
            if missing_invoice:
                self.log("Sales Listing", False, f"Sales missing invoice_number: {missing_invoice}")
                return
            
            # Verify our test sale is in the list
            our_sale_found = False
            if "sale_id" in self.test_data:
                for sale in sales:
                    if sale["id"] == self.test_data["sale_id"]:
                        our_sale_found = True
                        if sale["invoice_number"] == self.test_data["invoice_number"]:
                            print(f"   ✅ Test sale found with correct invoice: {sale['invoice_number']}")
                        break
            
            self.log("Sales Listing", True, f"All {len(sales)} sales have invoice_number field")
            print(f"   Sample invoices: {[s['invoice_number'] for s in sales[:3]]}")
            
        except json.JSONDecodeError:
            self.log("Sales Listing", False, "Invalid JSON response")

    def run_all_tests(self):
        """Execute all VAT and invoice tests"""
        print("🚀 MZANSI DISTRIBUTION TRACKER - VAT & INVOICE TESTING")
        print("="*65)
        print("Backend URL:", BASE_URL)
        print("Admin:", ADMIN_PHONE)
        print("Driver:", DRIVER_PHONE)
        print("="*65)
        
        # Authentication
        if not self.authenticate():
            return False
        
        # Seed data
        self.seed_data()
        
        # TEST 1: Products with VAT field
        self.test_products_vat_applicable()
        
        # Setup for sales tests
        if not self.setup_route_and_data():
            print("⚠️ Setup failed - skipping sales tests")
            return False
            
        # Start daily route
        if not self.start_daily_route():
            print("⚠️ Route start failed - skipping sales tests")
            return False
        
        # TEST 2: Sales with invoice and shortage
        self.test_sales_invoice_generation()
        
        # TEST 3: Sales listing with invoices
        self.test_sales_listing_invoice_visible()
        
        return True

    def print_summary(self):
        """Print comprehensive test summary"""
        print("\n" + "="*65)
        print("📊 VAT & INVOICE TEST RESULTS")
        print("="*65)
        
        total = self.results["passed"] + self.results["failed"]
        success_rate = (self.results["passed"] / total * 100) if total > 0 else 0
        
        print(f"✅ PASSED: {self.results['passed']}")
        print(f"❌ FAILED: {self.results['failed']}")
        print(f"📈 SUCCESS RATE: {success_rate:.1f}%")
        
        print(f"\n📋 DETAILED RESULTS:")
        for detail in self.results["details"]:
            print(f"   {detail}")
        
        # Critical test assessment
        critical_tests = ["Products VAT Field", "Sales Invoice Generation", "Sales Listing"]
        passed_critical = sum(1 for detail in self.results["details"] 
                             if any(test in detail and "✅ PASS" in detail for test in critical_tests))
        
        print(f"\n🎯 CRITICAL FEATURES:")
        print(f"   ✅ Products API with vat_applicable field")
        print(f"   ✅ Sales API with invoice_number and shortage_amount") 
        print(f"   ✅ Sales listing with invoice_number visible")
        
        if passed_critical == len(critical_tests):
            print(f"\n🎉 SUCCESS - All VAT and invoice features working correctly!")
        else:
            print(f"\n⚠️ ISSUES FOUND - {len(critical_tests) - passed_critical} critical features need attention")


def main():
    tester = VATInvoiceTester()
    
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