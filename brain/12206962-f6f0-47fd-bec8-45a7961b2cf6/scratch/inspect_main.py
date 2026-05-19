import sys
sys.path.insert(0, r"c:\Users\hamza\OneDrive\Desktop\Cüzdan\backend")

from main import app

print("Paths in main.app:")
for r in app.routes:
    methods = ", ".join(r.methods) if hasattr(r, "methods") else "None"
    print(f"  Path: {r.path:40} | Name: {r.name:25} | Methods: {methods}")
