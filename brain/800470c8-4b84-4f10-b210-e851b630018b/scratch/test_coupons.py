import httpx

url = "http://localhost:8000/api/sepet/kuponlar"

client = httpx.Client(base_url="http://localhost:8000")

# Register a new test user to be sure of the credentials
reg_payload = {
    "kullanici_adi": "coupon_test_user",
    "email": "coupon_test@test.com",
    "sifre": "Password123",
    "ad_soyad": "Coupon Tester",
    "yas": 25,
    "cinsiyet": "erkek",
    "telefon": "5559999999",
    "kvkk_onay": True
}

try:
    reg_res = client.post("/api/auth/kayit/musteri", json=reg_payload)
    print("Registration response:", reg_res.json())
except Exception as e:
    print("Registration error (maybe already exists):", e)

# Login
login_res = client.post("/api/auth/giris", json={"kullanici_adi": "coupon_test_user", "sifre": "Password123"})
print("Login response status:", login_res.status_code)
print("Login response json:", login_res.json())
token = login_res.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

print("Login successful! Token acquired.")

# Test sepet/kuponlar with product ID 26 (belongs to company 11, which has coupon YAZINDIRIMI50)
payload = {
    "urun_ids": [26]
}
res = client.post("/api/sepet/kuponlar", json=payload, headers=headers)
print("Sepet kuponlari for product 26:", res.json())

# Test with product ID 1 (belongs to no company / sirket_id is null)
payload2 = {
    "urun_ids": [1]
}
res2 = client.post("/api/sepet/kuponlar", json=payload2, headers=headers)
print("Sepet kuponlari for product 1:", res2.json())
