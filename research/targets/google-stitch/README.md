# Google Stitch — research dossier

**Research status:** Official Google Labs update and product material reviewed 2026-11-08.  
**Direct REA validation:** Pending.  
**Implementation policy:** Proprietary hosted product; study documented behavior and user-visible workflows only.

## Product role

Stitch is an AI-first interface design canvas. It moves from a brief or multimodal reference to UI, then supports live iteration with an agent on the canvas. Its strength is rapid design exploration rather than being a full replacement for every professional vector-editor workflow.

## Documented capabilities

Google's May 19, 2026 update describes:

- Text and voice prompting.
- Using existing codebases and design files as context.
- The Stitch Agent streaming work directly onto the canvas.
- Real-time human steering while iterations are in progress.
- Shareable links via Google AI Studio.
- Export to Google Antigravity or publish through Netlify.

The user's initial research also identifies its infinite-canvas and multimodal-context experience as important areas to validate hands-on.

## Architectural lessons for UDS

1. Model generation as a streaming job with incremental, inspectable document changes.
2. Allow the user to interrupt or redirect generation before a run completes.
3. Accept text, image, screenshot and codebase context through a common context-ingestion layer.
4. Keep several design directions in the same workspace for comparison.
5. Provide explicit export targets rather than coupling designs to one downstream builder.

## What remains unknown

- Google's proprietary canvas data model, renderer and agent orchestration.
- Exact internal persistence/merge behavior for concurrent generations.
- Which APIs and file formats are available for third-party interoperability beyond documented export targets.
- Whether the full current editor can be inspected with REA without an account/feature entitlement.

## UDS capability mapping

- Infinite/pan-zoom canvas
- Multimodal context intake
- Streamed AI document generation
- Human-in-the-loop generation controls
- Design direction comparison
- Antigravity/code handoff adapter

## Sources

- https://stitch.withgoogle.com/
- https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-updates/
