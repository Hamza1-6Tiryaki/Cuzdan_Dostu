import urllib.request
import json

url = "http://localhost:8000/openapi.json"
print("Fetching OpenAPI schema from:", url)

try:
    with urllib.request.urlopen(url) as response:
        body = response.read().decode('utf-8')
        schema = json.loads(body)
        paths = list(schema.get("paths", {}).keys())
        print("Total paths in running server:", len(paths))
        print("Paths:")
        for path in sorted(paths):
            print("  ", path)
except Exception as e:
    print("Error:", e)
