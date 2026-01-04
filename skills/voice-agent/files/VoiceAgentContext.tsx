'use client';

import React, { createContext, useContext, useCallback, useRef, useEffect } from 'react';
import { useRealtimeConnection } from '@/hooks/useRealtimeConnection';
import { buildInstructions, getSlideContext, getPersonaConfig, InteractionMode, PersonaType } from '@/lib/realtime/instructions';
import { ConnectionStatus, NavigationCallbacks, SlideMetadata } from '@/lib/realtime/types';
import { initializeSlideContexts } from '@/lib/slide-contexts';

export interface VoiceAgentContextValue {
  // State
  status: ConnectionStatus;
  isAgentSpeaking: boolean;
  error: Error | null;
  mode: InteractionMode;
  persona: PersonaType;

  // Actions
  startSession: () => Promise<void>;
  endSession: () => void;
  setMode: (mode: InteractionMode) => void;
  setPersona: (persona: PersonaType) => void;

  // Messaging
  sendHint: (message: string) => void;
  sendTextMessage: (text: string) => void;

  // Navigation integration
  registerNavigationCallbacks: (callbacks: NavigationCallbacks) => void;

  // Slide context
  setCurrentSlide: (metadata: SlideMetadata) => void;
  setSlideOverview: (slides: { id: string; title: string }[]) => void;
}

const VoiceAgentContext = createContext<VoiceAgentContextValue | null>(null);

export function useVoiceAgent(): VoiceAgentContextValue {
  const context = useContext(VoiceAgentContext);
  if (!context) {
    throw new Error('useVoiceAgent must be used within VoiceAgentProvider');
  }
  return context;
}

interface VoiceAgentProviderProps {
  children: React.ReactNode;
}

export function VoiceAgentProvider({ children }: VoiceAgentProviderProps) {
  const currentSlideRef = useRef<SlideMetadata | null>(null);
  const slideOverviewRef = useRef<{ id: string; title: string }[]>([]);
  const modeRef = useRef<InteractionMode>('dialogue');
  const personaRef = useRef<PersonaType>('guide');
  const hasGreetedRef = useRef(false);
  const initializedRef = useRef(false);

  // Initialize slide contexts on mount
  useEffect(() => {
    if (!initializedRef.current) {
      initializeSlideContexts();
      initializedRef.current = true;
    }
  }, []);

  const {
    status,
    isAgentSpeaking,
    error,
    connect,
    disconnect,
    sendTextMessage: rawSendTextMessage,
    sendHint: rawSendHint,
    updateInstructions,
    setNavigationCallbacks,
  } = useRealtimeConnection({
    onTranscript: (transcript, isFinal) => {
      // Could expose this if needed for UI
      if (isFinal) {
        console.log('Agent said:', transcript);
      }
    },
    onUserTranscript: (transcript) => {
      console.log('User said:', transcript);
    },
    onError: (err) => {
      console.error('Voice agent error:', err);
    },
  });

  // Build instructions for current slide
  const buildCurrentInstructions = useCallback(() => {
    const currentSlide = currentSlideRef.current;
    const slideOverview = slideOverviewRef.current;
    const mode = modeRef.current;
    const persona = personaRef.current;

    if (!currentSlide || slideOverview.length === 0) {
      return 'You are a helpful presentation assistant. Wait for the presentation to load.';
    }

    const slideContext = getSlideContext(currentSlide.id);
    return buildInstructions(currentSlide, slideOverview, slideContext || undefined, mode, persona);
  }, []);

  // Set interaction mode
  const setMode = useCallback(
    (newMode: InteractionMode) => {
      modeRef.current = newMode;
      // If connected, update instructions with new mode
      if (status === 'connected') {
        const instructions = buildCurrentInstructions();
        updateInstructions(instructions);
      }
    },
    [status, buildCurrentInstructions, updateInstructions]
  );

  // Set persona
  const setPersona = useCallback(
    (newPersona: PersonaType) => {
      personaRef.current = newPersona;
      // If connected, update instructions with new persona
      if (status === 'connected') {
        const instructions = buildCurrentInstructions();
        updateInstructions(instructions);
      }
    },
    [status, buildCurrentInstructions, updateInstructions]
  );

  // Start session
  const startSession = useCallback(async () => {
    const instructions = buildCurrentInstructions();
    const personaConfig = getPersonaConfig(personaRef.current);
    hasGreetedRef.current = false;
    await connect(instructions, personaConfig.voice);
  }, [connect, buildCurrentInstructions]);

  // End session
  const endSession = useCallback(() => {
    disconnect();
    hasGreetedRef.current = false;
  }, [disconnect]);

  // Send greeting after connection is established
  useEffect(() => {
    if (status === 'connected' && !hasGreetedRef.current) {
      hasGreetedRef.current = true;
      const currentSlide = currentSlideRef.current;
      const mode = modeRef.current;
      const persona = personaRef.current;
      const personaConfig = getPersonaConfig(persona);

      if (currentSlide) {
        const greetingPrompt = {
          presenter: `You've just connected to present. The user is on slide ${currentSlide.slideNumber}: "${currentSlide.title}". ` +
            `Greet them ${personaConfig.greetingStyle}, then begin presenting this slide.`,
          dialogue: `You've just connected for a conversation. The user is on slide ${currentSlide.slideNumber}: "${currentSlide.title}". ` +
            `Greet them ${personaConfig.greetingStyle}, then start a conversation about this slide - ask them a question to kick things off. ` +
            `Remember: this is a dialogue, not a presentation. Draw out their thinking.`,
          assistant: `You've just connected as an assistant. The user is on slide ${currentSlide.slideNumber}: "${currentSlide.title}". ` +
            `Greet them ${personaConfig.greetingStyle} and let them know you're here if they have any questions. ` +
            `Don't start explaining - wait for them to ask or comment.`,
        }[mode];

        rawSendTextMessage(greetingPrompt);
      }
    }
  }, [status, rawSendTextMessage]);

  // Set current slide and update instructions
  const setCurrentSlide = useCallback(
    (metadata: SlideMetadata) => {
      const previousSlide = currentSlideRef.current;
      currentSlideRef.current = metadata;

      // If connected, update instructions and notify
      if (status === 'connected') {
        const instructions = buildCurrentInstructions();
        updateInstructions(instructions);

        // Send a hint about the slide change (mode-specific)
        if (previousSlide && previousSlide.slideNumber !== metadata.slideNumber) {
          const mode = modeRef.current;
          const slideChangeHint = {
            presenter: `User navigated to slide ${metadata.slideNumber} of ${metadata.totalSlides}: "${metadata.title}". ` +
              `Transition smoothly to presenting this new slide.`,
            dialogue: `User navigated to slide ${metadata.slideNumber} of ${metadata.totalSlides}: "${metadata.title}". ` +
              `Continue the conversation naturally - perhaps connect this to what you were just discussing, or ask what catches their eye.`,
            assistant: `User navigated to slide ${metadata.slideNumber} of ${metadata.totalSlides}: "${metadata.title}". ` +
              `They're exploring. Don't explain unless they ask - just acknowledge briefly if at all.`,
          }[mode];

          rawSendHint(slideChangeHint);
        }
      }
    },
    [status, buildCurrentInstructions, updateInstructions, rawSendHint]
  );

  // Set slide overview
  const setSlideOverview = useCallback((slides: { id: string; title: string }[]) => {
    slideOverviewRef.current = slides;
  }, []);

  // Register navigation callbacks
  const registerNavigationCallbacks = useCallback(
    (callbacks: NavigationCallbacks) => {
      setNavigationCallbacks(callbacks);
    },
    [setNavigationCallbacks]
  );

  // Wrapped sendHint that only sends if connected
  const sendHint = useCallback(
    (message: string) => {
      if (status === 'connected') {
        rawSendHint(message);
      }
    },
    [status, rawSendHint]
  );

  // Wrapped sendTextMessage
  const sendTextMessage = useCallback(
    (text: string) => {
      if (status === 'connected') {
        rawSendTextMessage(text);
      }
    },
    [status, rawSendTextMessage]
  );

  const value: VoiceAgentContextValue = {
    status,
    isAgentSpeaking,
    error,
    mode: modeRef.current,
    persona: personaRef.current,
    startSession,
    endSession,
    setMode,
    setPersona,
    sendHint,
    sendTextMessage,
    registerNavigationCallbacks,
    setCurrentSlide,
    setSlideOverview,
  };

  return (
    <VoiceAgentContext.Provider value={value}>
      {children}
    </VoiceAgentContext.Provider>
  );
}
