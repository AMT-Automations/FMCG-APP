#!/usr/bin/env python3
"""
Mzansi FMCG Tracker Multi-Tenancy Backend Test
Test company-scoped data isolation and multi-tenancy functionality
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from frontend environment
BACKEND_URL = "https://order-system-preview-2.preview.emergentagent.com/api"

class MultiTenancyTester:
    def __init__(self):
        self.results = []
        self.company_a_token = None
        self.company_b_token = None
        self.company_a_id = None
        self.company_b_id = None
        
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
    
    def test_1_seed_demo_data(self):
        """Test 1: Seed demo data first"""
        print("\n=== Test 1: Seed Demo Data ===")
        
        response = self.make_request("POST", "/seed-all")
        if isinstance(response, str):
            self.log_result("Seed Demo Data", "FAIL", f"Request failed: {response}")
            return False
            
        if response.status_code == 200:
            self.log_result("Seed Demo Data", "PASS", "Demo data seeded successfully")
            return True
        else:
            self.log_result("Seed Demo Data", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
    
    def test_2_setup_company_a(self):
        """Test 2: Setup Company A"""
        print("\n=== Test 2: Setup Company A ===")
        
        company_a_data = {
            "company": {
                "name": "Alpha Distributors",
                "contact_person": "John",
                "phone": "0111111111"
            },
            "admin_name": "John Alpha", 
            "admin_phone": "0771110001",
            "admin_pin": "1111"
        }
        
        response = self.make_request("POST", "/companies/setup", company_a_data)
        if isinstance(response, str):
            self.log_result("Setup Company A", "FAIL", f"Request failed: {response}")
            return False
            
        if response.status_code == 200:
            data = response.json()
            if "company_id" in data:
                self.company_a_id = data["company_id"]
                self.log_result("Setup Company A", "PASS", f"Company A created with ID: {self.company_a_id}")
                return True
            else:
                self.log_result("Setup Company A", "FAIL", f"No company_id in response: {data}")
                return False
        else:
            self.log_result("Setup Company A", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
    
    def test_3_login_company_a_admin(self):
        """Test 3: Login as Company A admin"""
        print("\n=== Test 3: Login Company A Admin ===")
        
        login_data = {
            "phone": "0771110001",
            "pin": "1111"
        }
        
        response = self.make_request("POST", "/auth/login", login_data)
        if isinstance(response, str):
            self.log_result("Login Company A Admin", "FAIL", f"Request failed: {response}")
            return False
            
        if response.status_code == 200:
            data = response.json()
            if "token" in data and "company" in data:
                self.company_a_token = data["token"]
                company_info = data["company"]
                if company_info and company_info.get("name") == "Alpha Distributors":
                    self.log_result("Login Company A Admin", "PASS", f"Login successful with company: {company_info['name']}")
                    return True
                else:
                    self.log_result("Login Company A Admin", "FAIL", f"Company field missing or incorrect: {data}")
                    return False
            else:
                self.log_result("Login Company A Admin", "FAIL", f"Missing token or company in response: {data}")
                return False
        else:
            self.log_result("Login Company A Admin", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
    
    def test_4_company_a_creates_product(self):
        """Test 4: Company A creates a product"""
        print("\n=== Test 4: Company A Creates Product ===")
        
        if not self.company_a_token:
            self.log_result("Company A Create Product", "FAIL", "No Company A token available")
            return False
        
        product_data = {
            "name": "Alpha Bread",
            "category": "BREAD", 
            "unit_type": "loaf",
            "price": 15.00
        }
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.company_a_token}"
        }
        
        response = self.make_request("POST", "/products", product_data, headers)
        if isinstance(response, str):
            self.log_result("Company A Create Product", "FAIL", f"Request failed: {response}")
            return False
            
        if response.status_code == 200:
            data = response.json()
            if data.get("name") == "Alpha Bread":
                self.log_result("Company A Create Product", "PASS", f"Alpha Bread product created: {data.get('id')}")
                return True
            else:
                self.log_result("Company A Create Product", "FAIL", f"Product creation failed: {data}")
                return False
        else:
            self.log_result("Company A Create Product", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
    
    def test_5_company_a_sees_only_their_product(self):
        """Test 5: Company A sees only their product (NOT demo products)"""
        print("\n=== Test 5: Company A Product Isolation ===")
        
        if not self.company_a_token:
            self.log_result("Company A Product Isolation", "FAIL", "No Company A token available")
            return False
        
        headers = {
            "Authorization": f"Bearer {self.company_a_token}"
        }
        
        response = self.make_request("GET", "/products", None, headers)
        if isinstance(response, str):
            self.log_result("Company A Product Isolation", "FAIL", f"Request failed: {response}")
            return False
            
        if response.status_code == 200:
            products = response.json()
            alpha_bread_found = any(p.get("name") == "Alpha Bread" for p in products)
            demo_products_found = any(p.get("name") in ["White Bread", "Brown Bread", "Maas (500ml)"] for p in products)
            
            if alpha_bread_found and not demo_products_found:
                self.log_result("Company A Product Isolation", "PASS", f"Company A sees only their product: Alpha Bread (found {len(products)} products)")
                return True
            elif not alpha_bread_found:
                self.log_result("Company A Product Isolation", "FAIL", f"Alpha Bread not found in products: {[p.get('name') for p in products]}")
                return False
            else:
                self.log_result("Company A Product Isolation", "FAIL", f"Demo products visible to Company A: {[p.get('name') for p in products]}")
                return False
        else:
            self.log_result("Company A Product Isolation", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
    
    def test_6_setup_company_b(self):
        """Test 6: Setup Company B"""
        print("\n=== Test 6: Setup Company B ===")
        
        company_b_data = {
            "company": {
                "name": "Beta Logistics",
                "contact_person": "Sara", 
                "phone": "0222222222"
            },
            "admin_name": "Sara Beta",
            "admin_phone": "0772220002", 
            "admin_pin": "2222"
        }
        
        response = self.make_request("POST", "/companies/setup", company_b_data)
        if isinstance(response, str):
            self.log_result("Setup Company B", "FAIL", f"Request failed: {response}")
            return False
            
        if response.status_code == 200:
            data = response.json()
            if "company_id" in data:
                self.company_b_id = data["company_id"]
                self.log_result("Setup Company B", "PASS", f"Company B created with ID: {self.company_b_id}")
                return True
            else:
                self.log_result("Setup Company B", "FAIL", f"No company_id in response: {data}")
                return False
        else:
            self.log_result("Setup Company B", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
    
    def test_7_login_company_b_admin(self):
        """Test 7: Login as Company B admin"""
        print("\n=== Test 7: Login Company B Admin ===")
        
        login_data = {
            "phone": "0772220002",
            "pin": "2222"
        }
        
        response = self.make_request("POST", "/auth/login", login_data)
        if isinstance(response, str):
            self.log_result("Login Company B Admin", "FAIL", f"Request failed: {response}")
            return False
            
        if response.status_code == 200:
            data = response.json()
            if "token" in data and "company" in data:
                self.company_b_token = data["token"]
                company_info = data["company"]
                if company_info and company_info.get("name") == "Beta Logistics":
                    self.log_result("Login Company B Admin", "PASS", f"Login successful with company: {company_info['name']}")
                    return True
                else:
                    self.log_result("Login Company B Admin", "FAIL", f"Company field missing or incorrect: {data}")
                    return False
            else:
                self.log_result("Login Company B Admin", "FAIL", f"Missing token or company in response: {data}")
                return False
        else:
            self.log_result("Login Company B Admin", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
    
    def test_8_company_b_sees_no_products(self):
        """Test 8: Company B sees NO products (empty list)"""
        print("\n=== Test 8: Company B Product Isolation ===")
        
        if not self.company_b_token:
            self.log_result("Company B Product Isolation", "FAIL", "No Company B token available")
            return False
        
        headers = {
            "Authorization": f"Bearer {self.company_b_token}"
        }
        
        response = self.make_request("GET", "/products", None, headers)
        if isinstance(response, str):
            self.log_result("Company B Product Isolation", "FAIL", f"Request failed: {response}")
            return False
            
        if response.status_code == 200:
            products = response.json()
            if len(products) == 0:
                self.log_result("Company B Product Isolation", "PASS", "Company B sees empty product list as expected")
                return True
            else:
                self.log_result("Company B Product Isolation", "FAIL", f"Company B should see empty list but found: {[p.get('name') for p in products]}")
                return False
        else:
            self.log_result("Company B Product Isolation", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
    
    def test_9_pdf_excel_exports(self):
        """Test 9: PDF/Excel exports work with authentication"""
        print("\n=== Test 9: PDF/Excel Exports ===")
        
        if not self.company_a_token:
            self.log_result("PDF/Excel Exports", "FAIL", "No Company A token available")
            return False
        
        headers = {
            "Authorization": f"Bearer {self.company_a_token}"
        }
        
        # Test PDF export
        pdf_response = self.make_request("GET", "/reports/export/pdf", None, headers)
        pdf_success = False
        if isinstance(pdf_response, str):
            pdf_details = f"PDF request failed: {pdf_response}"
        elif pdf_response.status_code == 200:
            content_type = pdf_response.headers.get('content-type', '')
            if 'application/pdf' in content_type:
                pdf_success = True
                pdf_details = f"PDF export success ({len(pdf_response.content)} bytes)"
            else:
                pdf_details = f"PDF wrong content-type: {content_type}"
        else:
            pdf_details = f"PDF status: {pdf_response.status_code}"
        
        # Test Excel export  
        excel_response = self.make_request("GET", "/reports/export/excel", None, headers)
        excel_success = False
        if isinstance(excel_response, str):
            excel_details = f"Excel request failed: {excel_response}"
        elif excel_response.status_code == 200:
            content_type = excel_response.headers.get('content-type', '')
            if 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' in content_type or 'application/octet-stream' in content_type:
                excel_success = True
                excel_details = f"Excel export success ({len(excel_response.content)} bytes)"
            else:
                excel_details = f"Excel wrong content-type: {content_type}"
        else:
            excel_details = f"Excel status: {excel_response.status_code}"
        
        if pdf_success and excel_success:
            self.log_result("PDF/Excel Exports", "PASS", f"Both exports working - {pdf_details}, {excel_details}")
            return True
        else:
            self.log_result("PDF/Excel Exports", "FAIL", f"Export issues - {pdf_details}, {excel_details}")
            return False
    
    def run_all_tests(self):
        """Run all multi-tenancy tests"""
        print("🚀 Starting Mzansi FMCG Tracker Multi-Tenancy Backend Tests")
        print(f"Backend URL: {BACKEND_URL}")
        print("=" * 60)
        
        tests = [
            self.test_1_seed_demo_data,
            self.test_2_setup_company_a, 
            self.test_3_login_company_a_admin,
            self.test_4_company_a_creates_product,
            self.test_5_company_a_sees_only_their_product,
            self.test_6_setup_company_b,
            self.test_7_login_company_b_admin,
            self.test_8_company_b_sees_no_products,
            self.test_9_pdf_excel_exports
        ]
        
        passed = 0
        total = len(tests)
        
        for test in tests:
            try:
                if test():
                    passed += 1
            except Exception as e:
                self.log_result(test.__name__, "FAIL", f"Exception: {str(e)}")
        
        print("\n" + "=" * 60)
        print(f"📊 MULTI-TENANCY TEST RESULTS: {passed}/{total} tests passed")
        
        if passed == total:
            print("✅ ALL MULTI-TENANCY TESTS PASSED - Company-scoped data isolation working perfectly")
            return True
        else:
            print(f"❌ {total - passed} TESTS FAILED - Multi-tenancy issues found")
            return False
    
    def get_summary(self):
        """Get test results summary"""
        passed = len([r for r in self.results if r["status"] == "PASS"])
        failed = len([r for r in self.results if r["status"] == "FAIL"])
        
        summary = f"\n=== MULTI-TENANCY TEST SUMMARY ===\n"
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
    tester = MultiTenancyTester()
    success = tester.run_all_tests()
    
    print(tester.get_summary())
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()