#!/bin/bash

BASE_URL="http://127.0.0.1:8000"

echo "======================================"
echo " Hybrid RBAC/MAC Backend Smoke Test"
echo "======================================"
echo ""

echo "1. Root endpoint"
curl -s "$BASE_URL/" | jq
echo ""

echo "2. Health check"
curl -s "$BASE_URL/health" | jq
echo ""

echo "3. Health details"
curl -s "$BASE_URL/health/details" | jq
echo ""

echo "4. API map"
curl -s "$BASE_URL/system/api-map" | jq '.title, .modules | keys'
echo ""

echo "5. Users"
curl -s "$BASE_URL/users/" | jq
echo ""

echo "6. Roles"
curl -s "$BASE_URL/roles/" | jq
echo ""

echo "7. Resources"
curl -s "$BASE_URL/resources/" | jq
echo ""

echo "8. Departments summary"
curl -s "$BASE_URL/departments/summary" | jq
echo ""

echo "9. Departments tree"
curl -s "$BASE_URL/departments/tree" | jq
echo ""

echo "10. Admin dashboard"
curl -s "$BASE_URL/dashboard/admin" | jq '.statistics, .quick_actions'
echo ""

echo "11. User dashboard for user_id=2"
curl -s "$BASE_URL/dashboard/user/2" | jq
echo ""

echo "12. Access check"
curl -s -X POST "$BASE_URL/access/check" \
-H "Content-Type: application/json" \
-d '{
  "user_id": 2,
  "resource_id": 2,
  "action": "read"
}' | jq
echo ""

echo "13. Audit logs"
curl -s "$BASE_URL/audit/" | jq
echo ""

echo "======================================"
echo " Smoke test completed"
echo "======================================"