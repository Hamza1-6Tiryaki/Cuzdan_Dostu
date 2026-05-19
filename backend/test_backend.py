import urllib.request
import urllib.error
import json
import uuid

base_url = "http://localhost:8000/api"
rand = str(uuid.uuid4())[:8]

def request(path, data=None, token=None):
    url = base_url + path
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
        
    req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8") if data else None, headers=headers, method="POST" if data else "GET")
    try:
        with urllib.request.urlopen(req) as res:
            return res.status, res.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")
    except Exception as e:
        return 0, str(e)

# 1. Register
reg_data = {
    "kullanici_adi": f"test_{rand}",
    "email": f"test_{rand}@test.com",
    "sifre": "123456",
    "ad_soyad": "Test User",
    "kvkk_onay": True
}
status, body = request("/auth/kayit/musteri", reg_data)
print("Register:", status, body)

# 2. Login
login_data = {
    "kullanici_adi": f"test_{rand}",
    "sifre": "123456"
}
status, body = request("/auth/giris", login_data)
print("Login:", status, body)
token = None
if status == 200:
    token = json.loads(body)["access_token"]

# 3. Chat
if token:
    chat_data = {
        "mesaj": "Bana harcama önerisi ver",
        "gecmis": []
    }
    status, body = request("/chat", chat_data, token)
    print("Chat:", status, body)
