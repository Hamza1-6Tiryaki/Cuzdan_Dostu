import urllib.request
import urllib.error
import json

url = "http://localhost:8000/api/urunler/muadil/16"
print("Requesting URL:", url)

try:
    with urllib.request.urlopen(url) as response:
        status = response.status
        body = response.read().decode('utf-8')
        print(f"Status: {status}")
        print("Body:", json.dumps(json.loads(body), indent=2))
except urllib.error.HTTPError as e:
    print(f"HTTPError Status: {e.code}")
    print("HTTPError Read:", e.read().decode('utf-8'))
except Exception as e:
    print("Error:", e)
