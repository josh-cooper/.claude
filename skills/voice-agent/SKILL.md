---
name: voice-agent
description: Add OpenAI Realtime API voice agent to a Next.js presentation. Use when adding voice interactivity, realtime audio, AI presenter, or voice navigation to slides. Triggers on "voice agent", "realtime API", "audio presentation", "AI presenter", "voice navigation".
---

# Voice Agent for Presentations

Add an OpenAI Realtime API voice agent that presents slides, interacts with users, answers questions, and navigates via tool calls.

## Prerequisites

- Existing Next.js presentation with slide components
- `OPENAI_API_KEY` in `.env.local`

## Effort Distribution

| Phase | Effort | Description |
|-------|--------|-------------|
| 1. Infrastructure | 15% | Copy core files, wire up providers |
| 2. Customize Framework | 15% | Set presentation metadata, tweak personas |
| 3. Design Voice Engagement | 70% | Creative work: per-slide contexts, hints |

**The creative work is Phase 3.** Phases 1-2 are mechanical setup.

---

## Phase 1: Infrastructure Setup

Copy these files **exactly as-is** from [files/](files/). No customization needed.

### Core Files (Copy Verbatim)

| Target Path | Source |
|-------------|--------|
| `lib/realtime/types.ts` | [files/types.ts](files/types.ts) |
| `lib/realtime/tools.ts` | [files/tools.ts](files/tools.ts) |
| `app/api/realtime-token/route.ts` | [files/realtime-token-route.ts](files/realtime-token-route.ts) |
| `hooks/useRealtimeConnection.ts` | [files/useRealtimeConnection.ts](files/useRealtimeConnection.ts) |
| `hooks/useAuditionSession.ts` | [files/useAuditionSession.ts](files/useAuditionSession.ts) |
| `components/voice-agent/VoiceAgentContext.tsx` | [files/VoiceAgentContext.tsx](files/VoiceAgentContext.tsx) |
| `components/voice-agent/VoiceAgentButton.tsx` | [files/VoiceAgentButton.tsx](files/VoiceAgentButton.tsx) |
| `components/voice-agent/index.ts` | [files/voice-agent-index.ts](files/voice-agent-index.ts) |

### Template File (Customize)

| Target Path | Source |
|-------------|--------|
| `lib/realtime/instructions.ts` | [files/instructions-template.ts](files/instructions-template.ts) |

This file has `// TODO:` markers for what to customize.

### Integration Steps

1. **Wrap root layout with provider:**
```tsx
// app/layout.tsx
import { VoiceAgentProvider } from '@/components/voice-agent';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <VoiceAgentProvider>
          {children}
          <VoiceAgentButton />
        </VoiceAgentProvider>
      </body>
    </html>
  );
}
```

2. **Register navigation in presentation component:**
```tsx
import { useVoiceAgent } from '@/components/voice-agent';

// In your presentation component:
const { registerNavigationCallbacks, setCurrentSlide, setSlideOverview } = useVoiceAgent();

useEffect(() => {
  registerNavigationCallbacks({
    goToNext: () => setCurrentSlide(prev => Math.min(prev + 1, slides.length - 1)),
    goToPrevious: () => setCurrentSlide(prev => Math.max(prev - 1, 0)),
    goToSlide: (index) => setCurrentSlide(index),
    getCurrentSlide: () => currentSlide,
    getTotalSlides: () => slides.length,
  });
  setSlideOverview(slides.map(s => ({ id: s.id, title: s.title })));
}, []);

useEffect(() => {
  setCurrentSlide({
    id: slides[currentSlide].id,
    title: slides[currentSlide].title,
    slideNumber: currentSlide + 1,
    totalSlides: slides.length,
  });
}, [currentSlide]);
```

Use sub-agents to create files in parallel.

---

## Phase 2: Customize Framework

Open `lib/realtime/instructions.ts` and customize the `// TODO:` sections:

### Required: Presentation Metadata

```typescript
// TODO: Set your presentation details
const PRESENTATION = {
  title: 'Your Presentation Title',
  topic: 'What your presentation is about...',
  runningExample: 'Description of your main example or demo...',
  targetAudience: 'Who this is for and their background...',
  coreFramework: `
    1. **First Concept** - Brief description
    2. **Second Concept** - Brief description
    3. **Third Concept** - Brief description
  `,
};
```

### Optional: Persona Customization

The default personas work well for most presentations:
- **Sophie (guide)** - Warm, encouraging, patient
- **Marcus (coach)** - Direct, challenging, high-energy
- **Claire (expert)** - Clear, precise, structured
- **Sam (peer)** - Casual, exploratory, collaborative

To customize persona names or add presentation-specific phrases, edit the `personas` object.

### Optional: Audition Instructions

If using persona auditions, update `buildAuditionInstructions()` to reference your presentation's content.

### Optional: Landing Page

If the presentation doesn't have a start page, consider adding one with voice/mode/persona selection. See [files/LandingPage-example.tsx](files/LandingPage-example.tsx) for a reference implementation.

---

## Phase 3: Design Voice Engagement

**This is where you spend most of your effort.** Work through three focused passes, each building on the last. Don't try to do everything at once.

### Pass 1: Content Foundation

For each slide, create `lib/slide-contexts/slides/slide-XX-name.ts` with just the **factual content**:

```typescript
import { SlideContext } from '@/lib/realtime/instructions';

export const slideContext: SlideContext = {
  // PASS 1: What's here and what matters
  visualDescription: `
    Describe what the user sees on screen.
    Include layout, UI elements, interactive controls.
    Note current state if the slide is stateful.
  `,
  keyPoints: [
    'First key concept (2-4 total)',
    'Second key concept',
  ],
  backgroundKnowledge: `
    Deeper context for answering questions.
    Technical details, common misconceptions.
    Related concepts the user might ask about.
  `,

  // PASS 2: Leave empty for now
  engagementApproach: '',
  openingHook: '',
  interactionPrompts: [],
  transitionToNext: '',
};
```

**Focus:** Accuracy and completeness. What does the user see? What should they learn? What might they ask?

Use sub-agents to create multiple slides in parallel. Then create the index file:

```typescript
// lib/slide-contexts/index.ts
import { setSlideContext } from '@/lib/realtime/instructions';
import { slideContext as slide01 } from './slides/slide-01-title';
// ... more imports

export const slideContexts = { 'title': slide01, /* ... */ };

export function initializeSlideContexts(): void {
  for (const [id, ctx] of Object.entries(slideContexts)) {
    setSlideContext(id, ctx);
  }
}
```

---

### Pass 2: Engagement Design

Now go back through each slide and fill in the **engagement strategy**. This is the creative pass.

```typescript
  // PASS 2: How to engage
  engagementApproach: `
    What's the unique strategy for THIS slide?
    e.g., "guided discovery", "pose question first", "create tension"
  `,
  openingHook: `
    The first thing to say when arriving on this slide.
    Should feel natural spoken aloud.
  `,
  interactionPrompts: [
    'Try clicking [element] to see what happens',
    'What do you think will happen if...?',
    'Have you encountered this in your own work?',
  ],
  transitionToNext: `
    How to naturally lead into the next slide.
    Creates continuity in the narrative.
  `,
```

**Vary your approach.** Don't use the same pattern on every slide:

| Slide Type | Pattern |
|------------|---------|
| Title/Intro | Build anticipation, establish rapport |
| Running example | Guided discovery - "try clicking X" |
| Concept reveal | Pose problem first, then reveal |
| Interactive demo | Encourage experimentation |
| Limitation/problem | Create cognitive tension |
| New section | "Level unlocked" excitement |
| Skeptic/objection | Address concerns conversationally |
| Recap | Reinforce key points, call to action |

**Focus:** Personality and flow. Read the opening hooks aloud - do they sound natural? Does each slide feel different?

See [SLIDE-CONTEXT-PATTERN.md](SLIDE-CONTEXT-PATTERN.md) for detailed examples by slide type.

---

### Pass 3: UI Interactivity

For slides with interactive elements, add `sendHint()` calls to the slide components. This keeps the agent informed about user actions.

```typescript
import { useVoiceAgent } from '@/components/voice-agent';

export default function SlideXX({ isActive }: SlideProps) {
  const { sendHint } = useVoiceAgent();

  const handleButtonClick = () => {
    sendHint('User clicked Process. The AI is evaluating...');
    // ... do the action
    sendHint('Processing complete. Result: score 4/5 with reasoning about...');
  };
}
```

**Add hints for:**
- Button clicks (before and after async operations)
- Toggle/tab changes
- Accordion expansions
- Quiz answers
- Any state change the agent should know about

**Focus:** Context richness. Include what happened, not just what was clicked.

See [SEND-HINT-PATTERN.md](SEND-HINT-PATTERN.md) for patterns and examples.

---

## Interaction Modes

The voice agent supports three interaction modes:

| Mode | Who Drives | Best For |
|------|-----------|----------|
| **presenter** | Agent leads | Structured walkthroughs, demos |
| **dialogue** | Shared turn-taking | Learning, exploration, engagement |
| **assistant** | User leads | Self-paced study, reference |

Set via `setMode('dialogue')` on the voice agent context. Default is `'dialogue'`.

---

## Testing Checklist

- [ ] Microphone permission works
- [ ] Connection establishes (check console for "session created")
- [ ] Navigation tools work (agent says "next" -> slide advances)
- [ ] Hints flow through on interactions
- [ ] Slide context updates when navigating
- [ ] Persona voice sounds correct

---

## Architecture

For technical decisions and WebRTC flow, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Troubleshooting

**Agent doesn't start talking:**
- Ensure `response.create` is sent after connection (this happens automatically in useRealtimeConnection)
- Check that instructions are being passed to the token endpoint

**Navigation doesn't work:**
- Verify `registerNavigationCallbacks` is called with correct functions
- Check console for function call events

**Hints not reaching agent:**
- Verify `status === 'connected'` before sending
- Check data channel is open in console

**Wrong voice:**
- Check persona -> voice mapping in instructions.ts
- Verify voice is being passed to token endpoint
