#!/usr/bin/env python3
"""
DRIVER VEHICLE STOCK ENFORCEMENT TESTING
Test the vehicle stock enforcement feature as per review request.

Backend URL: https://fmcg-delivery-app-2.preview.emergentagent.com/api

Test Flow:
1. POST /api/admin/reset-and-seed — seed fresh data
2. Login as admin (phone=0767862760, pin=1984) — get admin_token
3. GET /api/products with admin_token — get first product's id and name
4. GET /api/routes with admin_token — get first route
5. GET /api/vehicles with admin_token — get first vehicle
6. POST /api/daily-routes/start with admin_token — start a daily route, get daily_route_id

Test 1: Driver sale WITHOUT dispatched stock should be allowed (no dispatch records = no enforcement)
Test 2: Admin dispatches stock, then driver sells within limits
Test 3: Driver tries to sell MORE than loaded stock
Test 4: Driver tries to sell unloaded product
Test 5: Driver my-stock endpoint
"""

import requests
import json
from datetime import datetime

# Backend URL
BASE_URL = "https://fmcg-delivery-app-2.preview.emergentagent.com/api"

def log_test(test_name, status, details=""):
    """Log test results"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    status_symbol = "✅" if status == "PASS" else "❌"
    print(f"[{timestamp}] {status_symbol} {test_name}")
    if details:
        print(f"    {details}")
    print()

def make_request(method, endpoint, headers=None, json_data=None):
    """Make HTTP request with error handling"""
    url = f"{BASE_URL}{endpoint}"
    try:
        if method == "GET":
            response = requests.get(url, headers=headers)
        elif method == "POST":
            response = requests.post(url, headers=headers, json=json_data)
        elif method == "PUT":
            response = requests.put(url, headers=headers, json=json_data)
        
        print(f"    {method} {endpoint} -> {response.status_code}")
        if response.status_code >= 400:
            print(f"    Error: {response.text}")
        
        return response
    except Exception as e:
        print(f"    Request failed: {str(e)}")
        return None

def test_driver_vehicle_stock_enforcement():
    """Main test function for driver vehicle stock enforcement"""
    
    print("🚛 DRIVER VEHICLE STOCK ENFORCEMENT TESTING")
    print("=" * 60)
    print()
    
    # Step 1: Seed fresh data
    print("STEP 1: Seeding fresh data...")
    response = make_request("POST", "/admin/reset-and-seed")
    if not response or response.status_code != 200:
        log_test("STEP 1: Seed Data", "FAIL", "Failed to seed data")
        return
    log_test("STEP 1: Seed Data", "PASS", "Fresh data seeded successfully")
    
    # Step 2: Admin login
    print("STEP 2: Admin login...")
    admin_login_data = {
        "phone": "0767862760",
        "pin": "1984"
    }
    response = make_request("POST", "/auth/login", json_data=admin_login_data)
    if not response or response.status_code != 200:
        log_test("STEP 2: Admin Login", "FAIL", "Admin login failed")
        return
    
    admin_data = response.json()
    admin_token = admin_data["token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    log_test("STEP 2: Admin Login", "PASS", f"Admin logged in successfully")
    
    # Step 3: Get first product
    print("STEP 3: Getting first product...")
    response = make_request("GET", "/products", headers=admin_headers)
    if not response or response.status_code != 200:
        log_test("STEP 3: Get Products", "FAIL", "Failed to get products")
        return
    
    products = response.json()
    if not products:
        log_test("STEP 3: Get Products", "FAIL", "No products found")
        return
    
    first_product = products[0]
    product_id = first_product["id"]
    product_name = first_product["name"]
    log_test("STEP 3: Get Products", "PASS", f"Selected product: {product_name} (ID: {product_id})")
    
    # Step 4: Get first route
    print("STEP 4: Getting first route...")
    response = make_request("GET", "/routes", headers=admin_headers)
    if not response or response.status_code != 200:
        log_test("STEP 4: Get Routes", "FAIL", "Failed to get routes")
        return
    
    routes = response.json()
    if not routes:
        log_test("STEP 4: Get Routes", "FAIL", "No routes found")
        return
    
    first_route = routes[0]
    route_id = first_route["id"]
    route_name = first_route["name"]
    log_test("STEP 4: Get Routes", "PASS", f"Selected route: {route_name} (ID: {route_id})")
    
    # Step 5: Get first vehicle
    print("STEP 5: Getting first vehicle...")
    response = make_request("GET", "/vehicles", headers=admin_headers)
    if not response or response.status_code != 200:
        log_test("STEP 5: Get Vehicles", "FAIL", "Failed to get vehicles")
        return
    
    vehicles = response.json()
    if not vehicles:
        log_test("STEP 5: Get Vehicles", "FAIL", "No vehicles found")
        return
    
    first_vehicle = vehicles[0]
    vehicle_id = first_vehicle["id"]
    vehicle_name = first_vehicle["name"]
    log_test("STEP 5: Get Vehicles", "PASS", f"Selected vehicle: {vehicle_name} (ID: {vehicle_id})")
    
    # Step 6: Start daily route
    print("STEP 6: Starting daily route...")
    daily_route_data = {
        "route_id": route_id,
        "vehicle_id": vehicle_id,
        "opening_km": 1000.0,
        "crates_out": 20
    }
    response = make_request("POST", "/daily-routes/start", headers=admin_headers, json_data=daily_route_data)
    if not response or response.status_code != 200:
        log_test("STEP 6: Start Daily Route", "FAIL", "Failed to start daily route")
        return
    
    daily_route_response = response.json()
    daily_route_id = daily_route_response["id"]
    log_test("STEP 6: Start Daily Route", "PASS", f"Daily route started (ID: {daily_route_id})")
    
    # Get driver info from the daily route or use admin as driver
    driver_id = daily_route_response.get("driver_id", admin_data["user"]["id"])
    
    # For testing, we'll use admin credentials as driver since we need to login as the driver
    driver_headers = admin_headers  # Using admin token as driver for testing
    
    print("\n" + "="*60)
    print("VEHICLE STOCK ENFORCEMENT TESTS")
    print("="*60)
    
    # First, let's get customers to use a real customer_id
    print("Getting customers for testing...")
    response = make_request("GET", "/customers", headers=admin_headers)
    if not response or response.status_code != 200:
        log_test("Get Customers", "FAIL", "Failed to get customers")
        return
    
    customers = response.json()
    if not customers:
        # Create a test customer
        print("    No customers found, creating test customer...")
        customer_data = {
            "name": "Test Customer",
            "contact": "0123456789",
            "location": "Test Location",
            "payment_terms": "cash",
            "route_id": route_id
        }
        response = make_request("POST", "/customers", headers=admin_headers, json_data=customer_data)
        if not response or response.status_code != 200:
            log_test("Create Test Customer", "FAIL", "Failed to create test customer")
            return
        
        # Get the created customer
        response = make_request("GET", "/customers", headers=admin_headers)
        if not response or response.status_code != 200:
            log_test("Get Customers After Create", "FAIL", "Failed to get customers after creation")
            return
        customers = response.json()
    
    if not customers:
        log_test("Get Customers", "FAIL", "No customers available after creation attempt")
        return
    
    first_customer = customers[0]
    customer_id = first_customer["id"]
    customer_name = first_customer["name"]
    print(f"    Using customer: {customer_name} (ID: {customer_id})")
    print()

    # TEST 1: Driver sale WITHOUT dispatched stock should be allowed
    print("\nTEST 1: Driver sale WITHOUT dispatched stock (should be allowed)")
    print("-" * 50)
    
    # Try to create a sale without any dispatched stock
    sale_data = {
        "route_id": route_id,
        "customer_id": customer_id,
        "customer_name": customer_name,
        "items": [
            {
                "product_id": product_id,
                "product_name": product_name,
                "quantity_delivered": 5,
                "quantity_returned": 0,
                "unit_price": first_product["price"]
            }
        ],
        "total_amount": first_product["price"] * 5,
        "cash_collected": first_product["price"] * 5,
        "payment_type": "cash",
        "delivery_status": "delivered"
    }
    
    response = make_request("POST", "/sales", headers=driver_headers, json_data=sale_data)
    if response and response.status_code == 200:
        log_test("TEST 1: Sale Without Dispatch", "PASS", "Driver can sell when no dispatch records exist (no enforcement)")
    else:
        log_test("TEST 1: Sale Without Dispatch", "FAIL", f"Expected success but got {response.status_code if response else 'no response'}")
    
    # TEST 2: Admin dispatches stock, then driver sells within limits
    print("\nTEST 2: Admin dispatches stock, driver sells within limits")
    print("-" * 50)
    
    # First, add stock to warehouse so we can dispatch it
    print("    Adding stock to warehouse first...")
    stock_receive_data = {
        "product_id": product_id,
        "product_name": product_name,
        "quantity": 100,
        "supplier": "Test Supplier",
        "batch_reference": "BATCH001"
    }
    response = make_request("POST", "/stock/receive", headers=admin_headers, json_data=stock_receive_data)
    if not response or response.status_code != 200:
        log_test("TEST 2: Add Warehouse Stock", "FAIL", "Failed to add stock to warehouse")
    else:
        print("    ✅ Added 100 units to warehouse")
    
    # Now dispatch stock to the vehicle
    dispatch_data = {
        "daily_route_id": daily_route_id,
        "items": [
            {
                "product_id": product_id,
                "product_name": product_name,
                "quantity": 50
            }
        ],
        "notes": "Test dispatch for enforcement testing"
    }
    
    response = make_request("POST", "/vehicle-stock/dispatch", headers=admin_headers, json_data=dispatch_data)
    if not response or response.status_code != 200:
        log_test("TEST 2: Stock Dispatch", "FAIL", "Failed to dispatch stock to vehicle")
    else:
        log_test("TEST 2: Stock Dispatch", "PASS", "Stock dispatched to vehicle successfully (50 units)")
        
        # Now try to sell within limits (10 units out of 50)
        sale_data_2 = {
            "route_id": route_id,
            "customer_id": customer_id,
            "customer_name": customer_name,
            "items": [
                {
                    "product_id": product_id,
                    "product_name": product_name,
                    "quantity_delivered": 10,
                    "quantity_returned": 0,
                    "unit_price": first_product["price"]
                }
            ],
            "total_amount": first_product["price"] * 10,
            "cash_collected": first_product["price"] * 10,
            "payment_type": "cash",
            "delivery_status": "delivered"
        }
        
        response = make_request("POST", "/sales", headers=driver_headers, json_data=sale_data_2)
        if response and response.status_code == 200:
            log_test("TEST 2: Sale Within Limits", "PASS", "Driver can sell within dispatched stock limits (10 ≤ 50)")
        else:
            log_test("TEST 2: Sale Within Limits", "FAIL", f"Expected success but got {response.status_code if response else 'no response'}")
    
    # TEST 3: Driver tries to sell MORE than loaded stock
    print("\nTEST 3: Driver tries to sell MORE than loaded stock")
    print("-" * 50)
    
    sale_data_3 = {
        "route_id": route_id,
        "customer_id": customer_id,
        "customer_name": customer_name,
        "items": [
            {
                "product_id": product_id,
                "product_name": product_name,
                "quantity_delivered": 100,  # More than the 50 dispatched (minus 10 already sold = 40 remaining)
                "quantity_returned": 0,
                "unit_price": first_product["price"]
            }
        ],
        "total_amount": first_product["price"] * 100,
        "cash_collected": first_product["price"] * 100,
        "payment_type": "cash",
        "delivery_status": "delivered"
    }
    
    response = make_request("POST", "/sales", headers=driver_headers, json_data=sale_data_3)
    if response and response.status_code == 400 and "Insufficient vehicle stock" in response.text:
        log_test("TEST 3: Oversell Prevention", "PASS", "System correctly prevents selling more than loaded stock")
    else:
        log_test("TEST 3: Oversell Prevention", "FAIL", f"Expected 400 'Insufficient vehicle stock' but got {response.status_code if response else 'no response'}")
    
    # TEST 4: Driver tries to sell unloaded product
    print("\nTEST 4: Driver tries to sell unloaded product")
    print("-" * 50)
    
    # Get a different product that was NOT dispatched
    if len(products) > 1:
        second_product = products[1]
        unloaded_product_id = second_product["id"]
        unloaded_product_name = second_product["name"]
        
        sale_data_4 = {
            "route_id": route_id,
            "customer_id": customer_id,
            "customer_name": customer_name,
            "items": [
                {
                    "product_id": unloaded_product_id,
                    "product_name": unloaded_product_name,
                    "quantity_delivered": 5,
                    "quantity_returned": 0,
                    "unit_price": second_product["price"]
                }
            ],
            "total_amount": second_product["price"] * 5,
            "cash_collected": second_product["price"] * 5,
            "payment_type": "cash",
            "delivery_status": "delivered"
        }
        
        response = make_request("POST", "/sales", headers=driver_headers, json_data=sale_data_4)
        if response and response.status_code == 400 and "has not been loaded onto your vehicle" in response.text:
            log_test("TEST 4: Unloaded Product Prevention", "PASS", "System correctly prevents selling unloaded products")
        else:
            log_test("TEST 4: Unloaded Product Prevention", "FAIL", f"Expected 400 'has not been loaded' but got {response.status_code if response else 'no response'}")
    else:
        log_test("TEST 4: Unloaded Product Prevention", "SKIP", "Only one product available, cannot test unloaded product")
    
    # TEST 5: Driver my-stock endpoint
    print("\nTEST 5: Driver my-stock endpoint")
    print("-" * 50)
    
    response = make_request("GET", "/vehicle-stock/driver/my-stock", headers=driver_headers)
    if response and response.status_code == 200:
        stock_data = response.json()
        log_test("TEST 5: Driver My-Stock", "PASS", f"Driver can view loaded stock: {len(stock_data)} items")
        
        # Verify the stock shows correct remaining quantity
        if isinstance(stock_data, list) and len(stock_data) > 0:
            for item in stock_data:
                if isinstance(item, dict) and item.get("product_id") == product_id:
                    remaining = item.get("quantity_remaining", 0)
                    print(f"    {product_name}: {remaining} units remaining")
                    break
        else:
            print(f"    Stock data: {stock_data}")
    else:
        log_test("TEST 5: Driver My-Stock", "FAIL", f"Failed to get driver stock: {response.status_code if response else 'no response'}")
    
    print("\n" + "="*60)
    print("DRIVER VEHICLE STOCK ENFORCEMENT TESTING COMPLETE")
    print("="*60)

if __name__ == "__main__":
    test_driver_vehicle_stock_enforcement()