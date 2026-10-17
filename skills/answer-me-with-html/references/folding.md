# Five-level reading zoom

New pages open with the full text. All five levels are embedded in one HTML file. They work offline and do not need a model or a separate service. The interaction is inspired by [TextFold](https://github.com/chenxiachan/textfold); this extension uses original runtime code and extracts the draft's own words, following the approach described in TextFold's Agent plugin.

| Level | Content retained |
|---|---|
| 1 Full | Complete prose, lists, code, tables, images and diagrams |
| 2 Brief | First two sentences of each paragraph/list item; rich blocks remain whole |
| 3 Key | First sentence of each paragraph/list item; rich blocks are hidden |
| 4 Points | First sentence of the section's first paragraph/list item |
| 5 Topics | Section headings in a map; the page conclusion remains above it |

These levels are extracts, not newly generated summaries. Short paragraphs can look the same at several levels. A diagram-only section has no extracted point: add a short explanatory paragraph before the diagram when an overview matters. Use named sections instead of `{bare}` for readable topic labels. Bare panels use their panel ID as a fallback heading.

## Write content that folds well

- Put the complete answer in the page lead. The lead remains visible at every level.
- Use a short, specific panel title as its topic.
- Start each panel with a paragraph whose first sentence states its main point.
- Start each following paragraph or list item with its point; put the reason in sentence two, then details and examples.
- Preserve caveats in the same first sentence as the claim when omitting them would mislead. For example, write “缓存仅对可重复读取的请求生效。” rather than putting the restriction in a later sentence.
- Use normal Markdown for text. Inline links, emphasis and code remain attached to the original words. Tables, code blocks, figures and diagrams stay intact at levels 1–2.
- Do not add five copies of the answer, hidden HTML, a second model call, or a `fold` code fence.

## Controls and configuration

The page has five buttons, number keys 1–5, a continuous slider and Shift + wheel zoom. Dragging the slider scrubs word movement and fading between adjacent levels; release snaps to the nearest level. Wheel input works across the page, normalizes pixel/line/page units and both axes, and accumulates into one animation-frame loop. A short nonzero gesture completes at least one level unless it reaches an endpoint; longer gestures can cross several levels. Reduced-motion mode keeps level changes while disabling word animation. Each panel has an accessible Expand/Fold button, and clicking a folded panel also expands it by one level. Selecting text or clicking links does not expand it. A global level change resets local panel overrides.

```markdown
---
title: A clear answer
fold: 1     # default: open the full text; use 1–5 for another starting level
---
The conclusion remains visible at every level.

## A Specific topic
The first sentence states the point. The second gives the reason. The rest gives details.
```

`fold: off` preserves the classic page without folding controls. `fold` is a page frontmatter field, not a global `am config` key. Patching keeps the source field, so the page retains its starting level. Existing HTML files stay unchanged until explicitly patched or regenerated. Videos do not use this extension.

Printing shows the complete page, even when it is folded. With JavaScript disabled, all source content stays visible. The runtime respects reduced-motion preferences and does not store reading state. UI labels use Chinese for Chinese pages and English otherwise.

This brings the folding interaction to answer pages. It does not add TextFold's document import, library, PDF comparison, notes, translation or AI question answering. The current zoom keeps the section's top anchored for wheel gestures; it does not reproduce TextFold's paragraph-coordinate anchoring or all native touch gestures.
