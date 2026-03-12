#!/usr/bin/env python3
"""
Debug the sales creation issue specifically
"""

import requests
import json

# Backend URL from environment
BASE_URL = "https://route-sales-ops.preview.emergentagent.com/api"

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

def debug_sales_creation():
    """Debug the sales creation process in detail"""
    print("=== DEBUGGING SALES CREATION ===")
    
    # Login as admin first
    admin_token = login_user(ADMIN_CREDS)
    if not admin_token:
        print("❌ Could not login as admin")
        return
    
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Seed data
    response = requests.post(f"{BASE_URL}/seed-all", headers=admin_headers, timeout=30)
    print(f"Seed data response: {response.status_code}")
    
    # Login as driver
    driver_token = login_user(DRIVER_CREDS)
    if not driver_token:
        print("❌ Could not login as driver")
        return
    
    headers = {"Authorization": f"Bearer {driver_token}"}
    
    # Get route and vehicle data
    response = requests.get(f"{BASE_URL}/routes", headers=admin_headers, timeout=30)
    routes = response.json() if response.status_code == 200 else []
    print(f"Available routes: {len(routes)}")
    
    response = requests.get(f"{BASE_URL}/vehicles/available", headers=admin_headers, timeout=30)
    vehicles = response.json() if response.status_code == 200 else []
    print(f"Available vehicles: {len(vehicles)}")
    
    if not routes or not vehicles:
        print("❌ Missing routes or vehicles")
        return
    
    route_id = routes[0]['id']
    vehicle_id = vehicles[0]['id']
    
    # Start route
    route_start_data = {
        "route_id": route_id,
        "vehicle_id": vehicle_id,
        "opening_km": 1000,
        "crates_out": 50
    }
    
    response = requests.post(f"{BASE_URL}/daily-routes/start", json=route_start_data, headers=headers, timeout=30)
    print(f"Route start response: {response.status_code}")
    if response.status_code != 200:
        print(f"Route start error: {response.text}")
        return
    
    # Get customers and products
    response = requests.get(f"{BASE_URL}/customers", headers=admin_headers, timeout=30)
    customers = response.json() if response.status_code == 200 else []
    print(f"Available customers: {len(customers)}")
    if customers:
        print(f"First customer: {customers[0]}")
    
    response = requests.get(f"{BASE_URL}/products", headers=admin_headers, timeout=30)
    products = response.json() if response.status_code == 200 else []
    print(f"Available products: {len(products)}")
    if products:
        print(f"First product: {products[0]}")
    
    if not customers or not products:
        print("❌ Missing customers or products")
        return
    
    customer_id = customers[0]['id']
    product_id = products[0]['id']
    
    # Create sale with detailed logging
    sale_data = {
        "customer_id": customer_id,
        "items": [
            {
                "product_id": product_id,
                "quantity_delivered": 10,
                "quantity_returned": 0,
                "unit_price": 15.0
            }
        ],
        "total_amount": 150.0,
        "cash_collected": 120.0,
        "payment_type": "cash"
    }
    
    print(f"Attempting to create sale with data: {json.dumps(sale_data, indent=2)}")
    response = requests.post(f"{BASE_URL}/sales", json=sale_data, headers=headers, timeout=30)
    print(f"Sales creation response: {response.status_code}")
    print(f"Sales creation response body: {response.text}")

def debug_send_report_no_recipients():
    """Debug send report with no recipients"""
    print("\n=== DEBUGGING SEND REPORT NO RECIPIENTS ===")
    
    admin_token = login_user(ADMIN_CREDS)
    if not admin_token:
        print("❌ Could not login as admin")
        return
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Get all recipients
    response = requests.get(f"{BASE_URL}/admin/email-recipients", headers=headers, timeout=30)
    print(f"Get recipients response: {response.status_code}")
    if response.status_code == 200:
        recipients = response.json()
        print(f"Total recipients: {len(recipients)}")
        
        # Toggle all to inactive
        for recipient in recipients:
            if recipient.get('is_active', True):
                r_id = recipient['id']
                toggle_response = requests.post(f"{BASE_URL}/admin/email-recipients/{r_id}/toggle", headers=headers, timeout=30)
                print(f"Toggle recipient {r_id} response: {toggle_response.status_code}")
        
        # Check recipients again
        response = requests.get(f"{BASE_URL}/admin/email-recipients", headers=headers, timeout=30)
        updated_recipients = response.json() if response.status_code == 200 else []
        active_count = sum(1 for r in updated_recipients if r.get('is_active', True))
        print(f"Active recipients after toggle: {active_count}")
        
        # Try to send report
        response = requests.post(f"{BASE_URL}/admin/send-report?report_type=sales", headers=headers, timeout=30)
        print(f"Send report response: {response.status_code}")
        print(f"Send report body: {response.text}")

if __name__ == "__main__":
    debug_sales_creation()
    debug_send_report_no_recipients()