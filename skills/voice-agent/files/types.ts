// Connection state
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

// Navigation callbacks interface for Presentation.tsx integration
export interface NavigationCallbacks {
  goToNext: () => void;
  goToPrevious: () => void;
  goToSlide: (index: number) => void;
  getCurrentSlide: () => number;
  getTotalSlides: () => number;
}

// Slide metadata for context
export interface SlideMetadata {
  id: string;
  title: string;
  slideNumber: number;
  totalSlides: number;
}

// Session configuration for OpenAI Realtime API
export interface SessionConfig {
  model: string;
  modalities: ('audio' | 'text')[];
  instructions: string;
  voice: VoiceOption;
  input_audio_format: 'pcm16' | 'g711_ulaw' | 'g711_alaw';
  output_audio_format: 'pcm16' | 'g711_ulaw' | 'g711_alaw';
  input_audio_transcription: {
    model: 'whisper-1';
  };
  turn_detection: {
    type: 'server_vad';
    threshold?: number;
    prefix_padding_ms?: number;
    silence_duration_ms?: number;
  };
  tools: Tool[];
  tool_choice: 'auto' | 'none' | 'required';
  temperature: number;
}

export type VoiceOption = 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'sage' | 'shimmer' | 'verse' | 'marin' | 'cedar';

// Tool definition
export interface Tool {
  type: 'function';
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

// Conversation items
export interface ConversationItem {
  type: 'message' | 'function_call' | 'function_call_output';
  role?: 'user' | 'assistant' | 'system';
  content?: ContentPart[];
  call_id?: string;
  name?: string;
  arguments?: string;
  output?: string;
}

export interface ContentPart {
  type: 'input_text' | 'input_audio' | 'text' | 'audio';
  text?: string;
  audio?: string;
  transcript?: string;
}

// Client -> Server events
export interface SessionUpdateEvent {
  type: 'session.update';
  session: Partial<SessionConfig>;
}

export interface ConversationItemCreateEvent {
  type: 'conversation.item.create';
  item: ConversationItem;
}

export interface ResponseCreateEvent {
  type: 'response.create';
  response?: {
    modalities?: ('audio' | 'text')[];
    instructions?: string;
  };
}

export interface InputAudioBufferAppendEvent {
  type: 'input_audio_buffer.append';
  audio: string;
}

export interface InputAudioBufferCommitEvent {
  type: 'input_audio_buffer.commit';
}

export type ClientEvent =
  | SessionUpdateEvent
  | ConversationItemCreateEvent
  | ResponseCreateEvent
  | InputAudioBufferAppendEvent
  | InputAudioBufferCommitEvent;

// Server -> Client events
export interface SessionCreatedEvent {
  type: 'session.created';
  session: {
    id: string;
    model: string;
    modalities: string[];
    voice: string;
  };
}

export interface SessionUpdatedEvent {
  type: 'session.updated';
  session: Partial<SessionConfig>;
}

export interface ConversationItemCreatedEvent {
  type: 'conversation.item.created';
  item: {
    id: string;
    type: string;
    role?: string;
    content?: ContentPart[];
  };
}

export interface ResponseOutputItemDoneEvent {
  type: 'response.output_item.done';
  item: {
    id: string;
    type: 'message' | 'function_call';
    role?: string;
    content?: ContentPart[];
    name?: string;
    call_id?: string;
    arguments?: string;
  };
}

export interface ResponseDoneEvent {
  type: 'response.done';
  response: {
    id: string;
    status: 'completed' | 'cancelled' | 'failed' | 'incomplete';
    output: Array<{
      id: string;
      type: 'message' | 'function_call';
      role?: string;
      content?: ContentPart[];
      name?: string;
      call_id?: string;
      arguments?: string;
    }>;
  };
}

export interface ResponseAudioDeltaEvent {
  type: 'response.audio.delta';
  delta: string;
}

export interface ResponseAudioDoneEvent {
  type: 'response.audio.done';
}

export interface ResponseAudioTranscriptDeltaEvent {
  type: 'response.audio_transcript.delta';
  delta: string;
}

export interface ResponseAudioTranscriptDoneEvent {
  type: 'response.audio_transcript.done';
  transcript: string;
}

export interface InputAudioBufferSpeechStartedEvent {
  type: 'input_audio_buffer.speech_started';
}

export interface InputAudioBufferSpeechStoppedEvent {
  type: 'input_audio_buffer.speech_stopped';
}

export interface InputAudioTranscriptionCompletedEvent {
  type: 'conversation.item.input_audio_transcription.completed';
  transcript: string;
}

export interface ErrorEvent {
  type: 'error';
  error: {
    type: string;
    code: string;
    message: string;
  };
}

export type ServerEvent =
  | SessionCreatedEvent
  | SessionUpdatedEvent
  | ConversationItemCreatedEvent
  | ResponseOutputItemDoneEvent
  | ResponseDoneEvent
  | ResponseAudioDeltaEvent
  | ResponseAudioDoneEvent
  | ResponseAudioTranscriptDeltaEvent
  | ResponseAudioTranscriptDoneEvent
  | InputAudioBufferSpeechStartedEvent
  | InputAudioBufferSpeechStoppedEvent
  | InputAudioTranscriptionCompletedEvent
  | ErrorEvent;

// API response types
export interface EphemeralTokenResponse {
  token: string;
  expiresAt: number;
  sessionId: string;
}
