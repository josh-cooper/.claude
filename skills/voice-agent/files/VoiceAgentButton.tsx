'use client';

import { Mic, MicOff, Loader2 } from 'lucide-react';
import { useVoiceAgent } from './VoiceAgentContext';

export default function VoiceAgentButton() {
  const { status, isAgentSpeaking, startSession, endSession, error } = useVoiceAgent();

  const handleClick = async () => {
    if (status === 'connected') {
      endSession();
    } else if (status === 'disconnected') {
      await startSession();
    }
    // Do nothing if connecting
  };

  const getButtonStyles = () => {
    const base =
      'fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2';

    if (status === 'connected') {
      return `${base} bg-red-500 hover:bg-red-600 text-white focus:ring-red-500 ${
        isAgentSpeaking ? 'ring-4 ring-red-300 ring-opacity-50 animate-pulse' : ''
      }`;
    }

    if (status === 'connecting') {
      return `${base} bg-blue-400 text-white cursor-wait opacity-75`;
    }

    // disconnected
    return `${base} bg-blue-500 hover:bg-blue-600 text-white focus:ring-blue-500`;
  };

  const getTitle = () => {
    if (status === 'connecting') return 'Connecting...';
    if (status === 'connected') return 'Click to stop voice agent';
    return 'Click to start voice agent';
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Error tooltip */}
      {error && (
        <div className="absolute bottom-16 right-0 bg-red-100 border border-red-300 text-red-700 px-3 py-2 rounded-lg text-sm max-w-xs shadow-lg">
          {error.message}
        </div>
      )}

      {/* Status indicator */}
      {status === 'connected' && (
        <div className="absolute -top-2 -left-2 flex items-center gap-1.5 bg-white px-2 py-1 rounded-full shadow-md border border-slate-200">
          <div
            className={`w-2 h-2 rounded-full ${
              isAgentSpeaking ? 'bg-green-500 animate-pulse' : 'bg-green-500'
            }`}
          />
          <span className="text-xs font-medium text-slate-600">
            {isAgentSpeaking ? 'Speaking' : 'Listening'}
          </span>
        </div>
      )}

      {/* Main button */}
      <button
        onClick={handleClick}
        disabled={status === 'connecting'}
        className={getButtonStyles()}
        title={getTitle()}
        aria-label={getTitle()}
      >
        {status === 'connecting' ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : status === 'connected' ? (
          <MicOff className="w-6 h-6" />
        ) : (
          <Mic className="w-6 h-6" />
        )}
      </button>
    </div>
  );
}
