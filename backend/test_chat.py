import urllib.request
import urllib.error
import json

url = "http://localhost:8000/api/chat"
data = {
    "mesaj": "Merhaba",
    "gecmis": []
}
headers = {
    "Content-Type": "application/json",
    "Origin": "http://localhost:5173"
}

req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers=headers, method="OPTIONS")

try:
    with urllib.request.urlopen(req) as response:
        print("OPTIONS Status:", response.status)
        print("OPTIONS Headers:", response.headers)
        print("OPTIONS Body:", response.read().decode("utf-8"))
except urllib.error.HTTPError as e:
    print("OPTIONS HTTPError Status:", e.code)
    print("OPTIONS HTTPError Headers:", e.headers)
    print("OPTIONS HTTPError Body:", e.read().decode("utf-8"))
except Exception as e:
    print("Other Error:", e)

print("---------------------------------")
req2 = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers=headers, method="POST")

try:
    with urllib.request.urlopen(req2) as response:
        print("POST Status:", response.status)
        print("POST Headers:", response.headers)
        print("POST Body:", response.read().decode("utf-8"))
except urllib.error.HTTPError as e:
    print("POST HTTPError Status:", e.code)
    print("POST HTTPError Headers:", e.headers)
    print("POST HTTPError Body:", e.read().decode("utf-8"))
except Exception as e:
    print("POST Other Error:", e)

