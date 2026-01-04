"use client";

import { useState, useRef, useCallback } from "react";
import {
  ConnectionStatus,
  NavigationCallbacks,
  ClientEvent,
  ServerEvent,
  EphemeralTokenResponse,
  VoiceOption,
} from "@/lib/realtime/types";
import { TOOL_NAMES } from "@/lib/realtime/tools";

const OPENAI_REALTIME_URL = "https://api.openai.com/v1/realtime";
const MODEL = "gpt-realtime";

export interface UseRealtimeConnectionOptions {
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onUserTranscript?: (transcript: string) => void;
  onError?: (error: Error) => void;
}

export interface UseRealtimeConnectionReturn {
  status: ConnectionStatus;
  isAgentSpeaking: boolean;
  error: Error | null;
  connect: (instructions: string, voice?: VoiceOption) => Promise<void>;
  disconnect: () => void;
  sendTextMessage: (text: string) => void;
  sendHint: (message: string) => void;
  updateInstructions: (instructions: string) => void;
  setNavigationCallbacks: (callbacks: NavigationCallbacks) => void;
}

export function useRealtimeConnection(
  options: UseRealtimeConnectionOptions = {}
): UseRealtimeConnectionReturn {
  const { onTranscript, onUserTranscript, onError } = options;

  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Refs for connection objects
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const navigationCallbacksRef = useRef<NavigationCallbacks | null>(null);

  // Set navigation callbacks
  const setNavigationCallbacks = useCallback(
    (callbacks: NavigationCallbacks) => {
      navigationCallbacksRef.current = callbacks;
    },
    []
  );

  // Send event via data channel
  const sendEvent = useCallback((event: ClientEvent) => {
    if (dataChannelRef.current?.readyState === "open") {
      dataChannelRef.current.send(JSON.stringify(event));
    } else {
      console.warn("Data channel not open, cannot send event:", event.type);
    }
  }, []);

  // Handle server events
  const handleServerEvent = useCallback(
    (event: ServerEvent) => {
      switch (event.type) {
        case "session.created":
          console.log("Session created:", event.session.id);
          break;

        case "session.updated":
          console.log("Session updated");
          break;

        case "response.audio.delta":
          setIsAgentSpeaking(true);
          break;

        case "response.audio.done":
          setIsAgentSpeaking(false);
          break;

        case "response.audio_transcript.delta":
          onTranscript?.(event.delta, false);
          break;

        case "response.audio_transcript.done":
          onTranscript?.(event.transcript, true);
          break;

        case "conversation.item.input_audio_transcription.completed":
          onUserTranscript?.(event.transcript);
          break;

        case "input_audio_buffer.speech_started":
          // User started speaking - agent may be interrupted
          setIsAgentSpeaking(false);
          break;

        case "response.output_item.done":
          // Note: Function calls are handled in response.done to avoid
          // conflicts with active responses
          break;

        case "response.done":
          setIsAgentSpeaking(false);
          // Handle function calls only after response is complete
          for (const item of event.response.output) {
            if (item.type === "function_call") {
              handleFunctionCall(item.name!, item.call_id!, item.arguments);
            }
          }
          break;

        case "error":
          console.error("Realtime API error:", event.error);
          const err = new Error(event.error.message);
          setError(err);
          onError?.(err);
          break;

        default:
          // Log unhandled events for debugging
          console.log("Unhandled event:", (event as { type: string }).type);
      }
    },
    [onTranscript, onUserTranscript, onError]
  );

  // Handle function calls from the model
  const handleFunctionCall = useCallback(
    (name: string, callId: string, args?: string) => {
      console.log("Function call:", name, args);

      let result: string;

      if (name === TOOL_NAMES.GO_TO_NEXT_SLIDE) {
        if (navigationCallbacksRef.current) {
          navigationCallbacksRef.current.goToNext();
          result = JSON.stringify({ success: true, action: "navigated_next" });
        } else {
          result = JSON.stringify({
            success: false,
            error: "Navigation not available",
          });
        }
      } else if (name === TOOL_NAMES.GO_TO_PREVIOUS_SLIDE) {
        if (navigationCallbacksRef.current) {
          navigationCallbacksRef.current.goToPrevious();
          result = JSON.stringify({
            success: true,
            action: "navigated_previous",
          });
        } else {
          result = JSON.stringify({
            success: false,
            error: "Navigation not available",
          });
        }
      } else {
        result = JSON.stringify({ error: `Unknown function: ${name}` });
      }

      // Send function result back
      sendEvent({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: callId,
          output: result,
        },
      });

      // Trigger model to continue after function call
      sendEvent({ type: "response.create" });
    },
    [sendEvent]
  );

  // Connect to OpenAI Realtime API
  const connect = useCallback(
    async (instructions: string, voice: VoiceOption = "shimmer") => {
      if (status !== "disconnected") {
        console.warn("Already connected or connecting");
        return;
      }

      setStatus("connecting");
      setError(null);

      try {
        // Step 1: Get ephemeral token from our API
        const tokenResponse = await fetch("/api/realtime-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instructions, voice }),
        });

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.json();
          throw new Error(errorData.error || "Failed to get token");
        }

        const { token } =
          (await tokenResponse.json()) as EphemeralTokenResponse;

        // Step 2: Create RTCPeerConnection
        const pc = new RTCPeerConnection();
        peerConnectionRef.current = pc;

        // Set up audio element for playback
        const audioElement = document.createElement("audio");
        audioElement.autoplay = true;
        audioElementRef.current = audioElement;

        // Handle incoming audio track
        pc.ontrack = (event) => {
          audioElement.srcObject = event.streams[0];
        };

        // Step 3: Get user microphone
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        localStreamRef.current = stream;

        // Add audio track to peer connection
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        // Step 4: Create data channel for events
        const dc = pc.createDataChannel("oai-events");
        dataChannelRef.current = dc;

        dc.addEventListener("open", () => {
          console.log("Data channel opened");
          setStatus("connected");
        });

        dc.addEventListener("message", (event) => {
          try {
            const serverEvent = JSON.parse(event.data) as ServerEvent;
            handleServerEvent(serverEvent);
          } catch (e) {
            console.error("Failed to parse server event:", e);
          }
        });

        dc.addEventListener("close", () => {
          console.log("Data channel closed");
          setStatus("disconnected");
        });

        // Step 5: Create and set local offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Step 6: Exchange SDP with OpenAI
        const sdpResponse = await fetch(
          `${OPENAI_REALTIME_URL}?model=${MODEL}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/sdp",
            },
            body: pc.localDescription?.sdp,
          }
        );

        if (!sdpResponse.ok) {
          throw new Error(`SDP exchange failed: ${sdpResponse.status}`);
        }

        // Step 7: Set remote description
        const answerSdp = await sdpResponse.text();
        await pc.setRemoteDescription({
          type: "answer",
          sdp: answerSdp,
        });

        // Wait for connection to be established
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Connection timeout"));
          }, 10000);

          pc.addEventListener("connectionstatechange", () => {
            if (pc.connectionState === "connected") {
              clearTimeout(timeout);
              resolve();
            } else if (
              pc.connectionState === "failed" ||
              pc.connectionState === "disconnected"
            ) {
              clearTimeout(timeout);
              reject(new Error(`Connection failed: ${pc.connectionState}`));
            }
          });
        });

        console.log("WebRTC connection established");
      } catch (err) {
        console.error("Connection error:", err);
        const error =
          err instanceof Error ? err : new Error("Connection failed");
        setError(error);
        onError?.(error);
        setStatus("disconnected");
        cleanup();
      }
    },
    [status, handleServerEvent, onError]
  );

  // Cleanup function
  const cleanup = useCallback(() => {
    // Close data channel
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    // Stop local media tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Clean up audio element
    if (audioElementRef.current) {
      audioElementRef.current.srcObject = null;
      audioElementRef.current = null;
    }
  }, []);

  // Disconnect
  const disconnect = useCallback(() => {
    cleanup();
    setStatus("disconnected");
    setIsAgentSpeaking(false);
    setError(null);
  }, [cleanup]);

  // Send a text message as user input
  const sendTextMessage = useCallback(
    (text: string) => {
      if (status !== "connected") {
        console.warn("Not connected");
        return;
      }

      // Create user message
      sendEvent({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text }],
        },
      });

      // Trigger response
      sendEvent({ type: "response.create" });
    },
    [status, sendEvent]
  );

  // Send a hint (context update that doesn't trigger a response)
  const sendHint = useCallback(
    (message: string) => {
      if (status !== "connected") {
        return; // Silently ignore if not connected
      }

      // Create system context message
      sendEvent({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text: `[Context Update] ${message}` },
          ],
        },
      });

      // Note: No response.create - this is just context
    },
    [status, sendEvent]
  );

  // Update system instructions
  const updateInstructions = useCallback(
    (instructions: string) => {
      if (status !== "connected") {
        console.warn("Not connected");
        return;
      }

      sendEvent({
        type: "session.update",
        session: { instructions },
      });
    },
    [status, sendEvent]
  );

  return {
    status,
    isAgentSpeaking,
    error,
    connect,
    disconnect,
    sendTextMessage,
    sendHint,
    updateInstructions,
    setNavigationCallbacks,
  };
}
