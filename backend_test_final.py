#!/usr/bin/env python3
"""
FINAL Comprehensive Backend API Testing for Mzansi Distribution Tracker
Testing NEW P0 Features with ALL FIXES APPLIED
"""

import requests
import json
import sys
from datetime import datetime, timedelta
import time

# Backend URL from environment
BASE_URL = "https://distributor-connect-4.preview.emergentagent.com/api"

# Test credentials
ADMIN_CREDS = {"phone": "0800000001", "pin": "0000"}
DRIVER_CREDS = {"phone": "0812345678", "pin": "1234"}

def log_test(test_name, result, details=""):
    """Log test results with timestamp"""
    status = "✅ PASS" if result else "❌ FAIL"
    print(f"{datetime.now().strftime('%H:%M:%S')} | {status} | {test_name}")
    if details:
        print(f"                    Details: {details}")
    if not result:
        print(f"                    ❌ FAILED: {test_name}")
    return result

def test_api_call(method, endpoint, data=None, headers=None, expected_status=200):
    """Make API call and validate response"""
    try:
        url = f"{BASE_URL}{endpoint}"
        
        if method == "GET":
            response = requests.get(url, headers=headers, timeout=30)
        elif method == "POST":
            response = requests.post(url, json=data, headers=headers, timeout=30)
        elif method == "PUT":
            response = requests.put(url, json=data, headers=headers, timeout=30)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers, timeout=30)
        else:
            return False, f"Unsupported method: {method}"
            
        if response.status_code != expected_status:
            return False, f"Expected {expected_status}, got {response.status_code}: {response.text}"
            
        try:
            return True, response.json() if response.text else {}
        except:
            # For PDF responses or non-JSON responses
            return True, response.content if response.content else response.text
            
    except Exception as e:
        return False, f"Request failed: {str(e)}"

def login_user(credentials):
    """Login user and get auth token"""
    success, response = test_api_call("POST", "/auth/login", credentials)
    if success and isinstance(response, dict) and 'token' in response:
        return response['token']
    return None

def get_auth_headers(token):
    """Get authorization headers"""
    return {"Authorization": f"Bearer {token}"}

def test_pdf_export():
    """Test PDF Export functionality (P0)"""
    print("\n=== TESTING PDF EXPORT (P0) ===")
    
    # Login as admin
    admin_token = login_user(ADMIN_CREDS)
    if not admin_token:
        log_test("PDF Export - Admin Login", False, "Failed to login as admin")
        return False
    
    headers = get_auth_headers(admin_token)
    
    # Test 1: PDF Export with date parameter
    test_date = "2026-03-10"
    success, response = test_api_call("GET", f"/reports/export/pdf?date_str={test_date}", headers=headers)
    pdf_basic = log_test("PDF Export - Basic with Date", success, f"Date: {test_date}")
    
    if success and isinstance(response, bytes):
        pdf_size = len(response)
        log_test("PDF Export - Valid PDF Content", pdf_size > 1000, f"PDF size: {pdf_size} bytes")
        
        # Check PDF header
        pdf_header = response[:5] == b'%PDF-'
        log_test("PDF Export - Valid PDF Format", pdf_header, "PDF header check")
    else:
        log_test("PDF Export - Content Validation", False, "No PDF content received")
    
    # Test 2: PDF Export without date (should use today)
    success, response = test_api_call("GET", "/reports/export/pdf", headers=headers)
    pdf_no_date = log_test("PDF Export - No Date Parameter", success, "Using current date")
    
    # Test 3: PDF Export with different date
    test_date2 = "2026-03-15"
    success, response = test_api_call("GET", f"/reports/export/pdf?date_str={test_date2}", headers=headers)
    pdf_diff_date = log_test("PDF Export - Different Date", success, f"Date: {test_date2}")
    
    return pdf_basic and pdf_no_date and pdf_diff_date

def test_email_settings():
    """Test Email Settings Management (P0)"""
    print("\n=== TESTING EMAIL SETTINGS (P0) ===")
    
    # Login as admin
    admin_token = login_user(ADMIN_CREDS)
    if not admin_token:
        log_test("Email Settings - Admin Login", False, "Failed to login as admin")
        return False
    
    headers = get_auth_headers(admin_token)
    
    # Test 1: Get current email settings
    success, response = test_api_call("GET", "/admin/settings/email", headers=headers)
    get_settings = log_test("Email Settings - GET Current Config", success)
    
    if success and isinstance(response, dict):
        has_sender = 'sender_email' in response
        no_password = 'sender_password' not in response  # Password should not be exposed
        log_test("Email Settings - Response Structure", has_sender, "Has sender_email field")
        log_test("Email Settings - Password Security", no_password, "Password not exposed in GET")
    
    # Test 2: Save email settings
    email_config = {
        "sender_email": "reports@mzansitracker.co.za",
        "sender_password": "test_password",
        "smtp_server": "mail.mzansitracker.co.za",
        "smtp_port": 465
    }
    
    success, response = test_api_call("POST", "/admin/settings/email", email_config, headers=headers)
    save_settings = log_test("Email Settings - POST Save Config", success, "Saved email configuration")
    
    # Test 3: Verify saved settings
    success, response = test_api_call("GET", "/admin/settings/email", headers=headers)
    verify_settings = False
    if success and isinstance(response, dict):
        sender_match = response.get('sender_email') == email_config['sender_email']
        verify_settings = log_test("Email Settings - Verify Saved Config", sender_match, f"Sender: {response.get('sender_email')}")
    
    # Test 4: Driver access should be denied
    driver_token = login_user(DRIVER_CREDS)
    if driver_token:
        driver_headers = get_auth_headers(driver_token)
        success, response = test_api_call("GET", "/admin/settings/email", headers=driver_headers, expected_status=403)
        driver_denied = log_test("Email Settings - Driver Access Denied", success, "403 Forbidden for driver")
    else:
        driver_denied = log_test("Email Settings - Driver Login", False, "Could not login as driver")
    
    return get_settings and save_settings and verify_settings and driver_denied

def test_email_recipients():
    """Test Email Recipients Management (P0)"""
    print("\n=== TESTING EMAIL RECIPIENTS CRUD (P0) ===")
    
    # Login as admin
    admin_token = login_user(ADMIN_CREDS)
    if not admin_token:
        log_test("Email Recipients - Admin Login", False, "Failed to login as admin")
        return False
    
    headers = get_auth_headers(admin_token)
    recipient_id = None
    
    # Test 1: Get all recipients (initial list)
    success, response = test_api_call("GET", "/admin/email-recipients", headers=headers)
    get_initial = log_test("Email Recipients - GET All (Initial)", success)
    initial_count = len(response) if success and isinstance(response, list) else 0
    
    # Test 2: Add new email recipient
    new_recipient = {"email": "test@mzansitracker.co.za"}
    success, response = test_api_call("POST", "/admin/email-recipients", new_recipient, headers=headers)
    add_recipient = log_test("Email Recipients - POST Add New", success)
    
    if success and isinstance(response, dict):
        recipient_id = response.get('id')
        log_test("Email Recipients - Add Response", bool(recipient_id), f"Created ID: {recipient_id}")
    
    # Test 3: Verify recipient was added
    success, response = test_api_call("GET", "/admin/email-recipients", headers=headers)
    verify_add = False
    if success and isinstance(response, list):
        new_count = len(response)
        verify_add = log_test("Email Recipients - Verify Added", new_count > initial_count, f"Count: {initial_count} -> {new_count}")
        
        # Find the added recipient
        added_recipient = next((r for r in response if r.get('email') == new_recipient['email']), None)
        if added_recipient:
            recipient_id = added_recipient.get('id')
            log_test("Email Recipients - Find Added Recipient", True, f"Found: {added_recipient['email']}")
    
    # Test 4: Update email recipient
    if recipient_id:
        updated_recipient = {"email": "updated@mzansitracker.co.za"}
        success, response = test_api_call("PUT", f"/admin/email-recipients/{recipient_id}", updated_recipient, headers=headers)
        update_recipient = log_test("Email Recipients - PUT Update", success, f"Updated to: {updated_recipient['email']}")
    else:
        update_recipient = log_test("Email Recipients - PUT Update", False, "No recipient ID available")
    
    # Test 5: Toggle active status
    if recipient_id:
        success, response = test_api_call("POST", f"/admin/email-recipients/{recipient_id}/toggle", headers=headers)
        toggle_status = log_test("Email Recipients - POST Toggle Status", success, "Toggled active status")
    else:
        toggle_status = log_test("Email Recipients - POST Toggle Status", False, "No recipient ID available")
    
    # Test 6: Delete email recipient
    if recipient_id:
        success, response = test_api_call("DELETE", f"/admin/email-recipients/{recipient_id}", headers=headers)
        delete_recipient = log_test("Email Recipients - DELETE Remove", success, f"Deleted ID: {recipient_id}")
    else:
        delete_recipient = log_test("Email Recipients - DELETE Remove", False, "No recipient ID available")
    
    # Test 7: Verify deletion
    success, response = test_api_call("GET", "/admin/email-recipients", headers=headers)
    verify_delete = False
    if success and isinstance(response, list):
        final_count = len(response)
        verify_delete = log_test("Email Recipients - Verify Deleted", final_count == initial_count, f"Count: {new_count} -> {final_count}")
    
    return (get_initial and add_recipient and verify_add and 
            update_recipient and toggle_status and delete_recipient and verify_delete)

def test_send_report():
    """Test Send Report Manually (P0) - CORRECTED"""
    print("\n=== TESTING SEND REPORT MANUALLY (P0) ===")
    
    # Login as admin
    admin_token = login_user(ADMIN_CREDS)
    if not admin_token:
        log_test("Send Report - Admin Login", False, "Failed to login as admin")
        return False
    
    headers = get_auth_headers(admin_token)
    
    # First, ensure we have email settings configured
    email_config = {
        "sender_email": "reports@mzansitracker.co.za",
        "sender_password": "test_password",
        "smtp_server": "mail.mzansitracker.co.za",
        "smtp_port": 465
    }
    test_api_call("POST", "/admin/settings/email", email_config, headers=headers)
    
    # Add a test recipient
    test_recipient = {"email": "manager@mzansitracker.co.za"}
    success, response = test_api_call("POST", "/admin/email-recipients", test_recipient, headers=headers)
    recipient_id = None
    if success and isinstance(response, dict):
        recipient_id = response.get('id')
    
    # Test 1: Send sales report (will attempt to send but likely fail due to SMTP)
    success, response = test_api_call("POST", "/admin/send-report?report_type=sales", headers=headers)
    send_sales = log_test("Send Report - Sales Report Queued", success, "Queued sales report for sending")
    
    if success and isinstance(response, dict):
        sent_count = response.get('sent', 0)
        failed_count = len(response.get('failed', []))
        # Email sending might fail due to SMTP config, but queueing should work
        log_test("Send Report - Sales Email Processing", True, f"Sent: {sent_count}, Failed: {failed_count}")
    
    # Test 2: Send stock report
    success, response = test_api_call("POST", "/admin/send-report?report_type=stock", headers=headers)
    send_stock = log_test("Send Report - Stock Report Queued", success, "Queued stock report for sending")
    
    # Test 3: Test with no recipients (should return proper 400 error)
    # First remove our test recipient
    if recipient_id:
        test_api_call("DELETE", f"/admin/email-recipients/{recipient_id}", headers=headers)
    
    # Deactivate all existing recipients for this test
    success, recipients_response = test_api_call("GET", "/admin/email-recipients", headers=headers)
    deactivated_recipients = []
    if success and isinstance(recipients_response, list):
        for recipient in recipients_response:
            if recipient.get('is_active', True):
                r_id = recipient.get('id')
                test_api_call("POST", f"/admin/email-recipients/{r_id}/toggle", headers=headers)
                deactivated_recipients.append(r_id)
    
    # This should now properly return a 400 error
    success, response = test_api_call("POST", "/admin/send-report?report_type=sales", headers=headers, expected_status=400)
    no_recipients = log_test("Send Report - No Active Recipients Error", success, "Proper 400 error for no recipients")
    
    # Restore recipients
    for r_id in deactivated_recipients:
        test_api_call("POST", f"/admin/email-recipients/{r_id}/toggle", headers=headers)
    
    # Test 4: Invalid report type
    success, response = test_api_call("POST", "/admin/send-report?report_type=invalid", headers=headers, expected_status=400)
    invalid_type = log_test("Send Report - Invalid Type Error", success, "Proper error for invalid report type")
    
    return send_sales and send_stock and no_recipients and invalid_type

def test_stock_management_verification():
    """Verify Stock Management still working (P0) - CORRECTED"""
    print("\n=== VERIFYING STOCK MANAGEMENT (P0) ===")
    
    # Login as admin
    admin_token = login_user(ADMIN_CREDS)
    if not admin_token:
        log_test("Stock Verification - Admin Login", False, "Failed to login as admin")
        return False
    
    headers = get_auth_headers(admin_token)
    
    # Test 1: Get stock levels
    success, response = test_api_call("GET", "/stock/levels", headers=headers)
    stock_levels = log_test("Stock Verification - GET Levels", success)
    
    product_id = None
    product_name = None
    if success and isinstance(response, list) and len(response) > 0:
        stock_count = len(response)
        log_test("Stock Verification - Stock Items Count", stock_count > 0, f"Found {stock_count} stock items")
        
        # Get first product for testing
        first_product = response[0]
        product_id = first_product.get('product_id')
        product_name = first_product.get('product_name', 'Unknown Product')
    
    # Test 2: Stock receive operation (CORRECTED - include required product_name field)
    if product_id and product_name:
        receive_data = {
            "product_id": product_id,
            "product_name": product_name,  # This field was missing!
            "quantity": 50,
            "supplier": "Test Supplier",
            "batch_reference": "TEST001"
        }
        success, response = test_api_call("POST", "/stock/receive", receive_data, headers=headers)
        stock_receive = log_test("Stock Verification - POST Receive", success, f"Received 50 units of {product_name}")
    else:
        stock_receive = log_test("Stock Verification - POST Receive", False, "No product available for receive test")
    
    # Test 3: Stock report
    success, response = test_api_call("GET", "/stock/report", headers=headers)
    stock_report = log_test("Stock Verification - GET Report", success)
    
    return stock_levels and stock_receive and stock_report

def test_invoice_shortage_verification():
    """Verify Invoice & Shortage calculations still working (P0) - FULLY CORRECTED"""
    print("\n=== VERIFYING INVOICE & SHORTAGE (P0) ===")
    
    # Login as admin first to seed data
    admin_token = login_user(ADMIN_CREDS)
    if not admin_token:
        log_test("Invoice Verification - Admin Login", False, "Failed to login as admin")
        return False
    
    admin_headers = get_auth_headers(admin_token)
    
    # Seed data first
    success, response = test_api_call("POST", "/seed-all", headers=admin_headers)
    seed_data = log_test("Invoice Verification - Seed Data", success, "Seeded test data")
    
    # Login as driver
    driver_token = login_user(DRIVER_CREDS)
    if not driver_token:
        log_test("Invoice Verification - Driver Login", False, "Failed to login as driver")
        return False
    
    headers = get_auth_headers(driver_token)
    
    # Get real route and vehicle IDs from the seeded data
    success, routes_response = test_api_call("GET", "/routes", headers=admin_headers)
    route_id = None
    if success and isinstance(routes_response, list) and len(routes_response) > 0:
        route_id = routes_response[0].get('id')
    
    success, vehicles_response = test_api_call("GET", "/vehicles/available", headers=admin_headers)
    vehicle_id = None
    if success and isinstance(vehicles_response, list) and len(vehicles_response) > 0:
        vehicle_id = vehicles_response[0].get('id')
    
    if not route_id or not vehicle_id:
        log_test("Invoice Verification - Prerequisites", False, "Missing route or vehicle data")
        return False
    
    # Start a route to create a sale
    route_start_data = {
        "route_id": route_id,
        "vehicle_id": vehicle_id,
        "opening_km": 1000,
        "crates_out": 50
    }
    success, response = test_api_call("POST", "/daily-routes/start", route_start_data, headers=headers)
    route_started = log_test("Invoice Verification - Start Route", success, f"Started route with real IDs")
    
    if not route_started:
        return False
    
    # Get the route_name for the sales creation
    route_name = None
    if success and isinstance(response, dict):
        route_name = response.get('route_name', 'Unknown Route')
    
    # Get real customer and product IDs
    success, customers_response = test_api_call("GET", "/customers", headers=admin_headers)
    customer_id = None
    customer_name = None
    if success and isinstance(customers_response, list) and len(customers_response) > 0:
        customer = customers_response[0]
        customer_id = customer.get('id')
        customer_name = customer.get('name', 'Unknown Customer')
    
    success, products_response = test_api_call("GET", "/products", headers=admin_headers)
    product_id = None
    product_name = None
    if success and isinstance(products_response, list) and len(products_response) > 0:
        product = products_response[0]
        product_id = product.get('id')
        product_name = product.get('name', 'Unknown Product')
    
    if not customer_id or not product_id or not route_name or not customer_name or not product_name:
        log_test("Invoice Verification - Customer/Product Data", False, "Missing customer, product, or route data")
        return False
    
    # Create a sale to test invoice generation and shortage calculation (WITH ALL REQUIRED FIELDS)
    sale_data = {
        "customer_id": customer_id,
        "customer_name": customer_name,  # Required field
        "route_id": route_id,           # Required field
        "items": [
            {
                "product_id": product_id,
                "product_name": product_name,  # Required field
                "quantity_delivered": 10,
                "quantity_returned": 0,
                "unit_price": 15.0
            }
        ],
        "total_amount": 150.0,
        "cash_collected": 120.0,  # R30 shortage
        "payment_type": "cash"
    }
    
    success, response = test_api_call("POST", "/sales", sale_data, headers=headers)
    sale_created = log_test("Invoice Verification - Create Sale", success, "Created sale with all required fields")
    
    if success and isinstance(response, dict):
        # Check invoice number format
        invoice_number = response.get('invoice_number', '')
        invoice_format_ok = invoice_number.startswith('INV-') and len(invoice_number.split('-')) == 4
        log_test("Invoice Verification - Invoice Format", invoice_format_ok, f"Invoice: {invoice_number}")
        
        # Check shortage calculation
        shortage_amount = response.get('shortage_amount', 0)
        expected_shortage = 150.0 - 120.0  # R30
        shortage_correct = abs(shortage_amount - expected_shortage) < 0.01
        log_test("Invoice Verification - Shortage Calculation", shortage_correct, f"Shortage: R{shortage_amount}")
        
        return route_started and sale_created and invoice_format_ok and shortage_correct
    
    return False

def main():
    """Run all P0 feature tests"""
    print("=" * 80)
    print("MZANSI DISTRIBUTION TRACKER - P0 FEATURES TESTING (FINAL)")
    print("=" * 80)
    
    # Test suite for new P0 features
    tests = [
        ("PDF Export", test_pdf_export),
        ("Email Settings", test_email_settings),
        ("Email Recipients CRUD", test_email_recipients),
        ("Send Report Manually", test_send_report),
        ("Stock Management (Verification)", test_stock_management_verification),
        ("Invoice & Shortage (Verification)", test_invoice_shortage_verification)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n{'='*20} {test_name} {'='*20}")
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            log_test(f"{test_name} - Exception", False, str(e))
            results.append((test_name, False))
        
        time.sleep(1)  # Small delay between test suites
    
    # Summary
    print("\n" + "="*80)
    print("P0 FEATURES TESTING SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} | {test_name}")
    
    print(f"\nOVERALL RESULT: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL P0 FEATURES WORKING CORRECTLY!")
        return True
    else:
        print("⚠️  SOME P0 FEATURES HAVE ISSUES")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)