import { Tool } from './types';

export const slideNavigationTools: Tool[] = [
  {
    type: 'function',
    name: 'goToNextSlide',
    description: 'Navigate to the next slide in the presentation. Use when naturally progressing through the content, when the user asks to continue, says "next", or when you have finished presenting the current slide and the user is ready to move on.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    type: 'function',
    name: 'goToPreviousSlide',
    description: 'Navigate to the previous slide in the presentation. Use when the user wants to go back, says "previous", "go back", or asks to review earlier content.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

// Tool names for type-safe handling
export const TOOL_NAMES = {
  GO_TO_NEXT_SLIDE: 'goToNextSlide',
  GO_TO_PREVIOUS_SLIDE: 'goToPreviousSlide',
} as const;

export type ToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];
