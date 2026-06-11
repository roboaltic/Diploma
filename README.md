# Diploma
RMAC(beta)
`curl "http://127.0.0.1:8000/audit-logs" | jq` (красивый лог (консоль))
python -m uvicorn app.main:app --reload (перезапуск сервера\ввімкнення
)

---
створення новго користувача (
`curl -X POST "http://127.0.0.1:8000/users" \`

`-H "Content-Type: application/json" \`

`-d '{`

  `"username": "andrii.auditor",`
  
  `"role_ids": [3],`
  
  `"clearance_level": 2,`
  
 ` "department": "finance"`

`}' | jq`
)
