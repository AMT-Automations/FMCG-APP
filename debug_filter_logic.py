#!/usr/bin/env python3
"""
Debug Company Filter Logic
"""

import requests
import json

BASE_URL = "https://fmcg-delivery-app-2.preview.emergentagent.com/api"

def debug_filter_logic():
    print("=== DEBUGGING FILTER LOGIC ===")
    
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
        
        print(f"User company_id: {user.get('company_id')}")
        print(f"Company ID: {company.get('id')}")
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # 3. Try to login as other company admin to verify isolation
        print("\n3. Logging in as Fresh Foods SA admin...")
        login_data2 = {"phone": "0711002001", "pin": "2222"}
        response2 = requests.post(f"{BASE_URL}/auth/login", json=login_data2)
        
        if response2.status_code == 200:
            data2 = response2.json()
            token2 = data2.get("token")
            user2 = data2.get("user", {})
            company2 = data2.get("company", {})
            
            print(f"Fresh Foods admin company_id: {user2.get('company_id')}")
            print(f"Fresh Foods company ID: {company2.get('id')}")
            
            headers2 = {"Authorization": f"Bearer {token2}"}
            
            # Check what each admin sees
            print("\n4. Mzansi admin routes:")
            response = requests.get(f"{BASE_URL}/routes", headers=headers)
            if response.status_code == 200:
                routes = response.json()
                print(f"  Mzansi admin sees {len(routes)} routes")
                for route in routes:
                    print(f"    - {route.get('name')}")
            
            print("\n5. Fresh Foods admin routes:")
            response = requests.get(f"{BASE_URL}/routes", headers=headers2)
            if response.status_code == 200:
                routes = response.json()
                print(f"  Fresh Foods admin sees {len(routes)} routes")
                for route in routes:
                    print(f"    - {route.get('name')}")
            
            print("\n6. Mzansi admin products:")
            response = requests.get(f"{BASE_URL}/products", headers=headers)
            if response.status_code == 200:
                products = response.json()
                print(f"  Mzansi admin sees {len(products)} products")
                for product in products[:3]:  # Show first 3
                    print(f"    - {product.get('name')}")
            
            print("\n7. Fresh Foods admin products:")
            response = requests.get(f"{BASE_URL}/products", headers=headers2)
            if response.status_code == 200:
                products = response.json()
                print(f"  Fresh Foods admin sees {len(products)} products")
                for product in products[:3]:  # Show first 3
                    print(f"    - {product.get('name')}")
        
    else:
        print(f"Login failed: {response.status_code} - {response.text}")

if __name__ == "__main__":
    debug_filter_logic()