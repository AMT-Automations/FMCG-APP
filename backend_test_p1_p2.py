#!/usr/bin/env python3
"""
Backend Test for Mzansi FMCG Tracker - P1 Order Cut-Off System & P2 Delivery Tracking
Tests the specific P1 and P2 endpoints as mentioned in the review request
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from review request
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

def test_seed_database():
    """Test 1: Seed Database - POST /api/admin/reset-and-seed"""
    print_test_header("Seed Database")
    
    try:
        headers = {"Content-Type": "application/json"}
        response = requests.post(f"{BASE_URL}/admin/reset-and-seed", headers=headers, timeout=30)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print_result(True, "Database seeded successfully", data)
            return True, data
        else:
            print_result(False, f"Database seed failed with status {response.status_code}: {response.text}")
            return False, None
    except Exception as e:
        print_result(False, f"Database seed error: {str(e)}")
        return False, None

def test_admin_login():
    """Test 2: Admin Login - POST /api/auth/login with phone=0767862760, pin=1984"""
    print_test_header("Admin Login")
    
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

def test_customer_login():
    """Test 3: Customer Login - POST /api/auth/login with phone=0831001001, pin=1111"""
    print_test_header("Customer Login")
    
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

def test_p1_enhanced_cutoff_info(customer_token):
    """Test 4: P1 Enhanced Cut-Off Info - GET /api/customer/available-companies"""
    print_test_header("P1: Enhanced Cut-Off Info")
    
    try:
        headers = {"Authorization": f"Bearer {customer_token}"}
        response = requests.get(f"{BASE_URL}/customer/available-companies", headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            companies = response.json()
            
            # Check if response includes enhanced delivery info
            success = len(companies) > 0
            found_enhanced_info = False
            for company in companies:
                # Check for P1 enhanced fields
                has_cutoff_message = "cutoff_message" in company
                has_minutes_until_cutoff = "minutes_until_cutoff" in company
                has_cut_off_display = "cut_off_display" in company
                
                if has_cutoff_message or has_minutes_until_cutoff or has_cut_off_display:
                    found_enhanced_info = True
                    print_result(True, f"P1 Enhanced cut-off info found in company: {company.get('name', 'Unknown')}")
                    print(f"  - cutoff_message: {company.get('cutoff_message', 'N/A')}")
                    print(f"  - minutes_until_cutoff: {company.get('minutes_until_cutoff', 'N/A')}")
                    print(f"  - cut_off_display: {company.get('cut_off_display', 'N/A')}")
                    break
            
            if not found_enhanced_info:
                print_result(False, "No enhanced cut-off info found in available companies")
                success = False
            
            return success, companies
        else:
            print_result(False, f"Available companies failed with status {response.status_code}: {response.text}")
            return False, None
    except Exception as e:
        print_result(False, f"Available companies error: {str(e)}")
        return False, None

def test_p1_company_products_cutoff(customer_token, company_id):
    """Test 5: P1 Company Products with Cut-Off - GET /api/customer/company/{company_id}/products"""
    print_test_header("P1: Company Products with Cut-Off")
    
    try:
        headers = {"Authorization": f"Bearer {customer_token}"}
        response = requests.get(f"{BASE_URL}/customer/company/{company_id}/products", headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            next_delivery = data.get("next_delivery", {})
            
            # Check for P1 enhanced fields in next_delivery
            has_cutoff_message = "cutoff_message" in next_delivery
            has_minutes_until_cutoff = "minutes_until_cutoff" in next_delivery
            has_cut_off_display = "cut_off_display" in next_delivery
            
            success = has_cutoff_message or has_minutes_until_cutoff or has_cut_off_display
            
            if success:
                print_result(True, "P1 Enhanced cut-off info found in next_delivery")
                print(f"  - cutoff_message: {next_delivery.get('cutoff_message', 'N/A')}")
                print(f"  - minutes_until_cutoff: {next_delivery.get('minutes_until_cutoff', 'N/A')}")
                print(f"  - cut_off_display: {next_delivery.get('cut_off_display', 'N/A')}")
            else:
                print_result(False, "No enhanced cut-off info found in next_delivery")
            
            return success, data
        else:
            print_result(False, f"Company products failed with status {response.status_code}: {response.text}")
            return False, None
    except Exception as e:
        print_result(False, f"Company products error: {str(e)}")
        return False, None

def test_start_daily_route(admin_token):
    """Test 6: Start a Daily Route - POST /api/daily-routes/start"""
    print_test_header("Start Daily Route")
    
    try:
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First, get available routes and vehicles
        routes_response = requests.get(f"{BASE_URL}/routes", headers=headers, timeout=10)
        vehicles_response = requests.get(f"{BASE_URL}/vehicles", headers=headers, timeout=10)
        
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
            "opening_km": 15000,
            "crates_out": 50
        }
        
        response = requests.post(f"{BASE_URL}/daily-routes/start", json=route_data, headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code in [200, 201]:
            data = response.json()
            route_name = data.get("route_name", "")
            vehicle_name = data.get("vehicle_name", "")
            daily_route_id = data.get("id", "")
            
            success = route_name and vehicle_name and daily_route_id
            print_result(success, f"Daily route started: Route {route_name}, Vehicle: {vehicle_name}, ID: {daily_route_id}")
            
            return success, data
        else:
            print_result(False, f"Start daily route failed with status {response.status_code}: {response.text}")
            return False, None
    except Exception as e:
        print_result(False, f"Start daily route error: {str(e)}")
        return False, None

def test_place_order(customer_token):
    """Test 7: Place an Order - POST /api/orders"""
    print_test_header("Place Order")
    
    try:
        headers = {"Authorization": f"Bearer {customer_token}"}
        
        # Get available companies first to get a valid company_id
        companies_response = requests.get(f"{BASE_URL}/customer/available-companies", headers=headers, timeout=10)
        if companies_response.status_code != 200:
            print_result(False, "Failed to get available companies for order")
            return False, None
        
        companies = companies_response.json()
        if not companies:
            print_result(False, "No companies available for order")
            return False, None
        
        company_id = companies[0]["id"]
        
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
            "notes": "Test order for P1/P2 testing"
        }
        
        response = requests.post(f"{BASE_URL}/orders", json=order_data, headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code in [200, 201]:
            data = response.json()
            order_id = data.get("id", "")
            order_number = data.get("order_number", "")
            total_amount = data.get("total_amount", 0)
            
            success = order_id and order_number and total_amount > 0
            print_result(success, f"Order placed: {order_number}, ID: {order_id}, Total: R{total_amount}")
            
            return success, data
        else:
            print_result(False, f"Place order failed with status {response.status_code}: {response.text}")
            return False, None
    except Exception as e:
        print_result(False, f"Place order error: {str(e)}")
        return False, None

def test_p2_order_tracking(customer_token, order_id):
    """Test 8: P2 Order Tracking - GET /api/orders/{order_id}/tracking"""
    print_test_header("P2: Order Tracking")
    
    try:
        headers = {"Authorization": f"Bearer {customer_token}"}
        response = requests.get(f"{BASE_URL}/orders/{order_id}/tracking", headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Check for P2 tracking fields
            has_status = "status" in data
            has_status_history = "status_history" in data
            has_delivery_day = "delivery_day" in data
            has_items = "items" in data
            has_total_amount = "total_amount" in data
            has_driver_info = "driver_info" in data
            has_delivery_progress = "delivery_progress" in data
            
            success = has_status and has_status_history and has_delivery_day and has_items and has_total_amount
            
            print_result(success, f"P2 Order tracking response includes required fields")
            print(f"  - status: {data.get('status', 'N/A')}")
            print(f"  - delivery_day: {data.get('delivery_day', 'N/A')}")
            print(f"  - total_amount: {data.get('total_amount', 'N/A')}")
            print(f"  - driver_info present: {has_driver_info}")
            print(f"  - delivery_progress present: {has_delivery_progress}")
            
            return success, data
        else:
            print_result(False, f"Order tracking failed with status {response.status_code}: {response.text}")
            return False, None
    except Exception as e:
        print_result(False, f"Order tracking error: {str(e)}")
        return False, None

def test_p2_driver_gps_location_update(admin_token, route_id):
    """Test 9: P2 Driver GPS Location Update - POST /api/daily-routes/{route_id}/location"""
    print_test_header("P2: Driver GPS Location Update")
    
    try:
        headers = {"Authorization": f"Bearer {admin_token}"}
        location_data = {
            "latitude": -26.2041,
            "longitude": 28.0473,
            "accuracy": 10.5,
            "speed": 30.2,
            "heading": 180
        }
        
        response = requests.post(f"{BASE_URL}/daily-routes/{route_id}/location", json=location_data, headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Check if location data is returned
            has_latitude = "latitude" in data or "current_location" in data
            success = True  # If we get 200, the update was successful
            
            print_result(success, f"GPS location updated successfully")
            print(f"  - Response data: {data}")
            if "current_location" in data:
                location = data["current_location"]
                print(f"  - Location: {location.get('latitude', 'N/A')}, {location.get('longitude', 'N/A')}")
            
            return success, data
        else:
            print_result(False, f"GPS location update failed with status {response.status_code}: {response.text}")
            return False, None
    except Exception as e:
        print_result(False, f"GPS location update error: {str(e)}")
        return False, None

def test_p2_get_driver_location(customer_token, route_id):
    """Test 10: P2 Get Driver Location - GET /api/daily-routes/{route_id}/location"""
    print_test_header("P2: Get Driver Location")
    
    try:
        headers = {"Authorization": f"Bearer {customer_token}"}
        response = requests.get(f"{BASE_URL}/daily-routes/{route_id}/location", headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Check for P2 location fields
            has_current_location = "current_location" in data
            has_driver_name = "driver_name" in data
            has_vehicle_info = "vehicle_name" in data or "vehicle_registration" in data
            
            success = has_current_location
            
            print_result(success, f"Driver location retrieved successfully")
            if has_current_location:
                location = data["current_location"]
                print(f"  - Location: {location.get('latitude', 'N/A')}, {location.get('longitude', 'N/A')}")
            print(f"  - Driver: {data.get('driver_name', 'N/A')}")
            print(f"  - Vehicle: {data.get('vehicle_name', 'N/A')}")
            
            return success, data
        else:
            print_result(False, f"Get driver location failed with status {response.status_code}: {response.text}")
            return False, None
    except Exception as e:
        print_result(False, f"Get driver location error: {str(e)}")
        return False, None

def test_p2_route_deliveries(admin_token, route_id):
    """Test 11: P2 Route Deliveries - GET /api/daily-routes/{route_id}/deliveries"""
    print_test_header("P2: Route Deliveries")
    
    try:
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/daily-routes/{route_id}/deliveries", headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Check for delivery management fields
            has_orders = "orders" in data or isinstance(data, list)
            has_summary = "summary" in data
            
            success = has_orders
            
            if isinstance(data, list):
                print_result(success, f"Route deliveries retrieved: {len(data)} orders")
            elif "orders" in data:
                orders = data["orders"]
                summary = data.get("summary", {})
                print_result(success, f"Route deliveries retrieved: {len(orders)} orders")
                print(f"  - Summary: {summary}")
            else:
                print_result(False, "Unexpected response format for route deliveries")
                success = False
            
            return success, data
        else:
            print_result(False, f"Route deliveries failed with status {response.status_code}: {response.text}")
            return False, None
    except Exception as e:
        print_result(False, f"Route deliveries error: {str(e)}")
        return False, None

def test_p2_batch_status_update(admin_token, order_id):
    """Test 12: P2 Batch Status Update - PUT /api/orders/batch-status"""
    print_test_header("P2: Batch Status Update (Out for Delivery)")
    
    try:
        headers = {"Authorization": f"Bearer {admin_token}"}
        batch_data = {
            "order_ids": [order_id],
            "status": "out_for_delivery"
        }
        
        response = requests.put(f"{BASE_URL}/orders/batch-status", json=batch_data, headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Check for batch update response
            has_updated_count = "updated_count" in data
            success = has_updated_count and data.get("updated_count", 0) > 0
            
            print_result(success, f"Batch status update successful: {data.get('updated_count', 0)} orders updated")
            
            return success, data
        else:
            print_result(False, f"Batch status update failed with status {response.status_code}: {response.text}")
            return False, None
    except Exception as e:
        print_result(False, f"Batch status update error: {str(e)}")
        return False, None

def test_p2_order_tracking_after_status_change(customer_token, order_id):
    """Test 13: P2 Order Tracking After Status Change - GET /api/orders/{order_id}/tracking"""
    print_test_header("P2: Order Tracking After Status Change")
    
    try:
        headers = {"Authorization": f"Bearer {customer_token}"}
        response = requests.get(f"{BASE_URL}/orders/{order_id}/tracking", headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Check if status changed to out_for_delivery and driver_info is populated
            status = data.get("status", "")
            driver_info = data.get("driver_info", {})
            
            success = status == "out_for_delivery" and bool(driver_info)
            
            print_result(success, f"Order status updated to: {status}")
            print(f"  - Driver info populated: {bool(driver_info)}")
            if driver_info:
                print(f"  - Driver: {driver_info.get('name', 'N/A')}")
            
            return success, data
        else:
            print_result(False, f"Order tracking after status change failed with status {response.status_code}: {response.text}")
            return False, None
    except Exception as e:
        print_result(False, f"Order tracking after status change error: {str(e)}")
        return False, None

def test_p2_mark_delivered(admin_token, order_id):
    """Test 14: P2 Mark Delivered - PUT /api/orders/batch-status"""
    print_test_header("P2: Mark Delivered")
    
    try:
        headers = {"Authorization": f"Bearer {admin_token}"}
        batch_data = {
            "order_ids": [order_id],
            "status": "delivered"
        }
        
        response = requests.put(f"{BASE_URL}/orders/batch-status", json=batch_data, headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Check for batch update response
            has_updated_count = "updated_count" in data
            success = has_updated_count and data.get("updated_count", 0) > 0
            
            print_result(success, f"Mark delivered successful: {data.get('updated_count', 0)} orders marked as delivered")
            
            return success, data
        else:
            print_result(False, f"Mark delivered failed with status {response.status_code}: {response.text}")
            return False, None
    except Exception as e:
        print_result(False, f"Mark delivered error: {str(e)}")
        return False, None

def test_p2_final_tracking_check(customer_token, order_id):
    """Test 15: P2 Final Tracking Check - GET /api/orders/{order_id}/tracking"""
    print_test_header("P2: Final Tracking Check")
    
    try:
        headers = {"Authorization": f"Bearer {customer_token}"}
        response = requests.get(f"{BASE_URL}/orders/{order_id}/tracking", headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Check if status is delivered and status_history has full timeline
            status = data.get("status", "")
            status_history = data.get("status_history", [])
            
            success = status == "delivered" and len(status_history) > 0
            
            print_result(success, f"Final order status: {status}")
            print(f"  - Status history entries: {len(status_history)}")
            
            # Print status timeline
            for i, history_entry in enumerate(status_history):
                print(f"  - Step {i+1}: {history_entry.get('status', 'N/A')} at {history_entry.get('timestamp', 'N/A')}")
            
            return success, data
        else:
            print_result(False, f"Final tracking check failed with status {response.status_code}: {response.text}")
            return False, None
    except Exception as e:
        print_result(False, f"Final tracking check error: {str(e)}")
        return False, None

def main():
    """Main test runner for P1 Order Cut-Off System & P2 Delivery Tracking"""
    print("="*80)
    print("MZANSI FMCG TRACKER - P1 ORDER CUT-OFF SYSTEM & P2 DELIVERY TRACKING TESTING")
    print("="*80)
    print(f"Backend URL: {BASE_URL}")
    print(f"Test Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    test_results = []
    
    # Test 1: Seed Database
    success, seed_data = test_seed_database()
    test_results.append(("Seed Database", success))
    
    if not success:
        print("\n❌ CRITICAL: Database seed failed. Cannot continue with other tests.")
        sys.exit(1)
    
    # Test 2: Admin Login
    success, admin_token = test_admin_login()
    test_results.append(("Admin Login", success))
    
    if not success:
        print("\n❌ CRITICAL: Admin login failed. Cannot continue with admin tests.")
        admin_token = None
    
    # Test 3: Customer Login
    success, customer_token = test_customer_login()
    test_results.append(("Customer Login", success))
    
    if not success:
        print("\n❌ CRITICAL: Customer login failed. Cannot continue with customer tests.")
        customer_token = None
    
    # Test 4: P1 Enhanced Cut-Off Info
    if customer_token:
        success, companies = test_p1_enhanced_cutoff_info(customer_token)
        test_results.append(("P1: Enhanced Cut-Off Info", success))
        
        # Test 5: P1 Company Products with Cut-Off
        if success and companies:
            company_id = companies[0]["id"]
            success, products_data = test_p1_company_products_cutoff(customer_token, company_id)
            test_results.append(("P1: Company Products with Cut-Off", success))
        else:
            test_results.append(("P1: Company Products with Cut-Off", False))
    else:
        test_results.append(("P1: Enhanced Cut-Off Info", False))
        test_results.append(("P1: Company Products with Cut-Off", False))
    
    # Test 6: Start Daily Route
    daily_route_data = None
    if admin_token:
        success, daily_route_data = test_start_daily_route(admin_token)
        test_results.append(("Start Daily Route", success))
    else:
        test_results.append(("Start Daily Route", False))
    
    # Test 7: Place Order
    order_data = None
    if customer_token:
        success, order_data = test_place_order(customer_token)
        test_results.append(("Place Order", success))
    else:
        test_results.append(("Place Order", False))
    
    # Test 8: P2 Order Tracking
    if customer_token and order_data:
        order_id = order_data.get("id", "")
        if order_id:
            success, tracking_data = test_p2_order_tracking(customer_token, order_id)
            test_results.append(("P2: Order Tracking", success))
        else:
            test_results.append(("P2: Order Tracking", False))
    else:
        test_results.append(("P2: Order Tracking", False))
    
    # Test 9: P2 Driver GPS Location Update
    if admin_token and daily_route_data:
        route_id = daily_route_data.get("id", "")
        if route_id:
            success, location_data = test_p2_driver_gps_location_update(admin_token, route_id)
            test_results.append(("P2: Driver GPS Location Update", success))
            
            # Test 10: P2 Get Driver Location
            if customer_token:
                success, driver_location = test_p2_get_driver_location(customer_token, route_id)
                test_results.append(("P2: Get Driver Location", success))
            else:
                test_results.append(("P2: Get Driver Location", False))
            
            # Test 11: P2 Route Deliveries
            success, deliveries_data = test_p2_route_deliveries(admin_token, route_id)
            test_results.append(("P2: Route Deliveries", success))
        else:
            test_results.append(("P2: Driver GPS Location Update", False))
            test_results.append(("P2: Get Driver Location", False))
            test_results.append(("P2: Route Deliveries", False))
    else:
        test_results.append(("P2: Driver GPS Location Update", False))
        test_results.append(("P2: Get Driver Location", False))
        test_results.append(("P2: Route Deliveries", False))
    
    # Test 12-15: Batch Status Updates and Final Tracking
    if admin_token and customer_token and order_data:
        order_id = order_data.get("id", "")
        if order_id:
            # Test 12: Batch Status Update (Out for Delivery)
            success, batch_data = test_p2_batch_status_update(admin_token, order_id)
            test_results.append(("P2: Batch Status Update", success))
            
            # Test 13: Order Tracking After Status Change
            success, tracking_after = test_p2_order_tracking_after_status_change(customer_token, order_id)
            test_results.append(("P2: Order Tracking After Status Change", success))
            
            # Test 14: Mark Delivered
            success, delivered_data = test_p2_mark_delivered(admin_token, order_id)
            test_results.append(("P2: Mark Delivered", success))
            
            # Test 15: Final Tracking Check
            success, final_tracking = test_p2_final_tracking_check(customer_token, order_id)
            test_results.append(("P2: Final Tracking Check", success))
        else:
            test_results.append(("P2: Batch Status Update", False))
            test_results.append(("P2: Order Tracking After Status Change", False))
            test_results.append(("P2: Mark Delivered", False))
            test_results.append(("P2: Final Tracking Check", False))
    else:
        test_results.append(("P2: Batch Status Update", False))
        test_results.append(("P2: Order Tracking After Status Change", False))
        test_results.append(("P2: Mark Delivered", False))
        test_results.append(("P2: Final Tracking Check", False))
    
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
        print("🎉 ALL P1 ORDER CUT-OFF SYSTEM & P2 DELIVERY TRACKING FEATURES WORKING PERFECTLY!")
    else:
        print(f"⚠️  {total - passed} tests failed - see details above")
    
    print(f"Test Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)