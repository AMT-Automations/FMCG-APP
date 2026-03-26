#!/usr/bin/env python3
"""
Debug script to check data isolation issue
"""

import requests
import json
import time

# Configuration
BASE_URL = "https://fmcg-delivery-app-2.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

def check_user_profile(token, description):
    """Check user profile and company_id"""
    url = f"{BASE_URL}/auth/me"
    headers = HEADERS.copy()
    headers["Authorization"] = f"Bearer {token}"
    
    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            user_data = response.json()
            print(f"\n{description}:")
            print(f"  User ID: {user_data.get('id')}")
            print(f"  Role: {user_data.get('role')}")
            print(f"  Company ID: {user_data.get('company_id', 'MISSING!')}")
            print(f"  Phone: {user_data.get('phone')}")
            return user_data
        else:
            print(f"Failed to get user profile: {response.status_code}")
            return None
    except Exception as e:
        print(f"Error checking user profile: {e}")
        return None

def test_data_access(token, description):
    """Test what data this token can access"""
    print(f"\n{description} - Data Access Test:")
    headers = HEADERS.copy()
    headers["Authorization"] = f"Bearer {token}"
    
    # Test orders
    try:
        response = requests.get(f"{BASE_URL}/orders", headers=headers)
        orders_count = len(response.json()) if response.status_code == 200 else "ERROR"
        print(f"  Orders visible: {orders_count}")
    except Exception as e:
        print(f"  Orders error: {e}")
    
    # Test products
    try:
        response = requests.get(f"{BASE_URL}/products", headers=headers)
        products_count = len(response.json()) if response.status_code == 200 else "ERROR"
        print(f"  Products visible: {products_count}")
    except Exception as e:
        print(f"  Products error: {e}")

def main():
    """Main debug function"""
    print("=" * 80)
    print("DATA ISOLATION DEBUG TEST")
    print("=" * 80)
    
    # Generate unique suffix
    unique_suffix = str(int(time.time()))[-4:]
    
    # Setup Company A
    admin_phone_a = f"076111{unique_suffix}"
    company_data_a = {
        "company": {
            "name": "Company Alpha",
            "contact_person": "Alpha Manager",
            "phone": "0123456789",
            "email": "alpha@alpha.com",
            "address": "123 Alpha Street"
        },
        "admin_name": "Alpha Admin",
        "admin_phone": admin_phone_a,
        "admin_pin": "1111"
    }
    
    print(f"\n1. Creating Company A with admin phone: {admin_phone_a}")
    response = requests.post(f"{BASE_URL}/companies/setup", json=company_data_a, headers=HEADERS)
    if response.status_code != 200:
        print(f"Company A setup failed: {response.status_code} - {response.text}")
        return
    
    company_a_data = response.json()
    company_a_id = company_a_data.get("company_id")
    print(f"Company A created with ID: {company_a_id}")
    
    # Login Admin A
    print(f"\n2. Logging in Admin A")
    response = requests.post(f"{BASE_URL}/auth/login", 
                           json={"phone": admin_phone_a, "pin": "1111"}, 
                           headers=HEADERS)
    if response.status_code != 200:
        print(f"Admin A login failed: {response.status_code} - {response.text}")
        return
    
    admin_a_token = response.json().get("token")
    admin_a_user = check_user_profile(admin_a_token, "Admin A Profile")
    
    # Create a product for Company A
    print(f"\n3. Creating product for Company A")
    product_data = {
        "name": "Alpha Bread",
        "price": 15.0,
        "category": "Bakery",
        "unit_type": "loaf",
        "vat_applicable": True
    }
    headers_a = HEADERS.copy()
    headers_a["Authorization"] = f"Bearer {admin_a_token}"
    
    response = requests.post(f"{BASE_URL}/products", json=product_data, headers=headers_a)
    if response.status_code != 200:
        print(f"Product creation failed: {response.status_code} - {response.text}")
        return
    print("Product created for Company A")
    
    # Test Company A data access
    test_data_access(admin_a_token, "Admin A")
    
    # Setup Company B
    admin_phone_b = f"076222{unique_suffix}"
    company_data_b = {
        "company": {
            "name": "Company Beta",
            "contact_person": "Beta Manager",
            "phone": "0987654321",
            "email": "beta@beta.com",
            "address": "456 Beta Street"
        },
        "admin_name": "Beta Admin",
        "admin_phone": admin_phone_b,
        "admin_pin": "2222"
    }
    
    print(f"\n4. Creating Company B with admin phone: {admin_phone_b}")
    response = requests.post(f"{BASE_URL}/companies/setup", json=company_data_b, headers=HEADERS)
    if response.status_code != 200:
        print(f"Company B setup failed: {response.status_code} - {response.text}")
        return
    
    company_b_data = response.json()
    company_b_id = company_b_data.get("company_id")
    print(f"Company B created with ID: {company_b_id}")
    
    # Login Admin B
    print(f"\n5. Logging in Admin B")
    response = requests.post(f"{BASE_URL}/auth/login", 
                           json={"phone": admin_phone_b, "pin": "2222"}, 
                           headers=HEADERS)
    if response.status_code != 200:
        print(f"Admin B login failed: {response.status_code} - {response.text}")
        return
    
    admin_b_token = response.json().get("token")
    admin_b_user = check_user_profile(admin_b_token, "Admin B Profile")
    
    # Test Company B data access (should be isolated)
    test_data_access(admin_b_token, "Admin B")
    
    print("\n" + "=" * 80)
    print("ISOLATION TEST RESULTS:")
    print("Expected: Admin B should see 0 orders and 0 products")
    print("If Admin B sees Company A's data, isolation is broken.")
    print("=" * 80)

if __name__ == "__main__":
    main()