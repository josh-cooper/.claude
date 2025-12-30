---
description: Build an interactive presentation to teach a topic
argument-hint: [url-or-topic]
model: claude-opus-4-5-20251101
---

# Build Interactive Presentation

Create an interactive slide presentation to teach: **$ARGUMENTS**

## Your Workflow

Follow these steps sequentially. Write each output to a file before proceeding to the next step.

### Step 1: Research the Topic

If given a URL, fetch and analyze the content. If given a topic, use web search to gather comprehensive information.

Focus on:
- Core concepts that must be understood
- Common misconceptions
- Practical examples and use cases
- Natural learning progression (what must be understood first?)

### Step 2: Write the Narrative (save to `NARRATIVE.md`)

Create a point-by-point narrative covering:
- The problem/context (why should someone care?)
- Key concepts in learning order
- Practical examples for each concept
- How concepts connect to each other
- Summary/takeaways

This is the "script" - what you'd say if presenting this live. Write it conversationally.

### Step 3: Plan Slides - Iteration 1 (save to `SLIDES.md`)

Convert the narrative into a slide-by-slide plan:

```markdown
## Slide 01: [Title]
**Purpose:** Why this slide exists in the narrative
**Content:** What the slide shows
**Key Message:** The one thing viewers should understand
```

Aim for 10-15 slides. Each slide should have ONE clear purpose.

### Step 4: Plan Interactivity - Iteration 2 (update `SLIDES.md`)

Review each slide and add interactivity that reinforces learning:

- **Progressive reveals**: Don't show everything at once. Let users click to reveal the next concept.
- **Question phases**: Start complex topics with a question, then reveal the answer.
- **Interactive demos**: Where possible, let users interact with the concept.
- **Tabs/toggles**: Show different views of the same concept (code vs UI, before vs after).

For each slide, add:
```markdown
**Interactivity:** [Description of interactive elements]
```

### Step 5: Plan Flow & Context - Iteration 3 (update `SLIDES.md`)

Imagine someone viewing this alone with zero context. Review the slide flow:

- Does each slide clearly connect to the previous one?
- Are there "question phases" that pose a problem before showing the solution?
- Do transitions feel natural or abrupt?
- Are there "unlocked" moments when introducing major new concepts?

Add transition notes:
```markdown
**Transition:** How this connects from the previous slide
```

Common patterns:
- "Level X Unlocked" badges when introducing major sections
- Question → Button → Answer reveal flow
- "But wait..." transitions to address skepticism
- Summary slides that reinforce before moving on

### Step 6: Final Review - Iteration 4 (update `SLIDES.md`)

Final polish:
- Consider adding React Joyride tours for complex interactive elements
- Ensure consistent styling themes across related slides
- Add "nudges" for interactive elements users might miss
- Verify the narrative is coherent end-to-end

### Step 7: Implement the Slides

Use sub-agents to implement slides in parallel. Each agent implements 2-3 slides.

**Pre-Implementation Setup:**

If not already in a Next.js project:
1. Check if we're in an existing Next.js project
2. If not, offer to create one: `pnpm create next-app@latest . --typescript --tailwind --app --eslint`
3. Install dependencies: `pnpm add lucide-react react-joyride`

Create the base infrastructure first:
- `components/slides/types.ts`
- `components/slides/Presentation.tsx`
- `components/slides/SlideIndicator.tsx`
- `components/slides/SlideNavigation.tsx`
- `components/slides/index.ts`

Then implement all slides in parallel using sub-agents.

---

## Technical Requirements

### Tech Stack
- **Next.js 15+** with App Router (`'use client'` directive)
- **React 19** with hooks (useState, useEffect)
- **TypeScript** for type safety
- **Tailwind CSS v4** for styling
- **pnpm** as package manager (NOT npm)
- **lucide-react** for icons
- **react-joyride** for guided tours (optional, for complex interactions)

### Slide Component Pattern

Every slide must follow this exact pattern:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { SlideProps } from './types';

export default function SlideXXName({ isActive }: SlideProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(isActive);
  }, [isActive]);

  // Reset state when slide becomes inactive
  useEffect(() => {
    if (!isActive) {
      // Reset any slide-specific state here
    }
  }, [isActive]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-8">
      <div className="w-full max-w-4xl">
        {/* Content with animations based on mounted state */}
      </div>
    </div>
  );
}
```

### Types (components/slides/types.ts)

```tsx
export interface SlideProps {
  isActive: boolean;
  slideNumber: number;
  totalSlides: number;
}

export interface SlideConfig {
  id: string;
  title: string;
  component: React.ComponentType<SlideProps>;
}
```

### Styling Conventions

**Colors by concept type:**
- Primary/Intro: `blue-50/100/600/700`
- Level 1 / Success: `emerald-50/100/600/700`
- Level 2 / Complex: `violet-50/100/600/700`
- Level 3 / Advanced: `amber-50/100/600/700`
- Warnings/Caution: `rose-50/100/600/700`
- Neutral: `slate-50/100/500/600/700/800`

**Animation pattern:**
```tsx
className={`transition-all duration-700 ${
  mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
}`}
```

**Staggered delays:** `delay-100`, `delay-150`, `delay-200`, `delay-300`

**Card styling:**
```tsx
className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl border-2 border-violet-200 p-6"
```

**Button styling:**
```tsx
className="px-8 py-4 bg-blue-600 text-white rounded-xl text-lg font-semibold hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl"
```

**Section headers:**
```tsx
<p className="text-sm font-medium text-blue-600 mb-2 tracking-wide uppercase">
  Section Label
</p>
<h1 className="text-4xl font-bold text-slate-800 mb-3">
  Main Title
</h1>
```

### Question Phase Pattern

For slides introducing major concepts:

```tsx
const [showQuestion, setShowQuestion] = useState(true);

// Reset when inactive
useEffect(() => {
  if (!isActive) {
    setShowQuestion(true);
  }
}, [isActive]);

return (
  <div className="min-h-screen bg-white flex items-center justify-center p-8">
    <div className="w-full max-w-4xl">
      {showQuestion ? (
        <div className={`text-center transition-all duration-700 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}>
          <p className="text-sm font-medium text-blue-600 mb-4 tracking-wide uppercase">
            The Question
          </p>
          <h2 className="text-3xl font-bold text-slate-800 mb-6">
            [Pose the problem]
          </h2>
          <p className="text-xl text-slate-600 mb-10">
            [Why this matters]
          </p>
          <button
            onClick={() => setShowQuestion(false)}
            className="px-8 py-4 bg-blue-600 text-white rounded-xl text-lg font-semibold hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl"
          >
            Show Me →
          </button>
        </div>
      ) : (
        // Answer content with animations
      )}
    </div>
  </div>
);
```

### Progressive Reveal Pattern

```tsx
const [revealedItems, setRevealedItems] = useState(0);

// In JSX:
{items.map((item, index) => (
  <div
    key={item.id}
    className={`transition-all duration-700 ${
      revealedItems > index
        ? 'opacity-100 translate-y-0'
        : 'opacity-0 translate-y-4 pointer-events-none'
    }`}
  >
    {/* Item content */}
  </div>
))}

{revealedItems < items.length && (
  <button onClick={() => setRevealedItems(r => r + 1)}>
    Continue →
  </button>
)}
```

### Level Badge Pattern

```tsx
<div className="inline-flex items-center gap-3 px-6 py-3 bg-violet-100 rounded-full border-2 border-violet-300 mb-4">
  <svg className="w-6 h-6 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
    />
  </svg>
  <p className="text-sm font-bold text-violet-700 tracking-wide uppercase">
    Level 2 Unlocked
  </p>
</div>
```

### Slides Index Pattern (components/slides/index.ts)

```tsx
import { SlideConfig } from "./types";
import Slide01Title from "./Slide01Title";
// ... more imports

export const slides: SlideConfig[] = [
  {
    id: "title",
    title: "Presentation Title",
    component: Slide01Title,
  },
  // ... more slides
];

export { default as Presentation } from "./Presentation";
export { default as SlideIndicator } from "./SlideIndicator";
export { default as SlideNavigation } from "./SlideNavigation";
export * from "./types";
```

### Main Page (app/page.tsx)

```tsx
import { Presentation, slides } from '@/components/slides';

export default function Home() {
  return <Presentation slides={slides} />;
}
```

---

## Reference Examples

These are complete examples of slide patterns that work well. Use them as inspiration.

### Example 1: "Running Example" Introduction Slide

This pattern introduces a concrete example that will be used throughout the presentation. It forces user interactivity before showing the main content, creating engagement.

**Structure:**
1. Phase 1-2: Auto-animated intro explaining what the example is
2. Phase 3: "Open Application" button to reveal the interactive demo
3. Phase 4: Full interactive demo with UI/Code toggle

```tsx
'use client';

import { useState, useEffect } from 'react';
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride';
import { SlideProps } from './types';

export default function Slide02Scenario({ isActive }: SlideProps) {
  const [mounted, setMounted] = useState(false);
  const [processed, setProcessed] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [view, setView] = useState<'ui' | 'code'>('ui');
  const [phase, setPhase] = useState(1);
  const [runTour, setRunTour] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [tourCompleted, setTourCompleted] = useState(false);

  // Define tour steps for guiding users through the demo
  const steps: Step[] = [
    {
      target: '#process-button',
      content: 'Click Process to see the AI evaluate the candidate',
      disableBeacon: true,
      placement: 'right',
    },
    {
      target: '#view-toggle',
      content: 'Toggle to Code View to see how it works under the hood',
      disableBeacon: true,
      placement: 'bottom',
    },
  ];

  useEffect(() => {
    if (isActive) {
      const mountTimer = setTimeout(() => setMounted(true), 0);
      // Auto-advance only to phase 2
      const phase2Timer = setTimeout(() => setPhase(2), 1500);

      return () => {
        clearTimeout(mountTimer);
        clearTimeout(phase2Timer);
      };
    } else {
      // Reset when slide becomes inactive
      const resetTimer = setTimeout(() => {
        setMounted(false);
        setPhase(1);
        setProcessed(false);
        setProcessing(false);
        setRunTour(false);
        setStepIndex(0);
        setTourCompleted(false);
      }, 0);
      return () => clearTimeout(resetTimer);
    }
  }, [isActive]);

  // Start tour when phase 4 is active
  useEffect(() => {
    if (phase >= 4 && !processed && !processing && !tourCompleted) {
      const tourTimer = setTimeout(() => setRunTour(true), 800);
      return () => clearTimeout(tourTimer);
    }
  }, [phase, processed, processing, tourCompleted]);

  const handleProcess = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setProcessed(true);
    }, 1500);
  };

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, action, index, type } = data;
    if (action === 'close') {
      setRunTour(false);
      setStepIndex(0);
      setTourCompleted(true);
      return;
    }
    if (type === 'step:after') {
      setStepIndex(index + (action === 'prev' ? -1 : 1));
    }
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRunTour(false);
      setStepIndex(0);
      setTourCompleted(true);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-8">
      {/* Joyride Tour */}
      <Joyride
        steps={steps}
        run={runTour}
        stepIndex={stepIndex}
        continuous
        showProgress
        showSkipButton
        callback={handleJoyrideCallback}
        styles={{
          options: { primaryColor: '#2563eb', zIndex: 10000 },
          tooltip: { borderRadius: 12, padding: 20, fontSize: 14 },
        }}
      />
      <div className="w-full max-w-3xl">
        {/* Phase 1-2: Introduction */}
        {phase < 4 && (
          <div className="text-center space-y-8">
            <div className={`transition-all duration-1000 ${
              phase >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}>
              <p className="text-sm font-medium text-blue-600 mb-2 tracking-wide uppercase">
                The Scenario
              </p>
              <h1 className="text-3xl font-bold text-slate-800 mb-4">
                Let&apos;s use a running example
              </h1>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Throughout this presentation, we&apos;ll explore evaluation using a concrete AI system
              </p>
            </div>

            {/* Phase 2: What the example is + Open button */}
            <div className={`transition-all duration-1000 delay-200 ${
              phase >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}>
              <div className="bg-blue-50 rounded-2xl border-2 border-blue-200 p-8 max-w-2xl mx-auto">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800">Candidate Screening Tool</h2>
                </div>
                <p className="text-slate-700 leading-relaxed mb-6">
                  An AI that reads resumes and evaluates candidates for a job. It gives a score (1-5)
                  and explains its reasoning—just like a recruiter would.
                </p>

                {/* Interactive button to reveal the demo */}
                <button
                  onClick={() => setPhase(4)}
                  className="group px-8 py-4 bg-blue-600 text-white rounded-xl font-semibold text-lg hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl hover:scale-105 flex items-center justify-center gap-3 mx-auto"
                >
                  <span>Open Application</span>
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Phase 4: Full interactive demo */}
        {phase >= 4 && (
          <div className={`transition-all duration-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
            {/* Header */}
            <div className="text-center mb-6">
              <p className="text-sm font-medium text-blue-600 mb-2 tracking-wide uppercase">The Scenario</p>
              <h1 className="text-3xl font-bold text-slate-800">Meet Our AI: Candidate Screening</h1>
            </div>

            {/* View Toggle */}
            <div className="flex justify-center mb-6">
              <div id="view-toggle" className="inline-flex bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => setView('ui')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    view === 'ui' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  UI View
                </button>
                <button
                  onClick={() => setView('code')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    view === 'code' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Code View
                </button>
              </div>
            </div>

            {/* UI View - Mock Application */}
            {view === 'ui' && (
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6">
                {/* Window chrome */}
                <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-200">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                  <span className="ml-4 text-sm text-slate-400">Smart Recruiting Tool</span>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-3">Resume Upload</p>
                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center bg-white">
                      <p className="text-sm font-medium text-slate-700">sarah_chen_resume.pdf</p>
                      <p className="text-xs text-slate-400 mt-1">Software Engineer • 4 pages</p>
                    </div>

                    <button
                      id="process-button"
                      onClick={handleProcess}
                      disabled={processing || processed}
                      className={`mt-4 w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                        processed ? 'bg-emerald-100 text-emerald-700' :
                        processing ? 'bg-blue-100 text-blue-700' :
                        'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {processed ? '✓ Processed' : processing ? 'Analyzing...' : 'Process Candidate'}
                    </button>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-3">AI Assessment</p>
                    <div className="bg-white rounded-xl border border-slate-200 p-4 min-h-[180px]">
                      {!processed && !processing && (
                        <p className="text-sm text-slate-400 italic">Click &quot;Process Candidate&quot; to see output...</p>
                      )}
                      {processing && (
                        <div className="flex items-center gap-2 text-sm text-blue-600">
                          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                          Evaluating candidate...
                        </div>
                      )}
                      {processed && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-emerald-600">4</span>
                            <span className="text-sm text-slate-500">/ 5</span>
                          </div>
                          <p className="text-sm text-slate-600 leading-relaxed">
                            Strong candidate with 6 years of relevant experience. Demonstrates solid
                            full-stack skills with React and Node.js.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Code View - show the underlying code */}
            {view === 'code' && (
              <div className="bg-slate-900 rounded-2xl p-6">
                {/* Window chrome */}
                <div className="flex items-center gap-2 mb-4 pb-4 border-b border-slate-700">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                  <span className="ml-4 text-sm text-slate-500 font-mono">evaluate_candidate.py</span>
                </div>
                <pre className="text-xs font-mono leading-relaxed text-slate-300">
                  {/* Syntax highlighted code here */}
                </pre>
              </div>
            )}

            <p className="text-center text-sm text-slate-500 mt-4">
              {view === 'ui' ? 'What the recruiter sees' : "What's happening under the hood"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Key Features:**
- Multi-phase animation with auto-progression (phases 1→2)
- User must click to reveal main content (phase 4)
- React Joyride tour nudges users to interact
- UI/Code toggle to show different perspectives
- Mock application window chrome (red/amber/green dots)
- Processing animation with spinner
- Resets all state when navigating away

---

### Example 2: "Level Unlocked" Transition Slide

This pattern introduces a major new section with a metaphor (like unlocking a level in a game). It creates anticipation before revealing the content.

**Structure:**
1. Question phase with "Level X Unlocked" badge
2. Pose the limitation of the previous approach
3. Button to reveal the new approach
4. Content phase with the actual solution

```tsx
'use client';

import { useState, useEffect } from 'react';
import { SlideProps } from './types';

export default function Slide08LLMJudgeIntro({ isActive }: SlideProps) {
  const [mounted, setMounted] = useState(false);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    setMounted(isActive);
  }, [isActive]);

  // Reset when slide becomes inactive
  useEffect(() => {
    if (!isActive) {
      setShowContent(false);
    }
  }, [isActive]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-8">
      <div className="w-full max-w-5xl">
        {!showContent ? (
          /* Question Phase - Level 2 Unlocked */
          <div className={`text-center transition-all duration-700 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}>
            {/* Level Unlocked Badge */}
            <div className="mb-6">
              <div className="inline-flex items-center gap-3 px-6 py-3 bg-violet-100 rounded-full border-2 border-violet-300 mb-4">
                <svg className="w-6 h-6 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
                  />
                </svg>
                <p className="text-sm font-bold text-violet-700 tracking-wide uppercase">
                  Level 2 Unlocked
                </p>
              </div>
            </div>

            {/* The limitation of the previous approach */}
            <h2 className="text-4xl font-bold text-slate-800 mb-6 max-w-2xl mx-auto leading-tight">
              Unit tests can&apos;t judge quality, bias, or meaning.
            </h2>
            <p className="text-2xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
              So how do we evaluate at scale?
            </p>

            {/* Button to reveal the answer */}
            <button
              onClick={() => setShowContent(true)}
              className="px-8 py-4 bg-violet-600 text-white rounded-xl text-lg font-semibold hover:bg-violet-700 transition-all shadow-lg hover:shadow-xl"
            >
              Discover Level 2 →
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className={`text-center mb-8 transition-all duration-700 ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              <p className="text-sm font-medium text-violet-600 mb-2 tracking-wide uppercase">
                Level 2
              </p>
              <h1 className="text-4xl font-bold text-slate-800 mb-3">
                Human & AI Evaluation
              </h1>
              <p className="text-lg text-slate-700 mb-3">
                When structure checks aren&apos;t enough, you need judgment
              </p>
            </div>

            {/* Content cards with staggered animation */}
            <div className={`max-w-3xl mx-auto mb-6 transition-all duration-700 delay-200 ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-rose-50 to-orange-50 rounded-xl p-4 border-2 border-rose-200">
                  <p className="text-sm font-bold text-slate-800 mb-2">1. Human-in-the-Loop</p>
                  <p className="text-xs text-slate-700">
                    Keep humans involved where there&apos;s significant impact and risk
                  </p>
                </div>
                <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl p-4 border-2 border-violet-200">
                  <p className="text-sm font-bold text-slate-800 mb-2">2. Monitor at Scale</p>
                  <p className="text-xs text-slate-700">
                    Design AI judges to detect drift and outliers
                  </p>
                </div>
              </div>
            </div>

            {/* Transition hint */}
            <div className={`max-w-3xl mx-auto bg-violet-50 rounded-xl p-6 border-2 border-violet-200 text-center transition-all duration-700 delay-300 ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              <p className="text-sm text-violet-800 font-medium">
                Let&apos;s explore how automated evaluation works →
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

**Key Features:**
- "Level Unlocked" badge with lock icon creates gaming metaphor
- Poses the limitation clearly before showing solution
- Uses the level's color theme (violet for Level 2)
- Button text matches the metaphor ("Discover Level 2")
- Content phase has staggered animations (delay-200, delay-300)

---

### Example 3: Interactive Mock Application with Toggles

This pattern shows a simulation where users can toggle between scenarios and see different outcomes. Great for demonstrating how tests work.

**Structure:**
1. UI/Code toggle at the top
2. Scenario toggles (Agreement vs Disagreement)
3. Animated step-by-step visualization
4. Result card with conditional styling

```tsx
'use client';

import { useState, useEffect } from 'react';
import { SlideProps } from './types';

export default function Slide06UnitTestsExamples({ isActive }: SlideProps) {
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<'ui' | 'code'>('ui');
  const [scenario, setScenario] = useState<'agreement' | 'disagreement'>('agreement');
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    if (isActive) {
      setMounted(true);
      setShowResult(false);
    } else {
      setMounted(false);
    }
  }, [isActive]);

  // Auto-show result after delay
  useEffect(() => {
    if (isActive && view === 'ui') {
      const timer = setTimeout(() => setShowResult(true), 800);
      return () => clearTimeout(timer);
    }
  }, [isActive, scenario, view]);

  const agreementData = {
    runs: [
      { id: 1, score: 4, reasoning: 'Strong technical background' },
      { id: 2, score: 4, reasoning: 'Solid skillset, good fit' },
      { id: 3, score: 4, reasoning: 'Experience aligns well' },
      { id: 4, score: 4, reasoning: 'Technical depth matches' },
    ],
    result: 'Agreement',
    color: 'emerald',
  };

  const disagreementData = {
    runs: [
      { id: 1, score: 4, reasoning: 'Strong technical background' },
      { id: 2, score: 1, reasoning: 'Unclear career progression' }, // Outlier!
      { id: 3, score: 4, reasoning: 'Solid skillset, good fit' },
      { id: 4, score: 4, reasoning: 'Technical depth matches' },
    ],
    result: 'Outlier Detected',
    color: 'red',
  };

  const currentData = scenario === 'agreement' ? agreementData : disagreementData;

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-8">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className={`text-center mb-6 transition-all duration-700 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}>
          <p className="text-sm font-medium text-blue-600 mb-2 tracking-wide uppercase">
            Level 1: Unit Tests
          </p>
          <h1 className="text-3xl font-bold text-slate-800">Self-Consistency Check</h1>
        </div>

        {/* View Toggle */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setView('ui')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                view === 'ui' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
              }`}
            >
              UI View
            </button>
            <button
              onClick={() => setView('code')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                view === 'code' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
              }`}
            >
              Code View
            </button>
          </div>
        </div>

        {view === 'ui' && (
          <div className="transition-all duration-300">
            {/* Scenario Toggle */}
            <div className="flex justify-center mb-6">
              <div className="inline-flex bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => setScenario('agreement')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    scenario === 'agreement' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Agreement
                </button>
                <button
                  onClick={() => setScenario('disagreement')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    scenario === 'disagreement' ? 'bg-red-500 text-white shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Disagreement
                </button>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-8">
              {/* Window chrome */}
              <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-200">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <span className="ml-4 text-sm text-slate-400">Self-Consistency Check</span>
              </div>

              {/* 4 Parallel Runs with staggered animation */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                {currentData.runs.map((run, index) => (
                  <div
                    key={run.id}
                    className={`bg-white rounded-lg border-2 p-4 transition-all duration-500 ${
                      showResult
                        ? `opacity-100 translate-y-0 ${
                            scenario === 'disagreement' && run.score === 1
                              ? 'border-red-400 shadow-lg shadow-red-100'  // Highlight outlier
                              : 'border-slate-200'
                          }`
                        : 'opacity-0 translate-y-4'
                    }`}
                    style={{ transitionDelay: `${index * 100}ms` }}
                  >
                    <div className="text-center mb-2">
                      <span className="text-xs text-slate-400">Run {run.id}</span>
                    </div>
                    <div className="flex items-center justify-center mb-2">
                      <span className={`text-3xl font-bold ${
                        scenario === 'disagreement' && run.score === 1
                          ? 'text-red-600'
                          : 'text-emerald-600'
                      }`}>
                        {run.score}
                      </span>
                      <span className="text-sm text-slate-400 ml-1">/ 5</span>
                    </div>
                    <p className="text-xs text-slate-500 text-center line-clamp-2">
                      {run.reasoning}
                    </p>
                  </div>
                ))}
              </div>

              {/* Result card */}
              <div className={`flex justify-center transition-all duration-500 ${
                showResult ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`} style={{ transitionDelay: '600ms' }}>
                <div className={`bg-white rounded-xl border-2 px-8 py-4 shadow-lg ${
                  currentData.color === 'emerald'
                    ? 'border-emerald-400 shadow-emerald-100'
                    : 'border-red-400 shadow-red-100'
                }`}>
                  <p className={`text-lg font-bold ${
                    currentData.color === 'emerald' ? 'text-emerald-700' : 'text-red-700'
                  }`}>
                    {currentData.result}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'code' && (
          <div className="bg-slate-900 rounded-2xl p-6">
            {/* Code view content */}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Key Features:**
- Two-level toggle: View (UI/Code) and Scenario (Agreement/Disagreement)
- Staggered animation with per-item delays (`transitionDelay: ${index * 100}ms`)
- Conditional styling for outliers (red border, shadow)
- Mock window chrome for authenticity
- Auto-triggers result display after delay
- Scenario toggle buttons change color based on selection (emerald/red)

---

## Key Principles

1. **One concept per slide** - Don't overload. If you need more space, add another slide.
2. **Question before answer** - Pose the problem first to create engagement.
3. **Progressive disclosure** - Reveal complexity gradually, not all at once.
4. **Clear transitions** - Each slide should flow naturally from the previous one.
5. **Self-guided** - The presentation should make sense without a presenter.
6. **Interactive where helpful** - Not everything needs to be interactive. Use it to reinforce learning.
7. **Clean, consistent styling** - Use the color conventions consistently throughout.
8. **Use metaphors** - "Level Unlocked", game-like progression, mock applications all make content more engaging.
9. **Nudge with Joyride** - For complex interactions, guide users with tooltips.
10. **Reset on inactive** - Always reset slide state when navigating away.

Now begin working through the steps above to create the presentation.
