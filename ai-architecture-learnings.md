# AI Architecture Learnings From This Repository

This document distills the AI-side learnings from the current Quadratic prototype so the next iteration can start with a strong task planner and add AI later without repainting the core architecture.

## Executive Summary

The strongest idea in this repository is not the model loop itself. It is the separation between:

- a durable system of record in Convex
- an isolated repository worker that operates against a cloned checkout
- task state that can survive retries, failures, and human clarification

The main weakness is that AI is too central to the task lifecycle. Task creation immediately triggers planning, planning output becomes part of the canonical task shape, and execution semantics are intertwined with product semantics.

For the next iteration, the core planner should exist and be fully usable without AI. AI should plug into that planner as:

- a drafting assistant
- a clarification assistant
- a repository analysis assistant
- an implementation/execution assistant

In other words: make tasks first-class, make AI runs optional, and keep all AI outputs explicitly attributable and replaceable.

## What This Repository Got Right

### 1. Durable orchestration belongs outside the model loop

The repo uses Convex as the system of record and schedules orchestration from there:

- planning dispatch: [packages/backend/convex/orchestration.ts](/Users/baedin/Documents/projects/quadratic/packages/backend/convex/orchestration.ts#L71)
- execution dispatch: [packages/backend/convex/orchestration.ts](/Users/baedin/Documents/projects/quadratic/packages/backend/convex/orchestration.ts#L215)

This is the right direction. The model should not be responsible for lifecycle, retries, permissions, or source-of-truth state transitions.

### 2. Planning and execution are separate AI activities

The current worker exposes two distinct paths:

- read-only planning: [apps/repo-actions/src/index.ts](/Users/baedin/Documents/projects/quadratic/apps/repo-actions/src/index.ts#L150)
- write-capable execution: [apps/repo-actions/src/index.ts](/Users/baedin/Documents/projects/quadratic/apps/repo-actions/src/index.ts#L241)

That separation is valuable and should remain. Planning wants a constrained, structured, inspect-only environment. Execution wants a narrower but writable environment plus verification tools.

### 3. Structured planning output is much better than freeform prose

Planning returns a typed draft:

- schema: [packages/agent-runtime/src/events.ts](/Users/baedin/Documents/projects/quadratic/packages/agent-runtime/src/events.ts#L111)
- worker output schema: [apps/repo-actions/src/index.ts](/Users/baedin/Documents/projects/quadratic/apps/repo-actions/src/index.ts#L54)

The important lesson is that AI planning is most useful when it emits a shape the product can reason about:

- normalized prompt
- plan
- acceptance criteria
- suggested files
- clarification questions

That is exactly the kind of structure you want to preserve, but as AI-generated suggestions rather than the planner’s core schema.

### 4. Ephemeral cloned repositories are the right execution boundary

The worker clones the target branch into a temp directory, operates there, and deletes it afterward:

- clone and cleanup: [apps/repo-actions/src/index.ts](/Users/baedin/Documents/projects/quadratic/apps/repo-actions/src/index.ts#L447)

This gives isolation, reproducibility, and a clean security boundary. That should stay in any future execution-oriented AI feature.

### 5. Human clarification was modeled as a first-class workflow

Tasks can enter `awaiting_clarification`, accumulate questions, and become executable once questions are resolved:

- task/question/run schema: [packages/backend/convex/schema.ts](/Users/baedin/Documents/projects/quadratic/packages/backend/convex/schema.ts#L146)
- apply planning result: [packages/backend/convex/tasks.ts](/Users/baedin/Documents/projects/quadratic/packages/backend/convex/tasks.ts#L1103)
- answer/dismiss question: [packages/backend/convex/tasks.ts](/Users/baedin/Documents/projects/quadratic/packages/backend/convex/tasks.ts#L679)

This is one of the best product learnings in the repo. AI often needs clarification. Modeling that explicitly is better than pretending prompts are always sufficient.

## What Became Architecturally Messy

### 1. Task creation is coupled to AI planning

The web app creates a task and immediately requests planning:

- [apps/web/src/routes/$workspaceSlug/tasks/index.tsx](/Users/baedin/Documents/projects/quadratic/apps/web/src/routes/$workspaceSlug/tasks/index.tsx#L52)

This is the main coupling to remove in the next iteration. A task planner should be usable with zero AI. AI planning should be a later action like:

- "Draft plan with AI"
- "Analyze repository impact"
- "Suggest acceptance criteria"

### 2. AI output is treated as canonical task state too early

Planning writes directly onto the task record:

- [packages/backend/convex/tasks.ts](/Users/baedin/Documents/projects/quadratic/packages/backend/convex/tasks.ts#L1145)

That is convenient, but it mixes authored task data with AI-generated interpretation. In the next version, keep these separate:

- planner-owned canonical fields
- AI suggestions / drafts / analyses
- promotion actions that explicitly copy AI output into canonical fields

### 3. There are two parallel run systems

The repo has both:

- `agentRuns` / `agentRunEvents` for repository-level runs: [packages/backend/convex/schema.ts](/Users/baedin/Documents/projects/quadratic/packages/backend/convex/schema.ts#L124)
- `taskRuns` / `taskRunEvents` for task-level runs: [packages/backend/convex/schema.ts](/Users/baedin/Documents/projects/quadratic/packages/backend/convex/schema.ts#L188)

This duplicates lifecycle concepts:

- requested/launching/running/succeeded/failed
- summary/error
- event storage

For the next iteration, prefer a single `runs` model with a target reference, for example:

- `targetType`: `task` | `repository` | `plan` | `execution`
- `targetId`
- `runKind`
- `status`
- `provider/model/promptVersion`

### 4. The shared runtime and worker runtime already drifted

There is duplicated AI runtime code:

- shared package: [packages/agent-runtime/src/runtime.ts](/Users/baedin/Documents/projects/quadratic/packages/agent-runtime/src/runtime.ts#L55)
- worker copy: [apps/repo-actions/src/runtime.ts](/Users/baedin/Documents/projects/quadratic/apps/repo-actions/src/runtime.ts#L139)

Concrete drift already exists:

- shared runtime records tool-call input as `{}`: [packages/agent-runtime/src/runtime.ts](/Users/baedin/Documents/projects/quadratic/packages/agent-runtime/src/runtime.ts#L149)
- worker runtime parses tool-call input properly: [apps/repo-actions/src/runtime.ts](/Users/baedin/Documents/projects/quadratic/apps/repo-actions/src/runtime.ts#L228)

This is a strong signal that the next iteration should have one runtime abstraction only.

### 5. Event logging is durable, but not actually live

The worker collects events in memory and returns them only after the run finishes:

- logger creation and final return: [apps/repo-actions/src/index.ts](/Users/baedin/Documents/projects/quadratic/apps/repo-actions/src/index.ts#L163)
- event persistence happens after result reporting: [packages/backend/convex/tasks.ts](/Users/baedin/Documents/projects/quadratic/packages/backend/convex/tasks.ts#L452)

That means the UI gets status transitions like `running`, but not true streaming insight while the run is in progress.

For a planner-first product this is acceptable at first. For serious AI workflows later, you will want either:

- incremental event ingestion while the run is active
- or a simpler UX that avoids pretending logs are streaming

### 6. Some planning context is being sent but not used

Planning dispatch includes `existingQuestions` and `existingDraft`:

- [packages/backend/convex/orchestration.ts](/Users/baedin/Documents/projects/quadratic/packages/backend/convex/orchestration.ts#L99)

The worker does not actually consume them when building the planning prompt:

- [apps/repo-actions/src/index.ts](/Users/baedin/Documents/projects/quadratic/apps/repo-actions/src/index.ts#L373)

This is a useful reminder for the next iteration: keep AI request payloads minimal and intentional. If context matters, feed it into prompt construction or model state explicitly. If it does not matter, do not ship it.

### 7. Execution editing is coarse-grained

The writable tool surface is:

- `list_files`
- `read_file`
- `write_file`
- `run_command`

See [apps/repo-actions/src/index.ts](/Users/baedin/Documents/projects/quadratic/apps/repo-actions/src/index.ts#L533)

`write_file` replaces full file contents. That is simple, but it raises overwrite risk and makes diffs more fragile. In a future execution system, prefer patch-oriented editing or explicit diff application.

## Product Lessons For A Planner-First Rebuild

### 1. Make the planner schema independent from AI

The next iteration should start with a planner that works with purely human-authored data. Suggested canonical planner entities:

- `tasks`
- `subtasks`
- `acceptanceCriteria`
- `notes`
- `attachments`
- `repositoryLinks`
- `status`
- `priority`
- `owner`
- `blockedBy`

AI should write to separate tables such as:

- `taskSuggestions`
- `taskAnalyses`
- `clarificationDrafts`
- `executionRuns`

### 2. Separate authored truth from generated truth

Use a promotion model:

- human or AI produces a suggestion
- the user accepts all or part of it
- accepted pieces are copied into canonical planner fields

That keeps the planner stable even if you swap models, prompts, or AI capabilities later.

### 3. Treat repository analysis as an optional augmentation

Repository-aware planning is valuable, but it should be invoked when needed, not assumed for every task.

Recommended capability split:

- planner-only task creation
- optional "analyze repository" action
- optional "suggest files and implementation plan" action
- optional "execute in repository" action

That preserves the product if the repository worker is unavailable or the user does not want AI involved.

### 4. Preserve clarification as a first-class workflow

The current clarification model is worth keeping, but it should not belong only to AI. Humans should be able to add blocking questions too.

Recommended generalization:

- `questions` as planner entities
- source metadata: `human`, `ai_planner`, `ai_executor`
- resolution metadata
- a rule engine that blocks certain transitions while required questions remain unresolved

### 5. Keep run history auditable

The run/event model is directionally correct. Keep durable run history, but make provenance richer:

- provider
- model
- prompt version
- toolset version
- repository SHA / branch
- actor type
- cost and token usage

The current implementation stores model/provider only in task execution runs and not consistently across all run types:

- execution model/provider set here: [packages/backend/convex/tasks.ts](/Users/baedin/Documents/projects/quadratic/packages/backend/convex/tasks.ts#L807)

In the next version, provenance should be universal.

## Recommended Architecture For The Next Iteration

### Core principle

Build the planner as if AI will never exist. Then add AI as a separate application layer that consumes planner state and produces proposals or run outputs.

### Suggested system split

#### 1. Planner core

Owns:

- canonical task model
- statuses and transitions
- assignments, priorities, due dates
- blockers and dependencies
- manual planning UI
- repository links

Does not require:

- model provider
- repo cloning
- prompt construction

#### 2. AI orchestration layer

Owns:

- enqueueing AI work
- provider/model selection
- prompt templates
- retries/timeouts/cancellation
- event ingestion
- run provenance

Should operate against stable planner entities, not define them.

#### 3. Repository worker

Owns:

- ephemeral checkout
- repository inspection tools
- code editing tools
- targeted validation commands
- diff/artifact generation

Should not own task semantics beyond the run input it is given.

### Suggested data model

If you want one simplifying move, it is this:

- keep one canonical `tasks` model
- keep one generic `runs` model
- keep one generic `runEvents` model
- keep optional `suggestions` / `drafts` tables for AI outputs

Avoid separate task-specific and repository-specific run systems unless they truly diverge operationally.

## Specific Recommendations

### Keep

- Convex as durable orchestration and source of truth
- isolated repo worker with temporary clone
- read-only planning vs writable execution split
- structured planning outputs
- clarification workflow
- durable event history

### Change

- decouple task creation from AI planning
- separate canonical planner data from AI-generated suggestions
- unify duplicated run models
- remove duplicated runtime code
- make AI requests intentionally scoped
- add provider/model/prompt provenance everywhere
- move from full-file writes to patch-oriented edits for execution

### Defer until later

- live streaming logs
- autonomous execution by default
- general-purpose agent loops outside clear product actions

Those features add complexity quickly and are not necessary to validate the planner-first product.

## If I Were Starting The Next Iteration

I would implement in this order:

1. Planner domain model and manual UX with no AI dependency.
2. Task lifecycle, blockers, notes, acceptance criteria, and repository linking.
3. Generic run infrastructure and event log model.
4. AI planning as a suggestion generator, not a required step.
5. Repository analysis as an optional action on a task.
6. Code execution only after the planner and suggestion workflows feel stable.

## Bottom Line

The repository proved that repository-aware AI planning and execution can be made durable and inspectable. The next iteration should keep that operational shape, but demote AI from "what a task is" to "one way a task can be enriched or executed."

That is the architectural move that will let the planner become the product, with AI as leverage instead of foundation.
