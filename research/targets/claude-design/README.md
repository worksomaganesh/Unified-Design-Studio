# Claude Design — research dossier

**Research status:** Public-source research reviewed 2026-11-08.  
**Direct REA validation:** Pending (requires the dedicated local browser profile).  
**Implementation policy:** Proprietary product; study observable workflows and documented capabilities only. Do not copy source code, private prompts, visual assets or branding.

## Product role

Claude Design is an AI-first visual creation experience that combines a conversation with an editable canvas. It can create designs, prototypes and other visual artifacts from a natural-language brief, then refine them through chat, direct canvas edits, inline comments and controls.

## Documented capabilities

- Start from a conversation, the Artifacts tab or Claude Code.
- Supply screenshots, images, existing assets, documents, design files and codebase context.
- Bring design systems from a GitHub repository, design files, raw uploads or a local codebase.
- Refine with natural language, direct text editing, inline comments, adjustment controls, and drag/resize/align operations.
- Synchronize design-system context through `/design-sync`.
- Handoff to Claude Code; `/design` supports design creation/editing and design/code workflows.
- Export/share artifacts; formats and connector destinations depend on the current workflow and plan.

**Current product-location note:** Anthropic's Help Center says Claude Design is available within Claude conversations, Artifacts and Claude Code. The standalone `claude.ai/design` site is scheduled to close on **2026-12-14**. Research must follow the integrated product, not assume a permanent standalone editor.

## Architectural lessons for UDS

1. Keep a persistent conversation thread attached to a design document.
2. Let the user select a node/region and issue a scoped edit.
3. Import the user's real design-system context before generation.
4. Treat comments and adjustment controls as structured edit intents, not merely chat text.
5. Support a deliberate design-to-code handoff with enough document and project context to avoid screenshot-only reconstruction.

## What we should not infer

- Claude's proprietary model orchestration, internal document schema, hidden prompts and backend implementation are not public.
- The exact persistence and collaboration implementation should not be reverse-engineered from UI appearance alone.
- Product plan access, limits and export availability can change.

## Evidence status

| Claim | Classification | Evidence |
|---|---|---|
| Conversation + canvas, direct editing and comments | Documented | Anthropic product and Help Center |
| Design-system import and Claude Code sync | Documented | Anthropic Help Center |
| Standalone site closure date | Documented | Anthropic Help Center |
| Internal rendering/state architecture | Unknown | No public implementation source |

## UDS capability mapping

- AI conversation attached to document
- Design-context ingestion
- Selection-scoped revision
- Inline comments/annotations
- Design-system-aware generation
- Code handoff and export

## Sources

- https://claude.com/product/design
- https://support.claude.com/en/articles/14604416-get-started-with-claude-design
- https://claude.com/resources/articles/claude-design-stays-on-brand-for-daily-work
