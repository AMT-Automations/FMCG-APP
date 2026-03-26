#!/usr/bin/env python3
"""
Debug Company Isolation Issues
"""

import requests
import json

BASE_URL = "https://fmcg-delivery-app-2.preview.emergentagent.com/api"

def debug_company_isolation():
    print("=== DEBUGGING COMPANY ISOLATION ===")
    
    # 1. Reset and seed
    print("\n1. Resetting and seeding database...")
    response = requests.post(f"{BASE_URL}/admin/reset-and-seed")
    print(f"Reset status: {response.status_code}")
    
    # 2. Login as admin
    print("\n2. Logging in as admin...")
    login_data = {"phone": "0767862760", "pin": "1984"}
    response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
    
    if response.status_code == 200:
        data = response.json()
        token = data.get("token")
        user = data.get("user", {})
        company = data.get("company", {})
        
        print(f"Login successful!")
        print(f"User ID: {user.get('id')}")
        print(f"User company_id: {user.get('company_id')}")
        print(f"Company ID: {company.get('id')}")
        print(f"Company name: {company.get('name')}")
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # 3. Check routes
        print("\n3. Checking routes...")
        response = requests.get(f"{BASE_URL}/routes", headers=headers)
        if response.status_code == 200:
            routes = response.json()
            print(f"Found {len(routes)} routes:")
            for route in routes:
                print(f"  - {route.get('name')} (company_id: {route.get('company_id')})")
        
        # 4. Check vehicles
        print("\n4. Checking vehicles...")
        response = requests.get(f"{BASE_URL}/vehicles", headers=headers)
        if response.status_code == 200:
            vehicles = response.json()
            print(f"Found {len(vehicles)} vehicles:")
            for vehicle in vehicles:
                print(f"  - {vehicle.get('name')} (company_id: {vehicle.get('company_id')})")
        
        # 5. Check products
        print("\n5. Checking products...")
        response = requests.get(f"{BASE_URL}/products", headers=headers)
        if response.status_code == 200:
            products = response.json()
            print(f"Found {len(products)} products:")
            for product in products:
                print(f"  - {product.get('name')} (company_id: {product.get('company_id')})")
        
        # 6. Check companies list
        print("\n6. Checking companies list...")
        response = requests.get(f"{BASE_URL}/companies/list")
        if response.status_code == 200:
            companies = response.json()
            print(f"Found {len(companies)} companies:")
            for company in companies:
                print(f"  - {company.get('name')} (id: {company.get('id')})")
        
        print("\n=== ANALYSIS ===")
        print(f"Admin user company_id: {user.get('company_id')}")
        print(f"Company object ID: {company.get('id')}")
        print(f"Match: {user.get('company_id') == company.get('id')}")
        
    else:
        print(f"Login failed: {response.status_code} - {response.text}")

if __name__ == "__main__":
    debug_company_isolation()