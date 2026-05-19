import os
import sys

sys.path.insert(0, r"c:\Users\hamza\OneDrive\Desktop\Cüzdan\backend")

import main
print("main.py imported from:", main.__file__)

import routers
print("routers package imported from:", routers.__file__)

import routers.products as products
print("routers.products module imported from:", products.__file__)
