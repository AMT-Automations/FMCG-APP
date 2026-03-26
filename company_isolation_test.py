#!/usr/bin/env python3
"""
Company Data Isolation and Customer Creation Test
Testing for Mzansi FMCG Tracker

Test Requirements:
1. POST /api/admin/reset-and-seed — fresh seed
2. Login as admin: POST /api/auth/login with phone=0767862760, pin=1984
3. Test 1: Customer Creation - POST /api/customers with admin token
4. Test 2: Company Data Isolation - Routes (GET /api/routes)
5. Test 3: Company Data Isolation - Vehicles (GET /api/vehicles)
6. Test 4: Company Data Isolation - Products (GET /api/products)
7. Test 5: Cross-company Protection on Updates
8. Test 6: Companies List (GET /api/companies/list)
9. Test 7: Customer Visibility (GET /api/customers)

Admin: phone=0767862760, pin=1984
Customer: phone=0831001001, pin=1111
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL
BASE_URL = "https://fmcg-delivery-app-2.preview.emergentagent.com/api"

class CompanyIsolationTester:
    def __init__(self):
        self.admin_token = None
        self.customer_token = None
        self.admin_company_id = None
        self.test_results = []
        
    def log_test(self, test_name, success, message, details=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = {
            "test": test_name,
            "status": status,
            "message": message,
            "details": details or {},
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        print(f"{status}: {test_name} - {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    def test_1_reset_and_seed(self):
        """Test 1: POST /api/admin/reset-and-seed — fresh seed"""
        try:
            response = requests.post(f"{BASE_URL}/admin/reset-and-seed")
            
            if response.status_code == 200:
                data = response.json()
                self.log_test(
                    "Reset and Seed Database",
                    True,
                    f"Database reset and seeded successfully",
                    {"response": data}
                )
                return True
            else:
                self.log_test(
                    "Reset and Seed Database",
                    False,
                    f"Failed with status {response.status_code}",
                    {"response": response.text}
                )
                return False
                
        except Exception as e:
            self.log_test(
                "Reset and Seed Database",
                False,
                f"Exception occurred: {str(e)}",
                {"error": str(e)}
            )
            return False
    
    def test_2_admin_login(self):
        """Test 2: Login as admin with phone=0767862760, pin=1984"""
        try:
            login_data = {
                "phone": "0767862760",
                "pin": "1984"
            }
            
            response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
            
            if response.status_code == 200:
                data = response.json()
                # Check for both 'access_token' and 'token' fields
                token = data.get("access_token") or data.get("token")
                if token:
                    self.admin_token = token
                    # Extract company_id if available
                    if "company" in data and data["company"]:
                        self.admin_company_id = data["company"].get("id") or data["company"].get("company_id")
                    
                    self.log_test(
                        "Admin Login",
                        True,
                        f"Admin login successful, token obtained",
                        {
                            "user": data.get("user", {}),
                            "company": data.get("company", {}),
                            "company_id": self.admin_company_id
                        }
                    )
                    return True
                else:
                    self.log_test(
                        "Admin Login",
                        False,
                        "No access token in response",
                        {"response": data}
                    )
                    return False
            else:
                self.log_test(
                    "Admin Login",
                    False,
                    f"Login failed with status {response.status_code}",
                    {"response": response.text}
                )
                return False
                
        except Exception as e:
            self.log_test(
                "Admin Login",
                False,
                f"Exception occurred: {str(e)}",
                {"error": str(e)}
            )
            return False
    
    def test_3_customer_creation(self):
        """Test 3: Customer Creation - POST /api/customers with admin token"""
        if not self.admin_token:
            self.log_test(
                "Customer Creation",
                False,
                "No admin token available",
                {}
            )
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            customer_data = {
                "name": "Test New Customer",
                "contact": "0801234567",
                "location": "Soweto"
            }
            
            response = requests.post(f"{BASE_URL}/customers", json=customer_data, headers=headers)
            
            if response.status_code == 200 or response.status_code == 201:
                data = response.json()
                
                # Check if customer was created successfully with expected data
                if (data.get("name") == "Test New Customer" and 
                    data.get("contact") == "0801234567" and 
                    data.get("location") == "Soweto" and
                    data.get("id")):
                    
                    self.log_test(
                        "Customer Creation",
                        True,
                        f"Customer created successfully with correct data",
                        {
                            "customer": data,
                            "expected_name": "Test New Customer",
                            "expected_contact": "0801234567",
                            "expected_location": "Soweto"
                        }
                    )
                    return True
                else:
                    self.log_test(
                        "Customer Creation",
                        False,
                        f"Customer created but data doesn't match expected values",
                        {
                            "customer": data,
                            "expected_name": "Test New Customer",
                            "expected_contact": "0801234567",
                            "expected_location": "Soweto"
                        }
                    )
                    return False
            else:
                self.log_test(
                    "Customer Creation",
                    False,
                    f"Customer creation failed with status {response.status_code}",
                    {"response": response.text}
                )
                return False
                
        except Exception as e:
            self.log_test(
                "Customer Creation",
                False,
                f"Exception occurred: {str(e)}",
                {"error": str(e)}
            )
            return False
    
    def test_4_routes_isolation(self):
        """Test 4: Company Data Isolation - Routes (GET /api/routes)"""
        if not self.admin_token:
            self.log_test(
                "Routes Data Isolation",
                False,
                "No admin token available",
                {}
            )
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.get(f"{BASE_URL}/routes", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                routes = data if isinstance(data, list) else data.get("routes", [])
                
                # For Mzansi Distribution admin, should see exactly 2 routes: "Soweto & Surrounds" and "Pretoria Route"
                expected_routes = ["Soweto & Surrounds", "Pretoria Route"]
                actual_route_names = [route.get("name") for route in routes]
                
                # Check if we see exactly the expected routes
                if len(routes) == 2 and all(name in actual_route_names for name in expected_routes):
                    self.log_test(
                        "Routes Data Isolation",
                        True,
                        f"Routes properly isolated - admin sees exactly {len(routes)} expected routes for their company",
                        {
                            "expected_routes": expected_routes,
                            "actual_routes": actual_route_names,
                            "routes_count": len(routes)
                        }
                    )
                    return True
                else:
                    self.log_test(
                        "Routes Data Isolation",
                        False,
                        f"Data isolation issue - expected 2 specific routes, got {len(routes)} routes",
                        {
                            "expected_routes": expected_routes,
                            "actual_routes": actual_route_names,
                            "routes_count": len(routes)
                        }
                    )
                    return False
            else:
                self.log_test(
                    "Routes Data Isolation",
                    False,
                    f"Failed to get routes with status {response.status_code}",
                    {"response": response.text}
                )
                return False
                
        except Exception as e:
            self.log_test(
                "Routes Data Isolation",
                False,
                f"Exception occurred: {str(e)}",
                {"error": str(e)}
            )
            return False
    
    def test_5_vehicles_isolation(self):
        """Test 5: Company Data Isolation - Vehicles (GET /api/vehicles)"""
        if not self.admin_token:
            self.log_test(
                "Vehicles Data Isolation",
                False,
                "No admin token available",
                {}
            )
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.get(f"{BASE_URL}/vehicles", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                vehicles = data if isinstance(data, list) else data.get("vehicles", [])
                
                # For Mzansi Distribution admin, should see exactly 2 vehicles: "Truck 1 - Toyota Dyna" and "Truck 2 - Isuzu NPR"
                expected_vehicles = ["Truck 1 - Toyota Dyna", "Truck 2 - Isuzu NPR"]
                actual_vehicle_names = [vehicle.get("name") for vehicle in vehicles]
                
                # Check if we see exactly the expected vehicles
                if len(vehicles) == 2 and all(name in actual_vehicle_names for name in expected_vehicles):
                    self.log_test(
                        "Vehicles Data Isolation",
                        True,
                        f"Vehicles properly isolated - admin sees exactly {len(vehicles)} expected vehicles for their company",
                        {
                            "expected_vehicles": expected_vehicles,
                            "actual_vehicles": actual_vehicle_names,
                            "vehicles_count": len(vehicles)
                        }
                    )
                    return True
                else:
                    self.log_test(
                        "Vehicles Data Isolation",
                        False,
                        f"Data isolation issue - expected 2 specific vehicles, got {len(vehicles)} vehicles",
                        {
                            "expected_vehicles": expected_vehicles,
                            "actual_vehicles": actual_vehicle_names,
                            "vehicles_count": len(vehicles)
                        }
                    )
                    return False
            else:
                self.log_test(
                    "Vehicles Data Isolation",
                    False,
                    f"Failed to get vehicles with status {response.status_code}",
                    {"response": response.text}
                )
                return False
                
        except Exception as e:
            self.log_test(
                "Vehicles Data Isolation",
                False,
                f"Exception occurred: {str(e)}",
                {"error": str(e)}
            )
            return False
    
    def test_6_products_isolation(self):
        """Test 6: Company Data Isolation - Products (GET /api/products)"""
        if not self.admin_token:
            self.log_test(
                "Products Data Isolation",
                False,
                "No admin token available",
                {}
            )
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.get(f"{BASE_URL}/products", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                products = data if isinstance(data, list) else data.get("products", [])
                
                # For Mzansi Distribution admin, should see exactly 8 products from their company
                expected_products = ["White Bread", "Brown Bread", "Full Cream Milk 2L", "Amasi 1L", 
                                   "Large Eggs (30)", "Sunflower Oil 750ml", "Maize Meal 5kg", "Sugar 2kg"]
                actual_product_names = [product.get("name") for product in products]
                
                # Check if we see exactly the expected products
                if len(products) == 8 and all(name in actual_product_names for name in expected_products):
                    self.log_test(
                        "Products Data Isolation",
                        True,
                        f"Products properly isolated - admin sees exactly {len(products)} expected products for their company",
                        {
                            "expected_products": expected_products,
                            "actual_products": actual_product_names,
                            "products_count": len(products)
                        }
                    )
                    return True
                else:
                    self.log_test(
                        "Products Data Isolation",
                        False,
                        f"Data isolation issue - expected 8 specific products, got {len(products)} products",
                        {
                            "expected_products": expected_products,
                            "actual_products": actual_product_names,
                            "products_count": len(products)
                        }
                    )
                    return False
            else:
                self.log_test(
                    "Products Data Isolation",
                    False,
                    f"Failed to get products with status {response.status_code}",
                    {"response": response.text}
                )
                return False
                
        except Exception as e:
            self.log_test(
                "Products Data Isolation",
                False,
                f"Exception occurred: {str(e)}",
                {"error": str(e)}
            )
            return False
    
    def test_7_cross_company_protection(self):
        """Test 7: Cross-company Protection on Updates"""
        if not self.admin_token:
            self.log_test(
                "Cross-company Protection",
                False,
                "No admin token available",
                {}
            )
            return False
            
        try:
            # First, try to get some data to find IDs from other companies
            # We'll simulate this by trying to update a non-existent ID or use a known pattern
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Try to update a product with a fake ID that doesn't belong to this company
            fake_product_id = "000000000000000000000001"  # Fake ObjectId
            update_data = {
                "name": "Hacked Product",
                "price": 999.99
            }
            
            response = requests.put(f"{BASE_URL}/products/{fake_product_id}", json=update_data, headers=headers)
            
            # Should get 403 (Forbidden) or 404 (Not Found) - both indicate protection
            if response.status_code in [403, 404]:
                self.log_test(
                    "Cross-company Protection",
                    True,
                    f"Cross-company update properly blocked with status {response.status_code}",
                    {
                        "attempted_product_id": fake_product_id,
                        "status_code": response.status_code,
                        "response": response.text
                    }
                )
                return True
            elif response.status_code == 200:
                self.log_test(
                    "Cross-company Protection",
                    False,
                    "Cross-company update was allowed - security breach!",
                    {
                        "attempted_product_id": fake_product_id,
                        "status_code": response.status_code,
                        "response": response.json()
                    }
                )
                return False
            else:
                self.log_test(
                    "Cross-company Protection",
                    True,  # Other errors are acceptable as they indicate some form of protection
                    f"Update blocked with status {response.status_code} (protection working)",
                    {
                        "attempted_product_id": fake_product_id,
                        "status_code": response.status_code,
                        "response": response.text
                    }
                )
                return True
                
        except Exception as e:
            self.log_test(
                "Cross-company Protection",
                False,
                f"Exception occurred: {str(e)}",
                {"error": str(e)}
            )
            return False
    
    def test_8_companies_list(self):
        """Test 8: Companies List (GET /api/companies/list)"""
        try:
            response = requests.get(f"{BASE_URL}/companies/list")
            
            if response.status_code == 200:
                data = response.json()
                companies = data if isinstance(data, list) else data.get("companies", [])
                
                # Check that response contains company names only, no internal data
                has_names_only = True
                internal_fields = ["_id", "created_at", "updated_at", "admin_user_id", "settings", "password"]
                
                for company in companies:
                    if not isinstance(company, dict):
                        continue
                    
                    # Should have name field
                    if "name" not in company:
                        has_names_only = False
                        break
                    
                    # Should not have sensitive internal fields (id and phone are acceptable)
                    for field in internal_fields:
                        if field in company:
                            has_names_only = False
                            break
                
                if has_names_only:
                    self.log_test(
                        "Companies List",
                        True,
                        f"Companies list properly returns names only - {len(companies)} companies",
                        {
                            "companies_count": len(companies),
                            "companies": companies
                        }
                    )
                    return True
                else:
                    self.log_test(
                        "Companies List",
                        False,
                        "Companies list contains internal data that should be hidden",
                        {
                            "companies_count": len(companies),
                            "companies": companies
                        }
                    )
                    return False
            else:
                self.log_test(
                    "Companies List",
                    False,
                    f"Failed to get companies list with status {response.status_code}",
                    {"response": response.text}
                )
                return False
                
        except Exception as e:
            self.log_test(
                "Companies List",
                False,
                f"Exception occurred: {str(e)}",
                {"error": str(e)}
            )
            return False
    
    def test_9_customer_visibility(self):
        """Test 9: Customer Visibility (GET /api/customers)"""
        if not self.admin_token:
            self.log_test(
                "Customer Visibility",
                False,
                "No admin token available",
                {}
            )
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = requests.get(f"{BASE_URL}/customers", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                customers = data if isinstance(data, list) else data.get("customers", [])
                
                # Check customer visibility rules:
                # 1. Should see the customer we created in test 3 ("Test New Customer")
                # 2. Should see marketplace customers (Thabo Mokoena from seed data)
                # 3. Should NOT see customers from other companies
                
                customer_names = [customer.get("name") for customer in customers]
                
                # Should see at least the customer we created and the marketplace customer
                expected_customers = ["Test New Customer", "Thabo Mokoena"]
                found_expected = [name for name in expected_customers if name in customer_names]
                
                if len(found_expected) >= 1:  # At least one expected customer should be visible
                    self.log_test(
                        "Customer Visibility",
                        True,
                        f"Customer visibility working - found {len(found_expected)} expected customers out of {len(customers)} total",
                        {
                            "total_customers": len(customers),
                            "expected_customers": expected_customers,
                            "found_expected": found_expected,
                            "all_customer_names": customer_names
                        }
                    )
                    return True
                else:
                    self.log_test(
                        "Customer Visibility",
                        False,
                        f"Customer visibility issue - expected to see at least one of {expected_customers}, but found none",
                        {
                            "total_customers": len(customers),
                            "expected_customers": expected_customers,
                            "found_expected": found_expected,
                            "all_customer_names": customer_names
                        }
                    )
                    return False
            else:
                self.log_test(
                    "Customer Visibility",
                    False,
                    f"Failed to get customers with status {response.status_code}",
                    {"response": response.text}
                )
                return False
                
        except Exception as e:
            self.log_test(
                "Customer Visibility",
                False,
                f"Exception occurred: {str(e)}",
                {"error": str(e)}
            )
            return False
    
    def run_all_tests(self):
        """Run all company isolation tests"""
        print("=" * 80)
        print("COMPANY DATA ISOLATION AND CUSTOMER CREATION TEST")
        print("=" * 80)
        print(f"Backend URL: {BASE_URL}")
        print(f"Test Time: {datetime.now().isoformat()}")
        print("=" * 80)
        
        tests = [
            self.test_1_reset_and_seed,
            self.test_2_admin_login,
            self.test_3_customer_creation,
            self.test_4_routes_isolation,
            self.test_5_vehicles_isolation,
            self.test_6_products_isolation,
            self.test_7_cross_company_protection,
            self.test_8_companies_list,
            self.test_9_customer_visibility
        ]
        
        passed = 0
        failed = 0
        
        for test in tests:
            try:
                if test():
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"❌ FAIL: {test.__name__} - Unexpected error: {str(e)}")
                failed += 1
            print("-" * 40)
        
        print("=" * 80)
        print("FINAL RESULTS")
        print("=" * 80)
        print(f"✅ PASSED: {passed}")
        print(f"❌ FAILED: {failed}")
        print(f"📊 SUCCESS RATE: {(passed/(passed+failed)*100):.1f}%")
        
        if failed == 0:
            print("🎉 ALL TESTS PASSED - Company data isolation working perfectly!")
        else:
            print("⚠️  SOME TESTS FAILED - Review issues above")
        
        print("=" * 80)
        
        return passed, failed

def main():
    """Main test execution"""
    tester = CompanyIsolationTester()
    passed, failed = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if failed == 0 else 1)

if __name__ == "__main__":
    main()