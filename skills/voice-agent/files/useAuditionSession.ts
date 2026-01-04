'use client';

import { useState, useRef, useCallback } from 'react';
import { buildAuditionInstructions, getPersonaConfig, PersonaType } from '@/lib/realtime/instructions';
import { ConnectionStatus, ServerEvent, EphemeralTokenResponse } from '@/lib/realtime/types';

const OPENAI_REALTIME_URL = 'https://api.openai.com/v1/realtime';
const MODEL = 'gpt-realtime';

export interface UseAuditionSessionReturn {
  status: ConnectionStatus;
  activePersona: PersonaType | null;
  isAgentSpeaking: boolean;
  error: Error | null;
  startAudition: (persona: PersonaType) => Promise<void>;
  endAudition: () => void;
}

export function useAuditionSession(): UseAuditionSessionReturn {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [activePersona, setActivePersona] = useState<PersonaType | null>(null);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  const handleServerEvent = useCallback((event: ServerEvent) => {
    switch (event.type) {
      case 'session.created':
        console.log('Audition session created:', event.session.id);
        break;
      case 'response.audio.delta':
        setIsAgentSpeaking(true);
        break;
      case 'response.audio.done':
      case 'response.done':
        setIsAgentSpeaking(false);
        break;
      case 'input_audio_buffer.speech_started':
        setIsAgentSpeaking(false);
        break;
      case 'error':
        console.error('Audition error:', event.error);
        setError(new Error(event.error.message));
        break;
    }
  }, []);

  const cleanup = useCallback(() => {
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (audioElementRef.current) {
      audioElementRef.current.srcObject = null;
      audioElementRef.current = null;
    }
  }, []);

  const startAudition = useCallback(async (persona: PersonaType) => {
    // If already in a session, clean up first
    if (status !== 'disconnected') {
      cleanup();
    }

    setStatus('connecting');
    setActivePersona(persona);
    setError(null);

    try {
      const personaConfig = getPersonaConfig(persona);
      const instructions = buildAuditionInstructions(persona);

      // Get ephemeral token
      const tokenResponse = await fetch('/api/realtime-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructions, voice: personaConfig.voice }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        throw new Error(errorData.error || 'Failed to get token');
      }

      const { token } = (await tokenResponse.json()) as EphemeralTokenResponse;

      // Create RTCPeerConnection
      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      // Set up audio element
      const audioElement = document.createElement('audio');
      audioElement.autoplay = true;
      audioElementRef.current = audioElement;

      pc.ontrack = (event) => {
        audioElement.srcObject = event.streams[0];
      };

      // Get user microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Create data channel
      const dc = pc.createDataChannel('oai-events');
      dataChannelRef.current = dc;

      dc.addEventListener('open', () => {
        console.log('Audition data channel opened');
        setStatus('connected');

        // Trigger the persona to start their audition immediately
        setTimeout(() => {
          if (dc.readyState === 'open') {
            dc.send(JSON.stringify({
              type: 'response.create',
            }));
          }
        }, 100);
      });

      dc.addEventListener('message', (event) => {
        try {
          const serverEvent = JSON.parse(event.data) as ServerEvent;
          handleServerEvent(serverEvent);
        } catch (e) {
          console.error('Failed to parse audition event:', e);
        }
      });

      dc.addEventListener('close', () => {
        console.log('Audition data channel closed');
        setStatus('disconnected');
        setActivePersona(null);
      });

      // Create and set local offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Exchange SDP
      const sdpResponse = await fetch(`${OPENAI_REALTIME_URL}?model=${MODEL}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/sdp',
        },
        body: pc.localDescription?.sdp,
      });

      if (!sdpResponse.ok) {
        throw new Error(`SDP exchange failed: ${sdpResponse.status}`);
      }

      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000);

        pc.addEventListener('connectionstatechange', () => {
          if (pc.connectionState === 'connected') {
            clearTimeout(timeout);
            resolve();
          } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
            clearTimeout(timeout);
            reject(new Error(`Connection failed: ${pc.connectionState}`));
          }
        });
      });

      console.log('Audition connection established for', persona);
    } catch (err) {
      console.error('Audition connection error:', err);
      const error = err instanceof Error ? err : new Error('Connection failed');
      setError(error);
      setStatus('disconnected');
      setActivePersona(null);
      cleanup();
    }
  }, [status, cleanup, handleServerEvent]);

  const endAudition = useCallback(() => {
    cleanup();
    setStatus('disconnected');
    setActivePersona(null);
    setIsAgentSpeaking(false);
    setError(null);
  }, [cleanup]);

  return {
    status,
    activePersona,
    isAgentSpeaking,
    error,
    startAudition,
    endAudition,
  };
}
