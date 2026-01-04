# Per-Slide Context Pattern

## File Location

`lib/slide-contexts/slides/slide-XX-name.ts`

## Template

```typescript
import { SlideContext } from '@/lib/realtime/instructions';

export const slideContext: SlideContext = {
  visualDescription: `
    [Describe what the user sees on screen]
    [Include layout, key UI elements, any interactive controls]
    [Describe current state if stateful]
  `,

  keyPoints: [
    'First key concept to convey',
    'Second key concept',
    'Third key concept',
  ],

  backgroundKnowledge: `
    [Deeper context for answering questions]
    [Technical details, common misconceptions]
    [Related concepts the user might ask about]
  `,

  engagementApproach: `
    [Unique strategy for THIS slide]
    [e.g., "guided discovery", "pose question first", "connect to experience"]
  `,

  openingHook: `
    [Natural opening line when arriving on this slide]
  `,

  interactionPrompts: [
    'Try clicking [element] to see what happens',
    'What do you think will happen if...?',
    'Have you encountered this in your own work?',
  ],

  transitionToNext: `
    [How to naturally lead into the next slide]
  `,
};
```

## Engagement Patterns by Slide Type

### Title/Intro Slides
- Build anticipation for what's coming
- Establish rapport with the user
- Set expectations for the presentation

```typescript
engagementApproach: `
  Build excitement and establish rapport. Make the user feel this will be
  worth their time. Don't rush - let them settle in.
`,
openingHook: `
  Welcome! I'm excited to walk you through this with you. We're going to
  explore something that I think you'll find really practical.
`,
```

### Running Example Introduction
- Guided discovery - let user interact first
- React to what they see, don't pre-explain

```typescript
engagementApproach: `
  Guided discovery - let the user click the Process button themselves
  rather than describing what happens. React to what they see.
`,
openingHook: `
  Let's see this in action. Go ahead and click that Process button to
  see what our AI produces.
`,
```

### Concept Reveal / "Aha Moment"
- Pose the problem or question first
- Create tension before revealing the answer

```typescript
engagementApproach: `
  Create cognitive tension by posing the problem clearly, then reveal
  the solution. Let the "aha" moment land.
`,
openingHook: `
  So here's the challenge we're facing... [pause] How do we actually
  know if this output is any good?
`,
```

### Interactive Demo
- Encourage experimentation
- React to user actions via hints

```typescript
engagementApproach: `
  Hands-on experimentation. Encourage the user to try different options
  and observe the results. Be ready to explain what they're seeing.
`,
openingHook: `
  This is where it gets fun. Try toggling between the different options
  and see what changes.
`,
```

### Limitation/Problem Slides
- Create cognitive dissonance
- Set up the need for the next concept

```typescript
engagementApproach: `
  Highlight the limitation clearly. Make the user feel the problem so
  they're primed for the solution on the next slide.
`,
openingHook: `
  But here's the thing... this approach only gets us so far.
`,
```

### New Section / "Level Unlocked"
- Create excitement for the new topic
- Frame it as progression

```typescript
engagementApproach: `
  Treat this as a milestone. The user has "earned" this next level by
  understanding the previous concepts.
`,
openingHook: `
  Alright, you've got the foundation. Now let's unlock the next level.
`,
```

### Skeptic/Objection Slides
- Address concerns head-on
- Be conversational, not defensive

```typescript
engagementApproach: `
  Anticipate and address skepticism directly. Acknowledge the concern
  is valid, then explain why it works anyway.
`,
openingHook: `
  Now, you might be thinking... "wait, isn't that kind of circular?"
  That's a fair question. Let me explain why it actually works.
`,
```

### Recap/Summary Slides
- Reinforce key takeaways
- Provide clear next steps

```typescript
engagementApproach: `
  Consolidate learning. Make the user feel confident about what they've
  learned and clear about what to do next.
`,
openingHook: `
  Let's bring it all together. Here's what we've covered...
`,
```

## Example: Complete Slide Context

```typescript
import { SlideContext } from '@/lib/realtime/instructions';

export const slideContext: SlideContext = {
  visualDescription: `
    The user sees a split-panel interface simulating a "Candidate Screening Tool".

    Left panel:
    - Mock window chrome (red/amber/green dots)
    - "Resume Upload" section with "sarah_chen_resume.pdf" shown
    - Blue "Process Candidate" button

    Right panel:
    - "AI Assessment" area, initially empty
    - After processing: Shows score (4/5) with reasoning text

    Above both panels:
    - UI/Code toggle to switch between interface view and code view
  `,

  keyPoints: [
    'This is our running example throughout the presentation',
    'The AI reads resumes and produces a score with reasoning',
    'The output is rich text that needs evaluation beyond simple checks',
  ],

  backgroundKnowledge: `
    This candidate screening tool represents a common AI use case: taking
    unstructured input (resume) and producing structured + unstructured
    output (score + reasoning).

    The challenge is that the reasoning can contain hallucinations, bias,
    or factual errors that simple unit tests can't catch. For example,
    the AI might claim "6 years of experience" when the resume shows 4,
    or make assumptions based on the candidate's name.

    This is why we need multiple evaluation levels - unit tests for
    structure, LLM judges for content quality, and A/B tests for
    real-world outcomes.
  `,

  engagementApproach: `
    Guided discovery - let the user click the Process button themselves
    rather than describing what happens. React to what they see. If they
    switch to Code View, briefly explain what they're looking at.
  `,

  openingHook: `
    Let's see this in action. Go ahead and click that Process button to
    see what our AI produces.
  `,

  interactionPrompts: [
    'Try switching to Code View to see what\'s happening under the hood',
    'What do you notice about the AI\'s reasoning?',
    'Can you spot anything that might need verification?',
  ],

  transitionToNext: `
    So we've got an AI producing rich output. The question is: how do we
    know if this output is actually good? Let's explore the challenges.
  `,
};
```

## Index File Pattern

Create `lib/slide-contexts/index.ts`:

```typescript
import { setSlideContext, SlideContext } from '@/lib/realtime/instructions';

// Import all slide contexts
import { slideContext as slide01 } from './slides/slide-01-title';
import { slideContext as slide02 } from './slides/slide-02-scenario';
import { slideContext as slide03 } from './slides/slide-03-problem';
// ... more imports

// Map slide IDs to their contexts
export const slideContexts: Record<string, SlideContext> = {
  'title': slide01,
  'scenario': slide02,
  'problem': slide03,
  // ... more mappings (keys must match slide IDs in your presentation)
};

// Initialize all slide contexts (call this once on app load)
export function initializeSlideContexts(): void {
  for (const [slideId, context] of Object.entries(slideContexts)) {
    setSlideContext(slideId, context);
  }
}
```

## Tips

1. **Don't describe everything** - The user can see the screen. Focus on what's important.

2. **Vary your patterns** - Don't use the same engagement approach on every slide.

3. **Include background for Q&A** - Users will ask questions. Give the agent enough context to answer well.

4. **Keep opening hooks natural** - Read them out loud. Do they sound like something a person would say?

5. **Think about transitions** - How does this slide connect to the next? Make it feel like a journey.
