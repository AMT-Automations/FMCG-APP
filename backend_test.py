#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Mzansi Distribution Tracker
Tests all endpoints with proper authentication and data validation
"""

import requests
import json
import sys
import traceback
from datetime import datetime, date

class MzansiAPITester:
    def __init__(self, base_url="https://vehicle-route-hub.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.driver_token = None
        self.manager_token = None
        self.test_data = {}
        self.passed_tests = 0
        self.failed_tests = 0
        self.test_results = []
        
    def log_test(self, test_name, success, message="", details=""):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = {
            "test": test_name,
            "status": status,
            "message": message,
            "details": details
        }
        self.test_results.append(result)
        print(f"{status}: {test_name}")
        if message:
            print(f"    {message}")
        if details and not success:
            print(f"    Details: {details}")
        print()
        
        if success:
            self.passed_tests += 1
        else:
            self.failed_tests += 1
            
    def make_request(self, method, endpoint, token=None, data=None, params=None):
        """Make HTTP request with error handling"""
        url = f"{self.base_url}{endpoint}"
        headers = {"Content-Type": "application/json"}
        
        if token:
            headers["Authorization"] = f"Bearer {token}"
            
        try:
            if method == "GET":
                response = requests.get(url, headers=headers, params=params, timeout=30)
            elif method == "POST":
                response = requests.post(url, headers=headers, json=data, timeout=30)
            elif method == "PUT":
                response = requests.put(url, headers=headers, json=data, timeout=30)
            elif method == "DELETE":
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            return response
        except requests.exceptions.RequestException as e:
            print(f"Request error ({method} {endpoint}): {str(e)}")
            return None
        except Exception as e:
            print(f"Unexpected error ({method} {endpoint}): {str(e)}")
            return None
    
    def test_seed_data(self):
        """Test seeding sample data"""
        print("🌱 SEEDING DATA...")
        response = self.make_request("POST", "/seed-all")
        
        if response and response.status_code == 200:
            data = response.json()
            self.log_test("Seed Data", True, f"Demo logins available: {list(data.get('demo_logins', {}).keys())}")
            return True
        else:
            error_msg = response.text if response else "No response"
            self.log_test("Seed Data", False, f"Status: {response.status_code if response else 'None'}", error_msg)
            return False
    
    def test_authentication(self):
        """Test authentication endpoints"""
        print("🔐 TESTING AUTHENTICATION...")
        
        # Test admin login
        admin_data = {"phone": "0800000001", "pin": "0000"}
        response = self.make_request("POST", "/auth/login", data=admin_data)
        
        if response and response.status_code == 200:
            data = response.json()
            self.admin_token = data.get("token")
            user_data = data.get("user", {})
            self.log_test("Admin Login", True, f"Admin: {user_data.get('name')} ({user_data.get('role')})")
        else:
            error_msg = response.text if response else "No response"
            self.log_test("Admin Login", False, f"Status: {response.status_code if response else 'None'}", error_msg)
            return False
            
        # Test driver login
        driver_data = {"phone": "0812345678", "pin": "1234"}
        response = self.make_request("POST", "/auth/login", data=driver_data)
        
        if response and response.status_code == 200:
            data = response.json()
            self.driver_token = data.get("token")
            user_data = data.get("user", {})
            self.log_test("Driver Login", True, f"Driver: {user_data.get('name')} ({user_data.get('role')})")
        else:
            error_msg = response.text if response else "No response"
            self.log_test("Driver Login", False, f"Status: {response.status_code if response else 'None'}", error_msg)
            
        # Test manager login
        manager_data = {"phone": "0800000002", "pin": "1111"}
        response = self.make_request("POST", "/auth/login", data=manager_data)
        
        if response and response.status_code == 200:
            data = response.json()
            self.manager_token = data.get("token")
            user_data = data.get("user", {})
            self.log_test("Manager Login", True, f"Manager: {user_data.get('name')} ({user_data.get('role')})")
        else:
            error_msg = response.text if response else "No response"
            self.log_test("Manager Login", False, f"Status: {response.status_code if response else 'None'}", error_msg)
            
        # Test /auth/me endpoint with admin token
        response = self.make_request("GET", "/auth/me", token=self.admin_token)
        if response and response.status_code == 200:
            user_data = response.json()
            self.log_test("Get Current User", True, f"Retrieved user: {user_data.get('name')}")
        else:
            error_msg = response.text if response else "No response"
            self.log_test("Get Current User", False, f"Status: {response.status_code if response else 'None'}", error_msg)
            
        return bool(self.admin_token and self.driver_token)
    
    def test_users_management(self):
        """Test users management (admin only)"""
        print("👥 TESTING USERS MANAGEMENT...")
        
        # Test GET /users (admin only)
        response = self.make_request("GET", "/users", token=self.admin_token)
        if response and response.status_code == 200:
            users = response.json()
            self.log_test("List Users (Admin)", True, f"Retrieved {len(users)} users")
        else:
            error_msg = response.text if response else "No response"
            self.log_test("List Users (Admin)", False, f"Status: {response.status_code if response else 'None'}", error_msg)
            
        # Test driver access to admin endpoint (should fail)
        response = self.make_request("GET", "/users", token=self.driver_token)
        print(f"DEBUG: Driver /users response - Status: {response.status_code if response else 'None'}")
        if response and response.status_code == 403:
            self.log_test("List Users (Driver Forbidden)", True, "Driver correctly blocked from admin endpoint")
        else:
            if response:
                self.log_test("List Users (Driver Forbidden)", False, f"Driver should be blocked, got status: {response.status_code}")
            else:
                self.log_test("List Users (Driver Forbidden)", False, "Driver request failed - no response received")
            
        # Test creating a user (admin only)
        new_user_data = {
            "name": "Test Driver API",
            "phone": "0800123456",
            "pin": "4567",
            "role": "driver"
        }
        response = self.make_request("POST", "/users", token=self.admin_token, data=new_user_data)
        if response and response.status_code == 200:
            user_data = response.json()
            self.test_data["created_user_id"] = user_data.get("id")
            self.log_test("Create User", True, f"Created user: {user_data.get('name')}")
        else:
            error_msg = response.text if response else "No response"
            self.log_test("Create User", False, f"Status: {response.status_code if response else 'None'}", error_msg)
    
    def test_vehicles_management(self):
        """Test vehicles management"""
        print("🚛 TESTING VEHICLES MANAGEMENT...")
        
        # Test GET /vehicles
        response = self.make_request("GET", "/vehicles", token=self.admin_token)
        if response and response.status_code == 200:
            vehicles = response.json()
            self.log_test("List Vehicles", True, f"Retrieved {len(vehicles)} vehicles")
            if vehicles:
                self.test_data["vehicle_id"] = vehicles[0].get("id")
        else:
            error_msg = response.text if response else "No response"
            self.log_test("List Vehicles", False, f"Status: {response.status_code if response else 'None'}", error_msg)
            
        # Test GET /vehicles/available
        response = self.make_request("GET", "/vehicles/available", token=self.admin_token)
        if response and response.status_code == 200:
            available = response.json()
            if isinstance(available, list):
                self.log_test("List Available Vehicles", True, f"Retrieved {len(available)} available vehicles")
            else:
                self.log_test("List Available Vehicles", True, f"Retrieved {len(available.get('available_vehicles', []))} available vehicles")
        else:
            error_msg = response.text if response else "No response"
            self.log_test("List Available Vehicles", False, f"Status: {response.status_code if response else 'None'}", error_msg)
            
        # Test creating a vehicle (admin/manager only)
        new_vehicle_data = {
            "registration": "TEST123GP",
            "name": "Test Vehicle API",
            "vehicle_type": "truck",
            "capacity_crates": 150
        }
        response = self.make_request("POST", "/vehicles", token=self.admin_token, data=new_vehicle_data)
        if response and response.status_code == 200:
            vehicle_data = response.json()
            self.test_data["created_vehicle_id"] = vehicle_data.get("id")
            self.log_test("Create Vehicle", True, f"Created vehicle: {vehicle_data.get('name')} ({vehicle_data.get('registration')})")
        else:
            error_msg = response.text if response else "No response"
            self.log_test("Create Vehicle", False, f"Status: {response.status_code if response else 'None'}", error_msg)
            
        # Test driver access to vehicle creation (should fail)
        response = self.make_request("POST", "/vehicles", token=self.driver_token, data=new_vehicle_data)
        if response and response.status_code == 403:
            self.log_test("Create Vehicle (Driver Forbidden)", True, "Driver correctly blocked from vehicle creation")
        else:
            self.log_test("Create Vehicle (Driver Forbidden)", False, f"Driver should be blocked, got status: {response.status_code if response else 'None'}")
    
    def test_routes_management(self):
        """Test routes management"""
        print("🗺️ TESTING ROUTES MANAGEMENT...")
        
        # Test GET /routes
        response = self.make_request("GET", "/routes", token=self.admin_token)
        if response and response.status_code == 200:
            routes = response.json()
            self.log_test("List Routes", True, f"Retrieved {len(routes)} routes")
            if routes:
                self.test_data["route_id"] = routes[0].get("id")
        else:
            error_msg = response.text if response else "No response"
            self.log_test("List Routes", False, f"Status: {response.status_code if response else 'None'}", error_msg)
            
        # Test creating a route
        new_route_data = {
            "name": "Test Route API",
            "description": "API testing route"
        }
        response = self.make_request("POST", "/routes", token=self.admin_token, data=new_route_data)
        if response and response.status_code == 200:
            route_data = response.json()
            self.test_data["created_route_id"] = route_data.get("id")
            self.log_test("Create Route", True, f"Created route: {route_data.get('name')}")
        else:
            error_msg = response.text if response else "No response"
            self.log_test("Create Route", False, f"Status: {response.status_code if response else 'None'}", error_msg)
            
        # Test GET /routes/{id}/customers
        if self.test_data.get("route_id"):
            response = self.make_request("GET", f"/routes/{self.test_data['route_id']}/customers", token=self.admin_token)
            if response and response.status_code == 200:
                customers = response.json()
                self.log_test("Get Route Customers", True, f"Retrieved {len(customers)} customers for route")
            else:
                error_msg = response.text if response else "No response"
                self.log_test("Get Route Customers", False, f"Status: {response.status_code if response else 'None'}", error_msg)
    
    def test_customers_management(self):
        """Test customers management"""
        print("👤 TESTING CUSTOMERS MANAGEMENT...")
        
        # Test GET /customers
        response = self.make_request("GET", "/customers", token=self.admin_token)
        if response and response.status_code == 200:
            customers = response.json()
            self.log_test("List Customers", True, f"Retrieved {len(customers)} customers")
            if customers:
                self.test_data["customer_id"] = customers[0].get("id")
        else:
            error_msg = response.text if response else "No response"
            self.log_test("List Customers", False, f"Status: {response.status_code if response else 'None'}", error_msg)
            
        # Test creating a customer
        new_customer_data = {
            "name": "API Test Customer",
            "contact": "0831234567",
            "location": "Test Location",
            "payment_terms": "cash",
            "route_id": self.test_data.get("route_id")
        }
        response = self.make_request("POST", "/customers", token=self.admin_token, data=new_customer_data)
        if response and response.status_code == 200:
            customer_data = response.json()
            self.test_data["created_customer_id"] = customer_data.get("id")
            self.log_test("Create Customer", True, f"Created customer: {customer_data.get('name')}")
        else:
            error_msg = response.text if response else "No response"
            self.log_test("Create Customer", False, f"Status: {response.status_code if response else 'None'}", error_msg)
            
        # Test updating a customer
        if self.test_data.get("created_customer_id"):
            update_data = {"location": "Updated Test Location"}
            response = self.make_request("PUT", f"/customers/{self.test_data['created_customer_id']}", 
                                       token=self.admin_token, data=update_data)
            if response and response.status_code == 200:
                self.log_test("Update Customer", True, "Customer updated successfully")
            else:
                error_msg = response.text if response else "No response"
                self.log_test("Update Customer", False, f"Status: {response.status_code if response else 'None'}", error_msg)
    
    def test_products_management(self):
        """Test products management"""
        print("📦 TESTING PRODUCTS MANAGEMENT...")
        
        # Test GET /products
        response = self.make_request("GET", "/products", token=self.admin_token)
        if response and response.status_code == 200:
            products = response.json()
            self.log_test("List Products", True, f"Retrieved {len(products)} products")
            if products:
                self.test_data["product_id"] = products[0].get("id")
        else:
            error_msg = response.text if response else "No response"
            self.log_test("List Products", False, f"Status: {response.status_code if response else 'None'}", error_msg)
            
        # Test creating a product
        new_product_data = {
            "name": "Test Product API",
            "category": "beverages",
            "unit_type": "units",
            "price": 25.99
        }
        response = self.make_request("POST", "/products", token=self.admin_token, data=new_product_data)
        if response and response.status_code == 200:
            product_data = response.json()
            self.test_data["created_product_id"] = product_data.get("id")
            self.log_test("Create Product", True, f"Created product: {product_data.get('name')} - R{product_data.get('price')}")
        else:
            error_msg = response.text if response else "No response"
            self.log_test("Create Product", False, f"Status: {response.status_code if response else 'None'}", error_msg)
            
        # Test updating a product
        if self.test_data.get("created_product_id"):
            update_data = {"price": 29.99}
            response = self.make_request("PUT", f"/products/{self.test_data['created_product_id']}", 
                                       token=self.admin_token, data=update_data)
            if response and response.status_code == 200:
                updated_product = response.json()
                self.log_test("Update Product", True, f"Product price updated to R{updated_product.get('price')}")
            else:
                error_msg = response.text if response else "No response"
                self.log_test("Update Product", False, f"Status: {response.status_code if response else 'None'}", error_msg)
    
    def test_daily_routes(self):
        """Test daily routes management"""
        print("🚛 TESTING DAILY ROUTES...")
        
        # Test starting a daily route
        if self.test_data.get("route_id") and self.test_data.get("vehicle_id"):
            start_route_data = {
                "route_id": self.test_data["route_id"],
                "vehicle_id": self.test_data["vehicle_id"],
                "opening_km": 15000.5,
                "crates_out": 50
            }
            response = self.make_request("POST", "/daily-routes/start", token=self.driver_token, data=start_route_data)
            if response and response.status_code == 200:
                route_data = response.json()
                self.test_data["active_route_id"] = route_data.get("id")
                vehicle_info = f"{route_data.get('vehicle_name')} ({route_data.get('vehicle_registration')})"
                self.log_test("Start Daily Route", True, f"Started route with vehicle: {vehicle_info}")
            else:
                error_msg = response.text if response else "No response"
                self.log_test("Start Daily Route", False, f"Status: {response.status_code if response else 'None'}", error_msg)
        else:
            self.log_test("Start Daily Route", False, "Missing route_id or vehicle_id from previous tests")
            
        # Test GET /daily-routes/active
        response = self.make_request("GET", "/daily-routes/active", token=self.driver_token)
        if response and response.status_code == 200:
            active_routes = response.json()
            self.log_test("Get Active Routes (Driver)", True, f"Driver has {len(active_routes)} active routes")
        else:
            error_msg = response.text if response else "No response"
            self.log_test("Get Active Routes (Driver)", False, f"Status: {response.status_code if response else 'None'}", error_msg)
            
        # Test GET /daily-routes/active/all (admin only)
        response = self.make_request("GET", "/daily-routes/active/all", token=self.admin_token)
        if response and response.status_code == 200:
            all_active_routes = response.json()
            self.log_test("Get All Active Routes (Admin)", True, f"Total {len(all_active_routes)} active routes across all drivers")
        else:
            error_msg = response.text if response else "No response"
            self.log_test("Get All Active Routes (Admin)", False, f"Status: {response.status_code if response else 'None'}", error_msg)
            
        # Test GET /daily-routes/history
        response = self.make_request("GET", "/daily-routes/history", token=self.driver_token)
        if response and response.status_code == 200:
            history = response.json()
            self.log_test("Get Route History", True, f"Retrieved {len(history)} route records from history")
        else:
            error_msg = response.text if response else "No response"
            self.log_test("Get Route History", False, f"Status: {response.status_code if response else 'None'}", error_msg)
    
    def test_sales_recording(self):
        """Test sales recording and management"""
        print("💰 TESTING SALES RECORDING...")
        
        # Test creating a sale
        if self.test_data.get("route_id") and self.test_data.get("customer_id") and self.test_data.get("product_id"):
            sale_data = {
                "route_id": self.test_data["route_id"],
                "customer_id": self.test_data["customer_id"],
                "customer_name": "API Test Customer",
                "items": [
                    {
                        "product_id": self.test_data["product_id"],
                        "product_name": "Test Product API",
                        "quantity_delivered": 10,
                        "quantity_returned": 1,
                        "damages": 0,
                        "unit_price": 29.99
                    }
                ],
                "crates_dropped": 5,
                "crates_collected": 3,
                "cash_collected": 269.91,
                "payment_type": "cash",
                "notes": "API test sale",
                "delivery_status": "delivered"
            }
            response = self.make_request("POST", "/sales", token=self.driver_token, data=sale_data)
            if response and response.status_code == 200:
                sale_response = response.json()
                self.test_data["sale_id"] = sale_response.get("id")
                total_amount = sale_response.get("total_amount", 0)
                self.log_test("Create Sale", True, f"Sale created with total: R{total_amount}")
            else:
                error_msg = response.text if response else "No response"
                self.log_test("Create Sale", False, f"Status: {response.status_code if response else 'None'}", error_msg)
        else:
            self.log_test("Create Sale", False, "Missing required data (route_id, customer_id, or product_id)")
            
        # Test GET /sales
        response = self.make_request("GET", "/sales", token=self.driver_token)
        if response and response.status_code == 200:
            sales = response.json()
            self.log_test("List Sales", True, f"Retrieved {len(sales)} sales records")
        else:
            error_msg = response.text if response else "No response"
            self.log_test("List Sales", False, f"Status: {response.status_code if response else 'None'}", error_msg)
            
        # Test GET /sales/{id}
        if self.test_data.get("sale_id"):
            response = self.make_request("GET", f"/sales/{self.test_data['sale_id']}", token=self.driver_token)
            if response and response.status_code == 200:
                sale_data = response.json()
                self.log_test("Get Single Sale", True, f"Retrieved sale for {sale_data.get('customer_name')}")
            else:
                error_msg = response.text if response else "No response"
                self.log_test("Get Single Sale", False, f"Status: {response.status_code if response else 'None'}", error_msg)
                
        # Test updating a sale
        if self.test_data.get("sale_id"):
            update_data = {"notes": "Updated via API test"}
            response = self.make_request("PUT", f"/sales/{self.test_data['sale_id']}", 
                                       token=self.driver_token, data=update_data)
            if response and response.status_code == 200:
                self.log_test("Update Sale", True, "Sale notes updated successfully")
            else:
                error_msg = response.text if response else "No response"
                self.log_test("Update Sale", False, f"Status: {response.status_code if response else 'None'}", error_msg)
    
    def test_reports(self):
        """Test reports endpoints"""
        print("📊 TESTING REPORTS...")
        
        # Test daily summary
        today = date.today().isoformat()
        response = self.make_request("GET", "/reports/daily-summary", token=self.driver_token, 
                                   params={"date": today})
        if response and response.status_code == 200:
            summary = response.json()
            total_sales = summary.get("total_sales", 0)
            self.log_test("Daily Summary Report", True, f"Daily summary: R{total_sales} in sales")
        else:
            error_msg = response.text if response else "No response"
            self.log_test("Daily Summary Report", False, f"Status: {response.status_code if response else 'None'}", error_msg)
            
        # Test route performance
        if self.test_data.get("route_id"):
            response = self.make_request("GET", f"/reports/route-performance/{self.test_data['route_id']}", 
                                       token=self.admin_token)
            if response and response.status_code == 200:
                performance = response.json()
                self.log_test("Route Performance Report", True, f"Route performance data retrieved")
            else:
                error_msg = response.text if response else "No response"
                self.log_test("Route Performance Report", False, f"Status: {response.status_code if response else 'None'}", error_msg)
        else:
            self.log_test("Route Performance Report", False, "No route_id available for testing")
            
        # Test Excel export
        response = self.make_request("GET", "/reports/export/excel", token=self.admin_token, 
                                   params={"date": today})
        if response and response.status_code == 200:
            content_type = response.headers.get('content-type', '')
            if 'excel' in content_type or 'spreadsheet' in content_type:
                self.log_test("Excel Export", True, f"Excel file generated successfully ({len(response.content)} bytes)")
            else:
                self.log_test("Excel Export", True, f"Export generated ({len(response.content)} bytes)")
        else:
            error_msg = response.text if response else "No response"
            self.log_test("Excel Export", False, f"Status: {response.status_code if response else 'None'}", error_msg)
    
    def test_permissions(self):
        """Test permissions endpoint"""
        print("🔑 TESTING PERMISSIONS...")
        
        # Test driver permissions
        response = self.make_request("GET", "/permissions", token=self.driver_token)
        if response and response.status_code == 200:
            permissions = response.json()
            self.log_test("Driver Permissions", True, f"Driver permissions: {len(permissions)} rules")
        else:
            error_msg = response.text if response else "No response"
            self.log_test("Driver Permissions", False, f"Status: {response.status_code if response else 'None'}", error_msg)
            
        # Test admin permissions
        response = self.make_request("GET", "/permissions", token=self.admin_token)
        if response and response.status_code == 200:
            permissions = response.json()
            self.log_test("Admin Permissions", True, f"Admin permissions: {len(permissions)} rules")
        else:
            error_msg = response.text if response else "No response"
            self.log_test("Admin Permissions", False, f"Status: {response.status_code if response else 'None'}", error_msg)
    
    def test_vehicle_availability_tracking(self):
        """Test that vehicle in-use prevention works correctly"""
        print("🔒 TESTING VEHICLE IN-USE PREVENTION...")
        
        # Try to start another route with the same vehicle (should fail)
        if self.test_data.get("created_route_id") and self.test_data.get("vehicle_id"):
            duplicate_route_data = {
                "route_id": self.test_data["created_route_id"],
                "vehicle_id": self.test_data["vehicle_id"],  # Same vehicle as earlier
                "opening_km": 16000.0,
                "crates_out": 40
            }
            response = self.make_request("POST", "/daily-routes/start", token=self.driver_token, data=duplicate_route_data)
            if response and response.status_code == 400:
                self.log_test("Vehicle In-Use Prevention", True, "Same vehicle correctly blocked from multiple active routes")
            else:
                self.log_test("Vehicle In-Use Prevention", False, f"Expected 400 error, got status: {response.status_code if response else 'None'}")
        else:
            self.log_test("Vehicle In-Use Prevention", False, "Missing route_id or vehicle_id for testing")
    
    def run_comprehensive_test(self):
        """Run all tests in sequence"""
        print("🚀 STARTING COMPREHENSIVE BACKEND API TESTING")
        print("=" * 60)
        
        try:
            # Seed data first
            if not self.test_seed_data():
                print("❌ CRITICAL: Failed to seed data. Stopping tests.")
                return
                
            # Authentication tests
            if not self.test_authentication():
                print("❌ CRITICAL: Authentication failed. Stopping tests.")
                return
                
            # Core functionality tests
            self.test_users_management()
            self.test_vehicles_management()
            self.test_routes_management()
            self.test_customers_management()
            self.test_products_management()
            self.test_daily_routes()
            self.test_sales_recording()
            self.test_reports()
            self.test_permissions()
            self.test_vehicle_availability_tracking()
            
        except Exception as e:
            print(f"❌ CRITICAL ERROR: {str(e)}")
            traceback.print_exc()
        
        # Print summary
        print("\n" + "=" * 60)
        print("📋 TEST SUMMARY")
        print("=" * 60)
        print(f"✅ PASSED: {self.passed_tests}")
        print(f"❌ FAILED: {self.failed_tests}")
        print(f"📊 TOTAL:  {self.passed_tests + self.failed_tests}")
        
        if self.failed_tests == 0:
            print("\n🎉 ALL TESTS PASSED! Backend APIs are fully functional.")
        else:
            print(f"\n⚠️  {self.failed_tests} test(s) failed. Check details above.")
            
        # Print failed tests summary
        failed_results = [r for r in self.test_results if "FAIL" in r["status"]]
        if failed_results:
            print("\n❌ FAILED TESTS DETAILS:")
            for result in failed_results:
                print(f"  • {result['test']}: {result['message']}")
                if result['details']:
                    print(f"    {result['details']}")
        
        return self.failed_tests == 0

def main():
    """Main entry point"""
    tester = MzansiAPITester()
    success = tester.run_comprehensive_test()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()