import requests
from config import settings

def chat(messages: list[dict]) -> str:
    if settings.LLM_PROVIDER == "openai":
        return _chat_openai(messages)
    if settings.LLM_PROVIDER == "groq":
        return _chat_groq(messages)
    return _chat_ollama(messages)

def generate(prompt: str, system: str = "") -> str:
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    return chat(messages)

def _chat_openai(messages: list[dict]) -> str:
    try:
        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        resp = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            max_tokens=2000,
            temperature=0.7
        )
        return resp.choices[0].message.content
    except Exception as e:
        import requests as _req
        print(f"OpenAI echec ({e}), fallback Ollama...")
        response = _req.post(
            f"{settings.OLLAMA_BASE_URL}/api/chat",
            json={"model": settings.OLLAMA_MODEL, "messages": messages, "stream": False},
            timeout=None
        )
        return response.json()["message"]["content"]

def _chat_ollama(messages: list[dict]) -> str:
    response = requests.post(
        f"{settings.OLLAMA_BASE_URL}/api/chat",
        json={"model": settings.OLLAMA_MODEL, "messages": messages, "stream": False},
        timeout=None
    )
    return response.json()["message"]["content"]

def _chat_groq(messages: list[dict]) -> str:
    from groq import Groq
    import os
    client = Groq(api_key=settings.GROQ_API_KEY)
    resp = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        max_tokens=2000,
        temperature=0.7
    )
    return resp.choices[0].message.content
