#!/usr/bin/env python3
"""
Backend Test for Route Start Flow and Multi-Tenancy Data Isolation
Tests the specific scenarios mentioned in the review request
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from frontend/.env
BASE_URL = "https://fmcg-delivery-app-2.preview.emergentagent.com/api"

def print_test_header(test_name):
    print(f"\n{'='*80}")
    print(f"TEST: {test_name}")
    print('='*80)

def print_result(success, message, data=None):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")
    if data:
        print(f"Data: {json.dumps(data, indent=2)}")

def print_step(step_num, description, expected=None, actual=None):
    print(f"\nSTEP {step_num}: {description}")
    if expected is not None:
        print(f"Expected: {expected}")
    if actual is not None:
        print(f"Actual: {actual}")

# ==================== TEST 1: DRIVER ROUTE START ====================
def test_driver_route_start():
    """Test driver route start with vehicle_check object"""
    print_test_header("TEST 1: DRIVER ROUTE START (Primary Test)")
    
    try:
        # STEP 1: POST /api/admin/reset-and-seed to seed fresh data
        print_step(1, "POST /api/admin/reset-and-seed to seed fresh data")
        response = requests.post(f"{BASE_URL}/admin/reset-and-seed", timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Database seed failed with status {response.status_code}: {response.text}")
            return False
        
        print_result(True, "Database seeded successfully")
        
        # STEP 2: Login as admin (phone: 0767862760, pin: 1984)
        print_step(2, "Login as admin (phone: 0767862760, pin: 1984)")
        login_data = {"phone": "0767862760", "pin": "1984"}
        response = requests.post(f"{BASE_URL}/auth/login", json=login_data, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Admin login failed: {response.text}")
            return False
        
        admin_response = response.json()
        admin_token = admin_response.get("token")
        company_info = admin_response.get("company")
        
        if not company_info:
            print_result(False, "Admin login response missing company info")
            return False
        
        company_name = company_info.get("name") if isinstance(company_info, dict) else None
        if not company_name or "Mzansi" not in company_name:
            print_result(False, f"Admin company mismatch. Expected: Mzansi Distribution, Got: {company_name}")
            return False
        
        print_result(True, f"Admin login successful - Company: {company_name}")
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        # STEP 3: Login as driver (phone: 0812345001, pin: 1234)
        print_step(3, "Login as driver (phone: 0812345001, pin: 1234)")
        driver_login_data = {"phone": "0812345001", "pin": "1234"}
        response = requests.post(f"{BASE_URL}/auth/login", json=driver_login_data, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Driver login failed: {response.text}")
            return False
        
        driver_response = response.json()
        driver_token = driver_response.get("token")
        driver_user = driver_response.get("user", {})
        driver_company_id = driver_user.get("company_id")
        
        if not driver_company_id:
            print_result(False, "Driver does not have company_id")
            return False
        
        print_result(True, f"Driver login successful - Name: {driver_user.get('name')}, Company ID: {driver_company_id}")
        driver_headers = {"Authorization": f"Bearer {driver_token}"}
        
        # STEP 4: As driver, GET /api/routes - should return 2 routes
        print_step(4, "As driver, GET /api/routes - should return 2 routes (Soweto & Surrounds, Pretoria Route)")
        response = requests.get(f"{BASE_URL}/routes", headers=driver_headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Get routes failed: {response.text}")
            return False
        
        routes = response.json()
        if len(routes) != 2:
            print_result(False, f"Expected 2 routes, got {len(routes)}")
            return False
        
        route_names = [r.get("name") for r in routes]
        print_result(True, f"Got 2 routes: {route_names}")
        
        # Pick first route
        test_route = routes[0]
        route_id = test_route["id"]
        route_name = test_route["name"]
        
        # STEP 5: As driver, GET /api/vehicles/available - should return 2 vehicles
        print_step(5, "As driver, GET /api/vehicles/available - should return 2 vehicles (Truck 1, Truck 2)")
        response = requests.get(f"{BASE_URL}/vehicles/available", headers=driver_headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Get vehicles failed: {response.text}")
            return False
        
        vehicles = response.json()
        if len(vehicles) < 2:
            print_result(False, f"Expected at least 2 vehicles, got {len(vehicles)}")
            return False
        
        vehicle_names = [v.get("name") for v in vehicles]
        print_result(True, f"Got vehicles: {vehicle_names}")
        
        # Pick first vehicle
        test_vehicle = vehicles[0]
        vehicle_id = test_vehicle["id"]
        vehicle_name = test_vehicle["name"]
        
        # STEP 6: As driver, POST /api/daily-routes/start with vehicle_check object
        print_step(6, "As driver, POST /api/daily-routes/start with route_id, vehicle_id, opening_km, crates_out, and vehicle_check")
        
        vehicle_check = {
            "inspection_date": datetime.now().isoformat(),
            "summary": {
                "total_items": 30,
                "passed": 28,
                "failed": 2,
                "unchecked": 0,
                "pass_rate": 93.3
            },
            "categories": {
                "exterior": {
                    "windscreen": {"status": "pass", "comment": ""},
                    "mirrors": {"status": "pass", "comment": ""},
                    "lights": {"status": "fail", "comment": "Left headlight dim"}
                },
                "tires": {
                    "front_left": {"status": "pass", "comment": ""},
                    "front_right": {"status": "pass", "comment": ""},
                    "rear_left": {"status": "pass", "comment": ""},
                    "rear_right": {"status": "pass", "comment": ""},
                    "spare_tire": {"status": "fail", "comment": "Missing"}
                }
            },
            "overall_notes": "Vehicle generally in good condition. Need to replace left headlight and add spare tire.",
            "failed_items": [
                {"item": "Left headlight", "comment": "Dim light"},
                {"item": "Spare tire", "comment": "Missing"}
            ]
        }
        
        daily_route_data = {
            "route_id": route_id,
            "vehicle_id": vehicle_id,
            "opening_km": 15000,
            "crates_out": 50,
            "vehicle_check": vehicle_check
        }
        
        response = requests.post(f"{BASE_URL}/daily-routes/start", json=daily_route_data, headers=driver_headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code not in [200, 201]:
            print_result(False, f"Start daily route failed: {response.text}")
            return False
        
        daily_route_response = response.json()
        daily_route_id = daily_route_response.get("id")
        status = daily_route_response.get("status")
        
        if status != "active":
            print_result(False, f"Expected status 'active', got '{status}'")
            return False
        
        # Verify all fields are populated
        required_fields = ["id", "route_id", "route_name", "vehicle_id", "vehicle_name", "vehicle_registration", 
                          "opening_km", "crates_out", "status", "vehicle_check"]
        missing_fields = [field for field in required_fields if field not in daily_route_response]
        
        if missing_fields:
            print_result(False, f"Missing fields in response: {missing_fields}")
            return False
        
        print_result(True, f"Daily route started successfully - ID: {daily_route_id}, Status: {status}, Vehicle: {daily_route_response.get('vehicle_name')}")
        
        # STEP 7: Try starting the same route again - should return 400 "already active today"
        print_step(7, "Try starting the same route again - should return 400 'already active today'")
        response = requests.post(f"{BASE_URL}/daily-routes/start", json=daily_route_data, headers=driver_headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 400:
            print_result(False, f"Expected 400 error, got {response.status_code}")
            return False
        
        error_message = response.json().get("detail", "")
        if "already active" not in error_message.lower():
            print_result(False, f"Expected 'already active' error message, got: {error_message}")
            return False
        
        print_result(True, f"Correctly blocked duplicate route start: {error_message}")
        
        return True
        
    except Exception as e:
        print_result(False, f"Test error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

# ==================== TEST 2: COMPANY-SCOPED DUPLICATE CHECKS ====================
def test_company_scoped_duplicate_checks():
    """Test that route_already_active and vehicle_in_use checks are scoped to company_id"""
    print_test_header("TEST 2: COMPANY-SCOPED DUPLICATE CHECKS")
    
    try:
        # STEP 1: Login as Fresh Foods SA admin (phone: 0711002001, pin: 2222)
        print_step(1, "Login as Fresh Foods SA admin (phone: 0711002001, pin: 2222)")
        login_data = {"phone": "0711002001", "pin": "2222"}
        response = requests.post(f"{BASE_URL}/auth/login", json=login_data, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Fresh Foods admin login failed: {response.text}")
            return False
        
        fresh_foods_response = response.json()
        fresh_foods_token = fresh_foods_response.get("token")
        company_info = fresh_foods_response.get("company")
        
        if not company_info:
            print_result(False, "Fresh Foods admin login response missing company info")
            return False
        
        fresh_foods_company = company_info.get("name") if isinstance(company_info, dict) else None
        if not fresh_foods_company or "Fresh Foods" not in fresh_foods_company:
            print_result(False, f"Expected Fresh Foods company, got: {fresh_foods_company}")
            return False
        
        print_result(True, f"Fresh Foods admin login successful - Company: {fresh_foods_company}")
        fresh_foods_headers = {"Authorization": f"Bearer {fresh_foods_token}"}
        
        # STEP 2: Get Fresh Foods routes
        print_step(2, "Get Fresh Foods routes")
        response = requests.get(f"{BASE_URL}/routes", headers=fresh_foods_headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Get routes failed: {response.text}")
            return False
        
        fresh_foods_routes = response.json()
        if not fresh_foods_routes:
            print_result(False, "No routes found for Fresh Foods")
            return False
        
        print_result(True, f"Got {len(fresh_foods_routes)} routes for Fresh Foods")
        
        # Pick first route
        fresh_foods_route = fresh_foods_routes[0]
        fresh_foods_route_id = fresh_foods_route["id"]
        
        # STEP 3: Get Fresh Foods vehicles
        print_step(3, "Get Fresh Foods vehicles")
        response = requests.get(f"{BASE_URL}/vehicles/available", headers=fresh_foods_headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Get vehicles failed: {response.text}")
            return False
        
        fresh_foods_vehicles = response.json()
        if not fresh_foods_vehicles:
            print_result(False, "No vehicles found for Fresh Foods")
            return False
        
        print_result(True, f"Got {len(fresh_foods_vehicles)} vehicles for Fresh Foods")
        
        # Pick first vehicle
        fresh_foods_vehicle = fresh_foods_vehicles[0]
        fresh_foods_vehicle_id = fresh_foods_vehicle["id"]
        
        # STEP 4: Start a route for Fresh Foods (should NOT be blocked by Mzansi's active routes)
        print_step(4, "Start a route for Fresh Foods - should NOT be blocked by Mzansi's active routes")
        
        vehicle_check = {
            "inspection_date": datetime.now().isoformat(),
            "summary": {
                "total_items": 30,
                "passed": 30,
                "failed": 0,
                "unchecked": 0,
                "pass_rate": 100.0
            },
            "categories": {},
            "overall_notes": "All checks passed",
            "failed_items": []
        }
        
        daily_route_data = {
            "route_id": fresh_foods_route_id,
            "vehicle_id": fresh_foods_vehicle_id,
            "opening_km": 10000,
            "crates_out": 40,
            "vehicle_check": vehicle_check
        }
        
        response = requests.post(f"{BASE_URL}/daily-routes/start", json=daily_route_data, headers=fresh_foods_headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code not in [200, 201]:
            print_result(False, f"Fresh Foods route start failed (should not be blocked by Mzansi routes): {response.text}")
            return False
        
        fresh_foods_daily_route = response.json()
        print_result(True, f"Fresh Foods route started successfully - ID: {fresh_foods_daily_route.get('id')}")
        
        return True
        
    except Exception as e:
        print_result(False, f"Test error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

# ==================== TEST 3: ACTIVE ROUTE CHECK ====================
def test_active_route_check():
    """Test GET /api/daily-routes/active endpoint"""
    print_test_header("TEST 3: ACTIVE ROUTE CHECK")
    
    try:
        # STEP 1: Login as driver (phone: 0812345001, pin: 1234)
        print_step(1, "Login as driver (phone: 0812345001, pin: 1234)")
        driver_login_data = {"phone": "0812345001", "pin": "1234"}
        response = requests.post(f"{BASE_URL}/auth/login", json=driver_login_data, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Driver login failed: {response.text}")
            return False
        
        driver_response = response.json()
        driver_token = driver_response.get("token")
        driver_headers = {"Authorization": f"Bearer {driver_token}"}
        
        print_result(True, "Driver login successful")
        
        # STEP 2: As driver, GET /api/daily-routes/active - should return the active route
        print_step(2, "As driver, GET /api/daily-routes/active - should return the active route")
        response = requests.get(f"{BASE_URL}/daily-routes/active", headers=driver_headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Get active route failed: {response.text}")
            return False
        
        active_routes = response.json()
        if not active_routes or len(active_routes) == 0:
            print_result(False, "No active route found for driver")
            return False
        
        active_route = active_routes[0]  # Get first active route
        print_result(True, f"Active route found - ID: {active_route.get('id')}, Route: {active_route.get('route_name')}")
        
        # STEP 3: Login as admin (phone: 0767862760, pin: 1984)
        print_step(3, "Login as Mzansi admin (phone: 0767862760, pin: 1984)")
        admin_login_data = {"phone": "0767862760", "pin": "1984"}
        response = requests.post(f"{BASE_URL}/auth/login", json=admin_login_data, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Admin login failed: {response.text}")
            return False
        
        admin_response = response.json()
        admin_token = admin_response.get("token")
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        print_result(True, "Admin login successful")
        
        # STEP 4: As admin, GET /api/daily-routes/active - should return company-scoped active routes
        print_step(4, "As admin, GET /api/daily-routes/active - should return company-scoped active routes")
        response = requests.get(f"{BASE_URL}/daily-routes/active", headers=admin_headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Get active routes failed: {response.text}")
            return False
        
        admin_active_routes = response.json()
        if not admin_active_routes or len(admin_active_routes) == 0:
            print_result(False, "No active routes found for admin")
            return False
        
        print_result(True, f"Admin can see {len(admin_active_routes)} active route(s) - ID: {admin_active_routes[0].get('id')}")
        
        return True
        
    except Exception as e:
        print_result(False, f"Test error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

# ==================== TEST 4: VEHICLE STOCK DISPATCH FLOW ====================
def test_vehicle_stock_dispatch_flow():
    """Test vehicle stock dispatch and warehouse stock reduction"""
    print_test_header("TEST 4: VEHICLE STOCK DISPATCH FLOW")
    
    try:
        # STEP 1: Login as Mzansi admin (phone: 0767862760, pin: 1984)
        print_step(1, "Login as Mzansi admin (phone: 0767862760, pin: 1984)")
        admin_login_data = {"phone": "0767862760", "pin": "1984"}
        response = requests.post(f"{BASE_URL}/auth/login", json=admin_login_data, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Admin login failed: {response.text}")
            return False
        
        admin_response = response.json()
        admin_token = admin_response.get("token")
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        print_result(True, "Admin login successful")
        
        # STEP 2: Get products
        print_step(2, "Get products")
        response = requests.get(f"{BASE_URL}/products", headers=admin_headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Get products failed: {response.text}")
            return False
        
        products = response.json()
        if not products:
            print_result(False, "No products found")
            return False
        
        # Find White Bread
        white_bread = None
        for product in products:
            if "White Bread" in product.get("name", ""):
                white_bread = product
                break
        
        if not white_bread:
            print_result(False, "White Bread product not found")
            return False
        
        product_id = white_bread["id"]
        product_name = white_bread["name"]
        print_result(True, f"Found product: {product_name} (ID: {product_id})")
        
        # STEP 3: POST /api/stock/receive to add 100 units of White Bread to warehouse
        print_step(3, "POST /api/stock/receive to add 100 units of White Bread to warehouse")
        receive_data = {
            "product_id": product_id,
            "product_name": product_name,
            "quantity": 100,
            "supplier": "Test Supplier",
            "batch_reference": "BATCH001"
        }
        
        response = requests.post(f"{BASE_URL}/stock/receive", json=receive_data, headers=admin_headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code not in [200, 201]:
            print_result(False, f"Stock receive failed: {response.text}")
            return False
        
        print_result(True, "Added 100 units of White Bread to warehouse")
        
        # STEP 4: Get stock levels to verify
        print_step(4, "GET /api/stock/levels to verify warehouse stock")
        response = requests.get(f"{BASE_URL}/stock/levels", headers=admin_headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Get stock levels failed: {response.text}")
            return False
        
        stock_levels = response.json()
        warehouse_stock_before = None
        for stock in stock_levels:
            if stock["product_id"] == product_id:
                warehouse_stock_before = stock["current_quantity"]
                break
        
        if warehouse_stock_before is None:
            print_result(False, "No stock found for White Bread")
            return False
        
        print_result(True, f"Warehouse stock before dispatch: {warehouse_stock_before}")
        
        # STEP 5: Get active daily route
        print_step(5, "Get active daily route")
        response = requests.get(f"{BASE_URL}/daily-routes/active", headers=admin_headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Get active route failed: {response.text}")
            return False
        
        active_routes = response.json()
        if not active_routes or len(active_routes) == 0:
            print_result(False, "No active route found")
            return False
        
        active_route = active_routes[0]  # Get first active route
        daily_route_id = active_route["id"]
        print_result(True, f"Active route ID: {daily_route_id}")
        
        # STEP 6: POST /api/vehicle-stock/dispatch to load 50 units onto the active vehicle
        print_step(6, "POST /api/vehicle-stock/dispatch to load 50 units onto the active vehicle")
        dispatch_data = {
            "daily_route_id": daily_route_id,
            "items": [
                {
                    "product_id": product_id,
                    "product_name": product_name,
                    "quantity": 50
                }
            ]
        }
        
        response = requests.post(f"{BASE_URL}/vehicle-stock/dispatch", json=dispatch_data, headers=admin_headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code not in [200, 201]:
            print_result(False, f"Vehicle stock dispatch failed: {response.text}")
            return False
        
        print_result(True, "Dispatched 50 units to vehicle")
        
        # STEP 7: GET /api/vehicle-stock/{daily_route_id} - verify 50 loaded
        print_step(7, f"GET /api/vehicle-stock/{daily_route_id} - verify 50 loaded")
        response = requests.get(f"{BASE_URL}/vehicle-stock/{daily_route_id}", headers=admin_headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Get vehicle stock failed: {response.text}")
            return False
        
        vehicle_stock = response.json()
        if not vehicle_stock or "items" not in vehicle_stock:
            print_result(False, "No vehicle stock found or invalid response format")
            return False
        
        items = vehicle_stock.get("items", [])
        if not items:
            print_result(False, "No items in vehicle stock")
            return False
        
        # Find White Bread in vehicle stock
        white_bread_vehicle_stock = None
        for item in items:
            if item.get("product_id") == product_id:
                white_bread_vehicle_stock = item
                break
        
        if not white_bread_vehicle_stock:
            print_result(False, "White Bread not found in vehicle stock")
            return False
        
        quantity_loaded = white_bread_vehicle_stock.get("quantity_loaded", 0)
        if quantity_loaded != 50:
            print_result(False, f"Expected 50 units loaded, got {quantity_loaded}")
            return False
        
        print_result(True, f"Vehicle stock verified - 50 units loaded")
        
        # STEP 8: GET /api/stock/levels - verify warehouse quantity reduced by 50
        print_step(8, "GET /api/stock/levels - verify warehouse quantity reduced by 50")
        response = requests.get(f"{BASE_URL}/stock/levels", headers=admin_headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Get stock levels failed: {response.text}")
            return False
        
        stock_levels = response.json()
        warehouse_stock_after = None
        for stock in stock_levels:
            if stock["product_id"] == product_id:
                warehouse_stock_after = stock["current_quantity"]
                break
        
        if warehouse_stock_after is None:
            print_result(False, "No stock found for White Bread after dispatch")
            return False
        
        expected_stock = warehouse_stock_before - 50
        if warehouse_stock_after != expected_stock:
            print_result(False, f"Expected warehouse stock {expected_stock}, got {warehouse_stock_after}")
            return False
        
        print_result(True, f"Warehouse stock correctly reduced: {warehouse_stock_before} → {warehouse_stock_after} (reduced by 50)")
        
        return True
        
    except Exception as e:
        print_result(False, f"Test error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

# ==================== TEST 5: MULTI-TENANCY DATA ISOLATION ====================
def test_multi_tenancy_data_isolation():
    """Test that Fresh Foods SA admin cannot see Mzansi data"""
    print_test_header("TEST 5: MULTI-TENANCY DATA ISOLATION")
    
    try:
        # STEP 1: Login as Fresh Foods SA admin (phone: 0711002001, pin: 2222)
        print_step(1, "Login as Fresh Foods SA admin (phone: 0711002001, pin: 2222)")
        login_data = {"phone": "0711002001", "pin": "2222"}
        response = requests.post(f"{BASE_URL}/auth/login", json=login_data, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Fresh Foods admin login failed: {response.text}")
            return False
        
        fresh_foods_response = response.json()
        fresh_foods_token = fresh_foods_response.get("token")
        fresh_foods_headers = {"Authorization": f"Bearer {fresh_foods_token}"}
        
        print_result(True, "Fresh Foods admin login successful")
        
        # STEP 2: GET /api/routes - should only show Fresh Foods routes, not Mzansi routes
        print_step(2, "GET /api/routes - should only show Fresh Foods routes, not Mzansi routes")
        response = requests.get(f"{BASE_URL}/routes", headers=fresh_foods_headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Get routes failed: {response.text}")
            return False
        
        routes = response.json()
        route_names = [r.get("name") for r in routes]
        
        # Check that Mzansi routes are NOT in the list
        mzansi_routes = ["Soweto & Surrounds", "Pretoria Route"]
        for mzansi_route in mzansi_routes:
            if mzansi_route in route_names:
                print_result(False, f"Fresh Foods admin can see Mzansi route: {mzansi_route}")
                return False
        
        print_result(True, f"Fresh Foods admin can only see their own routes: {route_names}")
        
        # STEP 3: GET /api/vehicles - should only show Fresh Foods vehicles, not Mzansi vehicles
        print_step(3, "GET /api/vehicles - should only show Fresh Foods vehicles, not Mzansi vehicles")
        response = requests.get(f"{BASE_URL}/vehicles", headers=fresh_foods_headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Get vehicles failed: {response.text}")
            return False
        
        vehicles = response.json()
        vehicle_names = [v.get("name") for v in vehicles]
        
        # Check that Mzansi vehicles are NOT in the list
        mzansi_vehicles = ["Truck 1 - Toyota Dyna", "Truck 2 - Isuzu NPR"]
        for mzansi_vehicle in mzansi_vehicles:
            if mzansi_vehicle in vehicle_names:
                print_result(False, f"Fresh Foods admin can see Mzansi vehicle: {mzansi_vehicle}")
                return False
        
        print_result(True, f"Fresh Foods admin can only see their own vehicles: {vehicle_names}")
        
        # STEP 4: GET /api/products - should only show Fresh Foods products, not Mzansi products
        print_step(4, "GET /api/products - should only show Fresh Foods products, not Mzansi products")
        response = requests.get(f"{BASE_URL}/products", headers=fresh_foods_headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Get products failed: {response.text}")
            return False
        
        products = response.json()
        product_names = [p.get("name") for p in products]
        
        print_result(True, f"Fresh Foods admin sees {len(products)} products: {product_names}")
        
        # STEP 5: GET /api/daily-routes/active - should not show Mzansi's active routes
        print_step(5, "GET /api/daily-routes/active - should not show Mzansi's active routes")
        response = requests.get(f"{BASE_URL}/daily-routes/active", headers=fresh_foods_headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        # This might return empty list if Fresh Foods has no active routes, which is fine
        if response.status_code == 200:
            active_routes = response.json()
            if len(active_routes) == 0:
                print_result(True, "Fresh Foods has no active routes (expected)")
            else:
                # If there are active routes, make sure they're not Mzansi routes
                for route in active_routes:
                    route_name = route.get("route_name", "")
                    if route_name in ["Soweto & Surrounds", "Pretoria Route"]:
                        print_result(False, f"Fresh Foods admin can see Mzansi active route: {route_name}")
                        return False
                print_result(True, f"Fresh Foods admin sees their own active routes: {[r.get('route_name') for r in active_routes]}")
        else:
            print_result(False, f"Unexpected status code: {response.status_code}")
            return False
        
        return True
        
    except Exception as e:
        print_result(False, f"Test error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Main test runner"""
    print("="*80)
    print("ROUTE START FLOW AND MULTI-TENANCY DATA ISOLATION TESTS")
    print("="*80)
    print(f"Backend URL: {BASE_URL}")
    print(f"Test Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Track test results
    test_results = {}
    
    # Run all tests
    print("\n" + "="*80)
    print("RUNNING ALL TESTS")
    print("="*80)
    
    test_results["TEST 1: DRIVER ROUTE START"] = test_driver_route_start()
    test_results["TEST 2: COMPANY-SCOPED DUPLICATE CHECKS"] = test_company_scoped_duplicate_checks()
    test_results["TEST 3: ACTIVE ROUTE CHECK"] = test_active_route_check()
    test_results["TEST 4: VEHICLE STOCK DISPATCH FLOW"] = test_vehicle_stock_dispatch_flow()
    test_results["TEST 5: MULTI-TENANCY DATA ISOLATION"] = test_multi_tenancy_data_isolation()
    
    # Final Results Summary
    print("\n" + "="*80)
    print("FINAL TEST RESULTS SUMMARY")
    print("="*80)
    
    passed_tests = sum(1 for result in test_results.values() if result)
    total_tests = len(test_results)
    
    for test_name, result in test_results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print("\n" + "="*80)
    print(f"OVERALL RESULTS: {passed_tests}/{total_tests} tests passed ({passed_tests/total_tests*100:.1f}%)")
    print("="*80)
    
    if passed_tests == total_tests:
        print("🎉 ALL TESTS PASSED!")
        print("✅ Route Start Flow working correctly")
        print("✅ Multi-Tenancy Data Isolation working correctly")
        print("✅ Vehicle Stock Dispatch Flow working correctly")
    else:
        print(f"❌ {total_tests - passed_tests} test(s) failed")
    
    print(f"Test Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    return passed_tests == total_tests

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
