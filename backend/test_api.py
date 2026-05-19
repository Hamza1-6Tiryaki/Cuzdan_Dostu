import os
from dotenv import load_dotenv
load_dotenv()
import google.generativeai as genai

print(f"API KEY: {os.getenv('GOOGLE_API_KEY')}")

try:
    genai.configure(api_key=os.getenv('GOOGLE_API_KEY'))
    model_name = os.getenv('GEMINI_MODEL', 'gemini-1.5-flash')
    print(f"Testing model: {model_name}")
    m = genai.GenerativeModel(model_name)
    response = m.generate_content('Merhaba')
    print("Response:")
    print(response.text)
except Exception as e:
    print(f"Error: {e}")
