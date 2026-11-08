# Comparative feature matrix

**Research date:** 2026-11-08  
**Evidence type:** Public official product pages, documentation and source repositories. Feature presence below is based on the published description, not a hands-on test of every plan or workflow.

Legend: **Core** = a defining capability; **Strong** = clearly documented; **Partial** = present but not the product's primary strength; **Unknown** = not verified in the available official material. A blank is not proof the product lacks a capability.

| Capability | Claude Design | OpenDesign | Figma | Stitch | Penpot | Doop | Paper | v0 | UX Pilot |
|---|---|---|---|---|---|---|---|---|---|
| Prompt-to-design | Core | Core | Strong / agent | Core | Partial / AI workflows | Core via agent | Strong via agent | Core | Core |
| PRD / UX flow to multi-screen | Strong | Strong | Partial | Strong | Partial | Strong via agent | Partial | Strong | Core |
| Infinite canvas / free placement | Partial / canvas | Partial / studio workspace | Core | Core | Core | Core | Partial | Unknown | Partial |
| Direct visual editing | Strong | Strong | Core | Strong | Core | Strong | Strong | Strong / design mode | Strong |
| Layers / structured design objects | Abstracted / artifact | File/HTML-oriented | Core | Canvas objects | Core | HTML frames | HTML/CSS canvas | Code-oriented | Design model / Figma layers via Nodey |
| Vector editing / boolean operations | Unknown | Not primary | Core | Unknown | Core | Partial / frame HTML | Partial / HTML/CSS | Not primary | Not primary |
| Responsive layout | Via design/code context | HTML/CSS output | Auto Layout | Reflow / responsive intent | Flex Layout + CSS Grid | Frame HTML | HTML/CSS | Core for generated apps | Strong |
| Design tokens / systems | Strong | Core | Core | DESIGN.md | Core | Style guides / tokens | Tokens/styles/components | Design Systems 2.0 | Strong / Figma import |
| Component libraries / variants | Design-system components | Design-system packages | Core | DESIGN.md context | Components/libraries | HTML frames/style guides | Components | Code components | Figma components / Nodey sync |
| Interactive prototype | Core | Strong | Core | Strong | Core | Live HTML frames | Preview via HTML/CSS | Live code prototype | Core |
| AI iteration on selected area | Strong | Strong | Agent workflows | Strong | Agent workflows | In-place frame edits | Agent can read/write canvas | Core | Core |
| Code generation / handoff | Claude Code sync | HTML export / agent project | Dev Mode / Code Connect | Antigravity / AI Studio / Netlify | Inspect code / plugins / MCP | HTML frames / exports | HTML/CSS-native | Core | React prototype / code export |
| Agent / MCP access | Claude + Claude Code | CLI/skills/agent adapters | AI agent workflows / APIs | MCP server + SDK | Open MCP server | Core MCP | Core MCP | MCP integrations | MCP server |
| Real-time collaboration | Sharing/comments | Team workspace/comments | Core | Live collaborative agent canvas | Core | Core multiplayer canvas | Team canvas | Sharing / PR review | Team collaboration |
| Revision/version history | Artifact/project history | Project/file workflow | Core | Project evolution | History | Frame versions/restore | Not fully established | Versions | Versions / review |
| Import from URL / screenshot / code | Screenshots, assets, codebase | Website/GitHub/Figma according to product docs | Broad design import | Image/text/code context | Assets/files | Website and Figma import | Code/repo/data | Screenshots/files/Figma/Paper | PRD/screenshots/site/Figma |
| Export / publish | Export/share; handoff | HTML/PDF/PNG/PPTX etc. | Export/dev handoff | AI Studio/Antigravity/Netlify | SVG/CSS/HTML etc. | Frame images/links | Design-to-code | Vercel deployment | Figma/code/React |
| Open-source implementation | No | Yes, Apache-2.0 | No | No public editor source verified | Yes | No public server source verified | No | No | No |

## Product capability clusters

### 1. AI ideation and generation

Claude Design, Google Stitch, UX Pilot, OpenDesign and v0 cover different stages of turning prompts or source material into output. Stitch's multimodal canvas/voice workflow and UX Pilot's product-design-oriented PRD and screen-flow generation are complementary rather than identical.

### 2. Professional editing and design systems

Figma and Penpot supply the most explicit professional editing concepts: layers, frames, components, variants, variables/tokens, constraints and prototyping. Penpot's CSS Grid/Flex Layout and SVG model are especially relevant to the design-to-code layer.

### 3. Agent-native canvas and design/code bridge

Doop and Paper are important architecture references for exposing canvas operations to agents. Doop uses explicit MCP actions for canvases, frames, live HTML streaming, feedback, comments, decisions and versions. Paper emphasizes an HTML/CSS canvas and bidirectional synchronization of tokens/styles/components with code.

### 4. Local-first agent workspace

OpenDesign is the closest architecture reference for a local-first agentic product shell with a desktop wrapper, local daemon, project files, SQLite state, SSE streaming, design-system/skill/plugin registries and sandboxed previews.

### 5. From design to shipping software

v0 and Claude Design/Claude Code highlight the importance of a continuous handoff from visual artifact to editable code, live preview, source control and deployment.

## Consolidated feature priorities

| Priority | Capability | Reason |
|---|---|---|
| P0 | Canonical design-document model | Enables all engines to operate on the same artifact. |
| P0 | Prompt-to-multi-screen generation | Core differentiation and fastest useful first experience. |
| P0 | Editable DOM/CSS canvas with frames, layers and properties | Avoids screenshot-only prototypes. |
| P0 | Tokens, themes and reusable components | Keeps outputs consistent and improves AI generation. |
| P0 | Save, reopen, revisions, undo/redo | Makes the editor dependable. |
| P0 | Responsive preview and prototype links | Completes the end-to-end design workflow. |
| P0 | React + CSS export with a live preview | Proves the product is useful beyond mockups. |
| P1 | Figma/Penpot import and richer SVG editing | Improves interoperability and professional editing. |
| P1 | MCP server and agent operation API | Makes agents first-class participants. |
| P1 | Reference-site import and design extraction | Helps start from real content/layout evidence. |
| P2 | Real-time multiplayer editing | Significant distributed-state complexity; defer until core editing is robust. |
| P2 | Advanced vector tools, animation/timeline and team administration | Broadens the product after the core workflow works. |
