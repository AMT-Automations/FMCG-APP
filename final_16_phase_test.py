#!/usr/bin/env python3
"""
FINAL RE-TEST: 16-Phase Integration Test for Customer Ordering System
Backend URL: https://distributor-connect-4.preview.emergentagent.com/api

Following the exact specification from the review request:
- Must achieve 16/16 phases 
- Use UNIQUE phone numbers to avoid conflicts
- Focus on "Logo Update & Component Integration Audit" validation

Test Cases as Specified:
Phase 1: Company Setup
Phase 2: Admin Data Creation  
Phase 3: Schedule Setup
Phase 4: Public API Check
Phase 5: Customer Registration
Phase 6: Customer Login
Phase 7: Customer Data Verification
Phase 8: Order Creation
Phase 9: Admin Visibility
Phase 10: Status Update (confirm)
Phase 11: Customer Sees Update
Phase 12: Product Price Propagation
Phase 13: Schedule Propagation  
Phase 14: Full Workflow
Phase 15: Data Isolation
Phase 16: Error Handling
"""

import requests
import json
from datetime import datetime
import sys
import time
import random

# Configuration
BASE_URL = "https://distributor-connect-4.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

# Generate unique suffix to avoid phone number conflicts
UNIQUE_SUFFIX = str(int(time.time()))[-4:]
ADMIN_PHONE = f"0755550{UNIQUE_SUFFIX[-3:]}"  # Using last 3 digits for uniqueness
CUSTOMER_PHONE = f"0844440{UNIQUE_SUFFIX[-3:]}"
RIVAL_ADMIN_PHONE = f"0733330{UNIQUE_SUFFIX[-3:]}"

# Test data storage
test_data = {
    "company_id": None,
    "admin_token": None,
    "customer_token": None,
    "product_ids": {},
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
    """Execute the EXACT 16 phases as specified in the review request"""
    passed_phases = 0
    total_phases = 16
    
    print("=" * 80)
    print("FINAL RE-TEST: 16-PHASE INTEGRATION TEST")
    print("Logo Update & Component Integration Audit Validation")
    print("=" * 80)
    print(f"Unique phones: admin={ADMIN_PHONE}, customer={CUSTOMER_PHONE}, rival={RIVAL_ADMIN_PHONE}")
    
    # Phase 1: Company Setup
    data, success = make_request("POST", "/companies/setup", {
        "company": {
            "name": "ZuluTrade SA",
            "contact_person": "Zulu Admin",
            "phone": "0112345678",
            "email": "admin@zulu.co.za",
            "address": "123 Zulu Street, Johannesburg"
        },
        "admin_name": "Zulu Admin",
        "admin_phone": ADMIN_PHONE,
        "admin_pin": "5555"
    })
    
    if success and data and "company_id" in data and data.get("company_name") == "ZuluTrade SA":
        test_data["company_id"] = data["company_id"]
        passed_phases += 1
        log_test("Phase 1", "Company Setup", True, 
                f"ZuluTrade SA created with ID: {data['company_id']}")
    else:
        log_test("Phase 1", "Company Setup", False, "Failed to create ZuluTrade SA company")
        return passed_phases, total_phases
    
    # Phase 2: Admin Data Creation - Login admin, save token
    data, success = make_request("POST", "/auth/login", {
        "phone": ADMIN_PHONE,
        "pin": "5555"
    })
    
    if success and data and "token" in data:
        test_data["admin_token"] = data["token"]
        
        # Create 3 specific products as per spec
        products = [
            {"name": "Pap 2.5kg", "price": 29.00, "category": "Staples", "unit_type": "bag", "vat_applicable": True},
            {"name": "Cooking Oil 2L", "price": 69.00, "category": "Cooking", "unit_type": "bottle", "vat_applicable": True},
            {"name": "Tinned Fish", "price": 18.00, "category": "Canned", "unit_type": "tin", "vat_applicable": True}
        ]
        
        products_created = 0
        for product in products:
            prod_data, prod_success = make_request("POST", "/products", product, test_data["admin_token"])
            if prod_success and prod_data and "id" in prod_data:
                test_data["product_ids"][product["name"]] = prod_data["id"]
                products_created += 1
        
        # Create route
        route_data, route_success = make_request("POST", "/routes", {
            "name": "Pretoria East",
            "description": "Pretoria East delivery route"
        }, test_data["admin_token"])
        
        if products_created == 3 and route_success and route_data and "id" in route_data:
            test_data["route_id"] = route_data["id"]
            passed_phases += 1
            log_test("Phase 2", "Admin Data Creation", True, 
                    f"Created 3 products and Pretoria East route")
        else:
            log_test("Phase 2", "Admin Data Creation", False, 
                    f"Only created {products_created}/3 products or route failed")
            return passed_phases, total_phases
    else:
        log_test("Phase 2", "Admin Data Creation", False, "Admin login failed")
        return passed_phases, total_phases
    
    # Phase 3: Schedule Setup
    data, success = make_request("PUT", f"/routes/{test_data['route_id']}/schedule", {
        "delivery_days": ["Monday", "Wednesday"],
        "cut_off_time": "15:00"
    }, test_data["admin_token"])
    
    schedule_valid = (success and data and 
                     "schedule" in data and 
                     "delivery_days" in data["schedule"] and
                     set(data["schedule"]["delivery_days"]) == {"Monday", "Wednesday"} and
                     "next_delivery" in data)
    
    if schedule_valid:
        passed_phases += 1
        log_test("Phase 3", "Schedule Setup", True, 
                f"Schedule set: {data['schedule']['delivery_days']}, next: {data.get('next_delivery', {}).get('delivery_day')}")
    else:
        log_test("Phase 3", "Schedule Setup", False, 
                "Response missing schedule object or next_delivery")
        return passed_phases, total_phases
    
    # Phase 4: Public API Check
    # GET /companies/list (no auth)
    companies_data, companies_success = make_request("GET", "/companies/list")
    zulu_found = companies_success and companies_data and any(
        comp.get("name") == "ZuluTrade SA" for comp in companies_data
    )
    
    # GET /companies/{id}/routes (no auth)
    routes_data, routes_success = make_request("GET", f"/companies/{test_data['company_id']}/routes")
    pretoria_route = routes_success and routes_data and any(
        route.get("name") == "Pretoria East" and "delivery_days" in route
        for route in routes_data
    )
    
    # GET /companies/{id}/products (no auth)
    products_data, products_success = make_request("GET", f"/companies/{test_data['company_id']}/products")
    three_products = products_success and products_data and len(products_data) == 3
    
    if zulu_found and pretoria_route and three_products:
        passed_phases += 1
        log_test("Phase 4", "Public API Check", True, 
                "ZuluTrade in list, Pretoria East with schedule, 3 products found")
    else:
        failed_parts = []
        if not zulu_found: failed_parts.append("ZuluTrade not in company list")
        if not pretoria_route: failed_parts.append("Pretoria East route/schedule not found")
        if not three_products: failed_parts.append(f"Expected 3 products, found {len(products_data) if products_data else 0}")
        log_test("Phase 4", "Public API Check", False, "; ".join(failed_parts))
        return passed_phases, total_phases
    
    # Phase 5: Customer Registration
    data, success = make_request("POST", "/auth/register-customer", {
        "business_name": "Mama's Kitchen",
        "contact_person": "Mama Zulu", 
        "phone": CUSTOMER_PHONE,
        "pin": "4444",
        "company_id": test_data["company_id"],
        "route_id": test_data["route_id"]
    })
    
    if success and data and "user_id" in data:
        test_data["customer_id"] = data["user_id"]
        passed_phases += 1
        log_test("Phase 5", "Customer Registration", True, 
                f"Mama's Kitchen registered with ID: {data['user_id']}")
    else:
        log_test("Phase 5", "Customer Registration", False, "Customer registration failed")
        return passed_phases, total_phases
    
    # Phase 6: Customer Login
    data, success = make_request("POST", "/auth/login", {
        "phone": CUSTOMER_PHONE,
        "pin": "4444"
    })
    
    customer_login_valid = (success and data and 
                           "token" in data and
                           data.get("user", {}).get("role") == "customer" and
                           data.get("user", {}).get("customer_profile", {}).get("business_name") == "Mama's Kitchen" and
                           data.get("user", {}).get("customer_profile", {}).get("route_name") == "Pretoria East")
    
    if customer_login_valid:
        test_data["customer_token"] = data["token"]
        passed_phases += 1
        log_test("Phase 6", "Customer Login", True, 
                f"Customer login: role=customer, business=Mama's Kitchen, route=Pretoria East")
    else:
        log_test("Phase 6", "Customer Login", False, "Customer login verification failed")
        return passed_phases, total_phases
    
    # Phase 7: Customer Data Verification
    # GET /customer/products
    products_data, products_success = make_request("GET", "/customer/products", token=test_data["customer_token"])
    customer_products_valid = products_success and products_data and len(products_data) == 3
    
    # GET /customer/delivery-info
    delivery_data, delivery_success = make_request("GET", "/customer/delivery-info", token=test_data["customer_token"])
    delivery_valid = (delivery_success and delivery_data and 
                     delivery_data.get("company_name") == "ZuluTrade SA" and
                     delivery_data.get("route_name") == "Pretoria East" and
                     "schedule" in delivery_data and
                     set(delivery_data["schedule"]["delivery_days"]) == {"Monday", "Wednesday"})
    
    if customer_products_valid and delivery_valid:
        test_data["customer_products"] = products_data
        passed_phases += 1
        log_test("Phase 7", "Customer Data Verification", True, 
                f"Customer sees 3 products and correct delivery info")
    else:
        issues = []
        if not customer_products_valid: issues.append("products issue")
        if not delivery_valid: issues.append("delivery info issue")
        log_test("Phase 7", "Customer Data Verification", False, "; ".join(issues))
        return passed_phases, total_phases
    
    # Phase 8: Order Creation
    # Create order with Pap x20 @R29 and Oil x10 @R69
    pap_product = next(p for p in test_data["customer_products"] if "Pap" in p["name"])
    oil_product = next(p for p in test_data["customer_products"] if "Oil" in p["name"])
    
    order_items = [
        {
            "product_id": pap_product["id"],
            "product_name": pap_product["name"],
            "quantity": 20,
            "unit_price": 29.00
        },
        {
            "product_id": oil_product["id"],
            "product_name": oil_product["name"],
            "quantity": 10,
            "unit_price": 69.00
        }
    ]
    
    expected_total = 20 * 29 + 10 * 69  # 580 + 690 = 1270
    
    data, success = make_request("POST", "/orders", {
        "company_id": test_data["company_id"],
        "items": order_items,
        "notes": "Morning delivery"
    }, test_data["customer_token"])
    
    order_valid = (success and data and 
                  "order_number" in data and
                  abs(data.get("total_amount", 0) - expected_total) < 0.01 and
                  data.get("status") == "pending")
    
    if order_valid:
        test_data["order_id"] = data.get("id")
        passed_phases += 1
        log_test("Phase 8", "Order Creation", True, 
                f"Order {data['order_number']}: total=R{data['total_amount']}, status=pending")
    else:
        log_test("Phase 8", "Order Creation", False, 
                f"Order creation failed or incorrect total (expected R{expected_total})")
        return passed_phases, total_phases
    
    # Phase 9: Admin Visibility
    admin_orders_data, admin_orders_success = make_request("GET", "/orders", token=test_data["admin_token"])
    admin_sees_order = admin_orders_success and admin_orders_data and len(admin_orders_data) >= 1
    
    dashboard_data, dashboard_success = make_request("GET", "/orders/dashboard/summary", token=test_data["admin_token"])
    dashboard_valid = (dashboard_success and dashboard_data and 
                      dashboard_data.get("pending") == 1 and
                      abs(dashboard_data.get("total_value", 0) - expected_total) < 0.01)
    
    if admin_sees_order and dashboard_valid:
        passed_phases += 1
        log_test("Phase 9", "Admin Visibility", True, 
                f"Admin sees order, dashboard: pending=1, total_value=R{dashboard_data.get('total_value')}")
    else:
        log_test("Phase 9", "Admin Visibility", False, "Admin cannot see order or dashboard incorrect")
        return passed_phases, total_phases
    
    # Phase 10: Status Update (confirm) - MUST return full order object
    data, success = make_request("PUT", f"/orders/{test_data['order_id']}/status", {
        "status": "confirmed"
    }, test_data["admin_token"])
    
    status_update_valid = (success and data and 
                          data.get("status") == "confirmed" and
                          "order_number" in data and
                          "total_amount" in data)  # Full order object returned
    
    if status_update_valid:
        passed_phases += 1
        log_test("Phase 10", "Status Update (confirm)", True, 
                "Admin updated to confirmed, response is full order object")
    else:
        log_test("Phase 10", "Status Update (confirm)", False, 
                "Status update didn't return full order object")
        return passed_phases, total_phases
    
    # Phase 11: Customer Sees Update
    data, success = make_request("GET", f"/orders/{test_data['order_id']}", 
                                token=test_data["customer_token"])
    customer_sees_update = success and data and data.get("status") == "confirmed"
    
    if customer_sees_update:
        passed_phases += 1
        log_test("Phase 11", "Customer Sees Update", True, "Customer sees status=confirmed")
    else:
        log_test("Phase 11", "Customer Sees Update", False, "Customer cannot see status update")
        return passed_phases, total_phases
    
    # Phase 12: Product Price Propagation
    pap_id = test_data["product_ids"]["Pap 2.5kg"]
    data, success = make_request("PUT", f"/products/{pap_id}", {
        "price": 32.00
    }, test_data["admin_token"])
    
    if success:
        # Check if customer sees updated price
        products_data, products_success = make_request("GET", "/customer/products", token=test_data["customer_token"])
        pap_updated = products_success and products_data and any(
            p.get("name") == "Pap 2.5kg" and abs(p.get("price", 0) - 32.00) < 0.01
            for p in products_data
        )
        
        if pap_updated:
            passed_phases += 1
            log_test("Phase 12", "Product Price Propagation", True, "Pap price updated to R32.00")
        else:
            log_test("Phase 12", "Product Price Propagation", False, "Customer doesn't see price update")
            return passed_phases, total_phases
    else:
        log_test("Phase 12", "Product Price Propagation", False, "Product update failed")
        return passed_phases, total_phases
    
    # Phase 13: Schedule Propagation
    data, success = make_request("PUT", f"/routes/{test_data['route_id']}/schedule", {
        "delivery_days": ["Monday", "Wednesday", "Friday"],
        "cut_off_time": "15:00"
    }, test_data["admin_token"])
    
    schedule_updated = (success and data and 
                       "schedule" in data and 
                       set(data["schedule"]["delivery_days"]) == {"Monday", "Wednesday", "Friday"})
    
    if schedule_updated:
        # Check customer sees updated schedule
        delivery_data, delivery_success = make_request("GET", "/customer/delivery-info", token=test_data["customer_token"])
        customer_schedule_updated = (delivery_success and delivery_data and
                                   "Friday" in delivery_data.get("schedule", {}).get("delivery_days", []))
        
        if customer_schedule_updated:
            passed_phases += 1
            log_test("Phase 13", "Schedule Propagation", True, "Friday added to delivery schedule")
        else:
            log_test("Phase 13", "Schedule Propagation", False, "Customer doesn't see schedule update")
            return passed_phases, total_phases
    else:
        log_test("Phase 13", "Schedule Propagation", False, "Schedule update failed")
        return passed_phases, total_phases
    
    # Phase 14: Full Workflow
    workflow_steps = ["packed", "out_for_delivery", "delivered"]
    workflow_success = True
    
    for status in workflow_steps:
        data, success = make_request("PUT", f"/orders/{test_data['order_id']}/status", {
            "status": status
        }, test_data["admin_token"])
        
        if not (success and data and data.get("status") == status and "order_number" in data):
            workflow_success = False
            log_test("Phase 14", "Full Workflow", False, f"Failed to update status to {status}")
            break
    
    if workflow_success:
        # Verify customer sees delivered
        data, success = make_request("GET", f"/orders/{test_data['order_id']}", 
                                    token=test_data["customer_token"])
        customer_sees_delivered = success and data and data.get("status") == "delivered"
        
        if customer_sees_delivered:
            passed_phases += 1
            log_test("Phase 14", "Full Workflow", True, "All status updates working, customer sees delivered")
        else:
            log_test("Phase 14", "Full Workflow", False, "Customer cannot see delivered status")
            return passed_phases, total_phases
    else:
        return passed_phases, total_phases
    
    # Phase 15: Data Isolation
    # Create second company
    data, success = make_request("POST", "/companies/setup", {
        "company": {
            "name": "SoloTrader",
            "contact_person": "Solo Manager",
            "phone": "0987654321",
            "email": "solo@solo.com",
            "address": "456 Solo Street"
        },
        "admin_name": "Solo Admin",
        "admin_phone": RIVAL_ADMIN_PHONE,
        "admin_pin": "3333"
    })
    
    if not (success and data and "company_id" in data):
        log_test("Phase 15", "Data Isolation", False, "Failed to create SoloTrader company")
        return passed_phases, total_phases
    
    test_data["rival_company_id"] = data["company_id"]
    
    # Login as SoloTrader admin
    data, success = make_request("POST", "/auth/login", {
        "phone": RIVAL_ADMIN_PHONE,
        "pin": "3333"
    })
    
    if not (success and data and "token" in data):
        log_test("Phase 15", "Data Isolation", False, "SoloTrader admin login failed")
        return passed_phases, total_phases
    
    test_data["rival_admin_token"] = data["token"]
    
    # Check data isolation
    products_data, products_success = make_request("GET", "/products", token=test_data["rival_admin_token"])
    rival_isolation_products = products_success and len(products_data) == 0
    
    orders_data, orders_success = make_request("GET", "/orders", token=test_data["rival_admin_token"])
    rival_isolation_orders = orders_success and len(orders_data) == 0
    
    if rival_isolation_products and rival_isolation_orders:
        passed_phases += 1
        log_test("Phase 15", "Data Isolation", True, 
                "SoloTrader admin sees 0 products and 0 orders (perfect isolation)")
    else:
        issues = []
        if not rival_isolation_products: issues.append(f"sees {len(products_data)} products")
        if not rival_isolation_orders: issues.append(f"sees {len(orders_data)} orders")
        log_test("Phase 15", "Data Isolation", False, f"Isolation broken: {'; '.join(issues)}")
        return passed_phases, total_phases
    
    # Phase 16: Error Handling
    # Invalid route ID should return 400 (not 500)
    error_data, error_success = make_request("PUT", "/routes/not_a_valid_id/schedule", {
        "delivery_days": ["Monday"], 
        "cut_off_time": "16:00"
    }, test_data["admin_token"], expect_status=400)
    
    error_handling_valid = error_success  # We expect this to succeed with 400
    
    # Customer should be able to create new order (previous is delivered)
    new_order_items = [
        {
            "product_id": pap_product["id"],
            "product_name": pap_product["name"], 
            "quantity": 5,
            "unit_price": 32.00  # Updated price
        }
    ]
    
    new_order_data, new_order_success = make_request("POST", "/orders", {
        "company_id": test_data["company_id"],
        "items": new_order_items
    }, test_data["customer_token"])
    
    duplicate_prevention_fixed = new_order_success and new_order_data and "order_number" in new_order_data
    
    # Customer cannot cancel delivered order
    cancel_data, cancel_success = make_request("PUT", f"/orders/{test_data['order_id']}/status", {
        "status": "cancelled"
    }, test_data["customer_token"], expect_status=400)
    
    cancel_protection = cancel_success  # Should succeed with 400 error
    
    if error_handling_valid and duplicate_prevention_fixed and cancel_protection:
        passed_phases += 1
        log_test("Phase 16", "Error Handling", True, 
                "Invalid route returns 400, new order succeeds, cancel delivered order blocked")
    else:
        issues = []
        if not error_handling_valid: issues.append("invalid route error handling")
        if not duplicate_prevention_fixed: issues.append("new order creation")
        if not cancel_protection: issues.append("cancel protection")
        log_test("Phase 16", "Error Handling", False, f"Issues: {'; '.join(issues)}")
        return passed_phases, total_phases
    
    return passed_phases, total_phases

def main():
    """Main test execution"""
    print(f"Starting FINAL RE-TEST at {datetime.now()}")
    print(f"Backend URL: {BASE_URL}")
    print("-" * 80)
    
    try:
        passed, total = run_16_phase_test()
        
        print("\n" + "=" * 80)
        print("FINAL TEST SUMMARY")
        print("=" * 80)
        print(f"Phases Passed: {passed}/{total}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if passed == total:
            print("🎉 ALL 16/16 PHASES PASSED!")
            print("✅ LOGO UPDATE & COMPONENT INTEGRATION AUDIT: COMPLETE")
            print("✅ Customer Ordering System: PRODUCTION READY")
            print("✅ Data Isolation: VERIFIED")
            print("✅ All API Responses: RETURNING PROPER OBJECTS")
        else:
            print(f"❌ {total - passed} phases failed.")
            print("❌ Logo Update & Component Integration Audit: INCOMPLETE")
            
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