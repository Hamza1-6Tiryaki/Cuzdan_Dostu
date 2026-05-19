import sqlite3

def check():
    conn = sqlite3.connect("c:\\Users\\hamza\\OneDrive\\Desktop\\Cüzdan\\backend\\data\\cuzdan.db")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT id, ad, kategori, fiyat FROM urunler WHERE ad LIKE '%LEGO%' OR ad LIKE '%Dede%'")
    rows = cursor.fetchall()
    print("=== DATABASE PRODUCT CATEGORIES ===")
    for r in rows:
        print(f"ID: {r['id']} | Name: {r['ad']} | Category: {r['kategori']} | Price: {r['fiyat']} TL")
    conn.close()

if __name__ == "__main__":
    check()
