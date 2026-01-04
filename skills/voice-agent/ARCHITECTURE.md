# Voice Agent Architecture

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Transport | WebRTC | Better audio quality than WebSockets, native browser support |
| Token handling | Server-side ephemeral | API key never exposed to client |
| Activation | Manual start button | User controls when to enable voice |
| Turn-taking | OpenAI VAD | No manual interruption handling needed |
| Personas | Selectable (guide, coach, expert, peer) | Different personalities for different learning styles |
| Model | `gpt-realtime` | Always points to latest realtime model |
| Voice | Per-persona (sage, verse, shimmer) | Each persona has a mapped voice |

## Connection Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │     │  Next.js    │     │   OpenAI    │
│   Client    │     │   Server    │     │  Realtime   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │  1. POST /api/realtime-token         │
       │──────────────────>│                   │
       │                   │  2. Create session│
       │                   │──────────────────>│
       │                   │  3. Ephemeral token
       │                   │<──────────────────│
       │  4. Return token  │                   │
       │<──────────────────│                   │
       │                   │                   │
       │  5. WebRTC SDP offer                  │
       │───────────────────────────────────────>
       │  6. SDP answer                        │
       │<───────────────────────────────────────
       │                   │                   │
       │  7. Audio + Data Channel established  │
       │<═══════════════════════════════════════>
```

1. User clicks start button
2. Client calls `/api/realtime-token` to get ephemeral token
3. Server calls OpenAI `/v1/realtime/sessions` with API key
4. Server returns ephemeral token to client
5. Client creates RTCPeerConnection, gets microphone
6. Client creates SDP offer, sends to OpenAI
7. OpenAI returns SDP answer, connection established
8. Audio streams bidirectionally, events via data channel

## Event Handling

### Client → Server Events

| Event | Purpose |
|-------|---------|
| `session.update` | Update instructions, tools, voice settings |
| `conversation.item.create` | Add messages or function call outputs |
| `response.create` | Trigger model to generate a response |

### Server → Client Events

| Event | Purpose |
|-------|---------|
| `session.created` | Connection established |
| `response.audio.delta` | Audio chunk (agent speaking) |
| `response.audio.done` | Audio complete |
| `response.done` | Full response complete, check for function calls |
| `input_audio_buffer.speech_started` | User started speaking (interruption) |
| `error` | Error occurred |

## Function Call Flow

```
┌─────────────┐                    ┌─────────────┐
│   Model     │                    │   Client    │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │  response.done (with function_call)
       │─────────────────────────────────>│
       │                                  │
       │                          Execute function
       │                          (e.g., goToNext)
       │                                  │
       │  conversation.item.create        │
       │  (function_call_output)          │
       │<─────────────────────────────────│
       │                                  │
       │  response.create                 │
       │<─────────────────────────────────│
       │                                  │
       │  Model continues speaking...     │
       │─────────────────────────────────>│
```

**Important:** Only process function calls in `response.done`, not `response.output_item.done`, to avoid "active response in progress" errors.

## Hint System

`sendHint()` provides context to the agent without triggering an immediate response:

```typescript
sendHint('User clicked the Process button. The AI is evaluating...');
```

**How it works:**
1. Creates a user message prefixed with `[Context Update]`
2. Does NOT call `response.create`
3. Agent sees the context and incorporates it naturally in next response

**Use hints for:**
- Button clicks
- Toggle/tab changes
- Accordion expansion
- Form submissions
- Any UI state change the agent should know about

## Slide Context Updates

When the user navigates to a new slide:

1. `setCurrentSlide()` is called with new slide metadata
2. If connected, `updateInstructions()` sends new system prompt via `session.update`
3. `sendHint()` notifies agent: "User navigated to slide X: Title"
4. Agent transitions naturally to the new content

## System Prompt Structure

The system prompt is built dynamically from:

```
┌─────────────────────────────────────┐
│ Role & Persona                      │  ← Name + personality traits
├─────────────────────────────────────┤
│ Presentation Context                │  ← Topic, example, audience
├─────────────────────────────────────┤
│ Slide Overview                      │  ← All slides with IDs/titles
├─────────────────────────────────────┤
│ Current State                       │  ← Current slide, prev/next
├─────────────────────────────────────┤
│ Current Slide Context               │  ← Visual description, key points,
│                                     │    engagement approach, prompts
├─────────────────────────────────────┤
│ Working with Slide Contexts         │  ← Mode-specific guidance
├─────────────────────────────────────┤
│ Engagement Guidelines               │  ← How to interact naturally
├─────────────────────────────────────┤
│ Tool Usage Guidelines               │  ← When to navigate
└─────────────────────────────────────┘
```

## Interaction Modes

The system prompt adapts based on the selected mode:

| Mode | Prompt Adjustments |
|------|-------------------|
| **presenter** | Agent executes slide context as a plan. Covers key points, checks understanding, suggests moving on. |
| **dialogue** | Slide context is conversation fuel. Questions before explanations. Follows tangents. |
| **assistant** | Agent waits for engagement. Answers thoroughly when asked. Acknowledges UI briefly. |

## Error Handling

| Error | Handling |
|-------|----------|
| No microphone permission | Show error in UI, don't crash |
| Connection timeout | Cleanup, show error, allow retry |
| Token expired | User must reconnect |
| Network interruption | Data channel closes, status → disconnected |

## File Structure

```
lib/realtime/
├── types.ts               # TypeScript interfaces
├── tools.ts               # Navigation tool definitions
└── instructions.ts        # System prompt builder + personas

lib/slide-contexts/
├── index.ts               # Initialize all contexts
└── slides/
    ├── slide-01-title.ts
    ├── slide-02-example.ts
    └── ...

hooks/
├── useRealtimeConnection.ts  # Main WebRTC lifecycle
└── useAuditionSession.ts     # Persona audition sessions

components/voice-agent/
├── VoiceAgentContext.tsx     # React context + provider
├── VoiceAgentButton.tsx      # UI button
└── index.ts                  # Barrel export

app/api/realtime-token/
└── route.ts                  # Ephemeral token endpoint
```

## Persona Auditions

Separate WebRTC sessions for previewing personas:

1. `useAuditionSession` manages independent connection
2. Minimal system prompt with audition instructions
3. Sends `response.create` immediately on connection
4. Persona introduces themselves (~15-20 seconds)
5. User can interact or select/dismiss

This is independent of the main presentation session.
