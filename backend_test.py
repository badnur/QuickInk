#!/usr/bin/env python3
"""
QuickInk MVP Backend API Testing Script
Tests all backend API endpoints for functionality and validation
"""

import requests
import json
import sys
import os
from datetime import datetime

# Get base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://instant-print-hub-2.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

def print_test_header(test_name):
    """Print formatted test header"""
    print(f"\n{'='*60}")
    print(f"TESTING: {test_name}")
    print(f"{'='*60}")

def print_test_result(test_name, success, details=""):
    """Print formatted test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} - {test_name}")
    if details:
        print(f"   Details: {details}")

def test_get_machines():
    """Test GET /api/machines endpoint"""
    print_test_header("GET /api/machines - Printer Locations")
    
    try:
        response = requests.get(f"{API_BASE}/machines", timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Verify response structure
            if 'success' in data and data['success']:
                if 'machines' in data and 'count' in data:
                    machines = data['machines']
                    count = data['count']
                    
                    # Verify we have 8 machines
                    if count == 8 and len(machines) == 8:
                        # Verify machine structure
                        required_fields = ['id', 'name', 'latitude', 'longitude', 'address', 'status', 'paper_available', 'distance']
                        first_machine = machines[0]
                        
                        missing_fields = [field for field in required_fields if field not in first_machine]
                        if not missing_fields:
                            print_test_result("GET /api/machines", True, f"Returned {count} machines with correct structure")
                            return True
                        else:
                            print_test_result("GET /api/machines", False, f"Missing fields in machine data: {missing_fields}")
                            return False
                    else:
                        print_test_result("GET /api/machines", False, f"Expected 8 machines, got {count}")
                        return False
                else:
                    print_test_result("GET /api/machines", False, "Missing 'machines' or 'count' in response")
                    return False
            else:
                print_test_result("GET /api/machines", False, "Response success is false or missing")
                return False
        else:
            print_test_result("GET /api/machines", False, f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("GET /api/machines", False, f"Exception: {str(e)}")
        return False

def test_post_partners_valid():
    """Test POST /api/partners with valid data"""
    print_test_header("POST /api/partners - Valid Partner Registration")
    
    partner_data = {
        "name": "Rajesh Kumar",
        "shop_name": "Kumar Stationery Store",
        "location": "Andheri West, Mumbai",
        "phone": "+91-9876543210"
    }
    
    try:
        response = requests.post(
            f"{API_BASE}/partners", 
            json=partner_data,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Verify response structure
            if 'success' in data and data['success']:
                if 'partner' in data and 'message' in data:
                    partner = data['partner']
                    required_fields = ['id', 'name', 'shop_name', 'location', 'phone', 'created_at', 'status']
                    
                    missing_fields = [field for field in required_fields if field not in partner]
                    if not missing_fields:
                        # Verify data matches input
                        if (partner['name'] == partner_data['name'] and 
                            partner['shop_name'] == partner_data['shop_name'] and
                            partner['location'] == partner_data['location'] and
                            partner['phone'] == partner_data['phone'] and
                            partner['status'] == 'pending'):
                            print_test_result("POST /api/partners (valid)", True, "Partner created successfully with correct data")
                            return True
                        else:
                            print_test_result("POST /api/partners (valid)", False, "Partner data doesn't match input")
                            return False
                    else:
                        print_test_result("POST /api/partners (valid)", False, f"Missing fields in partner: {missing_fields}")
                        return False
                else:
                    print_test_result("POST /api/partners (valid)", False, "Missing 'partner' or 'message' in response")
                    return False
            else:
                print_test_result("POST /api/partners (valid)", False, "Response success is false or missing")
                return False
        else:
            print_test_result("POST /api/partners (valid)", False, f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("POST /api/partners (valid)", False, f"Exception: {str(e)}")
        return False

def test_post_partners_invalid():
    """Test POST /api/partners with invalid data (missing fields)"""
    print_test_header("POST /api/partners - Invalid Data (Missing Fields)")
    
    # Test with missing required fields
    invalid_data = {
        "name": "Test Partner",
        "shop_name": "Test Shop"
        # Missing location and phone
    }
    
    try:
        response = requests.post(
            f"{API_BASE}/partners", 
            json=invalid_data,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 400:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            if 'error' in data and 'All fields are required' in data['error']:
                print_test_result("POST /api/partners (invalid)", True, "Correctly returned 400 error for missing fields")
                return True
            else:
                print_test_result("POST /api/partners (invalid)", False, "Error message not as expected")
                return False
        else:
            print_test_result("POST /api/partners (invalid)", False, f"Expected 400, got {response.status_code}")
            return False
            
    except Exception as e:
        print_test_result("POST /api/partners (invalid)", False, f"Exception: {str(e)}")
        return False

def test_post_contact_valid():
    """Test POST /api/contact with valid data"""
    print_test_header("POST /api/contact - Valid Contact Form")
    
    contact_data = {
        "name": "Priya Sharma",
        "email": "priya.sharma@email.com",
        "subject": "Printer Location Query",
        "message": "Hi, I would like to know if you have any printers near Bandra station. Thank you!"
    }
    
    try:
        response = requests.post(
            f"{API_BASE}/contact", 
            json=contact_data,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Verify response structure
            if 'success' in data and data['success']:
                if 'contact' in data and 'message' in data:
                    contact = data['contact']
                    required_fields = ['id', 'name', 'email', 'subject', 'message', 'created_at', 'status']
                    
                    missing_fields = [field for field in required_fields if field not in contact]
                    if not missing_fields:
                        # Verify data matches input
                        if (contact['name'] == contact_data['name'] and 
                            contact['email'] == contact_data['email'] and
                            contact['subject'] == contact_data['subject'] and
                            contact['message'] == contact_data['message'] and
                            contact['status'] == 'unread'):
                            print_test_result("POST /api/contact (valid)", True, "Contact message created successfully")
                            return True
                        else:
                            print_test_result("POST /api/contact (valid)", False, "Contact data doesn't match input")
                            return False
                    else:
                        print_test_result("POST /api/contact (valid)", False, f"Missing fields in contact: {missing_fields}")
                        return False
                else:
                    print_test_result("POST /api/contact (valid)", False, "Missing 'contact' or 'message' in response")
                    return False
            else:
                print_test_result("POST /api/contact (valid)", False, "Response success is false or missing")
                return False
        else:
            print_test_result("POST /api/contact (valid)", False, f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("POST /api/contact (valid)", False, f"Exception: {str(e)}")
        return False

def test_post_contact_invalid():
    """Test POST /api/contact with invalid data (missing fields)"""
    print_test_header("POST /api/contact - Invalid Data (Missing Fields)")
    
    # Test with missing required fields
    invalid_data = {
        "name": "Test User",
        "email": "test@email.com"
        # Missing subject and message
    }
    
    try:
        response = requests.post(
            f"{API_BASE}/contact", 
            json=invalid_data,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 400:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            if 'error' in data and 'All fields are required' in data['error']:
                print_test_result("POST /api/contact (invalid)", True, "Correctly returned 400 error for missing fields")
                return True
            else:
                print_test_result("POST /api/contact (invalid)", False, "Error message not as expected")
                return False
        else:
            print_test_result("POST /api/contact (invalid)", False, f"Expected 400, got {response.status_code}")
            return False
            
    except Exception as e:
        print_test_result("POST /api/contact (invalid)", False, f"Exception: {str(e)}")
        return False

def test_get_partners():
    """Test GET /api/partners endpoint"""
    print_test_header("GET /api/partners - Get All Partners")
    
    try:
        response = requests.get(f"{API_BASE}/partners", timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Verify response structure
            if 'success' in data and data['success']:
                if 'partners' in data and 'count' in data:
                    partners = data['partners']
                    count = data['count']
                    
                    # Should have at least 1 partner from previous test
                    if count >= 1 and len(partners) == count:
                        # Verify partner structure if any exist
                        if count > 0:
                            first_partner = partners[0]
                            required_fields = ['id', 'name', 'shop_name', 'location', 'phone', 'created_at', 'status']
                            missing_fields = [field for field in required_fields if field not in first_partner]
                            
                            if not missing_fields:
                                print_test_result("GET /api/partners", True, f"Returned {count} partners with correct structure")
                                return True
                            else:
                                print_test_result("GET /api/partners", False, f"Missing fields in partner data: {missing_fields}")
                                return False
                        else:
                            print_test_result("GET /api/partners", True, "No partners found (empty list)")
                            return True
                    else:
                        print_test_result("GET /api/partners", False, f"Count mismatch: count={count}, array length={len(partners)}")
                        return False
                else:
                    print_test_result("GET /api/partners", False, "Missing 'partners' or 'count' in response")
                    return False
            else:
                print_test_result("GET /api/partners", False, "Response success is false or missing")
                return False
        else:
            print_test_result("GET /api/partners", False, f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print_test_result("GET /api/partners", False, f"Exception: {str(e)}")
        return False

def test_invalid_endpoint():
    """Test invalid endpoint to verify 404 handling"""
    print_test_header("Invalid Endpoint - 404 Error Handling")
    
    try:
        response = requests.get(f"{API_BASE}/invalid-endpoint", timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 404:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            if 'error' in data and 'not found' in data['error'].lower():
                print_test_result("Invalid endpoint (404)", True, "Correctly returned 404 for invalid endpoint")
                return True
            else:
                print_test_result("Invalid endpoint (404)", False, "404 response but error message not as expected")
                return False
        else:
            print_test_result("Invalid endpoint (404)", False, f"Expected 404, got {response.status_code}")
            return False
            
    except Exception as e:
        print_test_result("Invalid endpoint (404)", False, f"Exception: {str(e)}")
        return False

def main():
    """Run all backend API tests"""
    print(f"QuickInk MVP Backend API Testing")
    print(f"Testing against: {API_BASE}")
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Track test results
    test_results = []
    
    # Run all tests in sequence
    test_results.append(("GET /api/machines", test_get_machines()))
    test_results.append(("POST /api/partners (valid)", test_post_partners_valid()))
    test_results.append(("POST /api/partners (invalid)", test_post_partners_invalid()))
    test_results.append(("POST /api/contact (valid)", test_post_contact_valid()))
    test_results.append(("POST /api/contact (invalid)", test_post_contact_invalid()))
    test_results.append(("GET /api/partners", test_get_partners()))
    test_results.append(("Invalid endpoint (404)", test_invalid_endpoint()))
    
    # Print summary
    print(f"\n{'='*60}")
    print("TEST SUMMARY")
    print(f"{'='*60}")
    
    passed = 0
    failed = 0
    
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
        if result:
            passed += 1
        else:
            failed += 1
    
    print(f"\nTotal Tests: {len(test_results)}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Success Rate: {(passed/len(test_results)*100):.1f}%")
    
    if failed > 0:
        print(f"\n❌ {failed} test(s) failed. Check the details above.")
        sys.exit(1)
    else:
        print(f"\n✅ All tests passed successfully!")
        sys.exit(0)

if __name__ == "__main__":
    main()