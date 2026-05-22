from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import json, base64, asyncio
from loguru import logger
from services.voice_pipeline import VoiceSession

router = APIRouter()

@router.websocket("/ws/voice/{course_id}")
async def voice_websocket(websocket: WebSocket, course_id: str):
    await websocket.accept()
    session = VoiceSession(course_id=course_id, websocket=websocket)
    logger.info(f"Session vocale ouverte : cours {course_id}")

    await websocket.send_text(json.dumps({"type": "ready"}))

    try:
        while True:
            try:
                # Timeout de 60s par message - evite la deconnexion
                msg = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=60.0
                )
            except asyncio.TimeoutError:
                # Envoyer un ping pour garder la connexion vivante
                await websocket.send_text(json.dumps({"type": "ping"}))
                continue

            data = json.loads(msg)

            if data.get("type") == "start_recording":
                session.activate()
                await websocket.send_text(json.dumps({"type": "status", "value": "listening"}))

            elif data.get("type") == "stop_recording":
                session.deactivate()
                # Traiter en arriere-plan pour ne pas bloquer le WebSocket
                asyncio.create_task(session.process_and_send())

            elif data.get("type") == "audio_chunk":
                pcm_bytes = base64.b64decode(data["data"])
                await session.process_chunk(pcm_bytes)

            elif data.get("type") == "pong":
                pass  # Reponse au ping - connexion OK

    except WebSocketDisconnect:
        logger.info(f"Session fermee : cours {course_id}")
    except Exception as e:
        logger.error(f"Erreur WebSocket: {e}")
