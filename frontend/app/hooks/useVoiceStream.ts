"use client";
import { useRef, useState, useCallback } from "react";

export type VoiceStatus = "idle" | "listening" | "processing" | "speaking" | "error";

interface VoiceStreamOptions {
  courseId: string;
  onTranscript?: (text: string) => void;
  onAnswer?: (text: string) => void;
  onStatusChange?: (status: VoiceStatus) => void;
  onAudio?: (audioBlob: Blob) => void;
  onResumeCourse?: () => void;
  onWaitingFollowup?: () => void;
}

export function useVoiceStream({
  courseId, onTranscript, onAnswer, onStatusChange,
  onAudio, onResumeCourse, onWaitingFollowup
}: VoiceStreamOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [connected, setConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  function updateStatus(s: VoiceStatus) {
    setStatus(s);
    onStatusChange?.(s);
  }

  function float32ToPCM16(float32Array: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  }

  function bufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(`ws://172.31.6.180:8000/ws/voice/${courseId}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);
      switch (msg.type) {
        case "status":
          if (msg.value === "listening") updateStatus("listening");
          else if (msg.value === "processing") updateStatus("processing");
          else if (msg.value === "idle") updateStatus("idle");
          break;
        case "transcript":
          onTranscript?.(msg.text);
          break;
        case "answer":
          onAnswer?.(msg.text);
          updateStatus("speaking");
          break;
        case "waiting_followup":
          onWaitingFollowup?.();
          updateStatus("idle");
          break;
        case "audio":
          const binaryStr = atob(msg.data);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
          onAudio?.(new Blob([bytes], { type: "audio/mpeg" }));
          break;
        case "resume_course":
          onResumeCourse?.();
          updateStatus("idle");
          break;
      }
    };

    ws.onclose = () => { setConnected(false); updateStatus("idle"); };
    ws.onerror = () => updateStatus("error");
  }, [courseId]);

  const setupMic = useCallback(async () => {
    if (streamRef.current) return; // Deja configure
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      streamRef.current = stream;
      const ctx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(512, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) return;
        const float32 = e.inputBuffer.getChannelData(0);
        const pcm16 = float32ToPCM16(float32);
        wsRef.current.send(JSON.stringify({ type: "audio_chunk", data: bufferToBase64(pcm16) }));
      };

      source.connect(processor);
      processor.connect(ctx.destination);
    } catch (err) {
      updateStatus("error");
    }
  }, []);

  // Toggle : un clic = commence, un autre clic = envoie
  const toggleRecording = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      await connect();
      await new Promise(resolve => setTimeout(resolve, 600));
    }

    if (!isRecording) {
      // Demarrer l enregistrement
      await setupMic();
      setIsRecording(true);
      wsRef.current?.send(JSON.stringify({ type: "start_recording" }));
      updateStatus("listening");
    } else {
      // Arreter et envoyer
      setIsRecording(false);
      wsRef.current?.send(JSON.stringify({ type: "stop_recording" }));
      updateStatus("processing");
    }
  }, [isRecording, connect, setupMic]);

  return { status, connected, isRecording, connect, toggleRecording };
}
