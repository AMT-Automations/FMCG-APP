#!/usr/bin/env python3
"""
Debug the failed tests to get specific error details
"""

import requests
import json

# Backend URL from environment
BASE_URL = "https://distributor-connect-4.preview.emergentagent.com/api"

# Test credentials
ADMIN_CREDS = {"phone": "0800000001", "pin": "0000"}
DRIVER_CREDS = {"phone": "0812345678", "pin": "1234"}

def login_user(credentials):
    """Login user and get auth token"""
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json=credentials, timeout=30)
        if response.status_code == 200:
            return response.json().get('token')
    except Exception as e:
        print(f"Login failed: {e}")
    return None

def debug_send_report_no_recipients():
    """Debug the send report with no recipients test"""
    print("=== DEBUGGING SEND REPORT NO RECIPIENTS ===")
    
    admin_token = login_user(ADMIN_CREDS)
    if not admin_token:
        print("❌ Could not login as admin")
        return
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Check current recipients
    response = requests.get(f"{BASE_URL}/admin/email-recipients", headers=headers, timeout=30)
    print(f"Current recipients status: {response.status_code}")
    if response.status_code == 200:
        recipients = response.json()
        print(f"Current recipients count: {len(recipients)}")
        for r in recipients:
            print(f"  - {r.get('email')} (active: {r.get('is_active', True)})")
    
    # Try to send report
    response = requests.post(f"{BASE_URL}/admin/send-report?report_type=sales", headers=headers, timeout=30)
    print(f"Send report response: {response.status_code}")
    print(f"Response body: {response.text}")

def debug_stock_receive():
    """Debug the stock receive operation"""
    print("\n=== DEBUGGING STOCK RECEIVE ===")
    
    admin_token = login_user(ADMIN_CREDS)
    if not admin_token:
        print("❌ Could not login as admin")
        return
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Get current stock levels to find a valid product_id
    response = requests.get(f"{BASE_URL}/stock/levels", headers=headers, timeout=30)
    print(f"Stock levels status: {response.status_code}")
    if response.status_code == 200:
        stock_items = response.json()
        print(f"Stock items count: {len(stock_items)}")
        if stock_items:
            first_item = stock_items[0]
            product_id = first_item.get('product_id')
            print(f"Using product_id: {product_id} ({first_item.get('product_name')})")
            
            # Try stock receive with correct product_id
            receive_data = {
                "product_id": product_id,
                "quantity": 50,
                "supplier": "Test Supplier",
                "batch_reference": "TEST001"
            }
            
            response = requests.post(f"{BASE_URL}/stock/receive", json=receive_data, headers=headers, timeout=30)
            print(f"Stock receive response: {response.status_code}")
            print(f"Response body: {response.text}")
    else:
        print(f"Could not get stock levels: {response.text}")

def debug_route_start():
    """Debug the route start operation"""
    print("\n=== DEBUGGING ROUTE START ===")
    
    driver_token = login_user(DRIVER_CREDS)
    if not driver_token:
        print("❌ Could not login as driver")
        return
    
    headers = {"Authorization": f"Bearer {driver_token}"}
    
    # Get available routes
    admin_token = login_user(ADMIN_CREDS)
    if admin_token:
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/routes", headers=admin_headers, timeout=30)
        print(f"Routes status: {response.status_code}")
        if response.status_code == 200:
            routes = response.json()
            print(f"Available routes: {len(routes)}")
            if routes:
                route_id = routes[0].get('id')
                print(f"Using route_id: {route_id}")
            else:
                print("No routes available")
                return
        
        # Get available vehicles
        response = requests.get(f"{BASE_URL}/vehicles/available", headers=admin_headers, timeout=30)
        print(f"Vehicles status: {response.status_code}")
        if response.status_code == 200:
            vehicles = response.json()
            print(f"Available vehicles: {len(vehicles)}")
            if vehicles:
                vehicle_id = vehicles[0].get('id')
                print(f"Using vehicle_id: {vehicle_id}")
            else:
                print("No vehicles available")
                return
    
    # Try to start route
    route_start_data = {
        "route_id": route_id,
        "vehicle_id": vehicle_id,
        "opening_km": 1000,
        "crates_out": 50
    }
    
    response = requests.post(f"{BASE_URL}/daily-routes/start", json=route_start_data, headers=headers, timeout=30)
    print(f"Route start response: {response.status_code}")
    print(f"Response body: {response.text}")

if __name__ == "__main__":
    debug_send_report_no_recipients()
    debug_stock_receive()
    debug_route_start()