---
name: answer-me-with-html
argument-hint: "[config [key value] | clean | update]"
description: >-
  Turns an answer into a one-page visual HTML explainer: the model writes a short Markdown draft and
  the bundled CLI builds a foldable page. Use it proactively and liberally, without being asked, whenever a
  page would help the reader more than plain text, even if plain text would also work: any explanation
  of how something works or how parts relate (flow, request path, architecture, code or folder
  structure, state machine, lifecycle, history); any comparison, trade-off or decision with pros and
  cons; any diagnosis, review or investigation, especially with several causes or findings to rank;
  any answer with a table, a numbered or ranked list, steps, branches or several sections; or when the
  user says "I don't get it / draw it / explain visually / 讲讲原理 / 没看懂 / 画个图". When in doubt, use it: a
  page is quick and cheap to make. Also for explainer videos ("make a video", "做个视频") and for changing
  its settings. Skip only for small talk, a trivial one-line answer, or when the user asks for plain
  text.
---

# Answer me with HTML: answer a complex question with one HTML page

You write only the **content draft** (extended Markdown). The `am` CLI does all layout, colours, dark mode and diagram coordinates. **Do not hand-write HTML / CSS / SVG.**

Reply to the user, and write the draft, in the user's language.

## Five-level reading pages (local extension)

New pages open with the full text, with five levels: full text → brief → key sentences → points → topics. Readers can use buttons, keys 1–5, a continuous zoom slider, Shift + wheel, or expand one section. The original words move and fade between levels; no extra model call is needed.

Write a complete conclusion in the page lead and short, meaningful panel titles. Begin every panel with a prose paragraph that states its point in sentence one and its reason in sentence two. Do the same for later paragraphs and list items. Keep essential restrictions in the sentence that states the claim. The runtime extracts these sentences; it does not paraphrase them. Put a short explanatory paragraph before a table or diagram so the folded view has a point to show.

The default is `fold: 1` (full text). Set frontmatter `fold: 1` through `fold: 5` to choose the starting level, or `fold: off` for the classic page. For exact level behavior and interaction limits, read [references/folding.md](references/folding.md). Do not create five separate drafts or hand-written folding HTML.

## 0. When the user wants to change settings

Arguments for this call: `$ARGUMENTS`

When the arguments start with `config` (for example `/answer-me-with-html config open off`), this turn handles settings only and produces no page:

- `config`: run `am config` to show the current settings, then let the user choose. Where the agent has a choice tool such as AskUserQuestion, use it: at most 4 settings at a time, these first: `open`, `theme`, `mode`, `style`, with the current value marked in the options. Otherwise ask in plain text.
- `config <key> <value>`: run `am config set <key> <value>`.
- `config reset [key]`: run `am config reset [key]`.

When the user asks in natural language ("stop opening the browser", "use the card theme by default"), also convert it to `am config set`. Settings: `preview` (serve pages over local HTTP, default on), `port` (fixed preview port, default 8765), `open` (auto-open the browser), `theme`, `mode`, `style`, `voice` (video narration), `update_check` (new-version notices). Run `am config` to see all descriptions.

When the arguments start with `clean`, or the user asks to clean up pages / the cache: first run `am clean --dry-run` and tell the user how many items and how much space will be deleted. Run `am clean` only after the user agrees (add `--all` to delete all pages and videos, `--days N` to change how many days to keep).

This copy is maintained in `llsunlie/personal-skills`, under `skills/answer-me-with-html`. Resolve this skill directory's real path before locating the repository. For a requested update, inspect `git status` at the repository root; if the tree is clean, use `git pull --ff-only` there. If it has local changes or divergent history, preserve those changes and resolve them before updating. No `npm install` is needed. Upstream changes from `QingYunA/answer-me-with-html` require a manual merge that preserves the local modules and behavior; do not run the upstream skill/plugin updater over this copy.

## 1. Decide: produce a page or not

Produce a page if any of these is true:
- There are ≥3 interrelated concepts, and the reader needs to see how they relate.
- There is a flow, protocol, call chain or state transition (especially with branches or several actors).
- There is a comparison across ≥3 dimensions, a trade-off between options, or a "can / cannot" list.
- There is a hierarchy or an evolution over time.

Otherwise answer in plain text. When unsure: the more the question "needs a picture to understand", the more it calls for a page.

### Always-on mode

If the context contains the `[answer-me-with-html always-on]` reminder (the user added the always-on rule to a rules file such as `CLAUDE.md` or `AGENTS.md`), the bar is lower:

- Whenever this turn gives a conclusion, summary, plan, comparison, review or explanation, attach a page.
- Do not skip it because "the answer is short". If there is a conclusion, produce a page.
- For everyday conclusions use a small page with 2–4 panels: one callout with the conclusion, plus one table or one diagram. Do not add panels just to fill space.
- Render with `--no-open`, so no browser window interrupts the user. The user opens the page by clicking the path at the end of the reply.
- Order: render the page first, then write the text reply. The reply is the last thing in the turn, with the page link on its last line (see step 5). Do not write the reply and then call `am render`.
- Produce no page for small talk, one or two sentences with no conclusion, pure command output, or when the user asks for plain text.

## 2. Workflow (one Bash call)

The CLI entry point is `scripts/am.mjs`, with local modules `scripts/preview.mjs` and `scripts/fold.mjs`. It needs only Node.js 20+; no packages need installing. Below, `am` always means:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/am.mjs"
```

In Claude Code, the path above is replaced with this skill's directory automatically. If you see the variable unreplaced (other agents), replace it with the absolute path of the directory that contains this SKILL.md. If the user installed the `am` command globally, you can also use `am` directly.

1. First list 3–8 panels in your head. Each panel answers one sub-question only.
   The draft language follows the language of the user's question: an English question gets an English draft, a Chinese question a Chinese draft, a Japanese question a Japanese draft. The page button labels, `<html lang>` and the STE check rules switch automatically by the draft language (a draft containing kana counts as Japanese); STE applies the English or Chinese rules to each sentence by its language (Japanese sentences get only the sentence-length and paragraph-length checks, with the same character limits as Chinese; any other language gets only those two checks, counted in words). To set the language yourself, write `lang:` in the frontmatter: `en`, `zh` (Simplified Chinese), `zh-Hant` or `zh-TW` (Traditional Chinese), `ja`, or any other language tag such as `fr` or `ko`. Detection reads Chinese (Simplified, or Traditional when the text has characters written in only one form), Japanese, Korean, and Cyrillic, Arabic, Hebrew, Thai and Greek text, and reads all Latin-script text as English. Declare the language when the user writes a Latin-script language other than English, when a Chinese text is too short or too plain to show Traditional characters, or when an exact tag matters (Arabic script also writes Persian, Cyrillic also Ukrainian). A language without its own labels still gets the right `<html lang>`, with English page labels.
2. Choose components by the shape of the information (see section 4).
3. Render in one go with a heredoc:

````bash
node "${CLAUDE_SKILL_DIR}/scripts/am.mjs" render - <<'AM_EOF'
---
title: Title
---
## A Panel title
```flow
A -> B: label
```
AM_EOF
````

4. Read the output:
   - `✓ <path>`: success. With local preview enabled, the CLI also prints `HTTP http://localhost:8765/...`. Use that HTTP URL in the response. The CLI automatically starts or reuses the preview server, including when `--no-open` is set. Whether the browser opens automatically depends on the user's settings (`am config`); `--no-open` affects only this run.
   - `✗ L<line> [component] …` + `Correct example:`: fix that line following the example, then render again.
   - `STE n warnings`: rewrite the flagged lines as suggested, then render again. Retry at most 2 rounds; if warnings remain, keep the page and say so.
   - `! Cleanup hint: …` or `! Update hint: …`: pass it on to the user in one sentence at the end of the reply, and ask whether to clean up / update. **Do not run am clean or the update command yourself**; wait until the user agrees. The CLI throttles these: the cleanup hint appears at most once every 7 days, the update hint at most once every 3 days.
5. Reply in the terminal with only 2–3 lines: one core conclusion + the page link. Do not paste the draft or the HTML back into the terminal. Write this reply after the render, as the last step of the turn: render the page first, then reply. No tool call comes after the reply.
   Write the page link as a Markdown link to the exact HTTP URL printed by the CLI, for example `[打开页面](http://localhost:8765/pages/example.html)`. Do not return a `file://` link when the HTTP URL is available. If preview startup fails or output is outside the served directories, use an absolute local file link and state the preview error briefly.

### Fixed local preview server

The local extension in `scripts/preview.mjs` serves only `$AM_HOME/pages/` and `$AM_HOME/videos/` (default home: `~/.answer-me-with-html`). It binds to `127.0.0.1`; Windows browsers can use WSL localhost forwarding.

- `http://localhost:8765/`: paper-style catalog, grouped by session, with title/body/session search and sorting.
- `http://localhost:8765/latest`: redirects to the most recently modified page.
- Each generated page keeps its own HTTP URL, including pages generated before this extension was installed.
- `am config set port 8765` changes the fixed port. `am config set preview off` disables automatic preview startup.
- `--no-open` suppresses browser launch only; the server still starts. A detached server is reused across render, patch and video calls. After WSL restarts, the next generated page starts it again.
- If the port belongs to another service, report the conflict. Do not silently choose a different port. The generated file remains available.
- The server log is `$AM_HOME/preview.log`. Changing the port starts a new server on the next render; an existing server stays on its previous port until stopped.

### Paper theme and session archive

Use the configured paper theme by default. Omit a draft's `theme:` field unless the user explicitly requests a different theme. Do not select blueprint automatically for diagrams.

The CLI records a `.html.meta.json` sidecar next to each generated page, without changing its URL. Session IDs come from `AM_SESSION_ID`, `CODEX_THREAD_ID`, `CODEX_SESSION_ID`, or `CLAUDE_SESSION_ID` (in that order). When the host does not supply a session ID, set `AM_SESSION_ID` to a stable identifier for the current conversation and reuse it for later renders. Never generate a fresh session ID for every page.

On the first render of a conversation, set `AM_SESSION_TITLE` to a short description of that conversation when its topic is known. The first page's title is the fallback session label; later pages inherit that label. Patching an existing page preserves its original session. Historical pages without metadata appear under “历史页面（未记录会话）”; do not invent their conversation IDs. The directory is a compact Session → Turn conversation tree. Keep each turn to one collapsed row by default; expanding it shows the user messages and final assistant replies. Show generated-page links at the front of each collapsed turn row, before its title, so they can be opened directly without expanding the conversation. For multiple pages, show separate numbered links with the page titles in tooltips. Link clicks open the page in a new tab and must not toggle the turn. Avoid repeating attachment links below the conversation. Include turns without generated pages when the archived session log is available. Do not use cards, repeated headings, page excerpts, or a separate page gallery. Search session names/IDs, turn names/IDs and dialogue text. Keep expand/collapse and refresh controls; show full IDs only on request. Show at most the newest 50 turns per session initially. Fetch the next 50 from the server only when the user clicks that session’s “加载更多” button; do not preload or render hidden turns. Search all archived turns on the server, including unloaded ones, and paginate matching results in the same way. Expanding the tree must not bypass pagination. Read only user-facing user messages and final assistant replies from the matching session log, excluding tool calls, reasoning and progress updates.

Record each page's turn as well as its session. Prefer `AM_TURN_ID` / `AM_TURN_TITLE`, then `CODEX_TURN_ID`; in Codex, the CLI can resolve the current turn and user question from the matching session's local rollout log. `CODEX_TOOL_CALL_ID` identifies a tool call, not a turn; never use it as the turn ID. When turn context is unavailable, set one stable `AM_TURN_ID` for the current user request and reuse it across all renders in that turn. Start a new turn ID only for a new user request. Unresolved historical turns appear as “未记录轮次”; do not assign them to the current turn. Patching a page preserves its original session and turn. Only backfill old turn metadata when the matching session log and generation timestamp establish its origin. New defaults do not restyle previously generated pages.

This installation has local changes in `scripts/am.mjs`, `scripts/preview.mjs`, `scripts/catalog.html`, and `scripts/fold.mjs`. Before updating the skill, preserve and reapply these changes, then verify render output, folding controls, and server reuse. Preserve the folding authoring instructions and `references/folding.md` too. Upstream CLI bundles can overwrite the integration.

When a page already exists and only one panel needs to change, do not rewrite the whole page. Take the source draft from the HTML's `#am-source`, replace only the matching `##` section, and overwrite the page in place:

````bash
node "${CLAUDE_SKILL_DIR}/scripts/am.mjs" patch page.html --panel "Panel title" <<'AM_EOF'
## A Panel title
New content
AM_EOF
````

`--panel` matches the title, the letter ID, or `ID title`. If the panel is not found or the page has no `#am-source`, leave the file unchanged. patch keeps the original page's theme, light/dark mode and STE style; add `--theme` / `--mode` / `--style` to change them. Full usage: `am help patch`.

## 3. Draft format quick reference

```markdown
---
template: sheet     # sheet board (default, one-screen overview) | doc linear explanation (read step by step)
# Theme defaults to configured paper; add theme: only when the user requests a different theme.
title: Title
subtitle: One-line summary     # optional
fold: 1             # default: full text; starting level 1–5; off disables reading zoom
cols: 3             # most columns in a sheet row, default 3
source: RFC 9293    # any other key is shown in the page header's meta line
---
Lead: one or two sentences with the core conclusion (optional).

## A Panel title {span=2 meta="small text, top right"}
Plain Markdown: paragraphs, lists, tables, quotes.
Table status words: ok / no / warn (may carry text: "ok approved") → ✓ / ✗ / ! badges.

## B {bare}            ← bare: no title bar (suits a kv title block)
```

- The panel letter ID can be omitted; it is assigned automatically.
- ```html / ```svg fenced blocks are embedded as-is. **Use them only when no component can express the content.**
- Full reference: `am help format`; component syntax: `am help <component>`; component list: `am list`.

## 4. Choose components by the shape of the information

| Shape of the information | Component | Minimal syntax |
|---|---|---|
| What connects to what, architecture, decision branches | `flow [LR]` | `A -> B: label`, `A --> C` dashed, `A -> B & C` fan-out, `{decision?}` `(start)` `[(database)]`, `*emphasis`, `group name: A, B` |
| Messages between actors over time | `sequence [num]` | `A -> B: request`, `B --> A: response`, `note A, B: note`, `== phase ==` |
| Hierarchy / directories / taxonomy | `tree [list]` | indentation for levels, `label \| description`, `` `id` label `` |
| History / phases | `timeline [v]` | `time \| title \| description`, `*` highlights |
| Values and limits | `limits` | `label \| 13 / 20 \| unit`, limit only: `label \| max 20` |
| Word-by-word comments on one sentence | `annot` | `# heading \| right note`, `[span]{note}`, `[wrong word]{!red note}`, `> footnote` |
| Metadata / title block | `kv [cols=2]` | `key: value`, `* wide cell: value` |
| Conclusion / warning | `callout <info\|ok\|warn\|err> title` | Markdown body |
| Multi-dimension comparison, can / cannot list | Markdown table | write ok / no / warn in the status column |
| What a real screen, photo or render looks like, as an existing file | image | `![what it shows](/absolute/path.png)` alone on a line |

Selection rules:
- Conclusion first. The first panel or the lead gives the core answer; the following panels give the evidence.
- One panel, one question. With more than 8 panels, split the page or cut panels.
- `span` is a hint. In a browser the sheet sizes each panel to its content and fills every row, so write no `span` for a wide table or diagram. Write `span` only for a panel that must stand out (`span` = `cols` gives it a row of its own). `rows` applies only to the plain grid (without JavaScript, in print and on narrow screens); the browser layout ignores it.
- Use an image only for what a diagram cannot show, such as a real UI. Use an existing file by its absolute path (PNG, JPG, GIF, WebP, AVIF or SVG, up to 5 MB). The alt text is the caption, so write what the picture shows. Never generate or invent an image. See `am help image`.
- Do not invent data. Without real numbers, do not use limits; mark illustrative data as "illustrative" in the description.

## 5. STE controlled writing (the text in the draft)

`am render` checks automatically and only warns by default (`style: 80`); with `style: strict` a draft that fails produces no page; `style: off` turns the check off.

- One sentence says one thing.
- Use the active voice. Write steps in the imperative ("Close the valve", not "The valve should be closed").
- One word, one meaning. Call the same thing by the same name throughout.
- Sentence length limits: steps (ordered lists) 20 words in English / 35 characters in Chinese; descriptions 25 words in English / 45 characters in Chinese.
- No more than 6 sentences per paragraph. Use lists for complex content.
- In English, use common short words: use, not utilize; start, not commence; before, not prior to.
- In Chinese, do not use light verbs (`进行优化` → `优化`, `加以说明` → `说明`), do not chain more than three `的`, and do not use clichés (`赋能`, `闭环`, `至关重要`…).
- Chinese also gets warnings for typos (`登陆` → `登录`), vague quantities (`尽快`, `若干`, `大概`, `多次`), `以上` / `以下` / `以内` after a number (write `大于` / `不小于` / `不超过`) and one meaning written several ways (`单击` → `点击`, `键入` → `输入`, `入参` → `参数`). The list comes from [Simplified Technical Chinese](https://github.com/mzopedia/simplified-technical-chinese).
- For counter-examples shown on purpose, use `~~strikethrough~~` or put them in a table row whose status is `no`; the check skips them.

## 6. Explainer videos (am video, 3Blue1Brown style)

Use only when the user explicitly asks for a video ("make a video", "explain it as a video", "3b1b style", "explainer video"). Do not produce a video unasked in always-on mode either.

A video draft has the same format as a page draft, with one extra rule: lines starting with `>` are narration, one beat per line.

````bash
node "${CLAUDE_SKILL_DIR}/scripts/am.mjs" video - --no-open <<'AM_EOF'
---
title: The TCP three-way handshake
subtitle: Why three
---
> Opening narration (optional).

## Both ends are waiting
```sequence
Client -> Server: SYN
Server -> Client: SYN-ACK
Client -> Server: ACK
```
> First the client sends SYN to ask for a connection.
> [Server] answers with SYN-ACK.
> The client replies with ACK, and the connection is open.
AM_EOF
````

- One `## ` is one scene. Put one component (or one table, one list) in a scene as the picture, and write 2–5 narration lines below it.
- When the Nth narration line plays, the picture shows step N. In flow / sequence / tree every source line is one step; timeline, limits, table rows and list items step by entry. So the line order of the component is the order of the explanation. When there are more narration lines than steps, the extra first lines serve as an opening and show nothing new.
- Write `[name]` in narration: the camera zooms in on the node or actor with that name and highlights it. The name must match how it is written in the component.
- Nodes with the same name in adjacent scenes move smoothly to their new position. To keep the viewer following one object, reuse the same name in the next scene.
- 3–6 scenes per video, one or two sentences per narration line.
- Narration is read aloud, so write it as speech, as if explaining to someone face to face: transitions like `你看`, `那问题来了`, `我们换个角度看` are fine, and characters' "lines" go in quotes. Do not write it like a manual (`客户端发送 SYN 报文以请求建立连接`). Sentence length is still subject to the STE check.
- The look follows the theme in the settings by default (usually the blueprint drawing style). When the user wants "that dark 3b1b style", write `theme: 3b1b` in the frontmatter.
- Narration voice: the default is `--voice auto`: ElevenLabs when `ELEVENLABS_API_KEY` is set, otherwise system TTS (macOS say), and subtitles only when neither is available. When the user says "no sound", add `--voice off`. When the user runs a local OpenAI-compatible speech service and has set `AM_TTS_URL`, use `--voice local`.
- The output is a single-file player page under `~/.answer-me-with-html/videos/` (audio embedded). When the user wants a video file, add `--mp4`; this needs Chrome, ffmpeg and Node.js 22+ on the machine, and export takes about 1.3 times the video length.
- Full syntax: `am help video`. In the terminal, reply with one sentence plus the player page link (and the MP4 link), written as in step 5 of section 2.

## 来源与维护

上游项目、参考来源、许可证和个人定制内容见 [SOURCE.md](SOURCE.md)。
