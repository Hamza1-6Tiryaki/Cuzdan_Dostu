import urllib.request

url = "http://localhost:8000/openapi.json"
try:
    with urllib.request.urlopen(url) as response:
        body = response.read().decode('utf-8')
        print("Schema length:", len(body))
        print("Contains 'muadil':", "muadil" in body)
        print("Contains 'ucuz_muadil_bul':", "ucuz_muadil_bul" in body)
        # Search for any occurrences
        idx = body.find("muadil")
        while idx != -1:
            print(f"Found 'muadil' at context: {body[max(0, idx-50):min(len(body), idx+100)]}")
            idx = body.find("muadil", idx+1)
except Exception as e:
    print("Error:", e)
