import urllib.request

url = "http://localhost:8000/"
try:
    with urllib.request.urlopen(url) as response:
        body = response.read()
        print("Status:", response.status)
        print("Body bytes:", body)
        print("Body text (utf-8):", body.decode('utf-8', errors='ignore'))
except Exception as e:
    print("Error:", e)
