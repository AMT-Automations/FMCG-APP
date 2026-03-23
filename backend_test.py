#!/usr/bin/env python3
"""
Backend Test for Mzansi FMCG Tracker - NEW Marketplace Model Endpoints Testing
Tests the specific marketplace endpoints as mentioned in the review request
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from frontend/.env
BASE_URL = "https://expo-production-2.preview.emergentagent.com/api"

def print_test_header(test_name):
    print(f"\n{'='*60}")
    print(f"TEST: {test_name}")
    print('='*60)

def print_result(success, message, data=None):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")
    if data:
        print(f"Data: {json.dumps(data, indent=2)}")

def test_database_seed():
    """Test 1: Database Seed - POST /api/admin/reset-and-seed"""
    print_test_header("Database Seed & Data Verification")
    
    try:
        # Seed the database
        response = requests.post(f"{BASE_URL}/admin/reset-and-seed", timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print_result(True, "Database seeded successfully", data)
            
            # Verify expected counts
            companies = data.get("companies", [])
            customers = data.get("customers", [])
            routes = data.get("routes", 0)
            vehicles = data.get("vehicles", 0)
            products = data.get("products", 0)
            
            expected_companies = 3
            expected_customers = 2
            expected_routes = 4
            expected_vehicles = 4
            expected_products = 17  # 8 + 5 + 4 = 17 total products
            
            success = (len(companies) == expected_companies and 
                      len(customers) == expected_customers and
                      routes == expected_routes and
                      vehicles == expected_vehicles and
                      products == expected_products)
            
            print_result(success, f"Seed verification: {len(companies)} companies, {len(customers)} customers, {routes} routes, {vehicles} vehicles, {products} products")
            
            return success, data
        else:
            print_result(False, f"Database seed failed with status {response.status_code}: {response.text}")
            return False, None
    except Exception as e:
        print_result(False, f"Database seed error: {str(e)}")
        return False, None

def test_admin_login():
    """Test 2: Admin Login - POST /api/auth/login with Mzansi Distribution admin"""
    print_test_header("Admin Login Test")
    
    try:
        login_data = {
            "phone": "0767862760",
            "pin": "1984"
        }
        
        response = requests.post(f"{BASE_URL}/auth/login", json=login_data, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("token")
            user = data.get("user", {})
            user_role = user.get("role")
            name = user.get("name")
            
            success = token and user_role == "admin" and name
            print_result(success, f"Admin login successful - Name: {name}, Role: {user_role}")
            
            return success, token
        else:
            print_result(False, f"Admin login failed with status {response.status_code}: {response.text}")
            return False, None
    except Exception as e:
        print_result(False, f"Admin login error: {str(e)}")
        return False, None

def test_location_endpoints():
    """Test 3: Location Endpoints - provinces, districts, areas"""
    print_test_header("Location Endpoints Test")
    
    results = []
    
    # Test 1: Get provinces (no auth needed)
    try:
        response = requests.get(f"{BASE_URL}/locations/provinces", timeout=10)
        if response.status_code == 200:
            provinces = response.json()
            success = len(provinces) == 9
            print_result(success, f"Provinces endpoint: {len(provinces)} provinces returned")
            results.append(success)
        else:
            print_result(False, f"Provinces endpoint failed: {response.status_code}")
            results.append(False)
    except Exception as e:
        print_result(False, f"Provinces endpoint error: {str(e)}")
        results.append(False)
    
    # Test 2: Get districts for Gauteng
    try:
        response = requests.get(f"{BASE_URL}/locations/districts/Gauteng", timeout=10)
        if response.status_code == 200:
            districts = response.json()
            success = len(districts) > 0 and "City of Johannesburg" in districts
            print_result(success, f"Gauteng districts: {len(districts)} districts returned")
            results.append(success)
        else:
            print_result(False, f"Districts endpoint failed: {response.status_code}")
            results.append(False)
    except Exception as e:
        print_result(False, f"Districts endpoint error: {str(e)}")
        results.append(False)
    
    # Test 3: Get areas for City of Johannesburg
    try:
        response = requests.get(f"{BASE_URL}/locations/areas/Gauteng/City%20of%20Johannesburg", timeout=10)
        if response.status_code == 200:
            areas = response.json()
            success = len(areas) > 0 and "Soweto" in areas
            print_result(success, f"Johannesburg areas: {len(areas)} areas returned, includes Soweto")
            results.append(success)
        else:
            print_result(False, f"Areas endpoint failed: {response.status_code}")
            results.append(False)
    except Exception as e:
        print_result(False, f"Areas endpoint error: {str(e)}")
        results.append(False)
    
    return all(results)

def test_customer_login():
    """Test 4: Customer Login - POST /api/auth/login with customer credentials"""
    print_test_header("Customer Login Test (Thabo's Spaza)")
    
    try:
        login_data = {
            "phone": "0831001001",
            "pin": "1111"
        }
        
        response = requests.post(f"{BASE_URL}/auth/login", json=login_data, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("token")
            user = data.get("user", {})
            user_role = user.get("role")
            name = user.get("name")
            
            success = token and user_role == "customer" and name
            print_result(success, f"Customer login successful - Name: {name}, Role: {user_role}")
            
            return success, token
        else:
            print_result(False, f"Customer login failed with status {response.status_code}: {response.text}")
            return False, None
    except Exception as e:
        print_result(False, f"Customer login error: {str(e)}")
        return False, None

def test_marketplace_available_companies(customer_token):
    """Test 5: Marketplace Available Companies - GET /api/customer/available-companies"""
    print_test_header("Marketplace Available Companies Test")
    
    try:
        headers = {"Authorization": f"Bearer {customer_token}"}
        response = requests.get(f"{BASE_URL}/customer/available-companies", headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            companies = response.json()
            
            # Should return companies that deliver to Soweto area (Mzansi Distribution)
            success = len(companies) > 0
            print_result(success, f"Available companies: {len(companies)} companies found")
            
            for company in companies:
                name = company.get("name", "")
                product_count = company.get("product_count", 0)
                routes = company.get("routes", [])
                print(f"  - {name}: {product_count} products, {len(routes)} routes")
            
            return success, companies
        else:
            print_result(False, f"Available companies failed with status {response.status_code}: {response.text}")
            return False, None
    except Exception as e:
        print_result(False, f"Available companies error: {str(e)}")
        return False, None

def test_marketplace_company_products(customer_token, company_id):
    """Test 6: Company Products - GET /api/customer/company/{company_id}/products"""
    print_test_header("Marketplace Company Products Test")
    
    try:
        headers = {"Authorization": f"Bearer {customer_token}"}
        response = requests.get(f"{BASE_URL}/customer/company/{company_id}/products", headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            company_info = data.get("company", {})
            products = data.get("products", [])
            route = data.get("route", {})
            next_delivery = data.get("next_delivery", {})
            
            success = len(products) > 0 and company_info and route
            print_result(success, f"Company products: {len(products)} products, route: {route.get('name', 'N/A')}")
            
            if next_delivery:
                print(f"Next delivery: {next_delivery.get('delivery_day', 'N/A')} - {next_delivery.get('delivery_date', 'N/A')}")
            
            return success, data
        else:
            print_result(False, f"Company products failed with status {response.status_code}: {response.text}")
            return False, None
    except Exception as e:
        print_result(False, f"Company products error: {str(e)}")
        return False, None

def test_marketplace_place_order(customer_token, company_id):
    """Test 7: Place Order - POST /api/orders"""
    print_test_header("Marketplace Place Order Test")
    
    try:
        headers = {"Authorization": f"Bearer {customer_token}"}
        order_data = {
            "company_id": company_id,
            "items": [
                {
                    "product_id": "test_product_1",
                    "product_name": "White Bread",
                    "quantity": 5,
                    "unit_price": 18.50
                }
            ],
            "notes": "Test order from marketplace"
        }
        
        response = requests.post(f"{BASE_URL}/orders", json=order_data, headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            order_number = data.get("order_number", "")
            company_name = data.get("company_name", "")
            route_id = data.get("route_id", "")
            total_amount = data.get("total_amount", 0)
            
            success = order_number and company_name and total_amount > 0
            print_result(success, f"Order placed: {order_number}, Company: {company_name}, Total: R{total_amount}")
            
            return success, data
        else:
            print_result(False, f"Place order failed with status {response.status_code}: {response.text}")
            return False, None
    except Exception as e:
        print_result(False, f"Place order error: {str(e)}")
        return False, None

def test_route_creation_with_location(admin_token):
    """Test 8: Route Creation with Location - POST /api/routes"""
    print_test_header("Route Creation with Location Test")
    
    try:
        headers = {"Authorization": f"Bearer {admin_token}"}
        route_data = {
            "name": "Test Route",
            "province": "Gauteng",
            "district": "City of Johannesburg", 
            "areas_covered": ["Soweto", "Orlando"],
            "delivery_schedule": {
                "delivery_days": ["Monday", "Friday"],
                "cut_off_time": "16:00",
                "cut_off_hours_before": 16
            },
            "description": "Test route for marketplace testing"
        }
        
        response = requests.post(f"{BASE_URL}/routes", json=route_data, headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code in [200, 201]:  # Accept both 200 and 201
            data = response.json()
            route_name = data.get("name", "")
            province = data.get("province", "")
            areas = data.get("areas_covered", [])
            schedule = data.get("delivery_schedule", {})
            
            success = route_name == "Test Route" and province == "Gauteng" and len(areas) == 2
            print_result(success, f"Route created: {route_name}, Province: {province}, Areas: {areas}")
            
            return success, data
        else:
            print_result(False, f"Route creation failed with status {response.status_code}: {response.text}")
            return False, None
    except Exception as e:
        print_result(False, f"Route creation error: {str(e)}")
        return False, None

def test_start_daily_route(admin_token):
    """Test 9: Start Daily Route - POST /api/daily-routes/start"""
    print_test_header("Start Daily Route Test")
    
    try:
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First, get available routes and vehicles
        routes_response = requests.get(f"{BASE_URL}/routes", headers=headers, timeout=10)
        vehicles_response = requests.get(f"{BASE_URL}/vehicles/available", headers=headers, timeout=10)
        
        if routes_response.status_code != 200 or vehicles_response.status_code != 200:
            print_result(False, "Failed to get routes or vehicles")
            return False, None
        
        routes = routes_response.json()
        vehicles = vehicles_response.json()
        
        if not routes or not vehicles:
            print_result(False, "No routes or vehicles available")
            return False, None
        
        route_id = routes[0]["id"]
        vehicle_id = vehicles[0]["id"]
        
        route_data = {
            "route_id": route_id,
            "vehicle_id": vehicle_id,
            "opening_km": 15000,  # Changed from opening_kilometres to opening_km
            "crates_out": 50
        }
        
        response = requests.post(f"{BASE_URL}/daily-routes/start", json=route_data, headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code in [200, 201]:  # Accept both 200 and 201
            data = response.json()
            vehicle_name = data.get("vehicle_name", "")
            route_name = data.get("route_name", "")
            
            success = vehicle_name and route_name
            print_result(success, f"Daily route started: Route {route_name}, Vehicle: {vehicle_name}")
            
            return success, data
        else:
            print_result(False, f"Start daily route failed with status {response.status_code}: {response.text}")
            return False, None
    except Exception as e:
        print_result(False, f"Start daily route error: {str(e)}")
        return False, None

def test_second_customer_login_and_availability():
    """Test 10: Second Customer Test - Nomsa in Umlazi KZN"""
    print_test_header("Second Customer Test (Nomsa's Tuck Shop - Umlazi KZN)")
    
    try:
        # Login as Nomsa
        login_data = {
            "phone": "0842002002", 
            "pin": "2222"
        }
        
        response = requests.post(f"{BASE_URL}/auth/login", json=login_data, timeout=10)
        print(f"Login Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print_result(False, f"Nomsa login failed: {response.text}")
            return False
        
        data = response.json()
        token = data.get("token")
        user = data.get("user", {})
        name = user.get("name")
        
        print_result(True, f"Nomsa login successful - Name: {name}")
        
        # Test available companies (should include Fresh Foods SA with Durban route)
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/customer/available-companies", headers=headers, timeout=10)
        
        if response.status_code == 200:
            companies = response.json()
            
            # Look for Fresh Foods SA
            fresh_foods = None
            for company in companies:
                if "Fresh Foods SA" in company.get("name", ""):
                    fresh_foods = company
                    break
            
            success = fresh_foods is not None
            if fresh_foods:
                print_result(success, f"Fresh Foods SA found for Umlazi customer: {fresh_foods.get('product_count', 0)} products")
            else:
                print_result(False, "Fresh Foods SA not found for Umlazi customer")
            
            return success
        else:
            print_result(False, f"Available companies failed for Nomsa: {response.text}")
            return False
            
    except Exception as e:
        print_result(False, f"Second customer test error: {str(e)}")
        return False

def main():
    """Main test runner"""
    print("="*80)
    print("MZANSI FMCG TRACKER - NEW MARKETPLACE MODEL ENDPOINTS TESTING")
    print("="*80)
    print(f"Backend URL: {BASE_URL}")
    print(f"Test Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    test_results = []
    
    # Test 1: Database Seed
    success, seed_data = test_database_seed()
    test_results.append(("Database Seed", success))
    
    if not success:
        print("\n❌ CRITICAL: Database seed failed. Cannot continue with other tests.")
        sys.exit(1)
    
    # Test 2: Admin Login
    success, admin_token = test_admin_login()
    test_results.append(("Admin Login", success))
    
    if not success:
        print("\n❌ CRITICAL: Admin login failed. Cannot continue with admin tests.")
        admin_token = None
    
    # Test 3: Location Endpoints
    success = test_location_endpoints()
    test_results.append(("Location Endpoints", success))
    
    # Test 4: Customer Login
    success, customer_token = test_customer_login()
    test_results.append(("Customer Login", success))
    
    if not success:
        print("\n❌ CRITICAL: Customer login failed. Cannot continue with customer tests.")
        customer_token = None
    
    # Test 5 & 6: Customer Marketplace Tests
    if customer_token:
        success, companies = test_marketplace_available_companies(customer_token)
        test_results.append(("Available Companies", success))
        
        if success and companies:
            # Use first company for products test
            company_id = companies[0]["id"]
            success, products_data = test_marketplace_company_products(customer_token, company_id)
            test_results.append(("Company Products", success))
            
            # Test 7: Place Order
            success, order_data = test_marketplace_place_order(customer_token, company_id)
            test_results.append(("Place Order", success))
        else:
            test_results.append(("Company Products", False))
            test_results.append(("Place Order", False))
    else:
        test_results.append(("Available Companies", False))
        test_results.append(("Company Products", False))
        test_results.append(("Place Order", False))
    
    # Test 8 & 9: Admin Tests (Route Creation and Daily Route Start)
    if admin_token:
        success, route_data = test_route_creation_with_location(admin_token)
        test_results.append(("Route Creation with Location", success))
        
        success, daily_route_data = test_start_daily_route(admin_token)
        test_results.append(("Start Daily Route", success))
    else:
        test_results.append(("Route Creation with Location", False))
        test_results.append(("Start Daily Route", False))
    
    # Test 10: Second Customer Test
    success = test_second_customer_login_and_availability()
    test_results.append(("Second Customer Test", success))
    
    # Final Results Summary
    print("\n" + "="*80)
    print("FINAL TEST RESULTS SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in test_results if result)
    total = len(test_results)
    
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nOVERALL RESULT: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL MARKETPLACE MODEL ENDPOINTS WORKING PERFECTLY!")
    else:
        print(f"⚠️  {total - passed} tests failed - see details above")
    
    print(f"Test Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)