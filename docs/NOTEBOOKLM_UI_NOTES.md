# NotebookLM UI — Design Notes for the Vector Brain UI Rebuild

> Research-only note. No application code was changed. The NotebookLM app
> requires a Google sign-in, so **nothing here comes from direct use of the
> logged-in app**. Everything below is from public pages, official Google
> posts, reviews, guides, and screenshot descriptions listed in §1.
> Anything marked **[inferred]** was not directly observed — verify before
> building on it. Accessed 2026-11-12 (IST).

## 1. Sources consulted

| # | Source | URL | What it established |
|---|--------|-----|---------------------|
| 1 | Google Keyword Blog, "NotebookLM gets a new look…" (13 Dec 2024, Steven Johnson) | https://blog.google/technology/google-labs/notebooklm-new-features-december-2024/ | Official three-panel redesign: Sources / Chat / Studio; side-by-side source viewer + notes editor; interactive Audio Overviews |
| 2 | NotebookLM product site | https://notebooklm.google.com | Public entry point; redirects to notebook.google.com since the Jul 2026 rename |
| 3 | AI Writers' Retreat, "The Writer's Complete Guide to NotebookLM in 2026" (updated Feb 2026) | https://www.aiwritersretreat.com/ai-basics/notebooklm-writers-guide-2026 | Three-panel summary; 50 sources/notebook, 500k words/source (free); source titles truncated to ~20 chars in sidebar |
| 4 | Fello AI, "How to Use NotebookLM (Gemini Notebook): 2026 Guide" | https://felloai.com/how-to-use-notebooklm/ | Rename to Gemini Notebook (16 Jul 2026); notebook.google address; source types; numbered citations |
| 5 | AINovaTools, "How to Use NotebookLM in 2026: Step-by-Step, With Screenshots" | https://ainovatools.com/guides/how-to-use-notebooklm | Add-sources dialog (drag-drop, Upload, Websites, Drive, Copied text); per-source checkboxes; auto-summary in chat on upload; hover-to-preview citations |
| 6 | DataCamp, "NotebookLM: A Guide With Practical Examples" | https://www.datacamp.com/tutorial/notebooklm | Notebook Guide / suggested questions; "Save to note" bottom-right of each reply; chat historically ephemeral |
| 7 | Klariti, "NotebookLM User Guide" | https://klariti.com/notebooklm-user-guide-from-klariti/ | Suggested-question carousel with left/right arrows; "N sources" count in chat field; Refresh at top of Chat pane |
| 8 | Geneamusings (Mar 2025, hands-on with screenshots) | https://www.geneamusings.com/2025/03/ask-notebooklm-ai-summarization-of.html | Left/right panels collapsible, centre not collapsible; Studio notes list (Study Guide, Briefing doc, FAQ, Timeline) |
| 9 | arXiv 2504.09720v3, "NotebookLM as a Socratic physics tutor" (Fig. 1 screenshot) | https://arxiv.org/pdf/2504.09720v3.pdf | Sources list with titles; Chat with "Start typing…" input; Studio buttons (Audio Overview, Study guide, Briefing doc, Timeline); Plus chat-only sharing |
| 10 | G2 reviews, "Google NotebookLM Pros and Cons" | https://www.g2.com/products/google-notebooklm/reviews?qs=pros-and-cons | "Minimalist and functional, following Google's Material Design language without unnecessary visual clutter" |
| 11 | Notebookcheck (updated 5 Oct 2026) | https://www.notebookcheck.net/Update-makes-Google-s-NotebookLM-significantly-more-powerful-and-enables-role-playing-games.1153548.0.html | 2026 updates: saved conversation history, 1M-token context, custom goals/roles, chat personalisation via configure icon |
| 12 | Vibecode NotebookLM clone template page | https://www.vibecodeapp.com/templates/notebooklm | Visual tokens **from a clone, not Google**: black-disc "arches" logo, Google Sans, Google blue #0B57D0, white rounded panels on a #F1F3F6 page |
| 13 | UserStyles.world, "NotebookLM DarkX theme" (community CSS) | https://userstyles.world/style/27214/notebooklm-darkx-theme | Token names (`--nlm-fills-surface-page`, `--nlm-stroke-default`, `--nlm-text-body-text`) — evidence the real app uses Material-style design tokens; values are the author's, not Google's |
| 14 | YouTube walkthrough transcript, "The Ultimate Guide to NotebookLM" | https://youtubetotranscript.com/transcript?v=FOs4RDTC52Q | Settings has output-language picker + light/dark toggle; composer shows "N sources"; unchecking sources updates the count live; "Configure notebook" (style/length) |

## 2. Naming / context (2026)

- Launched 2023 as Project Tailwind (Google Labs); global expansion Jun 2024; three-panel UI + NotebookLM Plus Dec 2024 (source 1).
- **Renamed 16 Jul 2026 to "Gemini Notebook"**; `notebooklm.google.com` redirects to `notebook.google.com`. Same product, same notebooks/links (sources 4, 5). This note keeps "NotebookLM" because the Vector Brain brief uses it.
- Free-tier limits per 2026 guides: up to 100 notebooks, 50 sources per notebook, up to 500,000 words / 200 MB per source; paid plans raise source counts. **Limits changed Sep 2026 to compute-based allowances refreshing every 5h up to a weekly cap** (sources 4, 5) — treat exact numbers as version-dependent; do not hard-code them into Vector Brain.

## 3. Layout map — the three panels

```
┌──────────────────────────────────────────────────────────────────┐
│ TOP BAR: logo + notebook title (editable) · Share · Settings ·   │
│          Google account avatar                                    │
├───────────────┬──────────────────────────────┬───────────────────┤
│ SOURCES       │ CHAT                         │ STUDIO            │
│ (left)        │ (centre, widest, fluid)      │ (right)           │
│ Add source    │ auto-summary + suggested     │ Audio Overview    │
│ Source list   │ questions (empty state)      │ Video Overview    │
│ (checkboxes)  │ ─────────────────────        │ Mind Map          │
│               │ message thread               │ Reports           │
│               │ ─────────────────────        │ Flashcards / Quiz │
│               │ composer (pinned bottom)     │ Infographic /     │
│               │                              │ Slides / Tables   │
│               │                              │ ─────────────     │
│               │                              │ Notes (saved)     │
└───────────────┴──────────────────────────────┴───────────────────┘
```

- **Proportions [inferred]:** side panels are fixed narrow columns (roughly 280–340 px each on desktop), centre chat is fluid and widest. No source gave exact widths — pick values that keep chat readable (~720 px max content width) and let side panels collapse.
- **Collapsing:** left and right panels collapse/expand; the centre panel cannot be collapsed — collapsing a side panel widens the chat (source 8). The source viewer and notes editor can sit side-by-side (source 1).
- **Responsive:** on phones the three panels become bottom tabs (Sources / Chat / Studio); tablets get a dual-pane layout. **[Attested by one secondary guide only.]**
- **Dashboard:** a "Notebooks" home screen with "Create new" and cards for existing notebooks. Vector Brain has no multi-notebook model — out of scope.

### 3a. Top bar

- Left: NotebookLM "arches" logo (black disc) + notebook title, editable in place (source 14); a back affordance returns to the Notebooks dashboard.
- Right: **Share** button (Plus adds public-link / chat-only sharing, source 9), **Settings** (gear), Google account avatar. Settings contains output-language picker, light/dark theme toggle, and (2026) "Configure notebook" — conversational style and response length (sources 11, 14).
- No persistent left nav rail inside a notebook; navigation is the three panels themselves.

### 3b. Left — Sources panel

- Header: **"Sources"** label + source count, and a prominent **"Add source" / "+ Add source"** button at the top.
- **Add-source dialog:** modal with a drag-drop zone plus entry points — **Upload files, Websites** (paste URL), **Drive** (Google Drive picker), **Copied text**, YouTube links (sources 5, 6). Accepted types per Google docs via guides: PDF, Google Docs/Slides/Sheets, Word, PowerPoint, plain text, Markdown, CSV, EPUB, images, audio, websites, public YouTube videos, pasted text.
- **Source rows:** flat list rows (not cards), each with a **checkbox** (ticking controls which sources the next answer draws from; "Select all sources" at the top), a type icon **[icon style not verified]**, and the title **truncated to ~20 visible characters** (source 3). Hover/selection reveals rename and remove; reorder is supported per one guide.
- **Source count surfaced twice:** in the panel header and in the chat composer as "N sources" — unchecking a source updates the composer count live (sources 7, 14).
- **Source viewer:** clicking a source (or a citation) opens its content in a reading view; the centre can show the source instead of chat (source 1).

### 3c. Centre — Chat panel

- **Header:** "Chat" label; a **Refresh** control at the top clears responses and restarts the conversation (source 7).
- **Empty / first-run state (the "Notebook Guide"):** after the first source is added, NotebookLM auto-generates a short summary of the source(s) in chat without being asked, plus **suggested questions** tailored to the documents (sources 5, 6). Suggested questions are clickable chips/cards; one guide describes a carousel with left/right arrows (source 7). Clicking one sends it as the first question.
- **Message layout:** standard chat thread — user questions as plain turns, AI answers as full-width prose with headings, lists and bold. Bubble styling **not verified** — do not assume ChatGPT-style bubbles. Answers stream in.
- **Per-answer actions (below each AI reply):** **"Save to note"** (bottom-right of the reply) and a **copy** icon (sources 6, 7). Saved answers become notes in the Studio panel.
- **Composer (pinned to bottom of centre panel):** placeholder **"Start typing…"**; a **source-count indicator ("N sources")** at the right/bottom of the input, reflecting checked sources; suggested-question chips just above/below the field, cyclable with arrows (sources 7, 14). Send via Enter or a send button **[styling not verified]**. No attachment button in the composer — files are added via the Sources panel, not the chat box. That separation is a defining NotebookLM trait; keep it in Vector Brain.
- **Chat persistence — conflicting reports:** older guides (source 6) say chat is ephemeral and disappears on close/refresh unless saved as a note; 2026 guides (sources 3, 11) say saved/persistent conversation history was added (Feb 2026). Treat persistence as version-dependent. Vector Brain already has sessions — keep them; do not mimic ephemeral chat.

### 3d. Right — Studio panel

- Header: **"Studio"**. A vertical stack of **one-click generation tiles/buttons** (sources 1, 5, 8, 9): **Audio Overview** (podcast-style two-host discussion; formats Brief, Critique, Debate; Interactive mode lets you "Join" by voice), **Video Overview** (narrated slides, 80 languages), **Mind Map** (branching topic diagram), **Reports** (Study Guide, Briefing Doc, FAQ, Timeline; later: slide decks, infographics, data tables), **Flashcards / Quiz** (persistent progress, 2026 update).
- **Notes section (below the tiles):** saved notes live here — created via "Save to note" or manually via **"Add note"** (a "Start typing" field). Notes can be converted back into sources (source 5). Generated outputs appear as items in this panel (e.g. an Audio Overview player card at the top once generated).

## 4. Palette / typography / spacing tokens (observed)

- **Light-first.** Default theme is light, near-white; dark mode exists, toggled in Settings (sources 5, 14). Vector Brain already has a light/dark toggle — keep both, light as default.
- **Overall feel:** "minimalist and functional, following Google's Material Design language without unnecessary visual clutter" (source 10). Clean lines, subtle colour accents, lots of whitespace.
- **Page vs panels [secondary source — clone template, source 12]:** white rounded panels on a very light grey page (~`#F1F3F6`). Treat the exact hex as **unverified**; the pattern (light-grey app background, white panels) is consistent with Material 3 surfaces and with screenshots described in sources 8–9.
- **Accent:** Google blue `#0B57D0` for primary actions/links (source 12, clone-derived — the hex matches Google's published Material blue and is plausible, but **not verified from Google's own CSS**). Colour is used sparingly: links, active states, citation numbers.
- **Logo:** black disc with white "arches" mark (source 12). Do **not** copy Google's logo into Vector Brain — use our own mark.
- **Typography:** Google Sans for UI text (source 12, clone-derived; consistent with Google products). Panel headings are small, medium-weight labels ("Sources", "Chat", "Studio"), not large display headings. **Exact sizes/weights not verified — no source gave px values.**
- **Radius / elevation:** panels and tiles are **rounded rectangles with soft corners** and very light borders/shadows — cards for Studio tiles and generated outputs, **flat rows** for the source list and chat messages (sources 8, 9, 12). **[Radius px not verified; suggest ~12–16 px panels/tiles, ~8 px buttons — inferred.]**
- **Density:** comfortable, not dense — generous padding inside panels, clear gutters between columns. **[Exact spacing tokens not verified.]**
- **Dark mode (community theme, source 13 — third-party values, pattern only):** dark surfaces ~`#1e1e1e`–`#2d2d2d`, borders `#3c3c3c`, body text `#d6d5d4`/`#cccccc`, blue focus `#007fd4`. Useful as a sanity check for Vector Brain's existing dark theme, not a spec to copy.

## 5. Source ingestion + loading states

- **Ingestion is fast and visible:** drag a PDF into the drop zone and "NotebookLM ingests it within seconds"; the file appears in the Sources panel with a checkbox, and NotebookLM immediately writes an overview in the chat panel (source 5). Another guide puts processing at "within 30–60 seconds" per source. Takeaway: **seconds-scale, not minutes** — show a per-source "processing" state, then flip to ready; do not block the whole UI.
- **What the user sees while ingesting [partially verified]:** the source row appears in the Sources panel while processing; the chat fills with the auto-summary once ready. A spinner/progress indicator on the row itself is **not explicitly described in any source** — Vector Brain's existing `ProcessingStatus` (per-document status) already matches the spirit; keep row-level status (queued → processing → ready / failed), not a global modal.
- **Failure modes:** copy-protected PDFs won't import; the offered fix is to export a fresh PDF or paste the text, keeping the original filename/page numbers in the title for traceability. Uploads can also "fail silently" (monsha.ai) — Vector Brain must surface failures explicitly with a retry affordance; do not copy silent failure.
- **Audio Overviews take minutes** to generate (source 8) — the one genuinely slow operation. (Not applicable to Vector Brain — no audio generation.)
- **Chat answering:** responses stream; the model "searches the sources from multiple perspectives" (2026 update, source 11). Exact streaming/loading copy ("Thinking…", "Searching sources…") **not verified**.

## 6. Citation / chip patterns

- **Inline numbered citations:** every claim carries a small numbered citation — `[1]`, `[2]`, `[3]` — inline in the prose, superscript-style (sources 4, 5, 9).
- **Hover = preview:** hovering a citation number shows a popover with the exact source passage (sources 5, 14).
- **Click = jump:** clicking opens the source viewer with the supporting text highlighted / scrolled to the exact paragraph (sources 5, 9, 14).
- **Grounding rule (product behaviour, not just UI):** answers are built only from the notebook's sources; the UI makes that verifiable rather than asserting it. Vector Brain already has this model (filename + page citations) — keep the hover-preview + click-to-open pattern, the single most important NotebookLM interaction to adopt.
- **Suggested-question chips:** clickable pills under the auto-summary and around the composer; clicking sends the question (sources 6, 7).
- **Source-count chip:** "N sources" in the composer reflects the checked sources (sources 7, 14) — a small live affordance, not a static label.

## 7. Empty states

- **No sources yet:** a new notebook opens to an empty state prompting the user to add sources — the add-sources affordance is the whole first screen (sources 5, 6). The centre chat is empty until the first source lands; no fake conversation is pre-filled.
- **No chat yet (sources present):** the auto-summary + suggested questions *is* the empty state — NotebookLM generates content for the user instead of showing a blank page (sources 5, 6).
- **No Studio outputs yet:** the Studio panel shows the generation tiles in their idle state (buttons, not placeholders) — the tiles themselves are the affordance (sources 8, 9).
- **No notes yet:** the Notes section shows "Add note" as the entry point (source 8).
- Vector Brain mapping: keep `EmptyState` for zero documents; after the first upload succeeds, show an auto-summary + suggested questions in chat (new behaviour — needs a summary on ingest or a first-chat prompt; see §9).

## 8. ADAPT vs SKIP for Vector Brain

Vector Brain has: document upload + processing, RAG chat with filename+page citations, chat sessions, light/dark themes. It does **not** have: Audio/Video Overviews, Mind Maps, Reports, Flashcards, Quiz, multi-notebook support, sharing, Google Drive/YouTube ingestion.

### ADAPT (take these)

| NotebookLM pattern | Vector Brain mapping |
|---|---|
| Three-panel layout: Sources \| Chat \| Studio | Keep `SourcePanel` \| `ChatInterface` \| right panel; side panels collapsible, centre fluid and non-collapsible |
| Top bar: logo + editable title, Share, Settings, avatar | Title + theme toggle + settings; **no Share** (single-user, no auth — do not add sharing UI) |
| Sources panel: "Add source" on top, flat rows with checkboxes, source count | Already close (`SourcePanel`, `DocumentCard`, `UploadDropzone`); add per-source checkboxes that scope the next query + live "N sources" in the composer |
| Add-source dialog: drag-drop zone + Upload / URL / pasted-text entry points | Keep upload + pasted text; **no Drive/YouTube** (out of scope) |
| Source rows truncated (~20 chars) with rename/remove on hover | Apply truncation + hover actions to `DocumentCard` |
| Composer: "Start typing…" placeholder, "N sources" indicator, suggested-question chips above it | Add to `ChatComposer`; suggested questions generated from the uploaded docs |
| Auto-summary + suggested questions after first upload (the empty state) | New: show a short auto-summary in chat when a document becomes READY |
| Numbered inline citations `[1][2][3]`; hover previews passage; click opens source at the passage | Upgrade `SourceCitation` (filename+page) to numbered inline chips + hover preview + click-to-open at the cited page |
| "Save to note" / copy under each AI reply | Keep copy; "save" = keep the session (we persist sessions already — do not reintroduce ephemeral chat) |
| Light-first Material look: white rounded panels on light-grey page, single blue accent, flat source rows, card tiles | Apply to `variables.css` / `main.css` tokens; keep our dark theme as counterpart |
| Row-level ingestion status (processing → ready / failed, explicit failure + retry) | Keep/strengthen `ProcessingStatus`; never fail silently |
| Mobile: panels become bottom tabs (Sources / Chat / Studio) | Apply responsively; tablets dual-pane **[inferred]** |

### SKIP (do not build)

| NotebookLM feature | Why |
|---|---|
| Audio Overview (+ Interactive mode, Critique/Debate formats) | No audio generation |
| Video Overview | No video generation |
| Mind Map | No graph visualisation |
| Reports (Study Guide, Briefing Doc, FAQ, Timeline), Flashcards, Quiz, Infographics, Slide decks, Data Tables | No generation features beyond chat |
| Notes section / "Add note" / notes-as-sources | No notes model; sessions cover persistence |
| Multi-notebook dashboard ("Create new" cards, folders) | Single workspace; no notebook model |
| Share notebook / public link / chat-only sharing, Plus tiers, usage analytics | Single-user, no auth — do not add |
| Google Drive / YouTube / website ingestion | Out of scope; PDF upload + pasted text only |
| Deep Research / web search, Source Discovery | Answers come only from uploaded docs |
| Custom goals / roles / "Configure notebook" persona prompts | No persona configuration in scope |
| Google's arches logo, "NotebookLM"/"Gemini Notebook" name, Google Sans as a brand font | Trademark/brand — use our own mark; a system sans stack is fine |

### Right panel — what to put there instead of Studio

Since Studio's generators are all skipped, do **not** leave an empty "Studio" panel. The right panel should become a **"Details / Citations"** panel: the active citation's passage, the selected document's metadata (filename, pages, chunks, status), and session history. That keeps the three-panel shape without faking features we don't have.

## 9. What I could NOT verify

- **Logged-in behaviour:** I did not sign in and did not use the app. Exact pixel widths, spacing tokens, font sizes/weights, border-radius values, hex colours, hover states, focus rings, and animation timings are **not verified** — no public source publishes them. Values in §4 marked "inferred" or "clone-derived" are starting points, not specs.
- **Exact top-bar composition:** Share/Settings/avatar placement comes from secondary guides and a skill doc, not from a labelled Google screenshot; the avatar's exact position is unconfirmed.
- **Loading-state copy:** no source quoted the exact spinner text or progress UI during ingestion; "processing → ready" is inferred from behaviour descriptions.
- **Chat persistence:** sources conflict (ephemeral pre-2026 vs saved history in 2026 updates) — could not resolve which behaviour the current build has.
- **Composer buttons:** whether there is a mic/attach/stop button in the composer is unconfirmed; only the "N sources" indicator and suggested-question chips are attested.
- **2026 redesign drift:** several guides describe the July 2026 rename to Gemini Notebook and a "redesigned interface" (Oct 2026 free-tier expansion); screenshot-level detail of the post-rename UI was not available in the sources I could read. The Dec 2024 three-panel structure is the stable, well-attested core — build on that.
- **Mobile specifics:** bottom-tab navigation on phones is attested by one secondary guide only; exact breakpoints unconfirmed.
- **Limits:** free-tier numbers changed in Sep 2026 to compute-based allowances; any limit quoted in §2 may already be stale.
