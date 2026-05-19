import urllib.request
import urllib.error
import json

endpoints = [
    "/api/urunler/1",
    "/api/urunler/16",
    "/api/urunler/muadil/1",
    "/api/urunler/muadil/16"
]

for ep in endpoints:
    url = f"http://localhost:8000{ep}"
    print("\n--- Requesting:", url)
    try:
        with urllib.request.urlopen(url) as response:
            status = response.status
            body = response.read().decode('utf-8')
            print(f"Status: {status}")
            print("Body:", body[:200])
    except urllib.error.HTTPError as e:
        print(f"HTTPError Status: {e.code}")
        print("HTTPError Body:", e.read().decode('utf-8'))
    except Exception as e:
        print("Error:", e)
