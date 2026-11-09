# AI design generation

**Status:** Phase 5 implementation is in place. Workspace typecheck and Studio production build pass. A live provider request still needs a configured key/model.

## User workflow

1. Connect OpenAI, Anthropic, or Google Gemini in the AI Studio panel. The key is stored by the local service in Windows Credential Manager. On other platforms the service reads the corresponding environment variable.
2. Enter a product brief and optionally select up to three project images or screenshots. AI Studio first requests a user flow and screen inventory. The flow is reviewable; screen names and goals can be edited before generation.
3. Request two or three design directions. Each direction uses a distinct desktop layout (`bento`, `editorial`, or `split`) and keeps the approved screen order, names, and goals. The generated pages contain ordinary editable frame, text, and shape nodes.
4. Review each direction and its deterministic quality report, then apply one direction. It is added to the canvas as one undoable edit. Save the document to persist the change as a revision.
5. For a selection revision, select layers and ask for a change. The provider returns a proposal, summary, and considerations. Each operation can be accepted or rejected; applying the accepted operations is one undoable edit.
6. The Quality Review tab evaluates the current pages locally without contacting a provider.

## Provider adapters

The adapter contract is in `packages/ai-engine/src/index.ts`; REST translations are in `server/api/src/ai-providers.ts`.

| Provider | Request format | Image input | JSON handling |
|---|---|---:|---|
| OpenAI | Responses API | Yes | JSON object mode, then schema validation |
| Anthropic | Messages API | Yes | Prompt-guided JSON, then schema validation |
| Google Gemini | `generateContent` | Yes | JSON response MIME type, then schema validation |

All three currently use non-streaming requests, accept at most three selected images, and have a 120-second request timeout. The model can be entered in AI Studio or set with `UDS_OPENAI_MODEL`, `UDS_ANTHROPIC_MODEL`, or `UDS_GOOGLE_MODEL`. API key environment fallbacks are `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and `GEMINI_API_KEY`.

## Data sent to a provider

- **Planning and generation:** the brief, a compact document summary, and only the selected images. The summary includes the project name, revision, up to 16 pages and 50 layers per page, text snippets capped at 200 characters, plus up to 40 component and token names. It reports omitted page/layer counts. The complete design document is not sent.
- **Selection revision:** the revision request, compact document summary, and summaries of selected layers. The API accepts operations only for selected IDs and supported node types.
- **Local quality review:** no data is sent. It uses deterministic structure, text-size, approximate contrast, and image-alt-text checks.

Images are read from the current project by asset ID. PNG, JPEG, WebP, and GIF are accepted; each image is limited to 4 MB and the combined selection to 8 MB. The service checks project ownership and the resolved asset path before reading files.

## Local API routes

- `GET /api/ai/providers` reports available adapters, capabilities, configured-key status, and the selected provider.
- `PUT /api/ai/provider` changes the selected provider.
- `PUT /api/ai/credentials/:provider` stores a key; `DELETE` removes it.
- `POST /api/projects/:id/ai/plan` creates a validated flow and screen inventory.
- `POST /api/projects/:id/ai/generate` creates validated directions and quality scores.
- `POST /api/projects/:id/ai/revise` returns a validated, selection-scoped patch proposal.

The generation and revision routes never write the document. They reject stale persisted revisions before and after the provider call. The editor also checks its local change counter before applying a reviewed result. Document persistence continues through the normal revision-checked save route.

## Validation and limits

Provider output is parsed as JSON and validated with Zod before it reaches the editor. Flow links, screen IDs, direction layouts, colors, operation counts, selected node IDs, and node/operation compatibility are checked. Directions are compiled locally into editable nodes; the provider cannot run code or write project files.

Quality scores are heuristics, not a substitute for accessibility testing or desktop visual review. Contrast estimates compare against simplified backgrounds. A live provider call and Windows Credential Manager setup still need an end-to-end smoke review after a provider key/model is configured. Phase 3 laptop/desktop visual review remains tracked separately.

The code checks completed for this phase are `pnpm typecheck` and `pnpm --filter @uds/studio exec vite build`. No automated test suite was run.
