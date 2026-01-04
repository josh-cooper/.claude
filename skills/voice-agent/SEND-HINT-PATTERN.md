# sendHint Integration Pattern

The `sendHint()` function provides real-time context to the voice agent about user actions without triggering an immediate response. This keeps the agent informed so it can respond naturally.

## Basic Setup

```typescript
// 1. Import the hook
import { useVoiceAgent } from '@/components/voice-agent';

// 2. Use in component
export default function SlideXX({ isActive }: SlideProps) {
  const { sendHint } = useVoiceAgent();

  // sendHint is safe to call even when disconnected (no-op)
}
```

## Pattern: Button Clicks

For buttons that trigger actions, send hints before and after:

```typescript
const handleProcess = () => {
  sendHint('User clicked "Process Candidate". The AI is now evaluating the resume.');
  setProcessing(true);

  setTimeout(() => {
    setProcessing(false);
    setComplete(true);
    sendHint('Processing complete. The AI gave a score of 4/5 with reasoning about strong technical skills and relevant experience.');
  }, 1500);
};
```

## Pattern: Toggle Switches

For toggles that change views or modes:

```typescript
const handleViewChange = (mode: 'ui' | 'code') => {
  if (mode !== currentMode) {
    sendHint(`User switched to ${mode === 'code' ? 'Code View to see the implementation details' : 'UI View to see the interface'}.`);
  }
  setCurrentMode(mode);
};
```

```typescript
const handleJudgeTypeChange = (type: 'fact-checker' | 'bias-detector') => {
  if (type !== currentType) {
    const description = type === 'fact-checker'
      ? 'verifies factual claims against the source data'
      : 'analyzes the output for signs of unfair bias';
    sendHint(`User switched to the ${type} judge. This judge ${description}.`);
  }
  setCurrentType(type);
};
```

## Pattern: Accordion/Panel Expansion

When expandable content is revealed:

```typescript
const toggleCard = (id: string) => {
  const isExpanding = expandedCard !== id;
  setExpandedCard(isExpanding ? id : null);

  if (isExpanding) {
    const card = cards.find(c => c.id === id);
    if (card) {
      // Include the content so the agent knows what was revealed
      sendHint(`User expanded the card: "${card.title}". The explanation reads: ${card.content}`);
    }
  }
};
```

## Pattern: Quiz Answers

For interactive quizzes, include whether correct and the explanation:

```typescript
const handleAnswerSelect = (selectedOption: number) => {
  const question = questions[currentQuestion];
  const isCorrect = selectedOption === question.correct;
  const optionText = question.options[selectedOption].text;

  sendHint(
    `User answered "${optionText}" for the question "${question.question}". ` +
    `${isCorrect ? 'Correct!' : 'Incorrect.'} ${question.explanation}`
  );

  setSelectedAnswer(selectedOption);
  setShowResult(true);
};

const handleNextQuestion = () => {
  if (currentQuestion < questions.length - 1) {
    const nextQ = questions[currentQuestion + 1];
    sendHint(`Moving to question ${currentQuestion + 2}: "${nextQ.question}"`);
    setCurrentQuestion(currentQuestion + 1);
  } else {
    sendHint('User finished the quiz and returned to the main view.');
    setShowQuiz(false);
  }
};
```

## Pattern: Scenario Changes

When switching between different scenarios or examples:

```typescript
const handleScenarioChange = (scenario: 'good' | 'bad') => {
  if (scenario !== currentScenario) {
    const description = scenario === 'good'
      ? 'This shows the AI working correctly with accurate output'
      : 'This shows a problematic output with hallucinated facts';
    sendHint(`User switched to the "${scenario}" scenario. ${description}.`);
  }
  setCurrentScenario(scenario);
};
```

## Pattern: Async Operations

For operations with loading states:

```typescript
const handleRunJudge = () => {
  const judgeName = judgeType === 'fact-checker' ? 'Fact-Checker' : 'Bias-Detector';

  // Hint before
  sendHint(`User clicked "Run Judge" with the ${judgeName} selected. The judge is now evaluating the AI's output.`);
  setRunning(true);

  setTimeout(() => {
    setRunning(false);
    setComplete(true);

    // Hint after with results
    const result = judgeResults[judgeType];
    sendHint(`The ${judgeName} completed evaluation. Result: ${result.verdict.toUpperCase()}. Summary: ${result.summary}`);
  }, 1500);
};
```

## Pattern: Level/Section Selection

When users select different levels or sections:

```typescript
const handleLevelClick = (levelNumber: number) => {
  const isExpanding = selectedLevel !== levelNumber;
  setSelectedLevel(isExpanding ? levelNumber : null);

  if (isExpanding) {
    const level = levels.find(l => l.number === levelNumber);
    if (level) {
      sendHint(`User clicked on Level ${level.number}: ${level.name}. Key takeaways: ${level.takeaways.join('; ')}`);
    }
  }
};
```

## Pattern: Starting Interactive Modes

When entering a quiz, demo, or other interactive mode:

```typescript
const handleStartQuiz = () => {
  sendHint('User started the quiz to test their understanding of the three evaluation levels.');
  setShowQuiz(true);
};

const handleStartDemo = () => {
  sendHint('User opened the interactive demo. They can now experiment with different inputs.');
  setShowDemo(true);
};
```

## What to Hint About

### DO hint about:
- Button clicks and their results
- State changes (toggle, tab, accordion)
- Results of operations (test results, scores)
- Mode changes (entering/exiting quiz)
- Selections (which option they chose)

### DON'T hint about:
- Automatic animations
- Hover states
- Passive scrolling
- Internal state that doesn't affect UI

## Writing Good Hints

### Include context, not just actions:

```typescript
// Bad - just the action
sendHint('User clicked button');

// Good - action + what happened
sendHint('User clicked "Run Tests". 3 tests passed, 1 failed (the JSON schema validation).');
```

### Be specific about results:

```typescript
// Bad - vague
sendHint('The judge finished');

// Good - specific outcome
sendHint('The Fact-Checker judge completed. Result: PASS. All 4 factual claims were verified against the resume.');
```

### For toggles, describe what changed:

```typescript
// Bad - just the new state
sendHint('User selected Code View');

// Good - what they can now see
sendHint('User switched to Code View. They can now see the Python function that calls the LLM with the evaluation prompt.');
```

## Complete Example: Slide with Multiple Interactions

```typescript
'use client';

import { useState, useEffect } from 'react';
import { SlideProps } from './types';
import { useVoiceAgent } from '@/components/voice-agent';

export default function Slide10AIWatchingAI({ isActive }: SlideProps) {
  const { sendHint } = useVoiceAgent();
  const [judgeType, setJudgeType] = useState<'fact-checker' | 'bias-detector'>('fact-checker');
  const [viewMode, setViewMode] = useState<'ui' | 'code'>('ui');
  const [judgeRunning, setJudgeRunning] = useState(false);
  const [judgeComplete, setJudgeComplete] = useState(false);

  const handleRunJudge = () => {
    const judgeName = judgeType === 'fact-checker' ? 'Fact-Checker' : 'Bias-Detector';
    sendHint(`User clicked "Run Judge" with the ${judgeName} judge selected. The judge is now evaluating the AI's candidate assessment.`);
    setJudgeRunning(true);
    setJudgeComplete(false);

    setTimeout(() => {
      setJudgeRunning(false);
      setJudgeComplete(true);
      const result = judgeResults[judgeType];
      sendHint(`The ${judgeName} judge completed evaluation. Result: ${result.verdict.toUpperCase()}. Summary: ${result.summary}`);
    }, 1500);
  };

  const handleToggleJudgeType = (type: typeof judgeType) => {
    if (type !== judgeType) {
      const judgeName = type === 'fact-checker' ? 'Fact-Checker' : 'Bias-Detector';
      sendHint(`User switched to the ${judgeName} judge. This judge ${type === 'fact-checker' ? 'verifies factual claims against the resume data' : 'analyzes the assessment for signs of unfair bias'}.`);
    }
    setJudgeType(type);
    setJudgeComplete(false);
  };

  const handleViewModeChange = (mode: typeof viewMode) => {
    if (mode !== viewMode) {
      sendHint(`User switched to ${mode === 'code' ? 'Code View to see the actual judge prompts' : 'UI View to see the interactive judge demo'}.`);
    }
    setViewMode(mode);
  };

  // ... rest of component
}
```
