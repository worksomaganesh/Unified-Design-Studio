# Prototyping and UX review

**Status:** Phase 6 implementation is in place. The prototype graph, editor panel, isolated preview, and deterministic UX checks are implemented in the local workspace.

## Prototype graph

Prototype data is part of the version 2 design document and is saved with the normal revision-checked document operation. Existing documents receive an empty prototype by schema default; no separate database table or route is needed.

An interaction connects a source page and layer to one trigger (`click`, `doubleClick`, or `hover`) and one action:

- Navigate to a page.
- Open a page as an overlay, or close the current overlay.
- Set a typed prototype variable.
- Select a named component variant on a component instance.

Each source layer can have one interaction for each trigger. Page, source-layer, variable, and component-variant references are checked when validating the document. Interactions and variable bindings are ordinary undoable editor changes.

Variables have string, number, or boolean types and an initial value. A text layer can bind to one variable. Setting that variable changes the bound text during preview. Prototype state never changes the saved design document.

## Editing and previewing

Open **Prototype** from the canvas toolbar. Select a source layer, choose a trigger and action, then add the interaction. The same panel creates variables, binds them to selected text layers, lists/removes interactions, and displays UX review findings.

**Open clickable preview** renders the current pages in a desktop-sized iframe. The iframe uses `sandbox="allow-scripts"` without same-origin access, a restrictive content security policy, and local project images only. Its script sends trigger messages to the parent. The parent checks the iframe source and matches each message against a validated interaction before changing preview state. Navigation, overlays, variable updates, and component variants are all temporary to the preview session.

Interactive layers get a button role, an accessible name, a keyboard focus target, and visible focus styling. Enter and Space activate click interactions. Hover-only interactions are called out in the UX review.

## UX and accessibility preflight

The review runs locally and checks:

- Reachability from the first page through navigation and overlays.
- Non-start pages without an incoming entry point.
- Whether any interactions are configured.
- Hidden or locked interaction sources.
- A click equivalent for hover and double-click interactions so keyboard users can activate them.
- Missing alternative text on image layers.
- Variables that are not bound to text.

These deterministic checks are guidance; they do not replace keyboard review, screen-reader review, or laptop/desktop visual QA. Mobile and tablet preview are out of scope.
