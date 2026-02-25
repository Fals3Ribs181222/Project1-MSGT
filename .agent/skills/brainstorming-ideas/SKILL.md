---
name: brainstorming-ideas
description: Facilitates divergent thinking, hypothesis generation, and parallel exploration of concepts. Use when the user needs ideas, root cause hypotheses for bugs, or alternative architectural approaches.
---

# Hypothesis & Idea Brainstorming

## When to use this skill
- User says "let's brainstorm", "give me some ideas", or "what are the possible causes?"
- Investigating an obscure bug without a clear root cause
- Designing parallel solutions or comparing architectural trade-offs
- Planning out multiple streams of parallel work (e.g., for multi-agent workflows)

## Workflow
1. **Divergent Phase**: Generate at least 3 distinct hypotheses, ideas, or approaches without prematurely judging them or locking into the first concept.
2. **Analysis Phase**: Detail the pros, cons, constraints, and requirements of each idea.
3. **Evidence Gathering**: If debugging, list what evidence, logs, or metrics would confirm or refute each hypothesis.
4. **Convergent Phase**: Present the options to the user clearly (often in a comparison table) and recommend an optimal path forward.

## Instructions
- Radically avoid locking onto the first idea that comes to mind.
- If investigating a bug or system failure:
  - Generate 3 competing hypotheses.
  - Formulate a lightweight test plan or command to validate each.
- If designing a feature or architecture:
  - Provide a "Safe/Standard" approach.
  - Provide an "Optimized/Advanced" approach.
  - Compare trade-offs (Time to implement vs. Scalability vs. Complexity).

### Example Output Format
```markdown
### Hypothesis 1: [Name/Concept]
- **Description**: [Brief summary of the idea or potential cause]
- **Pros / Evidence For**: [Why this might be the best path or the root cause]
- **Cons / Evidence Against**: [Drawbacks or why it might not be the root cause]
- **Verification step**: [How to validate or test this concept]
```

## Resources
- When working on architecture, use comparison tables for clarity in presenting divergent ideas.
