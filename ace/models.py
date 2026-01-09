"""
Pydantic models for structured LLM output via instructor.

These models define the expected output format for each stage of the ACE pipeline.
"""

from typing import Literal
from pydantic import BaseModel, Field


# === Triviality Filter ===


class TrivialityCheck(BaseModel):
    """Output from the triviality filter - determines if conversation is worth analyzing."""

    trivial: bool = Field(description="True if the conversation is trivial and should be skipped")
    reason: str = Field(description="Brief explanation of why the conversation is/isn't trivial")


# === Trajectory Reconstructor ===


class TrajectoryPoint(BaseModel):
    """A single decision point in the reconstructed reasoning trajectory."""

    action: str = Field(description="What action was taken (e.g., 'Searched for UserAuth using Grep')")
    reconstructed_reasoning: str = Field(
        description="Role-played reasoning: what was the assistant likely thinking? What assumptions were made?"
    )
    outcome: Literal["success", "failure", "neutral"] = Field(
        description="Whether this action led to a good or bad outcome"
    )
    outcome_analysis: str = Field(
        description="Analysis of why this outcome occurred - what worked/failed and why"
    )


class TrajectoryOutput(BaseModel):
    """Output from the Trajectory Reconstructor."""

    trajectory_points: list[TrajectoryPoint] = Field(
        description="List of key decision points with reconstructed reasoning"
    )


# === Reflector ===


class FailureReflection(BaseModel):
    """Reflection on a failure - what went wrong and what should be learned."""

    type: Literal["failure"] = "failure"
    error_identification: str = Field(description="What specifically went wrong?")
    root_cause: str = Field(
        description="Why did this error occur? What assumption or knowledge gap caused it?"
    )
    correct_approach: str = Field(description="What should have been done instead?")
    key_insight: str = Field(
        description="The strategy or principle that should be remembered to avoid this in future"
    )


class SuccessReflection(BaseModel):
    """Reflection on a success - what worked and why it's worth preserving."""

    type: Literal["success"] = "success"
    success_identification: str = Field(description="What went particularly well?")
    contributing_factors: str = Field(description="What reasoning or context led to success?")
    generalizable_pattern: str = Field(
        description="Can this be applied to similar situations? How?"
    )
    key_insight: str = Field(
        description="The strategy or principle worth preserving for future use"
    )


class BulletFeedback(BaseModel):
    """Feedback on an existing playbook bullet."""

    id: str = Field(description="The bullet ID (e.g., 'str-00003')")
    tag: Literal["helpful", "harmful", "neutral"] = Field(
        description="Whether this bullet helped, hurt, or was irrelevant"
    )


class ReflectorOutput(BaseModel):
    """Output from the Reflector."""

    reflections: list[FailureReflection | SuccessReflection] = Field(
        description="List of reflections on failures and successes"
    )
    bullet_feedback: list[BulletFeedback] = Field(
        default_factory=list,
        description="Feedback on existing playbook bullets that were available during this turn",
    )


# === Curator ===


class AddOperation(BaseModel):
    """Operation to add a new bullet to the playbook."""

    type: Literal["ADD"] = "ADD"
    section: Literal["strategies", "code_patterns", "pitfalls", "context"] = Field(
        description="Which section to add the bullet to"
    )
    path: str | None = Field(
        description="Scope path: null for global, path string for project/folder scope"
    )
    content: str = Field(description="The bullet content - should be specific and actionable")


class IncrementOperation(BaseModel):
    """Operation to increment a counter on an existing bullet."""

    type: Literal["INCREMENT"] = "INCREMENT"
    bullet_id: str = Field(description="The bullet ID to update")
    field: Literal["helpful", "harmful"] = Field(description="Which counter to increment")


class CuratorOutput(BaseModel):
    """Output from the Curator."""

    reasoning: str = Field(
        description="Explanation of why these operations were chosen and how they relate to the reflections"
    )
    operations: list[AddOperation | IncrementOperation] = Field(
        description="List of delta operations to apply to the playbook"
    )
