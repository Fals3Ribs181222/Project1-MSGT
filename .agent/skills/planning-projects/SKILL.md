---
name: planning-projects
description: Generates detailed specifications and actionable phased implementation plans to guide development. Use when the user needs to break down a task, plan a new feature, or structure a complex workflow.
---

# Project Planning

## When to use this skill
- User says "plan this out", "how should we approach this?", or "break this down"
- Starting a new feature or complex engineering task
- When a task requires multiple sequential steps, touches multiple files, or spans a large conceptual area

## Workflow
1. **Context Gathering**: Understand the product vision, current architecture, and constraints.
2. **Specification Draft**: Create a clear statement of requirements (the "what") bridging the gap between user intent and technical implementation.
3. **Phased Breakdown**: Divide the implementation into logical phases (e.g., Setup, Core Logic, Integration, Testing).
4. **Task Generation**: Break phases into actionable, testable tasks.
5. **Validation**: Present the plan to the user for review and approval before beginning execution.

## Instructions
- Do not immediately start writing code. Always establish the "what" and the "how" first.
- Maintain a `plan.md` artifact if the task spans multiple sessions or is highly complex.
- Structure plans using **Plan-Validate-Execute** cycles when applicable.
- For each task in the plan, clearly state:
  - Required changes (files created/modified/deleted)
  - Dependencies (what must be completed beforehand)
  - Verification steps (how to test or validate success)

### Example Plan Structure
```markdown
# Phase 1: Foundation
- [ ] Task 1.1: Initialize standard configuration (`config/settings.json`)
      - *Verification*: Validate JSON schema

# Phase 2: Core Implementation
- [ ] Task 2.1: Implement core algorithm module
      - *Dependencies*: Task 1.1
      - *Verification*: Run unit tests for module
```

## Resources
- Ensure checkboxes `[ ]`, `[/]`, and `[x]` are heavily utilized to track state and progress during the execution phase.
