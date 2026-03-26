#!/usr/bin/env python3
"""
Backend Test for Vehicle Stock Return Functionality
Tests the specific vehicle stock return flow as mentioned in the review request
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from frontend/.env
BASE_URL = "https://fmcg-delivery-app-2.preview.emergentagent.com/api"

def print_test_header(test_name):
    print(f"\n{'='*60}")
    print(f"TEST: {test_name}")
    print('='*60)

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

def test_vehicle_stock_return_flow():
    """Test the complete vehicle stock return flow as specified in review request"""
    print_test_header("Vehicle Stock Return Flow Test")
    
    try:
        # STEP 1: POST /api/admin/reset-and-seed — seed fresh data
        print_step(1, "POST /api/admin/reset-and-seed — seed fresh data")
        response = requests.post(f"{BASE_URL}/admin/reset-and-seed", timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Database seed failed with status {response.status_code}: {response.text}")
            return False
        
        seed_data = response.json()
        print_result(True, "Database seeded successfully")
        
        # STEP 2: POST /api/auth/login with phone=0767862760, pin=1984 — get admin token
        print_step(2, "POST /api/auth/login with phone=0767862760, pin=1984 — get admin token")
        login_data = {
            "phone": "0767862760",
            "pin": "1984"
        }
        
        response = requests.post(f"{BASE_URL}/auth/login", json=login_data, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Admin login failed with status {response.status_code}: {response.text}")
            return False
        
        login_response = response.json()
        admin_token = login_response.get("token")
        user = login_response.get("user", {})
        
        if not admin_token or user.get("role") != "admin":
            print_result(False, "Admin login failed - no token or not admin role")
            return False
        
        print_result(True, f"Admin login successful - Name: {user.get('name')}, Role: {user.get('role')}")
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # STEP 3: GET /api/products — pick first product, note its product_id
        print_step(3, "GET /api/products — pick first product, note its product_id")
        response = requests.get(f"{BASE_URL}/products", headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Get products failed with status {response.status_code}: {response.text}")
            return False
        
        products = response.json()
        if not products:
            print_result(False, "No products found")
            return False
        
        test_product = products[0]
        product_id = test_product["id"]
        product_name = test_product["name"]
        print_result(True, f"Selected product: {product_name} (ID: {product_id})")
        
        # STEP 4: GET /api/stock/levels — note the INITIAL warehouse quantity for that product
        print_step(4, "GET /api/stock/levels — note the INITIAL warehouse quantity")
        response = requests.get(f"{BASE_URL}/stock/levels", headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Get stock levels failed with status {response.status_code}: {response.text}")
            return False
        
        stock_levels = response.json()
        initial_stock = None
        for stock in stock_levels:
            if stock["product_id"] == product_id:
                initial_stock = stock["current_quantity"]
                break
        
        if initial_stock is None:
            print_result(False, f"No stock found for product {product_name}")
            return False
        
        INITIAL_QTY = initial_stock
        print_result(True, f"INITIAL warehouse quantity for {product_name}: {INITIAL_QTY}")
        
        # If initial stock is 0, we need to add some stock first
        if INITIAL_QTY == 0:
            print_step("4a", "POST /api/stock/receive — add initial stock to warehouse")
            receive_data = {
                "product_id": product_id,
                "product_name": product_name,
                "quantity": 100,
                "supplier": "Test Supplier",
                "batch_reference": "TEST001"
            }
            
            response = requests.post(f"{BASE_URL}/stock/receive", json=receive_data, headers=headers, timeout=10)
            print(f"Status Code: {response.status_code}")
            
            if response.status_code not in [200, 201]:
                print_result(False, f"Stock receive failed with status {response.status_code}: {response.text}")
                return False
            
            print_result(True, f"Added 100 units of {product_name} to warehouse")
            
            # Get updated stock levels
            response = requests.get(f"{BASE_URL}/stock/levels", headers=headers, timeout=10)
            if response.status_code == 200:
                stock_levels = response.json()
                for stock in stock_levels:
                    if stock["product_id"] == product_id:
                        INITIAL_QTY = stock["current_quantity"]
                        break
                print_result(True, f"UPDATED warehouse quantity for {product_name}: {INITIAL_QTY}")
            else:
                print_result(False, "Failed to get updated stock levels")
                return False
        
        # STEP 5: GET /api/routes — pick first route
        print_step(5, "GET /api/routes — pick first route")
        response = requests.get(f"{BASE_URL}/routes", headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Get routes failed with status {response.status_code}: {response.text}")
            return False
        
        routes = response.json()
        if not routes:
            print_result(False, "No routes found")
            return False
        
        test_route = routes[0]
        route_id = test_route["id"]
        route_name = test_route["name"]
        print_result(True, f"Selected route: {route_name} (ID: {route_id})")
        
        # STEP 6: GET /api/vehicles — pick first vehicle
        print_step(6, "GET /api/vehicles — pick first vehicle")
        response = requests.get(f"{BASE_URL}/vehicles", headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Get vehicles failed with status {response.status_code}: {response.text}")
            return False
        
        vehicles = response.json()
        if not vehicles:
            print_result(False, "No vehicles found")
            return False
        
        test_vehicle = vehicles[0]
        vehicle_id = test_vehicle["id"]
        vehicle_name = test_vehicle["name"]
        print_result(True, f"Selected vehicle: {vehicle_name} (ID: {vehicle_id})")
        
        # STEP 7: POST /api/daily-routes/start with route_id, vehicle_id — get daily_route_id
        print_step(7, "POST /api/daily-routes/start with route_id, vehicle_id — get daily_route_id")
        daily_route_data = {
            "route_id": route_id,
            "vehicle_id": vehicle_id,
            "opening_km": 15000,
            "crates_out": 50
        }
        
        response = requests.post(f"{BASE_URL}/daily-routes/start", json=daily_route_data, headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code not in [200, 201]:
            print_result(False, f"Start daily route failed with status {response.status_code}: {response.text}")
            return False
        
        daily_route_response = response.json()
        daily_route_id = daily_route_response["id"]
        print_result(True, f"Daily route started successfully (ID: {daily_route_id})")
        
        # STEP 8: POST /api/vehicle-stock/dispatch with daily_route_id, items: [{product_id, product_name, quantity: 30}]
        print_step(8, "POST /api/vehicle-stock/dispatch — dispatch 30 units to vehicle")
        dispatch_data = {
            "daily_route_id": daily_route_id,
            "items": [
                {
                    "product_id": product_id,
                    "product_name": product_name,
                    "quantity": 30
                }
            ]
        }
        
        response = requests.post(f"{BASE_URL}/vehicle-stock/dispatch", json=dispatch_data, headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code not in [200, 201]:
            print_result(False, f"Vehicle stock dispatch failed with status {response.status_code}: {response.text}")
            return False
        
        dispatch_response = response.json()
        print_result(True, f"Dispatched 30 units of {product_name} to vehicle")
        
        # STEP 9: GET /api/stock/levels — verify depot stock is now INITIAL_QTY - 30
        print_step(9, "GET /api/stock/levels — verify depot stock is now INITIAL_QTY - 30")
        response = requests.get(f"{BASE_URL}/stock/levels", headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Get stock levels failed with status {response.status_code}: {response.text}")
            return False
        
        stock_levels = response.json()
        current_stock_after_dispatch = None
        for stock in stock_levels:
            if stock["product_id"] == product_id:
                current_stock_after_dispatch = stock["current_quantity"]
                break
        
        if current_stock_after_dispatch is None:
            print_result(False, f"No stock found for product {product_name} after dispatch")
            return False
        
        expected_after_dispatch = INITIAL_QTY - 30
        print_step(9, f"Verify depot stock after dispatch", 
                  expected=f"{expected_after_dispatch} (INITIAL_QTY {INITIAL_QTY} - 30)", 
                  actual=current_stock_after_dispatch)
        
        if current_stock_after_dispatch != expected_after_dispatch:
            print_result(False, f"Stock after dispatch incorrect. Expected: {expected_after_dispatch}, Actual: {current_stock_after_dispatch}")
            return False
        
        print_result(True, f"✅ CORRECT: Depot stock after dispatch: {current_stock_after_dispatch} (was {INITIAL_QTY}, dispatched 30)")
        
        # STEP 10: POST /api/vehicle-stock/return with daily_route_id, items: [{product_id, product_name, quantity: 10}]
        print_step(10, "POST /api/vehicle-stock/return — return 10 unsold units")
        return_data = {
            "daily_route_id": daily_route_id,
            "items": [
                {
                    "product_id": product_id,
                    "product_name": product_name,
                    "quantity": 10
                }
            ]
        }
        
        response = requests.post(f"{BASE_URL}/vehicle-stock/return", json=return_data, headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code not in [200, 201]:
            print_result(False, f"Vehicle stock return failed with status {response.status_code}: {response.text}")
            return False
        
        return_response = response.json()
        print_result(True, f"Returned 10 units of {product_name} from vehicle")
        
        # STEP 11: GET /api/stock/levels — verify depot stock is now INITIAL_QTY - 30 + 10 = INITIAL_QTY - 20
        print_step(11, "GET /api/stock/levels — verify depot stock is now INITIAL_QTY - 30 + 10 = INITIAL_QTY - 20")
        response = requests.get(f"{BASE_URL}/stock/levels", headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Get stock levels failed with status {response.status_code}: {response.text}")
            return False
        
        stock_levels = response.json()
        final_stock = None
        for stock in stock_levels:
            if stock["product_id"] == product_id:
                final_stock = stock["current_quantity"]
                break
        
        if final_stock is None:
            print_result(False, f"No stock found for product {product_name} after return")
            return False
        
        expected_final_stock = INITIAL_QTY - 20  # INITIAL_QTY - 30 + 10
        print_step(11, f"Verify depot stock after return", 
                  expected=f"{expected_final_stock} (INITIAL_QTY {INITIAL_QTY} - 30 + 10)", 
                  actual=final_stock)
        
        if final_stock != expected_final_stock:
            print_result(False, f"❌ CRITICAL FAILURE: Stock after return incorrect. Expected: {expected_final_stock}, Actual: {final_stock}")
            print(f"❌ The depot quantity did NOT increase by exactly 10 after the return!")
            print(f"❌ Expected calculation: {INITIAL_QTY} (initial) - 30 (dispatched) + 10 (returned) = {expected_final_stock}")
            print(f"❌ Actual final stock: {final_stock}")
            return False
        
        print_result(True, f"🎉 SUCCESS: Depot stock after return: {final_stock}")
        print(f"🎉 CORRECT CALCULATION: {INITIAL_QTY} (initial) - 30 (dispatched) + 10 (returned) = {final_stock}")
        print(f"🎉 The depot quantity increased by exactly 10 after the return!")
        
        # Summary
        print(f"\n{'='*80}")
        print("VEHICLE STOCK RETURN FLOW TEST SUMMARY")
        print('='*80)
        print(f"Product: {product_name}")
        print(f"Initial depot quantity: {INITIAL_QTY}")
        print(f"After dispatch (30 units): {current_stock_after_dispatch}")
        print(f"After return (10 units): {final_stock}")
        print(f"Net change: {final_stock - INITIAL_QTY} (expected: -20)")
        print(f"Return increase: {final_stock - current_stock_after_dispatch} (expected: +10)")
        print("🎉 VEHICLE STOCK RETURN FUNCTIONALITY WORKING CORRECTLY!")
        
        return True
        
    except Exception as e:
        print_result(False, f"Vehicle stock return flow test error: {str(e)}")
        return False

def main():
    """Main test runner"""
    print("="*80)
    print("VEHICLE STOCK RETURN FUNCTIONALITY TEST")
    print("="*80)
    print(f"Backend URL: {BASE_URL}")
    print(f"Test Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Run the vehicle stock return flow test
    success = test_vehicle_stock_return_flow()
    
    # Final Results Summary
    print("\n" + "="*80)
    print("FINAL TEST RESULTS SUMMARY")
    print("="*80)
    
    if success:
        print("✅ PASS: Vehicle Stock Return Flow Test")
        print("🎉 VEHICLE STOCK RETURN FUNCTIONALITY IS WORKING PERFECTLY!")
        print("✅ Returned stock from vehicle is correctly added back to depot/warehouse stock")
    else:
        print("❌ FAIL: Vehicle Stock Return Flow Test")
        print("❌ VEHICLE STOCK RETURN FUNCTIONALITY HAS ISSUES!")
        print("❌ Returned stock from vehicle is NOT correctly added back to depot/warehouse stock")
    
    print(f"Test Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)