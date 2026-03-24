#!/bin/bash

# QuickInk Backend API Test Script
# Run this to test all API endpoints

BASE_URL=\"https://instant-print-hub-2.preview.emergentagent.com\"
SERVICE_ROLE_KEY=\"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhoemZybXBiaGFzbmlwaXJjY250Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM3MjY0MSwiZXhwIjoyMDg5OTQ4NjQxfQ.XlcqNYbgxxw73R31YTsCz1iSm14D4m32ootUjqCa4gA\"

echo \"🚀 QuickInk Backend API Tests\"
echo \"=============================\"
echo \"\"

# Test 1: Get Machines
echo \"📍 Test 1: GET /api/machines\"
curl -s -X GET \"$BASE_URL/api/machines\" | jq '.'
echo \"\"
echo \"\"

# Test 2: Get Machines with Filter
echo \"📍 Test 2: GET /api/machines?status=online&limit=3\"
curl -s -X GET \"$BASE_URL/api/machines?status=online&limit=3\" | jq '.'
echo \"\"
echo \"\"

# Test 3: Create Partner
echo \"👥 Test 3: POST /api/partners\"
curl -s -X POST \"$BASE_URL/api/partners\" \
  -H \"Content-Type: application/json\" \
  -d '{
    \"name\": \"Test Partner\",
    \"shop_name\": \"Test Shop\",
    \"location\": \"House 123, Road 5, Dhanmondi, Dhaka\",
    \"phone\": \"01712345678\"
  }' | jq '.'
echo \"\"
echo \"\"

# Test 4: Get All Partners
echo \"👥 Test 4: GET /api/partners\"
curl -s -X GET \"$BASE_URL/api/partners\" | jq '.'
echo \"\"
echo \"\"

# Test 5: Create Test File and Upload
echo \"📤 Test 5: POST /api/upload (creating test file)\"
echo \"This is a test document for QuickInk printing\" > /tmp/test-quickink.txt
curl -s -X POST \"$BASE_URL/api/upload\" \
  -F \"file=@/tmp/test-quickink.txt\" \
  -F \"pages=1\" \
  -F \"color_mode=bw\" | jq '.'
echo \"\"
echo \"\"

# Test 6: Get All Print Jobs
echo \"📄 Test 6: GET /api/jobs\"
curl -s -X GET \"$BASE_URL/api/jobs?limit=5\" | jq '.'
echo \"\"
echo \"\"

# Test 7: Get Specific Job (need to extract ID from previous response)
echo \"📄 Test 7: GET /api/jobs/{id} (skipped - need job ID)\"
echo \"To test: curl $BASE_URL/api/jobs/{job-id}\"
echo \"\"
echo \"\"

# Test 8: Update Machine Status (Admin)
echo \"🔧 Test 8: PATCH /api/machines/{id} (Admin - need machine ID)\"
echo \"To test: curl -X PATCH $BASE_URL/api/machines/{machine-id} \\\\\"
echo \"  -H \\\"Authorization: Bearer $SERVICE_ROLE_KEY\\\" \\\\\"
echo \"  -H \\\"Content-Type: application/json\\\" \\\\\"
echo \"  -d '{\\\"status\\\": \\\"offline\\\"}'\"
echo \"\"
echo \"\"

# Test 9: Update Job Status (Admin)
echo \"🔧 Test 9: PATCH /api/jobs/{id}/update (Admin - need job ID)\"
echo \"To test: curl -X PATCH $BASE_URL/api/jobs/{job-id}/update \\\\\"
echo \"  -H \\\"Authorization: Bearer $SERVICE_ROLE_KEY\\\" \\\\\"
echo \"  -H \\\"Content-Type: application/json\\\" \\\\\"
echo \"  -d '{\\\"status\\\": \\\"printed\\\"}'\"
echo \"\"
echo \"\"

echo \"✅ API Tests Complete!\"
echo \"\"
echo \"💡 Tips:\"
echo \"- Install jq for prettier JSON output: apt-get install jq\"
echo \"- Save job/machine IDs from responses to test update endpoints\"
echo \"- Check Supabase dashboard to verify data is saved\"
