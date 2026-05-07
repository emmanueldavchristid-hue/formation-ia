"""
Couche d'abstraction LLM.
Pour passer de Ollama/Mistral à OpenAI GPT-4 :
  → changer LLM_PROVIDER=openai dans .env
  → ajouter OPENAI_API_KEY dans .env
  → rien d'autre à toucher dans le reste du code
"""
import requests
from config import settings


def _chat_ollama(messages: list[dict]) -> str:
    response = requests.post(
        f"{settings.OLLAMA_BASE_URL}/api/chat",
        json={"model": settings.OLLAMA_MODEL, "messages": messages, "stream": False},
        timeout=None
    )
    response.raise_for_status()
    return response.json()["message"]["content"]


def _chat_openai(messages: list[dict]) -> str:
    # Activé automatiquement si LLM_PROVIDER=openai dans .env
    from openai import OpenAI
    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages
    )
    return resp.choices[0].message.content


def chat(messages: list[dict]) -> str:
    """Point d'entrée unique — le reste du code n'appelle QUE cette fonction."""
    if settings.LLM_PROVIDER == "openai":
        return _chat_openai(messages)
    return _chat_ollama(messages)


def generate(prompt: str, system: str = "") -> str:
    """Raccourci pour une génération simple sans historique."""
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    return chat(messages)
