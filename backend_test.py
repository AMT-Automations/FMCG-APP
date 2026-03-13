#!/usr/bin/env python3
"""
Backend Testing Suite for Mzansi Distribution Tracker
Testing new features as per review request:
1. Company Setup (Multi-tenancy)
2. Login with company
3. Excel Export
4. PDF Export
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL - using the production URL from frontend env
BASE_URL = "https://route-sales-ops.preview.emergentagent.com/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    PURPLE = '\033[95m'
    CYAN = '\033[96m'
    WHITE = '\033[97m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_test_header(title):
    print(f"\n{Colors.BLUE}{Colors.BOLD}{'='*60}")
    print(f"🧪 TESTING: {title}")
    print(f"{'='*60}{Colors.END}")

def print_success(message):
    print(f"{Colors.GREEN}✅ {message}{Colors.END}")

def print_error(message):
    print(f"{Colors.RED}❌ {message}{Colors.END}")

def print_warning(message):
    print(f"{Colors.YELLOW}⚠️  {message}{Colors.END}")

def print_info(message):
    print(f"{Colors.CYAN}ℹ️  {message}{Colors.END}")

def make_request(method, endpoint, headers=None, data=None, expected_status=200):
    """Make HTTP request and return response"""
    url = f"{BASE_URL}{endpoint}"
    print_info(f"{method} {url}")
    
    try:
        if method == "GET":
            response = requests.get(url, headers=headers)
        elif method == "POST":
            response = requests.post(url, headers=headers, json=data)
        elif method == "PUT":
            response = requests.put(url, headers=headers, json=data)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers)
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == expected_status:
            return response
        else:
            print_error(f"Expected {expected_status}, got {response.status_code}")
            print_error(f"Response: {response.text}")
            return None
            
    except Exception as e:
        print_error(f"Request failed: {str(e)}")
        return None

def test_seed_data():
    """Step 0: Seed data first as specified"""
    print_test_header("STEP 0: SEED ALL DATA")
    
    response = make_request("POST", "/seed-all")
    if response:
        print_success("✅ Data seeded successfully")
        return True
    else:
        print_error("❌ Failed to seed data")
        return False

def test_company_setup():
    """Test 1: Company Setup (Multi-tenancy)"""
    print_test_header("TEST 1: COMPANY SETUP (MULTI-TENANCY)")
    
    company_data = {
        "company": {
            "name": "Test Distribution Co",
            "contact_person": "John Test",
            "phone": "0111234567",
            "email": "test@test.co.za",
            "address": "123 Test Street, Johannesburg"
        },
        "admin_name": "John Admin",
        "admin_phone": "0991112222",
        "admin_pin": "5678"
    }
    
    print_info("Testing company setup with provided data...")
    print_info(f"Company: {company_data['company']['name']}")
    print_info(f"Admin: {company_data['admin_name']} ({company_data['admin_phone']})")
    
    response = make_request("POST", "/companies/setup", data=company_data, expected_status=200)
    
    if response:
        try:
            result = response.json()
            print_success(f"✅ Company setup successful!")
            print_success(f"   Company ID: {result.get('company_id')}")
            print_success(f"   Company Name: {result.get('company_name')}")
            print_success(f"   Admin Phone: {result.get('admin_phone')}")
            
            # Verify required fields are present
            if result.get('company_id') and result.get('company_name'):
                print_success("✅ VERIFICATION: Response includes company_id and company_name as required")
                return {
                    "success": True,
                    "company_id": result.get('company_id'),
                    "company_name": result.get('company_name'),
                    "admin_phone": company_data['admin_phone'],
                    "admin_pin": company_data['admin_pin']
                }
            else:
                print_error("❌ VERIFICATION: Missing required fields in response")
                return {"success": False}
                
        except json.JSONDecodeError:
            print_error("❌ Invalid JSON response")
            return {"success": False}
    else:
        print_error("❌ Company setup failed")
        return {"success": False}

def test_login_with_company(admin_phone, admin_pin):
    """Test 2: Login with company"""
    print_test_header("TEST 2: LOGIN WITH COMPANY")
    
    login_data = {
        "phone": admin_phone,
        "pin": admin_pin
    }
    
    print_info(f"Testing login with new admin credentials...")
    print_info(f"Phone: {admin_phone}, PIN: {admin_pin}")
    
    response = make_request("POST", "/auth/login", data=login_data, expected_status=200)
    
    if response:
        try:
            result = response.json()
            print_success(f"✅ Login successful!")
            print_success(f"   Token: {result.get('token', '')[:50]}...")
            print_success(f"   User ID: {result.get('user', {}).get('id')}")
            print_success(f"   User Name: {result.get('user', {}).get('name')}")
            print_success(f"   User Role: {result.get('user', {}).get('role')}")
            
            # Verify company field is present
            company_info = result.get('company')
            if company_info:
                print_success(f"✅ VERIFICATION: Company field present in response")
                print_success(f"   Company Name: {company_info.get('name')}")
                print_success(f"   Company ID: {company_info.get('id')}")
                
                return {
                    "success": True,
                    "token": result.get('token'),
                    "user": result.get('user'),
                    "company": company_info
                }
            else:
                print_error("❌ VERIFICATION: Company field missing from login response")
                return {"success": False}
                
        except json.JSONDecodeError:
            print_error("❌ Invalid JSON response")
            return {"success": False}
    else:
        print_error("❌ Login failed")
        return {"success": False}

def test_admin_login():
    """Login as default admin to test exports"""
    print_test_header("ADMIN LOGIN FOR EXPORT TESTING")
    
    login_data = {
        "phone": "0800000001",
        "pin": "0000"
    }
    
    print_info("Logging in as default admin for export testing...")
    print_info(f"Phone: {login_data['phone']}, PIN: {login_data['pin']}")
    
    response = make_request("POST", "/auth/login", data=login_data, expected_status=200)
    
    if response:
        try:
            result = response.json()
            print_success(f"✅ Admin login successful!")
            print_success(f"   User: {result.get('user', {}).get('name')} ({result.get('user', {}).get('role')})")
            
            return {
                "success": True,
                "token": result.get('token'),
                "user": result.get('user')
            }
        except json.JSONDecodeError:
            print_error("❌ Invalid JSON response")
            return {"success": False}
    else:
        print_error("❌ Admin login failed")
        return {"success": False}

def test_excel_export(auth_token):
    """Test 3: Excel Export"""
    print_test_header("TEST 3: EXCEL EXPORT")
    
    headers = {
        "Authorization": f"Bearer {auth_token}",
        "Accept": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    }
    
    print_info("Testing Excel export with authorization header...")
    
    response = make_request("GET", "/reports/export/excel", headers=headers, expected_status=200)
    
    if response:
        # Check content type
        content_type = response.headers.get('content-type', '')
        print_info(f"Content-Type: {content_type}")
        
        # Check if it's Excel format
        if 'xlsx' in content_type or 'spreadsheetml' in content_type:
            print_success("✅ VERIFICATION: Returns 200 status with xlsx content-type")
            
            # Check content length
            content_length = len(response.content)
            print_success(f"✅ Excel file generated: {content_length} bytes")
            
            return {"success": True, "file_size": content_length}
        else:
            print_error(f"❌ VERIFICATION: Wrong content type. Expected xlsx, got {content_type}")
            return {"success": False}
    else:
        print_error("❌ Excel export failed")
        return {"success": False}

def test_pdf_export(auth_token):
    """Test 4: PDF Export"""
    print_test_header("TEST 4: PDF EXPORT")
    
    headers = {
        "Authorization": f"Bearer {auth_token}",
        "Accept": "application/pdf"
    }
    
    print_info("Testing PDF export with authorization header...")
    
    response = make_request("GET", "/reports/export/pdf", headers=headers, expected_status=200)
    
    if response:
        # Check content type
        content_type = response.headers.get('content-type', '')
        print_info(f"Content-Type: {content_type}")
        
        # Check if it's PDF format
        if 'pdf' in content_type:
            print_success("✅ VERIFICATION: Returns 200 status with pdf content-type")
            
            # Check content length and PDF header
            content_length = len(response.content)
            print_success(f"✅ PDF file generated: {content_length} bytes")
            
            # Verify PDF magic bytes
            if response.content.startswith(b'%PDF'):
                print_success("✅ Valid PDF format (starts with %PDF)")
                return {"success": True, "file_size": content_length}
            else:
                print_error("❌ Invalid PDF format (missing %PDF header)")
                return {"success": False}
        else:
            print_error(f"❌ VERIFICATION: Wrong content type. Expected pdf, got {content_type}")
            return {"success": False}
    else:
        print_error("❌ PDF export failed")
        return {"success": False}

def main():
    """Run all tests"""
    print(f"{Colors.PURPLE}{Colors.BOLD}")
    print("🚀 MZANSI DISTRIBUTION TRACKER - BACKEND TESTING")
    print("📋 Testing New Features as per Review Request")
    print(f"🌐 Backend URL: {BASE_URL}")
    print(f"⏰ Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{Colors.END}")
    
    results = {
        "seed_data": False,
        "company_setup": False,
        "login_with_company": False,
        "excel_export": False,
        "pdf_export": False
    }
    
    # Step 0: Seed data first
    if test_seed_data():
        results["seed_data"] = True
    
    # Test 1: Company Setup
    company_result = test_company_setup()
    if company_result.get("success"):
        results["company_setup"] = True
        
        # Test 2: Login with new company admin
        login_result = test_login_with_company(
            company_result["admin_phone"], 
            company_result["admin_pin"]
        )
        if login_result.get("success"):
            results["login_with_company"] = True
    
    # Login as admin for export tests
    admin_login = test_admin_login()
    if admin_login.get("success"):
        auth_token = admin_login["token"]
        
        # Test 3: Excel Export
        excel_result = test_excel_export(auth_token)
        if excel_result.get("success"):
            results["excel_export"] = True
        
        # Test 4: PDF Export
        pdf_result = test_pdf_export(auth_token)
        if pdf_result.get("success"):
            results["pdf_export"] = True
    
    # Print summary
    print(f"\n{Colors.BOLD}{Colors.WHITE}")
    print("=" * 60)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 60)
    
    for test_name, success in results.items():
        status = f"{Colors.GREEN}✅ PASSED" if success else f"{Colors.RED}❌ FAILED"
        print(f"{test_name.replace('_', ' ').title()}: {status}{Colors.WHITE}")
    
    passed = sum(results.values())
    total = len(results)
    success_rate = (passed / total) * 100
    
    print(f"\nOverall Success Rate: {passed}/{total} ({success_rate:.1f}%)")
    
    if success_rate == 100:
        print(f"{Colors.GREEN}🎉 ALL TESTS PASSED! Backend is working perfectly.{Colors.END}")
        sys.exit(0)
    elif success_rate >= 80:
        print(f"{Colors.YELLOW}⚠️  Most tests passed with some issues to investigate.{Colors.END}")
        sys.exit(1)
    else:
        print(f"{Colors.RED}🚨 Multiple test failures detected. Backend needs attention.{Colors.END}")
        sys.exit(2)

if __name__ == "__main__":
    main()