'use client';

/**
 * Example Landing Page with Voice/Mode/Persona Selection
 *
 * This is a reference implementation. Customize the styling and content
 * to match your presentation's visual language.
 *
 * Features:
 * - Voice enable/disable toggle
 * - Mode selection drawer (presenter, dialogue, assistant)
 * - Persona selection drawer with "Listen" audition feature
 *
 * Dependencies:
 * - lucide-react for icons
 * - components/voice-agent for types and persona data
 * - hooks/useAuditionSession for persona auditions
 */

import { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  ArrowRight,
  MessageSquare,
  Presentation,
  HelpCircle,
  Compass,
  Flame,
  GraduationCap,
  Users,
  Play,
  Square,
  Check,
  ChevronRight,
  X,
} from 'lucide-react';
import type { InteractionMode, PersonaType } from '@/components/voice-agent';
import { getAllPersonas } from '@/components/voice-agent';
import { useAuditionSession } from '@/hooks/useAuditionSession';

interface LandingPageProps {
  onStart: (enableVoice: boolean, mode: InteractionMode, persona: PersonaType) => void;
}

// Mode definitions - customize descriptions to match your content
const modes: { id: InteractionMode; label: string; description: string; icon: typeof MessageSquare }[] = [
  {
    id: 'dialogue',
    label: 'Conversation',
    description: 'Back-and-forth discussion, questions drive exploration',
    icon: MessageSquare,
  },
  {
    id: 'presenter',
    label: 'Presentation',
    description: 'Guided walkthrough, AI leads you through the content',
    icon: Presentation,
  },
  {
    id: 'assistant',
    label: 'Assistant',
    description: 'Self-paced with AI available to answer questions',
    icon: HelpCircle,
  },
];

// Icons for each persona type
const personaIcons: Record<PersonaType, typeof Compass> = {
  guide: Compass,
  coach: Flame,
  expert: GraduationCap,
  peer: Users,
};

export default function LandingPage({ onStart }: LandingPageProps) {
  const [enableVoice, setEnableVoice] = useState(true);
  const [selectedMode, setSelectedMode] = useState<InteractionMode>('dialogue');
  const [selectedPersona, setSelectedPersona] = useState<PersonaType>('guide');
  const [showModeDrawer, setShowModeDrawer] = useState(false);
  const [showPersonaDrawer, setShowPersonaDrawer] = useState(false);
  const [mounted, setMounted] = useState(false);

  const {
    status: auditionStatus,
    activePersona,
    isAgentSpeaking,
    startAudition,
    endAudition,
  } = useAuditionSession();

  const personas = getAllPersonas();
  const selectedPersonaConfig = personas[selectedPersona];
  const selectedModeConfig = modes.find((m) => m.id === selectedMode)!;
  const isAuditioning = auditionStatus === 'connected' || auditionStatus === 'connecting';

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close drawers on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showPersonaDrawer) {
          endAudition();
          setShowPersonaDrawer(false);
        }
        if (showModeDrawer) {
          setShowModeDrawer(false);
        }
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showPersonaDrawer, showModeDrawer, endAudition]);

  const handlePersonaListen = async (personaId: PersonaType) => {
    if (activePersona === personaId && auditionStatus === 'connected') {
      endAudition();
    } else {
      await startAudition(personaId);
    }
  };

  const handleSelectPersona = (personaId: PersonaType) => {
    endAudition();
    setSelectedPersona(personaId);
    setShowPersonaDrawer(false);
  };

  const handleCloseDrawer = () => {
    endAudition();
    setShowPersonaDrawer(false);
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-8">
      <div className="max-w-2xl w-full text-center">
        {/* TODO: Customize - Label */}
        <p
          className={`text-sm font-medium text-blue-600 mb-4 tracking-wide uppercase transition-all duration-700 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          Interactive Tutorial
        </p>

        {/* TODO: Customize - Title */}
        <h1
          className={`text-5xl font-bold text-slate-800 mb-6 tracking-tight transition-all duration-700 delay-100 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          Your Presentation Title
        </h1>

        {/* TODO: Customize - Subtitle */}
        <p
          className={`text-lg text-slate-600 mb-10 transition-all duration-700 delay-200 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          A brief description of what this presentation covers
        </p>

        {/* Voice toggle */}
        <div
          className={`mb-6 transition-all duration-700 delay-300 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <button
            onClick={() => setEnableVoice(!enableVoice)}
            className="inline-flex items-center gap-4 px-6 py-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-all bg-white"
          >
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
                enableVoice ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {enableVoice ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </div>
            <div className="text-left">
              <p className="font-medium text-slate-800">
                {enableVoice ? 'Voice Guide Enabled' : 'Voice Guide Disabled'}
              </p>
              <p className="text-sm text-slate-500">
                {enableVoice ? 'AI will talk with you through the slides' : 'Navigate silently at your own pace'}
              </p>
            </div>
            <div
              className={`ml-2 w-11 h-6 rounded-full p-0.5 transition-colors duration-300 ${
                enableVoice ? 'bg-blue-600' : 'bg-slate-300'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${
                  enableVoice ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </button>
        </div>

        {/* Mode and Persona selection - only show when voice is enabled */}
        <div
          className={`mb-8 transition-all duration-500 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          } ${enableVoice ? 'delay-[350ms]' : 'opacity-0 h-0 overflow-hidden mb-0'}`}
        >
          <div className="flex justify-center gap-3">
            {/* Mode selector button */}
            <button
              onClick={() => setShowModeDrawer(true)}
              className="inline-flex items-center gap-3 px-5 py-3 rounded-xl border border-slate-200 hover:border-slate-300 transition-all bg-white"
            >
              <selectedModeConfig.icon className="w-5 h-5 text-slate-600" />
              <div className="text-left">
                <p className="text-xs text-slate-500">Mode</p>
                <p className="font-medium text-slate-800">{selectedModeConfig.label}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            {/* Persona selector button */}
            <button
              onClick={() => setShowPersonaDrawer(true)}
              className="inline-flex items-center gap-3 px-5 py-3 rounded-xl border border-slate-200 hover:border-slate-300 transition-all bg-white"
            >
              {(() => {
                const Icon = personaIcons[selectedPersona];
                return <Icon className="w-5 h-5 text-slate-600" />;
              })()}
              <div className="text-left">
                <p className="text-xs text-slate-500">Guide</p>
                <p className="font-medium text-slate-800">
                  {selectedPersonaConfig.name}{' '}
                  <span className="text-slate-400 font-normal">· {selectedPersonaConfig.archetype}</span>
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Start button */}
        <div
          className={`transition-all duration-700 delay-[400ms] ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <button
            onClick={() => onStart(enableVoice, selectedMode, selectedPersona)}
            className="inline-flex items-center gap-2 px-8 py-4 bg-slate-800 text-white rounded-xl text-lg font-medium hover:bg-slate-700 transition-all"
          >
            Begin
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        {/* Footer hint */}
        <p
          className={`mt-10 text-sm text-slate-400 transition-all duration-700 delay-500 ${
            mounted ? 'opacity-100' : 'opacity-0'
          }`}
        >
          Use arrow keys to navigate
        </p>
      </div>

      {/* Mode Drawer */}
      {showModeDrawer && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-40 transition-opacity"
            onClick={() => setShowModeDrawer(false)}
          />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl z-50 animate-slide-in-right">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">Choose Mode</h2>
              <button
                onClick={() => setShowModeDrawer(false)}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {modes.map((mode) => {
                const Icon = mode.icon;
                const isSelected = selectedMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    onClick={() => {
                      setSelectedMode(mode.id);
                      setShowModeDrawer(false);
                    }}
                    className={`w-full flex items-start gap-4 p-5 rounded-xl transition-all text-left ${
                      isSelected
                        ? 'bg-blue-50 border-2 border-blue-500'
                        : 'border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <p className={`font-semibold ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                        {mode.label}
                      </p>
                      <p className="text-sm text-slate-500 mt-1">{mode.description}</p>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Persona Drawer with Audition */}
      {showPersonaDrawer && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-40 transition-opacity"
            onClick={handleCloseDrawer}
          />
          <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-xl z-50 animate-slide-in-right overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Choose Your Guide</h2>
                <p className="text-sm text-slate-500 mt-1">
                  {isAuditioning ? 'Listening to audition...' : 'Click "Listen" to hear their audition'}
                </p>
              </div>
              <button
                onClick={handleCloseDrawer}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {(Object.keys(personas) as PersonaType[]).map((personaId) => {
                const persona = personas[personaId];
                const Icon = personaIcons[personaId];
                const isSelected = selectedPersona === personaId;
                const isActiveAudition = activePersona === personaId;
                const isConnecting = isActiveAudition && auditionStatus === 'connecting';
                const isPlaying = isActiveAudition && auditionStatus === 'connected';

                return (
                  <div
                    key={personaId}
                    className={`relative rounded-2xl border-2 transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : isPlaying
                          ? 'border-green-500 bg-green-50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}

                    <div className="p-5">
                      <div className="flex items-start gap-4">
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            isSelected
                              ? 'bg-blue-100 text-blue-600'
                              : isPlaying
                                ? 'bg-green-100 text-green-600'
                                : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          <Icon className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <p className="font-semibold text-slate-800">{persona.name}</p>
                            <p className="text-sm text-slate-400">{persona.archetype}</p>
                          </div>
                          <p className="text-sm text-slate-600 mt-0.5">{persona.tagline}</p>
                        </div>
                      </div>

                      <p className="text-sm text-slate-500 mt-3 leading-relaxed">{persona.description}</p>

                      {/* Speaking indicator */}
                      {isPlaying && isAgentSpeaking && (
                        <div className="flex items-center gap-2 mt-3 text-green-600">
                          <div className="flex gap-0.5">
                            <div
                              className="w-1 h-3 bg-green-500 rounded-full animate-pulse"
                              style={{ animationDelay: '0ms' }}
                            />
                            <div
                              className="w-1 h-4 bg-green-500 rounded-full animate-pulse"
                              style={{ animationDelay: '150ms' }}
                            />
                            <div
                              className="w-1 h-2 bg-green-500 rounded-full animate-pulse"
                              style={{ animationDelay: '300ms' }}
                            />
                            <div
                              className="w-1 h-5 bg-green-500 rounded-full animate-pulse"
                              style={{ animationDelay: '450ms' }}
                            />
                          </div>
                          <span className="text-sm font-medium">{persona.name} is speaking...</span>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => handlePersonaListen(personaId)}
                          disabled={isConnecting || (isAuditioning && !isActiveAudition)}
                          className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
                            isPlaying
                              ? 'bg-green-600 text-white hover:bg-green-700'
                              : isConnecting
                                ? 'bg-slate-200 text-slate-500 cursor-wait'
                                : isAuditioning && !isActiveAudition
                                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                  : 'bg-slate-800 text-white hover:bg-slate-700'
                          }`}
                        >
                          {isConnecting ? (
                            <>
                              <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                              Connecting...
                            </>
                          ) : isPlaying ? (
                            <>
                              <Square className="w-4 h-4" />
                              Stop
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4" />
                              Listen
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => handleSelectPersona(personaId)}
                          disabled={isAuditioning && !isActiveAudition}
                          className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
                            isSelected
                              ? 'bg-blue-100 text-blue-700'
                              : isAuditioning && !isActiveAudition
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          <Check className="w-4 h-4" />
                          {isSelected ? 'Selected' : 'Select'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
