import sqlite3
from pathlib import Path

DB_PATH = Path("c:/Users/hamza/OneDrive/Desktop/Cüzdan/backend/data/cuzdan.db")

def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT SUM(toplam_tutar) FROM siparisler WHERE kullanici_id=4 AND durum != 'iptal' AND strftime('%Y-%m', olusturuldu)='2026-05'")
    print("SUM Query Result:", cur.fetchone()[0])
    
    cur.execute("SELECT strftime('%Y-%m', olusturuldu), olusturuldu FROM siparisler")
    print("Date outputs:")
    for r in cur.fetchall():
        print(r)
    conn.close()

if __name__ == "__main__":
    main()
