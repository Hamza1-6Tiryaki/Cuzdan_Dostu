import urllib.request
import urllib.error
import json
import uuid

base_url = "http://localhost:8000/api"
rand = str(uuid.uuid4())[:8]

def request(path, data=None, token=None, method=None):
    url = base_url + path
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
        
    if not method:
        method = "POST" if data else "GET"
        
    req = urllib.request.Request(
        url, 
        data=json.dumps(data).encode("utf-8") if data else None, 
        headers=headers, 
        method=method
    )
    try:
        with urllib.request.urlopen(req) as res:
            return res.status, res.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")
    except Exception as e:
        return 0, str(e)

# 1. Register a company
reg_data = {
    "kullanici_adi": f"corp_{rand}",
    "email": f"corp_{rand}@test.com",
    "sifre": "123456",
    "kurum_adi": "Test Corp Inc",
    "sirket_kategorisi": "Teknoloji",
    "aciklama": "This is a test company.",
    "kvkk_onay": True
}
status, body = request("/auth/kayit/sirket", reg_data)
print("Register Company:", status, body)

# 2. Login
login_data = {
    "kullanici_adi": f"corp_{rand}",
    "sifre": "123456"
}
status, body = request("/auth/giris", login_data)
print("Login:", status, body)
token = None
if status == 200:
    token = json.loads(body)["access_token"]

# 3. Request sirket urunleri
if token:
    status, body = request("/urunler/sirket", token=token)
    print("GET /urunler/sirket:", status, body)
