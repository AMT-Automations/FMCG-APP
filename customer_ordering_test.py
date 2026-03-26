#!/usr/bin/env python3

import requests
import json
import sys
from datetime import datetime

# Backend URL - using the specific URL from review request
BASE_URL = "https://fmcg-delivery-app-2.preview.emergentagent.com/api"

class CustomerOrderingTester:
    def __init__(self):
        self.company_id = None
        self.admin_token = None
        self.customer_token = None
        self.admin_phone = None
        self.customer_phone = None
        self.route_id = None
        self.product1_id = None
        self.product2_id = None
        self.customer_id = None
        self.order_id = None
        self.test_results = []
        self.passed_tests = 0
        self.failed_tests = 0
        
    def log_result(self, test_name, success, message=""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = f"{status}: {test_name}"
        if message:
            result += f" - {message}"
        
        self.test_results.append(result)
        if success:
            self.passed_tests += 1
        else:
            self.failed_tests += 1
        print(result)
        
    def test_1_seed_demo_data(self):
        """Test 1: Seed demo data"""
        print("\n=== Test 1: Seed demo data ===")
        try:
            response = requests.post(f"{BASE_URL}/seed-all")
            if response.status_code == 200:
                self.log_result("Seed demo data", True, f"Status: {response.status_code}")
                return True
            else:
                self.log_result("Seed demo data", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_result("Seed demo data", False, f"Exception: {str(e)}")
            return False
    
    def test_2_setup_company(self):
        """Test 2: Setup a new company (distributor)"""
        print("\n=== Test 2: Setup a new company (distributor) ===")
        try:
            # Use timestamp to make phone numbers unique
            import time
            timestamp = str(int(time.time()))[-4:]  # Last 4 digits of timestamp
            
            data = {
                "company": {
                    "name": "Fresh Foods SA",
                    "contact_person": "James Moyo", 
                    "phone": f"071111{timestamp}",
                    "email": "info@freshfoods.co.za",
                    "address": "123 Market St"
                },
                "admin_name": "James Admin",
                "admin_phone": f"071111{timestamp}2", 
                "admin_pin": "1234"
            }
            
            response = requests.post(f"{BASE_URL}/companies/setup", json=data)
            if response.status_code == 200:
                result = response.json()
                self.company_id = result.get("company_id")
                self.admin_phone = data["admin_phone"]  # Store for later use
                self.log_result("Setup company", True, f"Company ID: {self.company_id}")
                return True
            else:
                self.log_result("Setup company", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_result("Setup company", False, f"Exception: {str(e)}")
            return False
    
    def test_3_login_admin(self):
        """Test 3: Login as company admin"""
        print("\n=== Test 3: Login as company admin ===")
        try:
            data = {
                "phone": self.admin_phone,  # Use the stored admin phone
                "pin": "1234"
            }
            
            response = requests.post(f"{BASE_URL}/auth/login", json=data)
            if response.status_code == 200:
                result = response.json()
                self.admin_token = result.get("token")
                user_role = result.get("user", {}).get("role")
                self.log_result("Login admin", True, f"Role: {user_role}, Token obtained")
                return True
            else:
                self.log_result("Login admin", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_result("Login admin", False, f"Exception: {str(e)}")
            return False
    
    def test_4_create_products(self):
        """Test 4: Create products for the company (admin)"""
        print("\n=== Test 4: Create products for the company ===")
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Product 1: White Bread
        try:
            data1 = {
                "name": "White Bread",
                "category": "Bakery",
                "unit_type": "loaf", 
                "price": 18.50
            }
            
            response = requests.post(f"{BASE_URL}/products", json=data1, headers=headers)
            if response.status_code == 200:
                result = response.json()
                self.product1_id = result.get("id")
                self.log_result("Create White Bread product", True, f"Product ID: {self.product1_id}")
            else:
                self.log_result("Create White Bread product", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Create White Bread product", False, f"Exception: {str(e)}")
            return False
        
        # Product 2: Full Cream Milk
        try:
            data2 = {
                "name": "Full Cream Milk",
                "category": "Dairy",
                "unit_type": "litre",
                "price": 22.00
            }
            
            response = requests.post(f"{BASE_URL}/products", json=data2, headers=headers)
            if response.status_code == 200:
                result = response.json()
                self.product2_id = result.get("id") 
                self.log_result("Create Full Cream Milk product", True, f"Product ID: {self.product2_id}")
                return True
            else:
                self.log_result("Create Full Cream Milk product", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Create Full Cream Milk product", False, f"Exception: {str(e)}")
            return False
    
    def test_5_create_route(self):
        """Test 5: Create a route for the company"""
        print("\n=== Test 5: Create a route for the company ===")
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            data = {
                "name": "Soweto Route",
                "description": "Soweto delivery area"
            }
            
            response = requests.post(f"{BASE_URL}/routes", json=data, headers=headers)
            if response.status_code == 200:
                result = response.json()
                self.route_id = result.get("id")
                self.log_result("Create route", True, f"Route ID: {self.route_id}")
                return True
            else:
                self.log_result("Create route", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_result("Create route", False, f"Exception: {str(e)}")
            return False
    
    def test_6_update_route_schedule(self):
        """Test 6: Update route delivery schedule"""
        print("\n=== Test 6: Update route delivery schedule ===")
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            data = {
                "delivery_days": ["Monday", "Thursday"],
                "cut_off_hours_before": 16,
                "cut_off_time": "16:00"
            }
            
            response = requests.put(f"{BASE_URL}/routes/{self.route_id}/schedule", json=data, headers=headers)
            if response.status_code == 200:
                self.log_result("Update route schedule", True, "Schedule updated successfully")
                return True
            else:
                self.log_result("Update route schedule", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_result("Update route schedule", False, f"Exception: {str(e)}")
            return False
    
    def test_7_get_route_schedule(self):
        """Test 7: Get route schedule"""
        print("\n=== Test 7: Get route schedule ===")
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.get(f"{BASE_URL}/routes/{self.route_id}/schedule", headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                delivery_days = result.get("delivery_days", [])
                next_delivery = result.get("next_delivery")
                self.log_result("Get route schedule", True, f"Delivery days: {delivery_days}, Next delivery: {next_delivery}")
                return True
            else:
                self.log_result("Get route schedule", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_result("Get route schedule", False, f"Exception: {str(e)}")
            return False
    
    def test_8_list_companies_public(self):
        """Test 8: List companies (public)"""
        print("\n=== Test 8: List companies (public) ===")
        try:
            response = requests.get(f"{BASE_URL}/companies/list")
            
            if response.status_code == 200:
                result = response.json()
                companies = result if isinstance(result, list) else []
                
                # Check if "Fresh Foods SA" appears in list
                company_names = [comp.get("name", "") for comp in companies]
                if "Fresh Foods SA" in company_names:
                    self.log_result("List companies public", True, f"Found Fresh Foods SA in {len(companies)} companies")
                    return True
                else:
                    self.log_result("List companies public", False, f"Fresh Foods SA not found in companies: {company_names}")
                    return False
            else:
                self.log_result("List companies public", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_result("List companies public", False, f"Exception: {str(e)}")
            return False
    
    def test_9_list_company_routes_public(self):
        """Test 9: List company routes (public)"""
        print("\n=== Test 9: List company routes (public) ===")
        try:
            response = requests.get(f"{BASE_URL}/companies/{self.company_id}/routes")
            
            if response.status_code == 200:
                result = response.json()
                routes = result if isinstance(result, list) else []
                
                # Check if "Soweto Route" appears
                route_names = [route.get("name", "") for route in routes]
                if "Soweto Route" in route_names:
                    self.log_result("List company routes public", True, f"Found Soweto Route in {len(routes)} routes")
                    return True
                else:
                    self.log_result("List company routes public", False, f"Soweto Route not found in routes: {route_names}")
                    return False
            else:
                self.log_result("List company routes public", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_result("List company routes public", False, f"Exception: {str(e)}")
            return False
    
    def test_10_list_company_products_public(self):
        """Test 10: List company products (public)"""
        print("\n=== Test 10: List company products (public) ===")
        try:
            response = requests.get(f"{BASE_URL}/companies/{self.company_id}/products")
            
            if response.status_code == 200:
                result = response.json()
                products = result if isinstance(result, list) else []
                
                # Check if our products are visible
                product_names = [prod.get("name", "") for prod in products]
                has_bread = "White Bread" in product_names
                has_milk = "Full Cream Milk" in product_names
                
                if has_bread and has_milk:
                    self.log_result("List company products public", True, f"Found both products in {len(products)} products")
                    return True
                else:
                    self.log_result("List company products public", False, f"Missing products. Found: {product_names}")
                    return False
            else:
                self.log_result("List company products public", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_result("List company products public", False, f"Exception: {str(e)}")
            return False
    
    def test_11_register_customer(self):
        """Test 11: Register a customer"""
        print("\n=== Test 11: Register a customer ===")
        try:
            # Use timestamp for unique customer phone
            import time
            timestamp = str(int(time.time()))[-4:]
            self.customer_phone = f"082111{timestamp}"
            
            data = {
                "business_name": "Sipho's Tuck Shop",
                "contact_person": "Sipho Ndlovu",
                "phone": self.customer_phone,
                "pin": "5678",
                "delivery_address": "45 Vilakazi St, Soweto",
                "company_id": self.company_id,
                "route_id": self.route_id
            }
            
            response = requests.post(f"{BASE_URL}/auth/register-customer", json=data)
            if response.status_code == 200:
                result = response.json()
                user_id = result.get("user_id")
                company_name = result.get("company_name")
                route_name = result.get("route_name")
                self.log_result("Register customer", True, f"User ID: {user_id}, Company: {company_name}, Route: {route_name}")
                return True
            else:
                self.log_result("Register customer", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_result("Register customer", False, f"Exception: {str(e)}")
            return False
    
    def test_12_login_customer(self):
        """Test 12: Login as customer"""
        print("\n=== Test 12: Login as customer ===")
        try:
            data = {
                "phone": self.customer_phone,  # Use stored customer phone
                "pin": "5678"
            }
            
            response = requests.post(f"{BASE_URL}/auth/login", json=data)
            if response.status_code == 200:
                result = response.json()
                self.customer_token = result.get("token")
                user = result.get("user", {})
                user_role = user.get("role")
                customer_profile = user.get("customer_profile")
                
                if user_role == "customer" and customer_profile:
                    self.log_result("Login customer", True, f"Role: {user_role}, Customer profile exists")
                    return True
                else:
                    self.log_result("Login customer", False, f"Role: {user_role}, Customer profile: {customer_profile}")
                    return False
            else:
                self.log_result("Login customer", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_result("Login customer", False, f"Exception: {str(e)}")
            return False
    
    def test_13_get_customer_products(self):
        """Test 13: Get customer products"""
        print("\n=== Test 13: Get customer products ===")
        try:
            headers = {"Authorization": f"Bearer {self.customer_token}"}
            response = requests.get(f"{BASE_URL}/customer/products", headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                products = result if isinstance(result, list) else []
                
                # Check if Fresh Foods SA products are returned
                product_names = [prod.get("name", "") for prod in products]
                has_bread = "White Bread" in product_names
                has_milk = "Full Cream Milk" in product_names
                
                if has_bread and has_milk:
                    self.log_result("Get customer products", True, f"Found Fresh Foods SA products: {product_names}")
                    return True
                else:
                    self.log_result("Get customer products", False, f"Missing Fresh Foods SA products: {product_names}")
                    return False
            else:
                self.log_result("Get customer products", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_result("Get customer products", False, f"Exception: {str(e)}")
            return False
    
    def test_14_get_customer_delivery_info(self):
        """Test 14: Get customer delivery info"""
        print("\n=== Test 14: Get customer delivery info ===")
        try:
            headers = {"Authorization": f"Bearer {self.customer_token}"}
            response = requests.get(f"{BASE_URL}/customer/delivery-info", headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                company_name = result.get("company_name")
                route_name = result.get("route_name")
                schedule = result.get("schedule", {})
                next_delivery = result.get("next_delivery")
                
                self.log_result("Get customer delivery info", True, 
                    f"Company: {company_name}, Route: {route_name}, Next delivery: {next_delivery}")
                return True
            else:
                self.log_result("Get customer delivery info", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_result("Get customer delivery info", False, f"Exception: {str(e)}")
            return False
    
    def test_15_create_order(self):
        """Test 15: Create an order"""
        print("\n=== Test 15: Create an order ===")
        try:
            headers = {"Authorization": f"Bearer {self.customer_token}"}
            data = {
                "company_id": self.company_id,
                "items": [
                    {
                        "product_id": self.product1_id,
                        "product_name": "White Bread", 
                        "quantity": 5,
                        "unit_price": 18.50
                    },
                    {
                        "product_id": self.product2_id,
                        "product_name": "Full Cream Milk",
                        "quantity": 3, 
                        "unit_price": 22.00
                    }
                ],
                "notes": "Please deliver before 10am"
            }
            
            response = requests.post(f"{BASE_URL}/orders", json=data, headers=headers)
            if response.status_code == 200:
                result = response.json()
                order_number = result.get("order_number")
                total_amount = result.get("total_amount")
                status = result.get("status")
                self.order_id = result.get("id")
                
                # Verify order number format: COMP-DATE-SEQ
                expected_total = 5 * 18.50 + 3 * 22.00  # 158.50
                
                if order_number and order_number.count("-") == 2:
                    if abs(total_amount - expected_total) < 0.01:
                        if status == "pending":
                            self.log_result("Create order", True, 
                                f"Order: {order_number}, Total: R{total_amount}, Status: {status}")
                            return True
                        else:
                            self.log_result("Create order", False, f"Wrong status: {status}")
                            return False
                    else:
                        self.log_result("Create order", False, f"Wrong total: {total_amount}, expected: {expected_total}")
                        return False
                else:
                    self.log_result("Create order", False, f"Wrong order number format: {order_number}")
                    return False
            else:
                self.log_result("Create order", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_result("Create order", False, f"Exception: {str(e)}")
            return False
    
    def test_16_get_orders_customer(self):
        """Test 16: Get orders as customer"""
        print("\n=== Test 16: Get orders as customer ===")
        try:
            headers = {"Authorization": f"Bearer {self.customer_token}"}
            response = requests.get(f"{BASE_URL}/orders", headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                orders = result if isinstance(result, list) else []
                
                if len(orders) > 0:
                    order = orders[0]
                    if order.get("id") == self.order_id:
                        self.log_result("Get orders as customer", True, f"Found {len(orders)} orders including our order")
                        return True
                    else:
                        self.log_result("Get orders as customer", False, f"Our order not found in {len(orders)} orders")
                        return False
                else:
                    self.log_result("Get orders as customer", False, "No orders found")
                    return False
            else:
                self.log_result("Get orders as customer", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_result("Get orders as customer", False, f"Exception: {str(e)}")
            return False
    
    def test_17_get_single_order(self):
        """Test 17: Get single order"""
        print("\n=== Test 17: Get single order ===")
        try:
            headers = {"Authorization": f"Bearer {self.customer_token}"}
            response = requests.get(f"{BASE_URL}/orders/{self.order_id}", headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                order_id = result.get("id")
                order_number = result.get("order_number")
                total_amount = result.get("total_amount")
                items = result.get("items", [])
                
                if order_id == self.order_id and len(items) == 2:
                    self.log_result("Get single order", True, 
                        f"Order: {order_number}, Total: R{total_amount}, Items: {len(items)}")
                    return True
                else:
                    self.log_result("Get single order", False, f"Order data mismatch")
                    return False
            else:
                self.log_result("Get single order", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_result("Get single order", False, f"Exception: {str(e)}")
            return False
    
    def test_18_get_orders_admin(self):
        """Test 18: Get orders as distributor admin"""
        print("\n=== Test 18: Get orders as distributor admin ===")
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.get(f"{BASE_URL}/orders", headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                orders = result if isinstance(result, list) else []
                
                # Check if customer order appears
                order_ids = [order.get("id") for order in orders]
                if self.order_id in order_ids:
                    self.log_result("Get orders as admin", True, f"Found customer order in {len(orders)} orders")
                    return True
                else:
                    self.log_result("Get orders as admin", False, f"Customer order not found in {len(orders)} orders")
                    return False
            else:
                self.log_result("Get orders as admin", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_result("Get orders as admin", False, f"Exception: {str(e)}")
            return False
    
    def test_19_get_order_dashboard(self):
        """Test 19: Get order dashboard (admin)"""
        print("\n=== Test 19: Get order dashboard (admin) ===")
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.get(f"{BASE_URL}/orders/dashboard/summary", headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                pending_count = result.get("pending", 0)  # API returns "pending", not "pending_count"
                total_value = result.get("total_value", 0)
                
                if pending_count > 0:
                    self.log_result("Get order dashboard", True, f"Pending: {pending_count}, Total value: R{total_value}")
                    return True
                else:
                    self.log_result("Get order dashboard", False, f"No pending orders found: {result}")
                    return False
            else:
                self.log_result("Get order dashboard", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_result("Get order dashboard", False, f"Exception: {str(e)}")
            return False
    
    def test_20_update_order_status_admin(self):
        """Test 20: Update order status (admin confirms order)"""
        print("\n=== Test 20: Update order status (admin confirms order) ===")
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            data = {"status": "confirmed"}
            
            response = requests.put(f"{BASE_URL}/orders/{self.order_id}/status", json=data, headers=headers)
            if response.status_code == 200:
                self.log_result("Update order status admin", True, "Order confirmed successfully")
                return True
            else:
                self.log_result("Update order status admin", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_result("Update order status admin", False, f"Exception: {str(e)}")
            return False
    
    def test_21_verify_status_changed(self):
        """Test 21: Verify status changed"""
        print("\n=== Test 21: Verify status changed ===")
        try:
            headers = {"Authorization": f"Bearer {self.customer_token}"}
            response = requests.get(f"{BASE_URL}/orders/{self.order_id}", headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                status = result.get("status")
                
                if status == "confirmed":
                    self.log_result("Verify status changed", True, f"Status is now: {status}")
                    return True
                else:
                    self.log_result("Verify status changed", False, f"Status is: {status}, expected: confirmed")
                    return False
            else:
                self.log_result("Verify status changed", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_result("Verify status changed", False, f"Exception: {str(e)}")
            return False
    
    def test_22_cancel_order_customer_fail(self):
        """Test 22: Cancel order as customer (should fail - not pending)"""
        print("\n=== Test 22: Cancel order as customer (should fail - not pending) ===")
        try:
            headers = {"Authorization": f"Bearer {self.customer_token}"}
            data = {"status": "cancelled"}
            
            response = requests.put(f"{BASE_URL}/orders/{self.order_id}/status", json=data, headers=headers)
            
            # This should fail since order is confirmed, not pending
            if response.status_code in [400, 403]:
                self.log_result("Cancel order customer fail", True, "Correctly rejected cancellation of confirmed order")
                return True
            else:
                self.log_result("Cancel order customer fail", False, 
                    f"Should have failed but got status: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Cancel order customer fail", False, f"Exception: {str(e)}")
            return False
    
    def test_23_duplicate_order_prevention(self):
        """Test 23: Duplicate order prevention"""
        print("\n=== Test 23: Duplicate order prevention ===")
        try:
            headers = {"Authorization": f"Bearer {self.customer_token}"}
            data = {
                "company_id": self.company_id,
                "items": [
                    {
                        "product_id": self.product1_id,
                        "product_name": "White Bread", 
                        "quantity": 5,
                        "unit_price": 18.50
                    }
                ],
                "notes": "Duplicate order test"
            }
            
            response = requests.post(f"{BASE_URL}/orders", json=data, headers=headers)
            
            # This should fail due to existing active order
            if response.status_code in [400, 409]:
                error_msg = response.json().get("detail", response.text)
                if "active order" in error_msg.lower() or "existing" in error_msg.lower():
                    self.log_result("Duplicate order prevention", True, "Correctly prevented duplicate order")
                    return True
                else:
                    self.log_result("Duplicate order prevention", False, f"Wrong error message: {error_msg}")
                    return False
            else:
                self.log_result("Duplicate order prevention", False, 
                    f"Should have failed but got status: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Duplicate order prevention", False, f"Exception: {str(e)}")
            return False
    
    def test_24_data_isolation(self):
        """Test 24: Customer can't see other company data"""
        print("\n=== Test 24: Customer can't see other company data ===")
        try:
            # Use a different timestamp for second company to avoid conflicts
            import time
            timestamp2 = str(int(time.time()))[-3:] + "9"  # Different timestamp
            
            # Create another company
            company_data = {
                "company": {
                    "name": "Beta Foods",
                    "contact_person": "Beta Admin", 
                    "phone": f"072222{timestamp2}",
                    "email": "admin@betafoods.co.za",
                    "address": "456 Beta St"
                },
                "admin_name": "Beta Manager",
                "admin_phone": f"072222{timestamp2}2", 
                "admin_pin": "4321"
            }
            
            response = requests.post(f"{BASE_URL}/companies/setup", json=company_data)
            if response.status_code != 200:
                self.log_result("Data isolation - setup second company", False, 
                    f"Failed to setup second company: {response.status_code} - {response.text}")
                return False
            
            second_company_id = response.json().get("company_id")
            
            # Login as second company admin
            login_data = {
                "phone": company_data["admin_phone"],
                "pin": "4321"
            }
            
            response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
            if response.status_code != 200:
                self.log_result("Data isolation - login second admin", False, 
                    f"Failed to login second admin: {response.status_code}")
                return False
            
            second_admin_token = response.json().get("token")
            
            # Check that second company admin can't see first company's orders
            headers = {"Authorization": f"Bearer {second_admin_token}"}
            response = requests.get(f"{BASE_URL}/orders", headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                orders = result if isinstance(result, list) else []
                
                # Should not see first company's order
                order_ids = [order.get("id") for order in orders]
                if self.order_id not in order_ids:
                    self.log_result("Data isolation", True, 
                        f"Second company correctly can't see first company's orders (found {len(order_ids)} orders)")
                    return True
                else:
                    self.log_result("Data isolation", False, 
                        "Second company can see first company's orders - DATA LEAK!")
                    return False
            else:
                self.log_result("Data isolation - get orders", False, 
                    f"Failed to get orders for second company: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Data isolation", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Customer Ordering System Backend API Testing")
        print(f"Backend URL: {BASE_URL}")
        print("=" * 80)
        
        tests = [
            self.test_1_seed_demo_data,
            self.test_2_setup_company,
            self.test_3_login_admin,
            self.test_4_create_products,
            self.test_5_create_route,
            self.test_6_update_route_schedule,
            self.test_7_get_route_schedule,
            self.test_8_list_companies_public,
            self.test_9_list_company_routes_public,
            self.test_10_list_company_products_public,
            self.test_11_register_customer,
            self.test_12_login_customer,
            self.test_13_get_customer_products,
            self.test_14_get_customer_delivery_info,
            self.test_15_create_order,
            self.test_16_get_orders_customer,
            self.test_17_get_single_order,
            self.test_18_get_orders_admin,
            self.test_19_get_order_dashboard,
            self.test_20_update_order_status_admin,
            self.test_21_verify_status_changed,
            self.test_22_cancel_order_customer_fail,
            self.test_23_duplicate_order_prevention,
            self.test_24_data_isolation
        ]
        
        for i, test_func in enumerate(tests, 1):
            # Stop if critical early tests fail
            if i <= 4 and self.failed_tests > 0:
                print(f"\n❌ Stopping tests - early critical test failed")
                break
                
            if not test_func():
                # Continue with next test even if current fails
                continue
        
        # Summary
        print("\n" + "=" * 80)
        print("🎯 CUSTOMER ORDERING SYSTEM BACKEND API TEST RESULTS")
        print("=" * 80)
        
        total_tests = self.passed_tests + self.failed_tests
        success_rate = (self.passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        print(f"✅ PASSED: {self.passed_tests}")
        print(f"❌ FAILED: {self.failed_tests}")
        print(f"📊 SUCCESS RATE: {success_rate:.1f}% ({self.passed_tests}/{total_tests})")
        
        if self.failed_tests == 0:
            print("\n🎉 ALL TESTS PASSED - Customer Ordering System Backend APIs are working perfectly!")
            return True
        else:
            print(f"\n⚠️  {self.failed_tests} TESTS FAILED - See detailed results above")
            
            # Show failed tests
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if "❌ FAIL" in result:
                    print(f"   {result}")
            
            return False

def main():
    tester = CustomerOrderingTester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()