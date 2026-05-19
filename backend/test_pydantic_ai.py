import asyncio
import os
from dotenv import load_dotenv
load_dotenv()
from pydantic_ai import Agent
from pydantic_ai.models.gemini import GeminiModel
from pydantic_ai.providers.google_gla import GoogleGLAProvider
from pydantic import BaseModel

class AjanYanit(BaseModel):
    yanit: str

async def main():
    api_key = os.getenv("GOOGLE_API_KEY")
    model_id = os.getenv("GEMINI_MODEL", "gemini-flash-lite-latest")
    
    print(f"Model ID: {model_id}")
    try:
        provider = GoogleGLAProvider(api_key=api_key)
        model = GeminiModel(model_id, provider=provider)
        agent = Agent(model=model, output_type=AjanYanit, system_prompt="Sen bir asistansın, Türkçe ve kısaca cevap ver.")
        
        print("Pydantic AI üzerinden Gemini API'ye istek atılıyor...")
        result = await agent.run("Merhaba, adın ne?")
        
        print("---------------------")
        print("✅ BAŞARILI!")
        print("Result attributes:", dir(result))
        print("Ajanın Yanıtı:", getattr(result, 'data', getattr(result, 'message', str(result))))
    except Exception as e:
        print("---------------------")
        print("❌ HATA OLUŞTU:", e)

if __name__ == "__main__":
    asyncio.run(main())
