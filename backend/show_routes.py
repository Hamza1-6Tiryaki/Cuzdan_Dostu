from main import app

print("=== FASTAPI ROUTE TABLE ===")
for route in app.routes:
    methods = ", ".join(route.methods) if hasattr(route, "methods") else "None"
    print(f"Path: {route.path:35} | Methods: {methods:15} | Name: {route.name}")
