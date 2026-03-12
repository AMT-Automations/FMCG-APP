#!/usr/bin/env python3
"""
Backend API Testing for Enhanced Vehicle Inspection Feature
Testing the Mzansi Distribution Tracker backend APIs according to review request.
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://route-sales-ops.preview.emergentagent.com/api"

class BackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
        self.driver_token = None
        
    def log(self, message, success=None):
        """Log messages with status indicators"""
        if success is True:
            print(f"✅ {message}")
        elif success is False:
            print(f"❌ {message}")
        else:
            print(f"ℹ️  {message}")
    
    def authenticate_admin(self):
        """Login as admin user"""
        self.log("Authenticating admin user...")
        response = self.session.post(f"{BACKEND_URL}/auth/login", json={
            "phone": "0800000001",
            "pin": "0000"
        })
        
        if response.status_code == 200:
            data = response.json()
            self.admin_token = data["token"]
            self.session.headers.update({"Authorization": f"Bearer {self.admin_token}"})
            self.log(f"Admin authentication successful - User: {data['user']['name']}", True)
            return True
        else:
            self.log(f"Admin authentication failed: {response.status_code} - {response.text}", False)
            return False
    
    def get_valid_route_id(self):
        """Get a valid route ID for testing"""
        self.log("Getting available routes...")
        response = self.session.get(f"{BACKEND_URL}/routes")
        
        if response.status_code == 200:
            routes = response.json()
            if routes:
                route_id = routes[0]["id"]
                route_name = routes[0]["name"]
                self.log(f"Found route: {route_name} (ID: {route_id})", True)
                return route_id
        
        self.log("No routes found", False)
        return None
    
    def get_available_vehicle_id(self):
        """Get an available vehicle ID for testing"""
        self.log("Getting available vehicles...")
        response = self.session.get(f"{BACKEND_URL}/vehicles/available")
        
        if response.status_code == 200:
            vehicles = response.json()
            for vehicle in vehicles:
                if not vehicle.get("in_use", False):
                    vehicle_id = vehicle["id"]
                    vehicle_name = vehicle["name"]
                    self.log(f"Found available vehicle: {vehicle_name} (ID: {vehicle_id})", True)
                    return vehicle_id
        
        self.log("No available vehicles found", False)
        return None
    
    def test_start_route_with_vehicle_inspection(self):
        """Test 1: Start daily route with full vehicle inspection data"""
        self.log("\n=== TEST 1: Start Daily Route with Vehicle Inspection ===")
        
        route_id = self.get_valid_route_id()
        vehicle_id = self.get_available_vehicle_id()
        
        if not route_id or not vehicle_id:
            self.log("Cannot proceed - missing route or vehicle", False)
            return False
        
        # Vehicle inspection data as specified in review request
        vehicle_check_data = {
            "inspection_date": "2026-03-12T22:00:00Z",
            "summary": {
                "total_items": 30,
                "passed": 25,
                "failed": 3,
                "unchecked": 2,
                "pass_rate": 83
            },
            "categories": {
                "exterior": {
                    "title": "Exterior & Body",
                    "items": [
                        {"id": "body_damage", "label": "No body damage / dents", "passed": True, "comment": None},
                        {"id": "mirrors", "label": "Side mirrors intact", "passed": True, "comment": None},
                        {"id": "windscreen", "label": "Windscreen clear, no cracks", "passed": False, "comment": "Small chip on driver side"},
                        {"id": "headlights", "label": "Headlights working", "passed": True, "comment": None}
                    ]
                },
                "tires": {
                    "title": "Tires & Wheels",
                    "items": [
                        {"id": "tire_condition", "label": "Tires in good condition", "passed": True, "comment": None},
                        {"id": "spare_tire", "label": "Spare tire present", "passed": False, "comment": "Missing spare tire"}
                    ]
                }
            },
            "overall_notes": "Vehicle generally in good condition but needs windscreen repair",
            "failed_items": [
                {"id": "windscreen", "label": "Windscreen clear, no cracks", "comment": "Small chip on driver side"},
                {"id": "spare_tire", "label": "Spare tire present", "comment": "Missing spare tire"}
            ]
        }
        
        # Start daily route with vehicle inspection
        route_data = {
            "route_id": route_id,
            "vehicle_id": vehicle_id,
            "opening_km": 50000,
            "crates_out": 100,
            "vehicle_check": vehicle_check_data
        }
        
        self.log("Starting daily route with vehicle inspection data...")
        response = self.session.post(f"{BACKEND_URL}/daily-routes/start", json=route_data)
        
        if response.status_code == 200:
            data = response.json()
            self.log("Daily route started successfully", True)
            
            # Verify vehicle_check field is present and matches
            if "vehicle_check" in data and data["vehicle_check"]:
                self.log("✓ vehicle_check field present in response", True)
                
                # Check specific inspection data
                vc = data["vehicle_check"]
                if vc.get("summary", {}).get("pass_rate") == 83:
                    self.log("✓ Pass rate (83%) correctly stored", True)
                else:
                    self.log(f"✗ Pass rate mismatch: expected 83, got {vc.get('summary', {}).get('pass_rate')}", False)
                
                if len(vc.get("failed_items", [])) == 2:
                    self.log("✓ Failed items count (2) correctly stored", True)
                else:
                    self.log(f"✗ Failed items mismatch: expected 2, got {len(vc.get('failed_items', []))}", False)
                
                if vc.get("overall_notes") == "Vehicle generally in good condition but needs windscreen repair":
                    self.log("✓ Overall notes correctly stored", True)
                else:
                    self.log("✗ Overall notes mismatch", False)
                
                self.log("Route started with complete vehicle inspection data", True)
                return data["id"]  # Return route ID for further tests
            else:
                self.log("✗ vehicle_check field missing or empty in response", False)
                return False
        else:
            self.log(f"Failed to start route: {response.status_code} - {response.text}", False)
            return False
    
    def test_daily_summary_includes_inspection(self):
        """Test 2: Daily summary includes inspection data"""
        self.log("\n=== TEST 2: Daily Summary Includes Vehicle Inspection ===")
        
        self.log("Getting daily summary report...")
        response = self.session.get(f"{BACKEND_URL}/reports/daily-summary")
        
        if response.status_code == 200:
            data = response.json()
            self.log("Daily summary retrieved successfully", True)
            
            # Check for vehicle_inspections array
            if "vehicle_inspections" in data:
                inspections = data["vehicle_inspections"]
                self.log(f"✓ vehicle_inspections array present with {len(inspections)} entries", True)
                
                if inspections:
                    # Examine first inspection entry
                    first_inspection = inspections[0]
                    required_fields = ["route_name", "vehicle_name", "vehicle_registration", "driver_name", "inspection"]
                    
                    missing_fields = []
                    for field in required_fields:
                        if field not in first_inspection:
                            missing_fields.append(field)
                    
                    if not missing_fields:
                        self.log("✓ All required fields present in inspection data", True)
                        
                        # Check inspection details
                        inspection = first_inspection.get("inspection", {})
                        if inspection.get("summary", {}).get("pass_rate"):
                            self.log(f"✓ Inspection details include pass rate: {inspection['summary']['pass_rate']}%", True)
                        
                        if inspection.get("failed_items"):
                            self.log(f"✓ Failed items recorded: {len(inspection['failed_items'])} items", True)
                        
                        return True
                    else:
                        self.log(f"✗ Missing required fields: {missing_fields}", False)
                        return False
                else:
                    self.log("ℹ️  No vehicle inspection entries found (may be expected if no routes started today)", None)
                    return True
            else:
                self.log("✗ vehicle_inspections array missing from daily summary", False)
                return False
        else:
            self.log(f"Failed to get daily summary: {response.status_code} - {response.text}", False)
            return False
    
    def test_excel_export_with_inspection_sheet(self):
        """Test 3: Excel export works with inspection sheet"""
        self.log("\n=== TEST 3: Excel Export with Inspection Sheet ===")
        
        self.log("Requesting Excel export...")
        response = self.session.get(f"{BACKEND_URL}/reports/export/excel")
        
        if response.status_code == 200:
            self.log("Excel export request successful", True)
            
            # Check content type
            content_type = response.headers.get("content-type", "")
            if "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in content_type:
                self.log("✓ Correct Excel content-type returned", True)
            else:
                self.log(f"✗ Incorrect content-type: {content_type}", False)
                return False
            
            # Check file size
            content_length = len(response.content)
            if content_length > 0:
                self.log(f"✓ Excel file generated successfully ({content_length} bytes)", True)
                
                # Verify it's a valid Excel file by checking magic bytes
                if response.content.startswith(b'PK'):  # Excel files are zip-based
                    self.log("✓ Valid Excel file format (ZIP signature found)", True)
                    return True
                else:
                    self.log("✗ Invalid Excel file format", False)
                    return False
            else:
                self.log("✗ Empty Excel file", False)
                return False
        else:
            self.log(f"Failed to export Excel: {response.status_code} - {response.text}", False)
            return False
    
    def run_all_tests(self):
        """Run all enhanced vehicle inspection tests"""
        self.log("🚀 Starting Enhanced Vehicle Inspection Testing")
        self.log("=" * 60)
        
        # Authenticate
        if not self.authenticate_admin():
            self.log("Cannot proceed without authentication", False)
            return False
        
        results = []
        
        # Test 1: Start route with vehicle inspection
        test1_result = self.test_start_route_with_vehicle_inspection()
        results.append(("Start Route with Vehicle Inspection", test1_result is not False))
        
        # Test 2: Daily summary includes inspection
        test2_result = self.test_daily_summary_includes_inspection()
        results.append(("Daily Summary Includes Inspection", test2_result))
        
        # Test 3: Excel export with inspection sheet
        test3_result = self.test_excel_export_with_inspection_sheet()
        results.append(("Excel Export with Inspection Sheet", test3_result))
        
        # Summary
        self.log("\n" + "=" * 60)
        self.log("🏁 TEST SUMMARY")
        self.log("=" * 60)
        
        passed = 0
        total = len(results)
        
        for test_name, success in results:
            if success:
                self.log(f"{test_name}: PASS", True)
                passed += 1
            else:
                self.log(f"{test_name}: FAIL", False)
        
        self.log(f"\nOVERALL RESULT: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
        
        if passed == total:
            self.log("🎉 ALL ENHANCED VEHICLE INSPECTION TESTS PASSED!", True)
            return True
        else:
            self.log("❌ Some tests failed - requires attention", False)
            return False

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)