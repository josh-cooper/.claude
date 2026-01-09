"""
Prompt templates for the ACE pipeline.

Each prompt corresponds to a stage in the pipeline:
0. Triviality Filter - quick check to skip trivial conversations
1. Trajectory Reconstructor - role-play reasoning from transcript
2. Reflector - extract insights from trajectory
3. Curator - generate delta operations for playbook
"""

TRIVIALITY_PROMPT = """You are evaluating whether a Claude Code conversation is worth extracting
learnings from. Trivial conversations should be skipped.

## Conversation

{formatted_transcript}

## Instructions

Determine if this conversation is **trivial** and not worth analyzing.

A conversation is TRIVIAL if:
- It's just greetings, thanks, or small talk
- It's a simple question with a factual answer (no reasoning or tool use)
- It's very short with no meaningful work done
- It's just reading files without any action or decision-making

A conversation is WORTH ANALYZING if:
- Claude made decisions about how to approach a task
- Claude used tools and the results informed next steps
- Something went wrong and Claude had to recover
- The user corrected Claude or provided feedback
- Claude completed a multi-step task
- There were non-obvious choices about implementation

Respond with your assessment."""


TRAJECTORY_PROMPT = """You are analyzing a Claude Code conversation to reconstruct the reasoning
trajectory that led to each decision. Your job is to role-play as the AI
assistant and articulate what it was likely thinking at each key moment.

## Conversation

{formatted_transcript}

## Instructions

Reconstruct the reasoning trajectory by identifying key decision points and
articulating the thinking that led to each action. For each decision point:

1. **What was the decision?** (e.g., "Decided to use Grep instead of Glob")
2. **What was I likely thinking?** Role-play the reasoning:
   - What assumptions was I making?
   - What context was I drawing on?
   - What alternatives did I consider (or fail to consider)?
3. **What was the outcome?** Did this work well or poorly?
4. **What led to that outcome?**
   - If it worked: What context/reasoning made this successful?
   - If it failed: What assumption was wrong? What did I miss?

Focus especially on:
- Moments where something went wrong (errors, user corrections, wrong approaches)
- Moments where something went particularly well (user appreciation, elegant solutions)
- Moments involving tool selection or usage patterns
- Moments involving understanding of this specific codebase

Identify the most significant decision points - don't list every trivial action."""


REFLECTOR_PROMPT = """You are an expert at diagnosing AI assistant behavior and extracting actionable
insights. Your job is to analyze a reconstructed reasoning trajectory and
identify what should be learned from it.

## Reconstructed Trajectory

{trajectory_json}

## Current Playbook (bullets that were available during this turn)

{playbook_bullets}

## Instructions

Analyze the trajectory to extract insights:

### For Failures:
1. **Error Identification**: What specifically went wrong?
2. **Root Cause Analysis**: Why did this error occur? What assumption or
   knowledge gap caused it?
3. **Correct Approach**: What should have been done instead?
4. **Key Insight**: What strategy or principle should be remembered?

### For Successes:
1. **Success Identification**: What went particularly well?
2. **Contributing Factors**: What reasoning or context led to success?
3. **Generalizable Pattern**: Can this be applied to similar situations?
4. **Key Insight**: What strategy or principle is worth preserving?

### For Existing Bullets:
For each playbook bullet that was available, assess whether it was:
- **helpful**: Contributed to good decisions
- **harmful**: Led to incorrect approaches
- **neutral**: Not relevant to this turn

### API/Tool Schema Curation:
When tools or APIs returned unexpected formats, explicitly document them.
Example: "Grep with output_mode='files_with_matches' returns file paths only, not line content"

Extract the most valuable insights. Quality over quantity."""


CURATOR_PROMPT = """You are a master curator of knowledge. Your job is to transform reflections
into structured playbook updates.

## Current Context

Working directory: {cwd}

## Playbook Stats

* Bullet count: {bullet_count}
* Estimated tokens: {estimated_tokens}

## Current Playbook

{playbook_bullets}

## Recent Reflections

{reflections_json}

## Instructions

Generate ONLY the delta updates needed. Follow these principles:

1. **No Redundancy**: Only add insights that are genuinely new. If similar
   advice exists, don't duplicate it.
2. **Specificity**: Insights should be concrete and actionable, not vague
3. **Appropriate Section**: Place each insight in the right section
4. **Appropriate Scope**: Choose the right path scope for each insight
5. **Preserve Detail**: Don't over-generalize. Specific details matter.
6. **API/Tool Schemas**: When reflections mention unexpected tool output formats,
   capture these explicitly (e.g., "Read tool returns line numbers starting at 1")

### Available Sections:

- **strategies**: Approaches and rules that work well
- **code_patterns**: Reusable code snippets, templates, patterns
- **pitfalls**: Common errors and how to avoid them
- **context**: Facts - where to find things, codebase structure, user preferences

### Path Scoping:

Each bullet has a `path` that determines where it applies:
- `null`: Global - applies everywhere (user preferences, general strategies)
- `"/path/to/project"`: Applies to this project and all subfolders
- `"/path/to/project/src/api"`: Applies only to this subtree

Choose the narrowest scope that makes sense. If an insight is specific to a
folder structure, scope it there. If it's about the whole project, scope to
project root. If it's a general strategy or user preference, make it global.

### Operations:

1. **ADD**: Create new bullet (provide section, path, and content)
2. **INCREMENT**: Update helpful/harmful counters on existing bullets based on bullet_feedback

Generate operations that will meaningfully improve the playbook."""
