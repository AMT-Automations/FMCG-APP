#!/usr/bin/env python3
"""
Mzansi FMCG Tracker - Full End-to-End Integration Test Suite
Tests complete customer ordering system flow as per review request
"""

import requests
import json
import sys
from datetime import datetime
import time

# Backend URL from review request
BACKEND_URL = "https://fmcg-delivery-app-2.preview.emergentagent.com/api"

class IntegrationTester:
    def __init__(self):
        self.results = []
        self.company_id = None
        self.admin_token = None
        self.customer_token = None
        self.route_id = None
        self.product_ids = {}
        self.order_id = None
        
        # Generate unique phone numbers using timestamp
        timestamp = str(int(time.time()))[-4:]  # Last 4 digits of timestamp
        self.admin_phone = f"079999{timestamp}"
        self.customer_phone = f"081111{timestamp}"
        self.other_admin_phone = f"088888{timestamp}"
        
    def log_result(self, test_name, status, details):
        """Log test results"""
        result = {
            "test": test_name,
            "status": status,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.results.append(result)
        status_icon = "✅" if status == "PASS" else "❌"
        print(f"{status_icon} {test_name}: {details}")
        
    def make_request(self, method, endpoint, data=None, headers=None):
        """Make HTTP request with error handling"""
        url = f"{BACKEND_URL}{endpoint}"
        try:
            if headers is None:
                headers = {"Content-Type": "application/json"}
            
            if method == "GET":
                response = requests.get(url, headers=headers, timeout=30)
            elif method == "POST":
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == "PUT":
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == "DELETE":
                response = requests.delete(url, headers=headers, timeout=30)
            
            return response
        except Exception as e:
            return f"ERROR: {str(e)}"

    def test_phase_1_setup_company(self):
        """Phase 1: Setup Fresh Company"""
        print("\n=== Phase 1: Setup Fresh Company ===")
        
        company_data = {
            "company": {
                "name": "Mzansi Goods",
                "contact_person": "Test Admin",
                "phone": self.admin_phone,
                "email": "admin@mzansigoods.co.za",
                "address": "123 Distribution Street, Johannesburg"
            },
            "admin_name": "Test Admin",
            "admin_phone": self.admin_phone,
            "admin_pin": "9999"
        }
        
        response = self.make_request("POST", "/companies/setup", company_data)
        if isinstance(response, str):
            self.log_result("Phase 1: Company Setup", "FAIL", f"Request failed: {response}")
            return False
            
        if response.status_code == 200:
            data = response.json()
            if "company_id" in data and "company_name" in data:
                self.company_id = data["company_id"]
                if data["company_name"] == "Mzansi Goods":
                    self.log_result("Phase 1: Company Setup", "PASS", f"Mzansi Goods created with ID: {self.company_id}")
                    return True
                else:
                    self.log_result("Phase 1: Company Setup", "FAIL", f"Wrong company name: {data['company_name']}")
                    return False
            else:
                self.log_result("Phase 1: Company Setup", "FAIL", f"Missing company_id or company_name: {data}")
                return False
        else:
            self.log_result("Phase 1: Company Setup", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False

    def test_phase_1_admin_login(self):
        """Phase 1: Admin Login and Save Token"""
        print("\n=== Phase 1: Admin Login ===")
        
        login_data = {
            "phone": self.admin_phone,
            "pin": "9999"
        }
        
        response = self.make_request("POST", "/auth/login", login_data)
        if isinstance(response, str):
            self.log_result("Phase 1: Admin Login", "FAIL", f"Request failed: {response}")
            return False
            
        if response.status_code == 200:
            data = response.json()
            if "token" in data and "company" in data:
                self.admin_token = data["token"]
                company_info = data["company"]
                if company_info and company_info.get("name") == "Mzansi Goods":
                    self.log_result("Phase 1: Admin Login", "PASS", f"Admin login successful, company: {company_info['name']}")
                    return True
                else:
                    self.log_result("Phase 1: Admin Login", "FAIL", f"Company info incorrect: {company_info}")
                    return False
            else:
                self.log_result("Phase 1: Admin Login", "FAIL", f"Missing token or company: {data}")
                return False
        else:
            self.log_result("Phase 1: Admin Login", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False

    def test_phase_2_create_products(self):
        """Phase 2: Admin Creates 3 Products"""
        print("\n=== Phase 2: Create Products ===")
        
        if not self.admin_token:
            self.log_result("Phase 2: Create Products", "FAIL", "No admin token available")
            return False
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.admin_token}"
        }
        
        products = [
            {"name": "Sunflower Oil 750ml", "category": "Cooking", "unit_type": "bottle", "price": 45.00},
            {"name": "Maize Meal 5kg", "category": "Staples", "unit_type": "bag", "price": 55.00},
            {"name": "Sugar 2kg", "category": "Staples", "unit_type": "bag", "price": 38.50}
        ]
        
        created_count = 0
        for product in products:
            response = self.make_request("POST", "/products", product, headers)
            if isinstance(response, str):
                self.log_result(f"Create Product: {product['name']}", "FAIL", f"Request failed: {response}")
                continue
                
            if response.status_code == 200:
                data = response.json()
                if "id" in data:
                    self.product_ids[product["name"]] = data["id"]
                    created_count += 1
                    self.log_result(f"Create Product: {product['name']}", "PASS", f"Product created with ID: {data['id']}")
                else:
                    self.log_result(f"Create Product: {product['name']}", "FAIL", f"No ID in response: {data}")
            else:
                self.log_result(f"Create Product: {product['name']}", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
        
        if created_count == 3:
            self.log_result("Phase 2: Create Products", "PASS", f"All 3 products created successfully")
            return True
        else:
            self.log_result("Phase 2: Create Products", "FAIL", f"Only {created_count}/3 products created")
            return False

    def test_phase_2_create_route(self):
        """Phase 2: Create Route"""
        print("\n=== Phase 2: Create Route ===")
        
        if not self.admin_token:
            self.log_result("Phase 2: Create Route", "FAIL", "No admin token available")
            return False
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.admin_token}"
        }
        
        route_data = {
            "name": "Joburg CBD",
            "description": "Central business district deliveries"
        }
        
        response = self.make_request("POST", "/routes", route_data, headers)
        if isinstance(response, str):
            self.log_result("Phase 2: Create Route", "FAIL", f"Request failed: {response}")
            return False
            
        if response.status_code == 200:
            data = response.json()
            if "id" in data and data.get("name") == "Joburg CBD":
                self.route_id = data["id"]
                self.log_result("Phase 2: Create Route", "PASS", f"Route 'Joburg CBD' created with ID: {self.route_id}")
                return True
            else:
                self.log_result("Phase 2: Create Route", "FAIL", f"Route creation failed: {data}")
                return False
        else:
            self.log_result("Phase 2: Create Route", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False

    def test_phase_2_set_delivery_schedule(self):
        """Phase 2: Set Delivery Schedule"""
        print("\n=== Phase 2: Set Delivery Schedule ===")
        
        if not self.admin_token or not self.route_id:
            self.log_result("Phase 2: Set Schedule", "FAIL", "No admin token or route ID available")
            return False
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.admin_token}"
        }
        
        schedule_data = {
            "delivery_days": ["Tuesday", "Thursday"],
            "cut_off_time": "14:00",
            "cut_off_hours_before": 14
        }
        
        response = self.make_request("PUT", f"/routes/{self.route_id}/schedule", schedule_data, headers)
        if isinstance(response, str):
            self.log_result("Phase 2: Set Schedule", "FAIL", f"Request failed: {response}")
            return False
            
        if response.status_code == 200:
            data = response.json()
            # Check if we got a success message or actual schedule data
            if "message" in data and "updated" in data["message"].lower():
                self.log_result("Phase 2: Set Schedule", "PASS", f"Schedule updated: {data['message']}")
                return True
            elif "delivery_days" in data and "Tuesday" in data["delivery_days"] and "Thursday" in data["delivery_days"]:
                self.log_result("Phase 2: Set Schedule", "PASS", f"Schedule set: {data['delivery_days']}, cutoff: {data.get('cut_off_time')}")
                return True
            else:
                self.log_result("Phase 2: Set Schedule", "FAIL", f"Schedule not set properly: {data}")
                return False
        else:
            self.log_result("Phase 2: Set Schedule", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False

    def test_phase_3_public_apis(self):
        """Phase 3: Verify Public APIs"""
        print("\n=== Phase 3: Verify Public APIs ===")
        
        if not self.company_id or not self.route_id:
            self.log_result("Phase 3: Public APIs", "FAIL", "No company or route ID available")
            return False
        
        # Test 1: GET /companies/list
        response = self.make_request("GET", "/companies/list")
        company_found = False
        if isinstance(response, str):
            self.log_result("Public API: Companies List", "FAIL", f"Request failed: {response}")
        elif response.status_code == 200:
            companies = response.json()
            company_found = any(c.get("name") == "Mzansi Goods" for c in companies)
            if company_found:
                self.log_result("Public API: Companies List", "PASS", f"Mzansi Goods found in list of {len(companies)} companies")
            else:
                self.log_result("Public API: Companies List", "FAIL", f"Mzansi Goods not found in: {[c.get('name') for c in companies]}")
        else:
            self.log_result("Public API: Companies List", "FAIL", f"Status: {response.status_code}")

        # Test 2: GET /companies/{company_id}/routes
        response = self.make_request("GET", f"/companies/{self.company_id}/routes")
        route_found = False
        if isinstance(response, str):
            self.log_result("Public API: Company Routes", "FAIL", f"Request failed: {response}")
        elif response.status_code == 200:
            routes = response.json()
            route_found = any(r.get("name") == "Joburg CBD" for r in routes)
            if route_found:
                route_data = next(r for r in routes if r.get("name") == "Joburg CBD")
                has_delivery_days = "delivery_days" in route_data
                self.log_result("Public API: Company Routes", "PASS", f"Joburg CBD found with delivery_days: {has_delivery_days}")
            else:
                self.log_result("Public API: Company Routes", "FAIL", f"Joburg CBD not found in: {[r.get('name') for r in routes]}")
        else:
            self.log_result("Public API: Company Routes", "FAIL", f"Status: {response.status_code}")

        # Test 3: GET /companies/{company_id}/products
        response = self.make_request("GET", f"/companies/{self.company_id}/products")
        products_found = False
        if isinstance(response, str):
            self.log_result("Public API: Company Products", "FAIL", f"Request failed: {response}")
        elif response.status_code == 200:
            products = response.json()
            expected_products = ["Sunflower Oil 750ml", "Maize Meal 5kg", "Sugar 2kg"]
            found_products = [p.get("name") for p in products]
            products_found = all(name in found_products for name in expected_products)
            if products_found and len(products) == 3:
                self.log_result("Public API: Company Products", "PASS", f"All 3 products visible: {found_products}")
            else:
                self.log_result("Public API: Company Products", "FAIL", f"Expected 3 products, found: {found_products}")
        else:
            self.log_result("Public API: Company Products", "FAIL", f"Status: {response.status_code}")

        if company_found and route_found and products_found:
            self.log_result("Phase 3: Public APIs", "PASS", "All public APIs working correctly")
            return True
        else:
            self.log_result("Phase 3: Public APIs", "FAIL", "Some public APIs failed")
            return False

    def test_phase_4_customer_registration(self):
        """Phase 4: Customer Registration & Login"""
        print("\n=== Phase 4: Customer Registration ===")
        
        if not self.company_id or not self.route_id:
            self.log_result("Phase 4: Customer Registration", "FAIL", "No company or route ID available")
            return False
        
        # Customer Registration
        customer_data = {
            "business_name": "Township Spaza",
            "contact_person": "Thabo Mokoena",
            "phone": self.customer_phone,
            "pin": "4321",
            "company_id": self.company_id,
            "route_id": self.route_id
        }
        
        response = self.make_request("POST", "/auth/register-customer", customer_data)
        if isinstance(response, str):
            self.log_result("Customer Registration", "FAIL", f"Request failed: {response}")
            return False
            
        if response.status_code == 200:
            data = response.json()
            self.log_result("Customer Registration", "PASS", f"Customer registered: {data.get('message', 'Success')}")
        else:
            self.log_result("Customer Registration", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False

        # Customer Login
        login_data = {
            "phone": self.customer_phone,
            "pin": "4321"
        }
        
        response = self.make_request("POST", "/auth/login", login_data)
        if isinstance(response, str):
            self.log_result("Customer Login", "FAIL", f"Request failed: {response}")
            return False
            
        if response.status_code == 200:
            data = response.json()
            if "token" in data and "user" in data:
                self.customer_token = data["token"]
                user = data.get("user", {})
                role = user.get("role")
                customer_profile = user.get("customer_profile", {})
                business_name = customer_profile.get("business_name")
                route_name = customer_profile.get("route_name")
                
                if role == "customer" and business_name == "Township Spaza" and route_name == "Joburg CBD":
                    self.log_result("Customer Login", "PASS", f"Customer login: role={role}, business={business_name}, route={route_name}")
                    return True
                else:
                    self.log_result("Customer Login", "FAIL", f"Customer profile incorrect: role={role}, business={business_name}, route={route_name}")
                    return False
            else:
                self.log_result("Customer Login", "FAIL", f"Login response incorrect: {data}")
                return False
        else:
            self.log_result("Customer Login", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False

    def test_phase_5_customer_views_data(self):
        """Phase 5: Customer Views Data (Integration Check)"""
        print("\n=== Phase 5: Customer Views Data ===")
        
        if not self.customer_token:
            self.log_result("Phase 5: Customer Views", "FAIL", "No customer token available")
            return False
        
        headers = {
            "Authorization": f"Bearer {self.customer_token}"
        }
        
        # Test 1: GET /customer/products
        response = self.make_request("GET", "/customer/products", None, headers)
        products_ok = False
        if isinstance(response, str):
            self.log_result("Customer Products View", "FAIL", f"Request failed: {response}")
        elif response.status_code == 200:
            products = response.json()
            expected_products = ["Sunflower Oil 750ml", "Maize Meal 5kg", "Sugar 2kg"]
            found_products = [p.get("name") for p in products]
            products_ok = all(name in found_products for name in expected_products) and len(products) == 3
            if products_ok:
                self.log_result("Customer Products View", "PASS", f"Customer sees same 3 products: {found_products}")
            else:
                self.log_result("Customer Products View", "FAIL", f"Products mismatch: {found_products}")
        else:
            self.log_result("Customer Products View", "FAIL", f"Status: {response.status_code}")

        # Test 2: GET /customer/delivery-info
        response = self.make_request("GET", "/customer/delivery-info", None, headers)
        delivery_ok = False
        if isinstance(response, str):
            self.log_result("Customer Delivery Info", "FAIL", f"Request failed: {response}")
        elif response.status_code == 200:
            data = response.json()
            company_name = data.get("company_name")
            route_name = data.get("route_name") 
            schedule = data.get("schedule", {})
            delivery_days = schedule.get("delivery_days", [])
            profile = data.get("profile", {})
            business_name = profile.get("business_name")
            
            checks = [
                company_name == "Mzansi Goods",
                route_name == "Joburg CBD", 
                "Tuesday" in delivery_days and "Thursday" in delivery_days,
                business_name == "Township Spaza"
            ]
            
            delivery_ok = all(checks)
            if delivery_ok:
                self.log_result("Customer Delivery Info", "PASS", f"All info correct: company={company_name}, route={route_name}, days={delivery_days}, business={business_name}")
            else:
                self.log_result("Customer Delivery Info", "FAIL", f"Info incorrect: {data}")
        else:
            self.log_result("Customer Delivery Info", "FAIL", f"Status: {response.status_code}")

        if products_ok and delivery_ok:
            self.log_result("Phase 5: Customer Views", "PASS", "Customer can view integrated data correctly")
            return True
        else:
            self.log_result("Phase 5: Customer Views", "FAIL", "Customer data view issues")
            return False

    def test_phase_6_customer_order(self):
        """Phase 6: Customer Places Order"""
        print("\n=== Phase 6: Customer Places Order ===")
        
        if not self.customer_token:
            self.log_result("Phase 6: Customer Order", "FAIL", "No customer token available")
            return False
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.customer_token}"
        }
        
        # Get product IDs and prices
        sunflower_oil_id = self.product_ids.get("Sunflower Oil 750ml")
        maize_meal_id = self.product_ids.get("Maize Meal 5kg")
        
        if not sunflower_oil_id or not maize_meal_id:
            self.log_result("Phase 6: Customer Order", "FAIL", "Product IDs not available")
            return False
        
        order_data = {
            "company_id": self.company_id,
            "items": [
                {
                    "product_id": sunflower_oil_id,
                    "product_name": "Sunflower Oil 750ml",
                    "quantity": 10,
                    "unit_price": 45.00
                },
                {
                    "product_id": maize_meal_id,
                    "product_name": "Maize Meal 5kg",
                    "quantity": 5,
                    "unit_price": 55.00
                }
            ]
        }
        
        response = self.make_request("POST", "/orders", order_data, headers)
        if isinstance(response, str):
            self.log_result("Phase 6: Customer Order", "FAIL", f"Request failed: {response}")
            return False
            
        if response.status_code == 200:
            data = response.json()
            order_number = data.get("order_number")
            total_amount = data.get("total_amount")
            status = data.get("status")
            order_id = data.get("id")
            
            expected_total = 10 * 45.00 + 5 * 55.00  # 450 + 275 = 725.00
            
            checks = [
                order_number is not None and len(order_number) > 0,
                total_amount == expected_total,
                status == "pending",
                order_id is not None
            ]
            
            if all(checks):
                self.order_id = order_id
                self.log_result("Phase 6: Customer Order", "PASS", f"Order created: {order_number}, total=R{total_amount}, status={status}")
                return True
            else:
                self.log_result("Phase 6: Customer Order", "FAIL", f"Order data incorrect: number={order_number}, total={total_amount}, status={status}")
                return False
        else:
            self.log_result("Phase 6: Customer Order", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False

    def test_phase_7_admin_manages_order(self):
        """Phase 7: Admin Manages Order (Integration Check)"""
        print("\n=== Phase 7: Admin Manages Order ===")
        
        if not self.admin_token or not self.order_id:
            self.log_result("Phase 7: Admin Manages", "FAIL", "No admin token or order ID available")
            return False
        
        headers = {
            "Content-Type": "application/json", 
            "Authorization": f"Bearer {self.admin_token}"
        }
        
        # Test 1: GET /orders (admin sees customer order)
        response = self.make_request("GET", "/orders", None, headers)
        admin_sees_order = False
        if isinstance(response, str):
            self.log_result("Admin Sees Order", "FAIL", f"Request failed: {response}")
        elif response.status_code == 200:
            orders = response.json()
            admin_sees_order = any(o.get("id") == self.order_id for o in orders)
            if admin_sees_order:
                self.log_result("Admin Sees Order", "PASS", f"Admin sees customer order in list of {len(orders)} orders")
            else:
                self.log_result("Admin Sees Order", "FAIL", f"Customer order not found in admin list")
        else:
            self.log_result("Admin Sees Order", "FAIL", f"Status: {response.status_code}")

        # Test 2: GET /orders/dashboard/summary
        response = self.make_request("GET", "/orders/dashboard/summary", None, headers)
        dashboard_ok = False
        if isinstance(response, str):
            self.log_result("Admin Dashboard", "FAIL", f"Request failed: {response}")
        elif response.status_code == 200:
            data = response.json()
            pending = data.get("pending", 0)
            total_value = data.get("total_value", 0)
            
            if pending >= 1 and total_value >= 725.00:
                dashboard_ok = True
                self.log_result("Admin Dashboard", "PASS", f"Dashboard shows pending={pending}, total_value=R{total_value}")
            else:
                self.log_result("Admin Dashboard", "FAIL", f"Dashboard incorrect: pending={pending}, total_value={total_value}")
        else:
            self.log_result("Admin Dashboard", "FAIL", f"Status: {response.status_code}")

        # Test 3: PUT /orders/{order_id}/status (confirm order)
        status_data = {"status": "confirmed"}
        response = self.make_request("PUT", f"/orders/{self.order_id}/status", status_data, headers)
        status_updated = False
        if isinstance(response, str):
            self.log_result("Admin Confirm Order", "FAIL", f"Request failed: {response}")
        elif response.status_code == 200:
            data = response.json()
            if data.get("status") == "confirmed":
                status_updated = True
                self.log_result("Admin Confirm Order", "PASS", f"Order status updated to confirmed")
            else:
                self.log_result("Admin Confirm Order", "FAIL", f"Status not updated: {data}")
        else:
            self.log_result("Admin Confirm Order", "FAIL", f"Status: {response.status_code}")

        if admin_sees_order and dashboard_ok and status_updated:
            self.log_result("Phase 7: Admin Manages", "PASS", "Admin can manage customer orders")
            return True
        else:
            self.log_result("Phase 7: Admin Manages", "FAIL", "Admin order management issues")
            return False

    def test_phase_8_customer_sees_update(self):
        """Phase 8: Customer Sees Updated Status"""
        print("\n=== Phase 8: Customer Sees Update ===")
        
        if not self.customer_token or not self.order_id:
            self.log_result("Phase 8: Customer Update", "FAIL", "No customer token or order ID available")
            return False
        
        headers = {
            "Authorization": f"Bearer {self.customer_token}"
        }
        
        # Test 1: GET /orders/{order_id}
        response = self.make_request("GET", f"/orders/{self.order_id}", None, headers)
        single_order_ok = False
        if isinstance(response, str):
            self.log_result("Customer Single Order", "FAIL", f"Request failed: {response}")
        elif response.status_code == 200:
            data = response.json()
            if data.get("status") == "confirmed":
                single_order_ok = True
                self.log_result("Customer Single Order", "PASS", f"Customer sees confirmed status")
            else:
                self.log_result("Customer Single Order", "FAIL", f"Status still: {data.get('status')}")
        else:
            self.log_result("Customer Single Order", "FAIL", f"Status: {response.status_code}")

        # Test 2: GET /orders (list)
        response = self.make_request("GET", "/orders", None, headers)
        order_list_ok = False
        if isinstance(response, str):
            self.log_result("Customer Order List", "FAIL", f"Request failed: {response}")
        elif response.status_code == 200:
            orders = response.json()
            customer_order = next((o for o in orders if o.get("id") == self.order_id), None)
            if customer_order and customer_order.get("status") == "confirmed":
                order_list_ok = True
                self.log_result("Customer Order List", "PASS", f"Order in list with confirmed status")
            else:
                self.log_result("Customer Order List", "FAIL", f"Order not found or wrong status in list")
        else:
            self.log_result("Customer Order List", "FAIL", f"Status: {response.status_code}")

        if single_order_ok and order_list_ok:
            self.log_result("Phase 8: Customer Update", "PASS", "Customer sees updated order status")
            return True
        else:
            self.log_result("Phase 8: Customer Update", "FAIL", "Customer status update issues")
            return False

    def test_phase_9_admin_updates_product(self):
        """Phase 9: Admin Updates Product Price → Customer Sees Change"""
        print("\n=== Phase 9: Admin Updates Product ===")
        
        if not self.admin_token or not self.customer_token:
            self.log_result("Phase 9: Product Update", "FAIL", "No admin or customer token available")
            return False
        
        # Get Sunflower Oil product ID
        sunflower_oil_id = self.product_ids.get("Sunflower Oil 750ml")
        if not sunflower_oil_id:
            self.log_result("Phase 9: Product Update", "FAIL", "Sunflower Oil product ID not found")
            return False
        
        admin_headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.admin_token}"
        }
        
        # Update product price
        update_data = {"price": 48.00}
        response = self.make_request("PUT", f"/products/{sunflower_oil_id}", update_data, admin_headers)
        admin_updated = False
        if isinstance(response, str):
            self.log_result("Admin Update Product", "FAIL", f"Request failed: {response}")
        elif response.status_code == 200:
            data = response.json()
            if data.get("price") == 48.00:
                admin_updated = True
                self.log_result("Admin Update Product", "PASS", f"Sunflower Oil price updated to R48.00")
            else:
                self.log_result("Admin Update Product", "FAIL", f"Price not updated: {data}")
        else:
            self.log_result("Admin Update Product", "FAIL", f"Status: {response.status_code}")

        # Customer sees change
        customer_headers = {
            "Authorization": f"Bearer {self.customer_token}"
        }
        
        response = self.make_request("GET", "/customer/products", None, customer_headers)
        customer_sees_change = False
        if isinstance(response, str):
            self.log_result("Customer Sees Price Change", "FAIL", f"Request failed: {response}")
        elif response.status_code == 200:
            products = response.json()
            sunflower_oil = next((p for p in products if p.get("name") == "Sunflower Oil 750ml"), None)
            if sunflower_oil and sunflower_oil.get("price") == 48.00:
                customer_sees_change = True
                self.log_result("Customer Sees Price Change", "PASS", f"Customer sees updated price: R48.00")
            else:
                self.log_result("Customer Sees Price Change", "FAIL", f"Customer price not updated: {sunflower_oil}")
        else:
            self.log_result("Customer Sees Price Change", "FAIL", f"Status: {response.status_code}")

        if admin_updated and customer_sees_change:
            self.log_result("Phase 9: Product Update", "PASS", "Product price update propagated to customer")
            return True
        else:
            self.log_result("Phase 9: Product Update", "FAIL", "Product update integration issue")
            return False

    def test_phase_10_admin_updates_schedule(self):
        """Phase 10: Admin Updates Route Schedule → Customer Sees Change"""
        print("\n=== Phase 10: Admin Updates Schedule ===")
        
        if not self.admin_token or not self.customer_token or not self.route_id:
            self.log_result("Phase 10: Schedule Update", "FAIL", "Missing required tokens or route ID")
            return False
        
        admin_headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.admin_token}"
        }
        
        # Update route schedule to include Saturday
        schedule_data = {
            "delivery_days": ["Tuesday", "Thursday", "Saturday"],
            "cut_off_time": "14:00",
            "cut_off_hours_before": 14
        }
        
        response = self.make_request("PUT", f"/routes/{self.route_id}/schedule", schedule_data, admin_headers)
        admin_updated = False
        if isinstance(response, str):
            self.log_result("Admin Update Schedule", "FAIL", f"Request failed: {response}")
        elif response.status_code == 200:
            data = response.json()
            delivery_days = data.get("delivery_days", [])
            if "Saturday" in delivery_days:
                admin_updated = True
                self.log_result("Admin Update Schedule", "PASS", f"Schedule updated to include Saturday: {delivery_days}")
            else:
                self.log_result("Admin Update Schedule", "FAIL", f"Saturday not added: {delivery_days}")
        else:
            self.log_result("Admin Update Schedule", "FAIL", f"Status: {response.status_code}")

        # Customer sees change
        customer_headers = {
            "Authorization": f"Bearer {self.customer_token}"
        }
        
        response = self.make_request("GET", "/customer/delivery-info", None, customer_headers)
        customer_sees_change = False
        if isinstance(response, str):
            self.log_result("Customer Sees Schedule Change", "FAIL", f"Request failed: {response}")
        elif response.status_code == 200:
            data = response.json()
            schedule = data.get("schedule", {})
            delivery_days = schedule.get("delivery_days", [])
            if "Saturday" in delivery_days:
                customer_sees_change = True
                self.log_result("Customer Sees Schedule Change", "PASS", f"Customer sees Saturday included: {delivery_days}")
            else:
                self.log_result("Customer Sees Schedule Change", "FAIL", f"Customer doesn't see Saturday: {delivery_days}")
        else:
            self.log_result("Customer Sees Schedule Change", "FAIL", f"Status: {response.status_code}")

        if admin_updated and customer_sees_change:
            self.log_result("Phase 10: Schedule Update", "PASS", "Schedule update propagated to customer")
            return True
        else:
            self.log_result("Phase 10: Schedule Update", "FAIL", "Schedule update integration issue")
            return False

    def test_phase_11_order_workflow(self):
        """Phase 11: Order Workflow Progression"""
        print("\n=== Phase 11: Order Workflow ===")
        
        if not self.admin_token or not self.customer_token or not self.order_id:
            self.log_result("Phase 11: Order Workflow", "FAIL", "Missing required tokens or order ID")
            return False
        
        admin_headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.admin_token}"
        }
        
        customer_headers = {
            "Authorization": f"Bearer {self.customer_token}"
        }
        
        statuses = ["packed", "out_for_delivery", "delivered"]
        workflow_ok = True
        
        for status in statuses:
            # Admin updates status
            status_data = {"status": status}
            response = self.make_request("PUT", f"/orders/{self.order_id}/status", status_data, admin_headers)
            
            if isinstance(response, str):
                self.log_result(f"Update to {status}", "FAIL", f"Request failed: {response}")
                workflow_ok = False
                continue
                
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == status:
                    self.log_result(f"Update to {status}", "PASS", f"Status updated to {status}")
                else:
                    self.log_result(f"Update to {status}", "FAIL", f"Status not updated: {data}")
                    workflow_ok = False
            else:
                self.log_result(f"Update to {status}", "FAIL", f"Status: {response.status_code}")
                workflow_ok = False

        # Customer sees final status
        response = self.make_request("GET", f"/orders/{self.order_id}", None, customer_headers)
        final_status_ok = False
        if isinstance(response, str):
            self.log_result("Customer Final Status", "FAIL", f"Request failed: {response}")
        elif response.status_code == 200:
            data = response.json()
            if data.get("status") == "delivered":
                final_status_ok = True
                self.log_result("Customer Final Status", "PASS", f"Customer sees delivered status")
            else:
                self.log_result("Customer Final Status", "FAIL", f"Final status: {data.get('status')}")
        else:
            self.log_result("Customer Final Status", "FAIL", f"Status: {response.status_code}")

        if workflow_ok and final_status_ok:
            self.log_result("Phase 11: Order Workflow", "PASS", "Complete order workflow progression working")
            return True
        else:
            self.log_result("Phase 11: Order Workflow", "FAIL", "Order workflow progression issues")
            return False

    def test_phase_12_data_isolation(self):
        """Phase 12: Data Isolation"""
        print("\n=== Phase 12: Data Isolation ===")
        
        # Create second company
        other_company_data = {
            "company": {
                "name": "Other Traders",
                "contact_person": "Jane Trader",
                "phone": self.other_admin_phone,
                "email": "jane@othertraders.co.za",
                "address": "456 Trade Ave, Cape Town"
            },
            "admin_name": "Jane Trader",
            "admin_phone": self.other_admin_phone,
            "admin_pin": "8888"
        }
        
        response = self.make_request("POST", "/companies/setup", other_company_data)
        other_company_setup = False
        if isinstance(response, str):
            self.log_result("Setup Other Company", "FAIL", f"Request failed: {response}")
        elif response.status_code == 200:
            data = response.json()
            if "company_id" in data:
                other_company_setup = True
                self.log_result("Setup Other Company", "PASS", f"Other Traders created: {data['company_id']}")
            else:
                self.log_result("Setup Other Company", "FAIL", f"No company_id: {data}")
        else:
            self.log_result("Setup Other Company", "FAIL", f"Status: {response.status_code}")

        if not other_company_setup:
            self.log_result("Phase 12: Data Isolation", "FAIL", "Could not setup second company")
            return False

        # Login as Other Traders admin
        login_data = {
            "phone": self.other_admin_phone,
            "pin": "8888"
        }
        
        response = self.make_request("POST", "/auth/login", login_data)
        other_admin_token = None
        if isinstance(response, str):
            self.log_result("Other Admin Login", "FAIL", f"Request failed: {response}")
        elif response.status_code == 200:
            data = response.json()
            if "token" in data:
                other_admin_token = data["token"]
                self.log_result("Other Admin Login", "PASS", f"Other admin login successful")
            else:
                self.log_result("Other Admin Login", "FAIL", f"No token: {data}")
        else:
            self.log_result("Other Admin Login", "FAIL", f"Status: {response.status_code}")

        if not other_admin_token:
            self.log_result("Phase 12: Data Isolation", "FAIL", "Could not login other admin")
            return False

        other_headers = {
            "Authorization": f"Bearer {other_admin_token}"
        }
        
        # Test isolation: Other admin should see no orders
        response = self.make_request("GET", "/orders", None, other_headers)
        orders_isolated = False
        if isinstance(response, str):
            self.log_result("Orders Isolation", "FAIL", f"Request failed: {response}")
        elif response.status_code == 200:
            orders = response.json()
            if len(orders) == 0:
                orders_isolated = True
                self.log_result("Orders Isolation", "PASS", f"Other admin sees empty orders list")
            else:
                self.log_result("Orders Isolation", "FAIL", f"Other admin sees {len(orders)} orders")
        else:
            self.log_result("Orders Isolation", "FAIL", f"Status: {response.status_code}")

        # Test isolation: Other admin should see no products
        response = self.make_request("GET", "/products", None, other_headers)
        products_isolated = False
        if isinstance(response, str):
            self.log_result("Products Isolation", "FAIL", f"Request failed: {response}")
        elif response.status_code == 200:
            products = response.json()
            if len(products) == 0:
                products_isolated = True
                self.log_result("Products Isolation", "PASS", f"Other admin sees empty products list")
            else:
                self.log_result("Products Isolation", "FAIL", f"Other admin sees {len(products)} products")
        else:
            self.log_result("Products Isolation", "FAIL", f"Status: {response.status_code}")

        if orders_isolated and products_isolated:
            self.log_result("Phase 12: Data Isolation", "PASS", "Multi-tenant data isolation working")
            return True
        else:
            self.log_result("Phase 12: Data Isolation", "FAIL", "Data isolation issues")
            return False

    def test_phase_13_error_handling(self):
        """Phase 13: Error Handling"""
        print("\n=== Phase 13: Error Handling ===")
        
        if not self.admin_token or not self.customer_token:
            self.log_result("Phase 13: Error Handling", "FAIL", "Missing required tokens")
            return False
        
        admin_headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.admin_token}"
        }
        
        customer_headers = {
            "Authorization": f"Bearer {self.customer_token}"
        }
        
        # Test 1: Invalid route ID
        response = self.make_request("PUT", "/routes/invalid_id/schedule", {"delivery_days": ["Monday"]}, admin_headers)
        invalid_route_ok = False
        if isinstance(response, str):
            self.log_result("Invalid Route Error", "FAIL", f"Request failed: {response}")
        elif response.status_code == 400 or response.status_code == 404:
            invalid_route_ok = True
            self.log_result("Invalid Route Error", "PASS", f"Proper error for invalid route: {response.status_code}")
        else:
            self.log_result("Invalid Route Error", "FAIL", f"Wrong status code: {response.status_code}")

        # Test 2: Customer endpoint with admin token (should be 403)
        response = self.make_request("GET", "/customer/delivery-info", None, admin_headers)
        role_restriction_ok = False
        if isinstance(response, str):
            self.log_result("Role Restriction Error", "FAIL", f"Request failed: {response}")
        elif response.status_code == 403:
            role_restriction_ok = True
            self.log_result("Role Restriction Error", "PASS", f"Proper 403 error for admin accessing customer endpoint")
        else:
            self.log_result("Role Restriction Error", "FAIL", f"Wrong status code: {response.status_code}")

        if invalid_route_ok and role_restriction_ok:
            self.log_result("Phase 13: Error Handling", "PASS", "Error handling working correctly")
            return True
        else:
            self.log_result("Phase 13: Error Handling", "FAIL", "Error handling issues")
            return False

    def run_integration_tests(self):
        """Run all integration test phases"""
        print("🚀 Starting Mzansi FMCG Tracker Full End-to-End Integration Tests")
        print(f"Backend URL: {BACKEND_URL}")
        print("=" * 80)
        
        test_phases = [
            ("Phase 1: Setup Company", self.test_phase_1_setup_company),
            ("Phase 1: Admin Login", self.test_phase_1_admin_login),
            ("Phase 2: Create Products", self.test_phase_2_create_products),
            ("Phase 2: Create Route", self.test_phase_2_create_route), 
            ("Phase 2: Set Schedule", self.test_phase_2_set_delivery_schedule),
            ("Phase 3: Public APIs", self.test_phase_3_public_apis),
            ("Phase 4: Customer Reg/Login", self.test_phase_4_customer_registration),
            ("Phase 5: Customer Views Data", self.test_phase_5_customer_views_data),
            ("Phase 6: Customer Order", self.test_phase_6_customer_order),
            ("Phase 7: Admin Manages Order", self.test_phase_7_admin_manages_order),
            ("Phase 8: Customer Sees Update", self.test_phase_8_customer_sees_update),
            ("Phase 9: Product Update", self.test_phase_9_admin_updates_product),
            ("Phase 10: Schedule Update", self.test_phase_10_admin_updates_schedule),
            ("Phase 11: Order Workflow", self.test_phase_11_order_workflow),
            ("Phase 12: Data Isolation", self.test_phase_12_data_isolation),
            ("Phase 13: Error Handling", self.test_phase_13_error_handling)
        ]
        
        passed = 0
        total = len(test_phases)
        
        for phase_name, test_func in test_phases:
            try:
                if test_func():
                    passed += 1
            except Exception as e:
                self.log_result(phase_name, "FAIL", f"Exception: {str(e)}")
        
        print("\n" + "=" * 80)
        print(f"📊 INTEGRATION TEST RESULTS: {passed}/{total} phases passed")
        
        if passed == total:
            print("✅ ALL INTEGRATION TESTS PASSED - Full component integration working perfectly")
            return True
        else:
            print(f"❌ {total - passed} PHASES FAILED - Integration issues found")
            return False
    
    def get_summary(self):
        """Get test results summary"""
        passed = len([r for r in self.results if r["status"] == "PASS"])
        failed = len([r for r in self.results if r["status"] == "FAIL"])
        
        summary = f"\n=== INTEGRATION TEST SUMMARY ===\n"
        summary += f"Total Tests: {len(self.results)}\n"
        summary += f"Passed: {passed}\n"
        summary += f"Failed: {failed}\n\n"
        
        if failed > 0:
            summary += "FAILED TESTS:\n"
            for result in self.results:
                if result["status"] == "FAIL":
                    summary += f"❌ {result['test']}: {result['details']}\n"
        
        return summary

def main():
    """Main test execution"""
    tester = IntegrationTester()
    success = tester.run_integration_tests()
    
    print(tester.get_summary())
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()