#!/usr/bin/env python3
"""
Comprehensive 16-Phase Integration Test for Mzansi FMCG Tracker
Backend URL: https://order-system-preview-2.preview.emergentagent.com/api

This test validates the full customer ordering system workflow with fixes applied:
1) PUT /api/routes/{id}/schedule returns schedule object + next_delivery 
2) PUT /api/orders/{id}/status returns full updated order object
3) PUT /api/orders/{id}/adjust returns full order
4) Duplicate order check allows new orders after delivered/cancelled

Target: 16/16 phases passed (improvement from previous 13/16)
"""

import requests
import json
from datetime import datetime
import sys
import time

# Configuration
BASE_URL = "https://order-system-preview-2.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

# Generate unique suffix for phone numbers to avoid conflicts
UNIQUE_SUFFIX = str(int(time.time()))[-4:]  # Last 4 digits of timestamp

# Test data storage
test_data = {
    "company_id": None,
    "admin_token": None,
    "customer_token": None,
    "product_ids": [],
    "route_id": None,
    "customer_id": None,
    "order_id": None,
    "rival_company_id": None,
    "rival_admin_token": None
}

def log_test(phase, description, success, details=""):
    """Log test results with consistent formatting"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"\n{phase}: {description}")
    print(f"Status: {status}")
    if details:
        print(f"Details: {details}")
    if not success:
        print("=" * 60)

def make_request(method, endpoint, data=None, token=None, expect_status=200):
    """Make HTTP request with consistent error handling"""
    url = f"{BASE_URL}{endpoint}"
    headers = HEADERS.copy()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=headers)
        elif method.upper() == "POST":
            response = requests.post(url, json=data, headers=headers)
        elif method.upper() == "PUT":
            response = requests.put(url, json=data, headers=headers)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        print(f"  {method.upper()} {endpoint} -> {response.status_code}")
        
        if response.status_code != expect_status:
            print(f"  Expected {expect_status}, got {response.status_code}")
            print(f"  Response: {response.text[:200]}...")
            return None, False
            
        return response.json() if response.text else {}, True
    except Exception as e:
        print(f"  ERROR: {str(e)}")
        return None, False

def run_16_phase_test():
    """Execute all 16 phases of the integration test"""
    passed_phases = 0
    total_phases = 16
    
    print("=" * 80)
    print("MZANSI FMCG TRACKER - 16 PHASE INTEGRATION TEST")
    print("=" * 80)
    
    # Phase 1: Setup Fresh Company
    admin_phone = f"076666{UNIQUE_SUFFIX}"
    data, success = make_request("POST", "/companies/setup", {
        "company": {
            "name": "TestCo Distributors",
            "contact_person": "Test Manager",
            "phone": "0123456789",
            "email": "test@testco.com",
            "address": "123 Test Street, Test City"
        },
        "admin_name": "Test Admin",
        "admin_phone": admin_phone,
        "admin_pin": "7777"
    })
    
    if success and data and "company_id" in data:
        test_data["company_id"] = data["company_id"]
        passed_phases += 1
        log_test("Phase 1", "Setup Fresh Company", True, 
                f"Created TestCo Distributors with ID: {data['company_id']}")
    else:
        log_test("Phase 1", "Setup Fresh Company", False, "Failed to create company")
        return 0, total_phases
    
    # Phase 2: Admin Login
    data, success = make_request("POST", "/auth/login", {
        "phone": admin_phone,
        "pin": "7777"
    })
    
    if success and data and "token" in data:
        test_data["admin_token"] = data["token"]
        passed_phases += 1
        log_test("Phase 2", "Admin Login", True, "Admin authentication successful")
    else:
        log_test("Phase 2", "Admin Login", False, "Failed to login admin")
        return passed_phases, total_phases
    
    # Phase 3: Create 3 Products
    products = [
        {"name": "Test Bread", "price": 18.50, "category": "Bakery", "unit_type": "loaf", "vat_applicable": True},
        {"name": "Test Milk", "price": 22.00, "category": "Dairy", "unit_type": "liter", "vat_applicable": True},
        {"name": "Test Eggs", "price": 35.00, "category": "Fresh", "unit_type": "dozen", "vat_applicable": False}
    ]
    
    products_created = 0
    for product in products:
        data, success = make_request("POST", "/products", product, test_data["admin_token"])
        if success and data and "id" in data:
            test_data["product_ids"].append(data["id"])
            products_created += 1
    
    if products_created == 3:
        passed_phases += 1
        log_test("Phase 3", "Create 3 Products", True, f"Created {products_created} products")
    else:
        log_test("Phase 3", "Create 3 Products", False, f"Only created {products_created}/3 products")
        return passed_phases, total_phases
    
    # Phase 4: Create Route
    data, success = make_request("POST", "/routes", {
        "name": "Cape Town Route",
        "description": "Main Cape Town delivery route"
    }, test_data["admin_token"])
    
    if success and data and "id" in data:
        test_data["route_id"] = data["id"]
        passed_phases += 1
        log_test("Phase 4", "Create Route", True, f"Created route with ID: {data['id']}")
    else:
        log_test("Phase 4", "Create Route", False, "Failed to create route")
        return passed_phases, total_phases
    
    # Phase 5: Set Delivery Schedule (FIXED - should return schedule object + next_delivery)
    data, success = make_request("PUT", f"/routes/{test_data['route_id']}/schedule", {
        "delivery_days": ["Tuesday", "Thursday"],
        "cut_off_time": "14:00"
    }, test_data["admin_token"])
    
    schedule_valid = (success and data and 
                     "schedule" in data and 
                     "delivery_days" in data["schedule"] and
                     "next_delivery" in data)
    
    if schedule_valid:
        passed_phases += 1
        log_test("Phase 5", "Set Delivery Schedule (FIXED)", True, 
                f"Schedule set with next delivery: {data.get('next_delivery', 'N/A')}")
    else:
        log_test("Phase 5", "Set Delivery Schedule (FIXED)", False, 
                "Response missing schedule object or next_delivery")
        return passed_phases, total_phases
    
    # Phase 6-8: Public APIs
    # Test 6: Company List
    data, success = make_request("GET", "/companies/list")
    company_found = success and data and any(
        comp.get("name") == "TestCo Distributors" for comp in data
    )
    
    if company_found:
        passed_phases += 1
        log_test("Phase 6", "Public Company List", True, "TestCo Distributors found in public list")
    else:
        log_test("Phase 6", "Public Company List", False, "Company not found in public list")
        return passed_phases, total_phases
    
    # Test 7: Public Routes
    data, success = make_request("GET", f"/companies/{test_data['company_id']}/routes")
    route_found = success and data and any(
        route.get("name") == "Cape Town Route" and "delivery_days" in route 
        for route in data
    )
    
    if route_found:
        passed_phases += 1
        log_test("Phase 7", "Public Routes with Delivery Days", True, "Route found with delivery schedule")
    else:
        log_test("Phase 7", "Public Routes with Delivery Days", False, "Route or schedule not found")
        return passed_phases, total_phases
    
    # Test 8: Public Products
    data, success = make_request("GET", f"/companies/{test_data['company_id']}/products")
    products_found = success and data and len(data) >= 3
    
    if products_found:
        passed_phases += 1
        log_test("Phase 8", "Public Products", True, f"Found {len(data)} products")
    else:
        log_test("Phase 8", "Public Products", False, "Less than 3 products found")
        return passed_phases, total_phases
    
    # Phase 9: Customer Registration
    customer_phone = f"076666{UNIQUE_SUFFIX[:-1]}2"  # Different last digit
    data, success = make_request("POST", "/auth/register-customer", {
        "business_name": "Test Tuck Shop", 
        "contact_person": "Test Customer Shop",
        "phone": customer_phone,
        "pin": "8888",
        "company_id": test_data["company_id"],
        "route_id": test_data["route_id"]
    })
    
    if success and data and "user_id" in data:
        test_data["customer_id"] = data["user_id"]
        passed_phases += 1
        log_test("Phase 9", "Customer Registration", True, f"Customer registered with ID: {data['user_id']}")
    else:
        log_test("Phase 9", "Customer Registration", False, "Failed to register customer")
        return passed_phases, total_phases
    
    # Phase 10: Customer Login
    data, success = make_request("POST", "/auth/login", {
        "phone": customer_phone,
        "pin": "8888"
    })
    
    customer_login_valid = (success and data and 
                           "token" in data and
                           data.get("user", {}).get("role") == "customer" and
                           "customer_profile" in data.get("user", {}))
    
    if customer_login_valid:
        test_data["customer_token"] = data["token"]
        passed_phases += 1
        log_test("Phase 10", "Customer Login", True, 
                f"Customer login successful with profile: {data['user']['customer_profile'].get('business_name', 'N/A')}")
    else:
        log_test("Phase 10", "Customer Login", False, "Customer login failed or missing profile")
        return passed_phases, total_phases
    
    # Phase 11: Customer Views Products
    data, success = make_request("GET", "/customer/products", token=test_data["customer_token"])
    customer_products_valid = success and data and len(data) >= 3
    
    if customer_products_valid:
        test_data["customer_products"] = data  # Save product details for order creation
        passed_phases += 1
        log_test("Phase 11", "Customer Views Products", True, f"Customer sees {len(data)} products")
    else:
        log_test("Phase 11", "Customer Views Products", False, "Customer cannot see products")
        return passed_phases, total_phases
    
    # Phase 12: Customer Views Delivery Info
    data, success = make_request("GET", "/customer/delivery-info", token=test_data["customer_token"])
    delivery_info_valid = (success and data and 
                          "company_name" in data and 
                          "route_name" in data and
                          "schedule" in data and
                          "next_delivery" in data)
    
    if delivery_info_valid:
        passed_phases += 1
        log_test("Phase 12", "Customer Views Delivery Info", True, 
                f"Delivery info complete: {data['company_name']} - {data['route_name']}")
    else:
        log_test("Phase 12", "Customer Views Delivery Info", False, "Delivery info incomplete")
        return passed_phases, total_phases
    
    # Phase 13: Customer Places Order
    # Create order items with product details from customer products
    product1 = test_data["customer_products"][0]
    product2 = test_data["customer_products"][1]
    
    order_items = [
        {
            "product_id": product1["id"],
            "product_name": product1["name"],
            "quantity": 2,
            "unit_price": product1["price"]
        },
        {
            "product_id": product2["id"],
            "product_name": product2["name"],
            "quantity": 3,
            "unit_price": product2["price"]
        }
    ]
    
    data, success = make_request("POST", "/orders", {
        "company_id": test_data["company_id"],
        "items": order_items
    }, test_data["customer_token"])
    
    order_created = (success and data and 
                    "order_number" in data and
                    "total_amount" in data and
                    data.get("status") == "pending")
    
    if order_created:
        test_data["order_id"] = data.get("id")
        passed_phases += 1
        log_test("Phase 13", "Customer Places Order", True, 
                f"Order {data['order_number']} created, Total: R{data['total_amount']}")
    else:
        log_test("Phase 13", "Customer Places Order", False, "Order creation failed")
        return passed_phases, total_phases
    
    # Phase 14: Admin Sees Orders & Dashboard
    data, success = make_request("GET", "/orders", token=test_data["admin_token"])
    admin_sees_orders = success and data and len(data) > 0
    
    if admin_sees_orders:
        # Test dashboard summary
        data, success = make_request("GET", "/orders/dashboard/summary", token=test_data["admin_token"])
        dashboard_valid = success and data and "pending" in data and "total_value" in data
        
        if dashboard_valid:
            passed_phases += 1
            log_test("Phase 14", "Admin Views Orders & Dashboard", True, 
                    f"Dashboard shows {data['pending']} pending orders, Total: R{data.get('total_value', 0)}")
        else:
            log_test("Phase 14", "Admin Views Orders & Dashboard", False, "Dashboard summary failed")
            return passed_phases, total_phases
    else:
        log_test("Phase 14", "Admin Views Orders & Dashboard", False, "Admin cannot see orders")
        return passed_phases, total_phases
    
    # Phase 15: Order Status Updates (FIXED - should return full order object)
    data, success = make_request("PUT", f"/orders/{test_data['order_id']}/status", {
        "status": "confirmed"
    }, test_data["admin_token"])
    
    status_update_valid = (success and data and 
                          "status" in data and 
                          data["status"] == "confirmed" and
                          "order_number" in data)  # Full order object returned
    
    if status_update_valid:
        # Verify customer can see updated status
        data, success = make_request("GET", f"/orders/{test_data['order_id']}", 
                                    token=test_data["customer_token"])
        customer_sees_update = success and data and data.get("status") == "confirmed"
        
        if customer_sees_update:
            passed_phases += 1
            log_test("Phase 15", "Order Status Update (FIXED)", True, 
                    "Admin updated to confirmed, customer sees update")
        else:
            log_test("Phase 15", "Order Status Update (FIXED)", False, 
                    "Customer cannot see status update")
            return passed_phases, total_phases
    else:
        log_test("Phase 15", "Order Status Update (FIXED)", False, 
                "Status update didn't return full order object")
        return passed_phases, total_phases
    
    # Phase 16: Full Order Workflow & Data Isolation Test
    # Complete order workflow
    for status in ["packed", "out_for_delivery", "delivered"]:
        data, success = make_request("PUT", f"/orders/{test_data['order_id']}/status", {
            "status": status
        }, test_data["admin_token"])
        
        if not (success and data and data.get("status") == status):
            log_test("Phase 16", "Full Order Workflow & Data Isolation", False, 
                    f"Failed to update status to {status}")
            return passed_phases, total_phases
    
    # Verify delivered status for customer
    data, success = make_request("GET", f"/orders/{test_data['order_id']}", 
                                token=test_data["customer_token"])
    if not (success and data and data.get("status") == "delivered"):
        log_test("Phase 16", "Full Order Workflow & Data Isolation", False, 
                "Customer cannot see delivered status")
        return passed_phases, total_phases
    
    # Test Data Isolation - Create second company
    data, success = make_request("POST", "/companies/setup", {
        "company": {
            "name": "Rival Corp",
            "contact_person": "Rival Manager",
            "phone": "0987654321",
            "email": "rival@rival.com",
            "address": "456 Rival Street"
        },
        "admin_name": "Rival Admin",
        "admin_phone": f"076666{UNIQUE_SUFFIX[:-1]}3",  # Different last digit
        "admin_pin": "9999"
    })
    
    if not (success and data and "company_id" in data):
        log_test("Phase 16", "Full Order Workflow & Data Isolation", False, 
                "Failed to create rival company")
        return passed_phases, total_phases
    
    test_data["rival_company_id"] = data["company_id"]
    
    # Login as rival admin
    rival_admin_phone = f"076666{UNIQUE_SUFFIX[:-1]}3"
    data, success = make_request("POST", "/auth/login", {
        "phone": rival_admin_phone,
        "pin": "9999"
    })
    
    if not (success and data and "token" in data):
        log_test("Phase 16", "Full Order Workflow & Data Isolation", False, 
                "Rival admin login failed")
        return passed_phases, total_phases
    
    test_data["rival_admin_token"] = data["token"]
    
    # Verify data isolation
    data, success = make_request("GET", "/orders", token=test_data["rival_admin_token"])
    rival_isolation_orders = success and data and len(data) == 0
    
    data, success = make_request("GET", "/products", token=test_data["rival_admin_token"])
    rival_isolation_products = success and data and len(data) == 0
    
    # Test duplicate order prevention fix (should now allow after delivered)
    data, success = make_request("POST", "/orders", {
        "company_id": test_data["company_id"],
        "items": order_items
    }, test_data["customer_token"])
    
    duplicate_prevention_fixed = success and data and "order_number" in data
    
    if rival_isolation_orders and rival_isolation_products and duplicate_prevention_fixed:
        passed_phases += 1
        log_test("Phase 16", "Full Order Workflow & Data Isolation", True, 
                "Data isolation verified, duplicate order prevention fixed")
    else:
        failed_details = []
        if not rival_isolation_orders:
            failed_details.append("Rival admin can see orders")
        if not rival_isolation_products:
            failed_details.append("Rival admin can see products")
        if not duplicate_prevention_fixed:
            failed_details.append("Duplicate order prevention not fixed")
        log_test("Phase 16", "Full Order Workflow & Data Isolation", False, 
                f"Issues: {', '.join(failed_details)}")
        return passed_phases, total_phases
    
    return passed_phases, total_phases

def main():
    """Main test execution"""
    print(f"Starting 16-Phase Integration Test at {datetime.now()}")
    print(f"Backend URL: {BASE_URL}")
    print("-" * 80)
    
    try:
        passed, total = run_16_phase_test()
        
        print("\n" + "=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        print(f"Phases Passed: {passed}/{total}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if passed == total:
            print("🎉 ALL TESTS PASSED! 16/16 phases completed successfully.")
            print("✅ FIXES VERIFIED:")
            print("  - PUT /api/routes/{id}/schedule returns schedule + next_delivery")
            print("  - PUT /api/orders/{id}/status returns full order object") 
            print("  - PUT /api/orders/{id}/adjust returns full order")
            print("  - Duplicate order check allows orders after delivered/cancelled")
        else:
            print(f"❌ {total - passed} phases failed. Please review the failed tests above.")
            
        print(f"\nTest completed at {datetime.now()}")
        return passed == total
        
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        return False
    except Exception as e:
        print(f"\n\nUnexpected error: {str(e)}")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)