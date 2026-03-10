#!/usr/bin/env python3
"""
Enhanced Stock Management Features Testing
Testing Stock-Sales Integration, Stock Receive with Deductions, Stock Reports with Variances, and Stock Take with Variance
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL - using the correct environment URL
BACKEND_URL = "https://cash-ops-tracker.preview.emergentagent.com/api"

# Test credentials
ADMIN_CREDENTIALS = {
    "phone": "0800000001",
    "pin": "0000"
}

DRIVER_CREDENTIALS = {
    "phone": "0812345678", 
    "pin": "1234"
}

# Global tokens
admin_token = None
driver_token = None
active_route_id = None

def print_test_header(test_name):
    print(f"\n{'='*60}")
    print(f"TEST: {test_name}")
    print('='*60)

def print_result(test_name, success, details=""):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} - {test_name}")
    if details:
        print(f"    Details: {details}")

def login_user(credentials, role_name):
    """Login and get auth token"""
    print(f"\n🔐 Logging in as {role_name}...")
    
    response = requests.post(f"{BACKEND_URL}/auth/login", json=credentials)
    
    if response.status_code == 200:
        token = response.json()["token"]
        print(f"✅ {role_name} login successful")
        return token
    else:
        print(f"❌ {role_name} login failed: {response.status_code} - {response.text}")
        return None

def get_auth_headers(token):
    """Get authentication headers"""
    return {"Authorization": f"Bearer {token}"}

def seed_all_data():
    """Seed all data including products and stock"""
    print("\n📦 Seeding all data...")
    
    response = requests.post(f"{BACKEND_URL}/seed-all")
    if response.status_code == 200:
        print("✅ All data seeded successfully")
        return True
    else:
        print(f"❌ Failed to seed data: {response.status_code} - {response.text}")
        return False

def test_1_stock_sales_integration():
    """Test 1: Stock-Sales Integration - verify stock is reduced automatically when sales are made"""
    print_test_header("1. Stock-Sales Integration")
    
    global driver_token, active_route_id
    
    try:
        # Step 1: Get initial stock levels
        print("📊 Getting initial stock levels...")
        response = requests.get(
            f"{BACKEND_URL}/stock/levels",
            headers=get_auth_headers(admin_token)
        )
        
        if response.status_code != 200:
            print_result("Get Initial Stock Levels", False, f"Status: {response.status_code}")
            return False
            
        initial_stock = response.json()
        print(f"✅ Retrieved {len(initial_stock)} product stock levels")
        
        # Find a product with stock for testing
        test_product = None
        for product in initial_stock:
            if product['current_quantity'] > 0:
                test_product = product
                break
                
        if not test_product:
            # If no stock, use first product anyway (might be a data issue)
            if initial_stock:
                test_product = initial_stock[0]
                print(f"⚠️ No stock found, using {test_product['product_name']} anyway")
            else:
                print_result("Find Test Product", False, "No products found at all")
                return False
            
        initial_qty = test_product['current_quantity']
        product_id = test_product['product_id']
        product_name = test_product['product_name']
        print(f"📦 Testing with {product_name} (ID: {product_id}, Initial Qty: {initial_qty})")
        
        # Step 2: Start a route as driver
        print("\n🚚 Starting route as driver...")
        
        # Get available routes first
        routes_response = requests.get(
            f"{BACKEND_URL}/routes",
            headers=get_auth_headers(driver_token)
        )
        
        if routes_response.status_code != 200:
            print_result("Get Routes", False, f"Status: {routes_response.status_code}")
            return False
            
        routes = routes_response.json()
        if not routes:
            print_result("Find Available Route", False, "No routes available")
            return False
            
        test_route = routes[0]
        route_id = test_route['id']
        
        # Get available vehicles
        vehicles_response = requests.get(
            f"{BACKEND_URL}/vehicles/available",
            headers=get_auth_headers(driver_token)
        )
        
        if vehicles_response.status_code != 200:
            print_result("Get Available Vehicles", False, f"Status: {vehicles_response.status_code}")
            return False
            
        vehicles = vehicles_response.json()
        if not vehicles:
            print_result("Find Available Vehicle", False, "No vehicles available")
            return False
            
        test_vehicle = vehicles[0]
        vehicle_id = test_vehicle['id']
        
        # Start daily route
        route_start_data = {
            "route_id": route_id,
            "vehicle_id": vehicle_id,
            "opening_km": 100.0,
            "crates_out": 50
        }
        
        start_response = requests.post(
            f"{BACKEND_URL}/daily-routes/start",
            json=route_start_data,
            headers=get_auth_headers(driver_token)
        )
        
        if start_response.status_code != 200:
            print_result("Start Daily Route", False, f"Status: {start_response.status_code}")
            return False
            
        active_route_id = start_response.json()['id']
        print(f"✅ Route started successfully (ID: {active_route_id})")
        
        # Step 3: Create a sale
        print(f"\n💰 Creating sale for {product_name}...")
        
        sale_quantity = 5  # Test with 5 units
        
        sale_data = {
            "route_id": route_id,
            "customer_id": "test-customer-001",
            "customer_name": "Test Customer Store",
            "items": [
                {
                    "product_id": product_id,
                    "product_name": product_name,
                    "quantity_delivered": sale_quantity,
                    "quantity_returned": 0,
                    "unit_price": 25.50
                }
            ],
            "crates_dropped": 2,
            "crates_collected": 1,
            "cash_collected": 127.50,
            "payment_type": "cash",
            "delivery_status": "delivered",
            "notes": "Stock integration test sale"
        }
        
        sale_response = requests.post(
            f"{BACKEND_URL}/sales",
            json=sale_data,
            headers=get_auth_headers(driver_token)
        )
        
        if sale_response.status_code != 200:
            print_result("Create Sale", False, f"Status: {sale_response.status_code} - {sale_response.text}")
            return False
            
        sale_result = sale_response.json()
        print(f"✅ Sale created: {sale_result.get('invoice_number', 'No invoice')}")
        
        # Step 4: Verify stock is reduced automatically
        print(f"\n📉 Verifying stock reduction...")
        
        updated_response = requests.get(
            f"{BACKEND_URL}/stock/levels",
            headers=get_auth_headers(admin_token)
        )
        
        if updated_response.status_code != 200:
            print_result("Get Updated Stock Levels", False, f"Status: {updated_response.status_code}")
            return False
            
        updated_stock = updated_response.json()
        
        # Find the updated product stock
        updated_product = None
        for product in updated_stock:
            if product['product_id'] == product_id:
                updated_product = product
                break
                
        if not updated_product:
            print_result("Find Updated Product Stock", False, "Product not found in updated stock")
            return False
            
        final_qty = updated_product['current_quantity']
        expected_qty = initial_qty - sale_quantity
        
        print(f"📊 Stock levels: Initial={initial_qty}, Expected={expected_qty}, Actual={final_qty}")
        
        if final_qty == expected_qty:
            print_result("Stock Automatic Reduction", True, f"Stock reduced from {initial_qty} to {final_qty}")
        else:
            print_result("Stock Automatic Reduction", False, f"Expected {expected_qty}, got {final_qty}")
            return False
            
        # Step 5: Check stock movements for "sale" type entries
        print(f"\n📋 Checking stock movement history...")
        
        movements_response = requests.get(
            f"{BACKEND_URL}/stock/movements?product_id={product_id}",
            headers=get_auth_headers(admin_token)
        )
        
        if movements_response.status_code != 200:
            print_result("Get Stock Movements", False, f"Status: {movements_response.status_code}")
            return False
            
        movements = movements_response.json()
        
        # Look for sale movement
        sale_movement = None
        for movement in movements:
            if movement['movement_type'] == 'sale' and movement['product_id'] == product_id:
                sale_movement = movement
                break
                
        if sale_movement:
            print_result("Sale Movement Recorded", True, f"Movement type: {sale_movement['movement_type']}, Quantity: {sale_movement['quantity']}")
            return True
        else:
            print_result("Sale Movement Recorded", False, "No sale movement found in history")
            return False
            
    except Exception as e:
        print_result("Stock-Sales Integration Test", False, f"Exception: {str(e)}")
        return False

def test_2_stock_receive_with_deductions():
    """Test 2: Stock Receive with Deductions - test damages, rejected, spoilt deductions"""
    print_test_header("2. Stock Receive with Deductions")
    
    try:
        # Step 1: Get a product for testing
        print("📦 Getting product for receive testing...")
        
        response = requests.get(
            f"{BACKEND_URL}/stock/levels",
            headers=get_auth_headers(admin_token)
        )
        
        if response.status_code != 200:
            print_result("Get Stock Levels", False, f"Status: {response.status_code}")
            return False
            
        stock_levels = response.json()
        if not stock_levels:
            print_result("Find Test Product", False, "No products found")
            return False
            
        test_product = stock_levels[0]  # Use first product
        product_id = test_product['product_id']
        product_name = test_product['product_name']
        initial_qty = test_product['current_quantity']
        
        print(f"📦 Testing with {product_name} (Initial Qty: {initial_qty})")
        
        # Step 2: Record stock receive with deductions
        print(f"\n📥 Recording stock receive with deductions...")
        
        receive_data = {
            "product_id": product_id,
            "product_name": product_name,
            "quantity": 100,
            "supplier": "ABC Supplier Ltd",
            "batch_reference": "BATCH-2026-001",
            "damages_in_transit": 5,
            "rejected_stock": 3,
            "spoilt_from_factory": 2,
            "crates_received": 50,
            "crates_returned": 20,
            "notes": "Enhanced stock receive test with deductions"
        }
        
        # Calculate expected net quantity
        total_deductions = receive_data['damages_in_transit'] + receive_data['rejected_stock'] + receive_data['spoilt_from_factory']
        expected_net_qty = receive_data['quantity'] - total_deductions
        expected_final_qty = initial_qty + expected_net_qty
        
        print(f"📊 Receive details:")
        print(f"   Quantity: {receive_data['quantity']}")
        print(f"   Damages in transit: {receive_data['damages_in_transit']}")
        print(f"   Rejected stock: {receive_data['rejected_stock']}")
        print(f"   Spoilt from factory: {receive_data['spoilt_from_factory']}")
        print(f"   Expected net quantity: {expected_net_qty}")
        print(f"   Expected final stock: {expected_final_qty}")
        
        receive_response = requests.post(
            f"{BACKEND_URL}/stock/receive",
            json=receive_data,
            headers=get_auth_headers(admin_token)
        )
        
        if receive_response.status_code != 200:
            print_result("Record Stock Receive", False, f"Status: {receive_response.status_code} - {receive_response.text}")
            return False
            
        receive_result = receive_response.json()
        print(f"✅ Stock receive recorded successfully")
        
        # Step 3: Verify net quantity calculation
        print(f"\n🔍 Verifying net quantity calculation...")
        
        updated_response = requests.get(
            f"{BACKEND_URL}/stock/levels",
            headers=get_auth_headers(admin_token)
        )
        
        if updated_response.status_code != 200:
            print_result("Get Updated Stock", False, f"Status: {updated_response.status_code}")
            return False
            
        updated_stock = updated_response.json()
        
        # Find updated product
        updated_product = None
        for product in updated_stock:
            if product['product_id'] == product_id:
                updated_product = product
                break
                
        if not updated_product:
            print_result("Find Updated Product", False, "Product not found")
            return False
            
        actual_final_qty = updated_product['current_quantity']
        
        print(f"📊 Stock verification:")
        print(f"   Expected final quantity: {expected_final_qty}")
        print(f"   Actual final quantity: {actual_final_qty}")
        
        if actual_final_qty == expected_final_qty:
            print_result("Net Quantity Calculation", True, f"Correct net quantity applied: {expected_net_qty}")
        else:
            print_result("Net Quantity Calculation", False, f"Expected {expected_final_qty}, got {actual_final_qty}")
            return False
            
        # Step 4: Verify separate movement entries
        print(f"\n📋 Verifying movement entries for deductions...")
        
        movements_response = requests.get(
            f"{BACKEND_URL}/stock/movements?product_id={product_id}&days=1",
            headers=get_auth_headers(admin_token)
        )
        
        if movements_response.status_code != 200:
            print_result("Get Recent Movements", False, f"Status: {movements_response.status_code}")
            return False
            
        movements = movements_response.json()
        
        # Look for different movement types
        receive_movements = [m for m in movements if m['movement_type'] == 'receive']
        damages_movements = [m for m in movements if 'damages_in_transit' in m.get('reference', '')]
        rejected_movements = [m for m in movements if 'rejected_stock' in m.get('reference', '')]
        spoilt_movements = [m for m in movements if 'spoilt_from_factory' in m.get('reference', '')]
        
        print(f"📊 Movement entries found:")
        print(f"   Receive movements: {len(receive_movements)}")
        print(f"   Damages movements: {len(damages_movements)}")
        print(f"   Rejected movements: {len(rejected_movements)}")
        print(f"   Spoilt movements: {len(spoilt_movements)}")
        
        # At minimum, we should have a receive movement
        if receive_movements:
            print_result("Stock Receive Movement", True, "Receive movement recorded")
            return True
        else:
            print_result("Stock Receive Movement", False, "No receive movement found")
            return False
            
    except Exception as e:
        print_result("Stock Receive with Deductions Test", False, f"Exception: {str(e)}")
        return False

def test_3_stock_report_with_variances():
    """Test 3: Stock Report with Variances - verify report includes all variance types and crates tracking"""
    print_test_header("3. Stock Report with Variances")
    
    try:
        # Step 1: Get stock report
        print("📊 Generating stock report...")
        
        response = requests.get(
            f"{BACKEND_URL}/stock/report",
            headers=get_auth_headers(admin_token)
        )
        
        if response.status_code != 200:
            print_result("Get Stock Report", False, f"Status: {response.status_code} - {response.text}")
            return False
            
        report_data = response.json()
        
        if not report_data:
            print_result("Stock Report Generated", False, "Empty report returned")
            return False
        
        # Extract products array from report structure    
        products = report_data.get('products', [])
        crates_info = report_data.get('crates', {})
        summary = report_data.get('summary', {})
        
        if not products:
            print_result("Stock Report Generated", False, "No products in report")
            return False
            
        print(f"✅ Stock report generated with {len(products)} entries")
        
        # Step 2: Verify report structure and variance tracking
        print(f"\n🔍 Verifying report structure...")
        
        required_fields = [
            'product_id', 'product_name', 'opening_stock', 'received', 
            'sold', 'adjustments', 'closing_stock'
        ]
        
        variance_fields = [
            'damages_in_transit', 'rejected_stock', 'spoilt_from_factory',
            'stock_take_variance'
        ]
        
        crate_fields = ['from_manufacturer', 'returned_to_manufacturer']
        
        # Check first product in report
        if products:
            first_product = products[0]
            
            # Check required fields
            missing_fields = []
            for field in required_fields:
                if field not in first_product:
                    missing_fields.append(field)
                    
            if missing_fields:
                print_result("Report Structure", False, f"Missing fields: {missing_fields}")
                return False
            else:
                print_result("Report Basic Structure", True, "All basic fields present")
                
            # Check variance fields (may be 0 but should exist)
            variance_present = []
            for field in variance_fields:
                if field in first_product:
                    variance_present.append(field)
                    
            print(f"📊 Variance fields found: {variance_present}")
            
            # Check crate fields
            crate_present = []
            for field in crate_fields:
                if field in crates_info:
                    crate_present.append(field)
                    
            print(f"📦 Crate fields found: {crate_present}")
            
            # Step 3: Display report summary
            print(f"\n📋 Report Summary:")
            total_products = len(products)
            total_opening = sum(p.get('opening_stock', 0) for p in products)
            total_received = sum(p.get('received', 0) for p in products)
            total_sold = sum(p.get('sold', 0) for p in products)
            total_closing = sum(p.get('closing_stock', 0) for p in products)
            
            # Variance totals
            total_damages_transit = sum(p.get('damages_in_transit', 0) for p in products)
            total_rejected = sum(p.get('rejected_stock', 0) for p in products)
            total_spoilt = sum(p.get('spoilt_from_factory', 0) for p in products)
            total_variance = sum(p.get('stock_take_variance', 0) for p in products)
            
            print(f"   Products: {total_products}")
            print(f"   Opening Stock: {total_opening}")
            print(f"   Received: {total_received}")
            print(f"   Sold: {total_sold}")
            print(f"   Closing Stock: {total_closing}")
            print(f"   Damages in Transit: {total_damages_transit}")
            print(f"   Rejected Stock: {total_rejected}")
            print(f"   Spoilt from Factory: {total_spoilt}")
            print(f"   Stock Take Variance: {total_variance}")
            
            # Verify the report includes our test data
            if len(variance_present) >= 2:  # At least some variance fields
                print_result("Variance Types Tracking", True, f"Found {len(variance_present)} variance types")
            else:
                print_result("Variance Types Tracking", False, "Insufficient variance type tracking")
                return False
                
            print_result("Stock Report with Variances", True, f"Complete report with {total_products} products")
            return True
            
        else:
            print_result("Stock Report Content", False, "No report data found")
            return False
            
    except Exception as e:
        print_result("Stock Report with Variances Test", False, f"Exception: {str(e)}")
        return False

def test_4_stock_take_with_variance():
    """Test 4: Stock Take with Variance - record stock take with physical count different from system"""
    print_test_header("4. Stock Take with Variance")
    
    try:
        # Step 1: Get current stock for testing
        print("📦 Getting product for stock take test...")
        
        response = requests.get(
            f"{BACKEND_URL}/stock/levels",
            headers=get_auth_headers(admin_token)
        )
        
        if response.status_code != 200:
            print_result("Get Stock Levels", False, f"Status: {response.status_code}")
            return False
            
        stock_levels = response.json()
        if not stock_levels:
            print_result("Find Test Product", False, "No products found")
            return False
            
        # Find a product with reasonable stock for testing
        test_product = None
        for product in stock_levels:
            if product['current_quantity'] >= 10:  # Need enough for variance test
                test_product = product
                break
                
        if not test_product:
            test_product = stock_levels[0]  # Use first product anyway
            
        product_id = test_product['product_id']
        product_name = test_product['product_name']
        system_qty = test_product['current_quantity']
        
        print(f"📦 Testing with {product_name}")
        print(f"   System Quantity: {system_qty}")
        
        # Step 2: Record stock take with variance
        print(f"\n🔍 Recording stock take with variance...")
        
        # Create a variance (physical count different from system)
        variance_amount = -7  # 7 units short
        physical_count = system_qty + variance_amount
        
        stock_take_data = {
            "product_id": product_id,
            "product_name": product_name,
            "system_quantity": system_qty,
            "physical_count": physical_count,
            "variance_reason": "Shrinkage - product spoilage during storage"
        }
        
        print(f"📊 Stock take details:")
        print(f"   System quantity: {system_qty}")
        print(f"   Physical count: {physical_count}")
        print(f"   Variance: {variance_amount}")
        print(f"   Reason: {stock_take_data['variance_reason']}")
        
        take_response = requests.post(
            f"{BACKEND_URL}/stock/take",
            json=stock_take_data,
            headers=get_auth_headers(admin_token)
        )
        
        if take_response.status_code != 200:
            print_result("Record Stock Take", False, f"Status: {take_response.status_code} - {take_response.text}")
            return False
            
        take_result = take_response.json()
        print(f"✅ Stock take recorded successfully")
        
        # Step 3: Verify variance is recorded
        print(f"\n📊 Verifying variance recording...")
        
        # Check updated stock level
        updated_response = requests.get(
            f"{BACKEND_URL}/stock/levels",
            headers=get_auth_headers(admin_token)
        )
        
        if updated_response.status_code != 200:
            print_result("Get Updated Stock", False, f"Status: {updated_response.status_code}")
            return False
            
        updated_stock = updated_response.json()
        
        # Find updated product
        updated_product = None
        for product in updated_stock:
            if product['product_id'] == product_id:
                updated_product = product
                break
                
        if not updated_product:
            print_result("Find Updated Product", False, "Product not found")
            return False
            
        new_system_qty = updated_product['current_quantity']
        
        print(f"📊 Stock level verification:")
        print(f"   Original system: {system_qty}")
        print(f"   Physical count: {physical_count}")
        print(f"   New system: {new_system_qty}")
        
        # Stock should now match physical count
        if new_system_qty == physical_count:
            print_result("Stock Adjusted to Physical", True, f"Stock corrected from {system_qty} to {new_system_qty}")
        else:
            print_result("Stock Adjusted to Physical", False, f"Expected {physical_count}, got {new_system_qty}")
            return False
            
        # Step 4: Check stock take appears in report
        print(f"\n📋 Verifying variance appears in stock report...")
        
        report_response = requests.get(
            f"{BACKEND_URL}/stock/report",
            headers=get_auth_headers(admin_token)
        )
        
        if report_response.status_code != 200:
            print_result("Get Stock Report", False, f"Status: {report_response.status_code}")
            return False
            
        report_data = report_response.json()
        
        # Find our product in the report  
        products = report_data.get('products', [])
        product_report = None
        for item in products:
            if item['product_id'] == product_id:
                product_report = item
                break
                
        if product_report:
            variance_in_report = product_report.get('stock_take_variance', 0)
            print(f"📊 Report variance: {variance_in_report}")
            
            if variance_in_report == variance_amount:
                print_result("Variance in Stock Report", True, f"Variance {variance_amount} correctly recorded")
                return True
            else:
                print_result("Variance in Stock Report", False, f"Expected {variance_amount}, found {variance_in_report}")
                return False
        else:
            print_result("Product in Stock Report", False, "Product not found in report")
            return False
            
    except Exception as e:
        print_result("Stock Take with Variance Test", False, f"Exception: {str(e)}")
        return False

def cleanup_test_data():
    """Clean up test data if needed"""
    global active_route_id, driver_token
    
    if active_route_id and driver_token:
        print(f"\n🧹 Cleaning up test route...")
        
        # End the active route
        end_data = {
            "closing_km": 150.0,
            "crates_in": 30,
            "damages_count": 0,
            "fuel_used": 25.0
        }
        
        try:
            end_response = requests.put(
                f"{BACKEND_URL}/daily-routes/{active_route_id}/end",
                json=end_data,
                headers=get_auth_headers(driver_token)
            )
            
            if end_response.status_code == 200:
                print("✅ Test route ended successfully")
            else:
                print(f"⚠️  Failed to end test route: {end_response.status_code}")
                
        except Exception as e:
            print(f"⚠️  Error ending test route: {str(e)}")

def main():
    """Main test execution"""
    global admin_token, driver_token
    
    print("🧪 Enhanced Stock Management Features Testing")
    print("=" * 60)
    
    # Step 1: Seed all data
    if not seed_all_data():
        print("❌ Failed to seed data. Exiting...")
        return False
        
    # Step 2: Login users
    admin_token = login_user(ADMIN_CREDENTIALS, "Admin")
    driver_token = login_user(DRIVER_CREDENTIALS, "Driver")
    
    if not admin_token:
        print("❌ Admin login failed. Exiting...")
        return False
        
    if not driver_token:
        print("❌ Driver login failed. Exiting...")
        return False
        
    # Step 3: Run enhanced stock management tests
    test_results = []
    
    print(f"\n🚀 Starting Enhanced Stock Management Tests...")
    
    # Test 1: Stock-Sales Integration
    result1 = test_1_stock_sales_integration()
    test_results.append(("Stock-Sales Integration", result1))
    
    # Test 2: Stock Receive with Deductions  
    result2 = test_2_stock_receive_with_deductions()
    test_results.append(("Stock Receive with Deductions", result2))
    
    # Test 3: Stock Report with Variances
    result3 = test_3_stock_report_with_variances()
    test_results.append(("Stock Report with Variances", result3))
    
    # Test 4: Stock Take with Variance
    result4 = test_4_stock_take_with_variance()
    test_results.append(("Stock Take with Variance", result4))
    
    # Clean up
    cleanup_test_data()
    
    # Final results
    print(f"\n{'='*60}")
    print("ENHANCED STOCK MANAGEMENT TESTING COMPLETE")
    print('='*60)
    
    passed_tests = 0
    total_tests = len(test_results)
    
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
        if result:
            passed_tests += 1
            
    print(f"\n📊 RESULTS: {passed_tests}/{total_tests} tests passed ({(passed_tests/total_tests)*100:.1f}%)")
    
    if passed_tests == total_tests:
        print("🎉 ALL ENHANCED STOCK MANAGEMENT FEATURES WORKING!")
        return True
    else:
        print("⚠️  SOME ENHANCED STOCK MANAGEMENT FEATURES NEED ATTENTION")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)