# Eucalculia v8 — handoff brief for Claude Code

This folder carries the work from a Cowork session so a Claude Code session can continue it. Read this file first, then the design section, then start at "Next steps".

## 1. The request (owner's words, condensed)

1. Combine `Eucalculia_experimental.html` (≈ v7, 11 MB) with `Eucalculia_SPA_VER_01_prototype.html` (SPA-VER-01 prototype v22) *holistically*. The SPA prototype was planned as a feature of Eucalculia; it is a first version, valuable mainly as aspiration.
2. That merge is only part of a larger goal. Assume **Relational Frame Theory (RFT)**, **P-FIT** and **intensive, high-level N-back** are true and beneficial. Advance the game on those grounds, especially the relational side: find missed relations and missed meta-relations, and raise the questions the owner can't yet think of. Work as "the original author, returned and much cleverer".
3. Make **serious advancements**, not tweaks — but stay in scope: no reversals of existing design decisions, nothing unrelated to the game.
4. It must stay **adaptive**: a beginner must be able to do something at their level and move up.
5. Weigh **opportunity costs**: if something can be done or fixed more efficiently, do it; be careful where a change would damage the integrity of the task.
6. **Fix errors**: the owner has seen wrong answers.
7. **Hard constraint**: write a NEW file in the `Eucalculia 6.0` folder. Do not modify `Eucalculia.html`, `Eucalculia_suave.html`, `Eucalculia_experimental.html` or `Eucalculia_SPA_VER_01_prototype.html`.

Suggested output name: `Eucalculia_v8.html` (built from a copy of the experimental file).

## 2. What the two source files are

### Eucalculia_experimental.html
- 195,062 lines. 242 `<script>` blocks, 29 `<style>` blocks. One base64 image (the logo).
- Line ~7887: the main script (4.7 MB). After it come ~200 patch layers (v6.6.x → v6.8.88, H3.x–H6.5 contracts, PH6.G0.x, PH6.B2–B3.8, PH6.C1–C5.R3.18). Each layer wraps globals and re-installs itself on `queueMicrotask`/`setTimeout(0)`/`pageshow`.
- Public surface is **Auto-only**: the old modes and L0–L3 selectors are internal. `State.modeChoice==="auto"`, `State.mode==="D"`, `State.autoPhase` in `1A` (recognition), `1B` (manipulation), `L0`… Internal levels: `State.levelByMode.D`.
- Relational cascade: L0 (two flashed quantities → delayed YES/NO/choice), L1/META (numeric integration over two retained L0 pairs), L2/META² (conclusion over two L1 answers), L3/META³ (synthesis over two L2). MEM cues mark retained items; lures add interference.
- 16 representations: digits, dots, cluster, ten-frame, dice, domino, tally, fingers, abacus, cards, cubes, coins, roman, clock, grid.

### Eucalculia_SPA_VER_01_prototype.html
- Stand-alone, 438 KB, one script (410 KB). Author's history notes are Spanish, in the header comment (v4 → v22).
- Content engine (script lines ≈ 647–4900) is DOM-free: shape registry, scenes, `drawScene` (SVG strings), the `evalSem` oracle, a `QUESTIONS` catalogue (`CAT`), `SCENE_PROFILES`, `RUNGS`, `serveItem`, and the `Ladder` object. A global mutable `SEED` drives `rnd()`; `withContentSeed` scopes it.
- 30 rungs in 6 tracks: main R0–R10 (load, arity, pointing, sequences, reference, Latin-square LST, transforms, twins), number N0–N3, induction I0–I7, oddity O0–O4, evidence E0–E1 (modal necessity; premise ablation).
- Ladder: window 8, promote at 7/8 (plus coverage groups and bool/choice balance), demote at ≤4/8.
- It has its own game loop (`startTrial → showStimulus/showFrame → showMask → beginInput → answer → showReview`), persistence (`SPAVER01_V22`) and an in-browser audit (`Audit`, line ≈ 5629) with key-marginal, leakage and regression-digest checks.
- Note: the experimental file already contains spatial families called SPA-02…SPA-05 (nets, views, sections, block design). SPA-VER is the *verification / induction / oddity / evidence* family that was never merged.

## 3. How the experimental engine can be extended safely (verified)

Every recent family (SPA-02…05, G0.8…) uses the same plug-in contract. Best model to copy: the SPA-05 R2 block at line ≈ 187330 (`installSpa05R2`).

- **Start hook**: wrap `globalThis.maybeStartInlineGenerativeTrialAfterReset(attempt, forcedLevel)`. `startTrial()` (line 63746) calls it right after the UI reset. Return `true` after setting `State.trialInfo` and starting your own phase. Guard with `attempt===0 && forcedLevel===null && State.running && !State.paused && State.modeChoice==="auto"` and **no pending META memory** (`ensureMetaMemoryPlans()` / `shouldExtendBlockForMetaMemory()`), otherwise you break MEM chains.
- **Scheduler**: `PH6.C5.R3.18 SPATIAL AUTO COORDINATOR` (line 194861) reserves 2 spatial slots per eligible block and keeps a separate adaptive axis at `State.adaptiveAxes.spatial`. A v8 coordinator for the new axes should follow that pattern, not add another bare probability hook.
- **Rendering**: `metaStimulusSVGForTrialInfo(info)` puts SVG into `#metaQuestion`; `showMetaQuestion(level, question, hint, options)`; `showCanonicalMask()` reuses the core canvas noise mask; `disableLegacyCanvas()` hides the canvas.
- **Answers**: bool → `processInput(true|false)`; choice → `handleChoiceInputIndex(i)` then `processInput(i)`; `setChoiceOptions(labels)`, `showPanel("bool"|"choice")`, `beginInputPhase()`. For multi-step episodes SPA-05 captures sub-answers itself, then calls the original `processInput(compoundCorrect)` with `State.targetValue=true`.
- **Review**: wrap `h35ReviewBuildModel(info)` (title/question/userAnswer/correctAnswer/reasons) and `h35ReviewPaintStimulus(info)`.
- **Timing**: wrap `currentET()` and `setStatus()` (SPA-05 does both) so the core update loop doesn't advance your phases.
- **Watchdog limits** (line 10625): `PREP 2500 ms, FLASH 6000 ms, MASK 2500 ms, LOCKED 2600 ms`. `INPUT` has no time limit, but `validateCurrentInputOperability()` (line 11050) needs a valid `pendingPanel` with visible buttons. Multi-frame episodes must re-enter FLASH/MASK per frame (each `setStatus` resets `phaseStartTime`), and each frame must stay under 6 s. An N-back stream needs this (or a dedicated status); otherwise the watchdog opens the recovery panel.
- Keep `countsForMetaHistory:false`, `memoryEligible:false`, `countsForAdaptation:false` on new families unless you integrate them with MEM on purpose.
- **Persistence**: the coordinator stores its axis on `State.adaptiveAxes`. Check the save path before relying on it; a namespaced localStorage key per profile (`State.activeProfile`) is the safe fallback.

### Local QA mode
The first script strips every URL parameter unless the host is loopback **and** `?eucaQa=1`. To use force parameters (`?spa05=force`, etc.):

```
cd "Eucalculia 6.0"
python -m http.server 8765 --bind 127.0.0.1
# open http://127.0.0.1:8765/Eucalculia_experimental.html?eucaQa=1
```

## 4. Correctness audit so far (owner reported wrong answers)

**Method**: in-page, force each L0 category with `State.forceNextL0RepairFamily = cat.id` and call `setupPosner()` 8 times at `State.levelByMode.D=20`, `State.maxValue=12`. Record question text, values, representations and the engine's answer (`harness/sample_all.js`). Then hand-verify each line against the wording. Output: `audit/l0_samples.txt` (4,712 lines, 834 categories / 2,238 wordings); the de-duplicated review set is `audit/l0_review.txt` (2,267 lines, up to 2 YES + 2 NO per category).

**Reviewed so far: lines 1–1,679 of `l0_review.txt`.** Almost everything checked out: recursion traces, program cards, cross-representation projections, sets, quantifiers, Boolean connectives, ratios, modular, cyclic distances, relation/predicate identification. Findings:

1. **Confirmed wrong-answer bug**: `sum_multiple_5` (line 22495) has the wording `"Does the total cross to the next decade exactly?"` under the predicate `(a+b)%5===0`. With a total of 5 or 15 the engine answers YES, but the wording means "lands exactly on 10/20". Fix: replace it with a mod-5 wording, e.g. `"Does the total land exactly on a multiple of 5?"`, or move it to a `sum_multiple_10` category.
2. **Perceived-error risk**: 1 is treated as a power of 2 (2⁰). This is correct, but a player will see it as a wrong answer, e.g. in `decl_set_membership_identification_choice_*` with pair (1, 9) the key is "exactly one value is power of 2". Options: exclude 1 from power-of-2 items, or say "1 counts as 2⁰" in the guide and in review text.
3. **Values above 10 in complement-to-10 items** (`complement10_*`) produce negative complements (11 → −1). They are consistent, but check that this is intended for the player's range.
4. 82 categories were **not served** when forced (list at the end of `audit/l0_samples.txt`, lines marked `NOT_SERVED`): Venn gates, card/domino/coin/cube visual checks, most `rec_*` terminal/branch items, `decl_missing_datum_*`, the PH6.B rational/integer/proportion/equation families, and `identical`. Some just need other conditions (a visual format, a level gate, a different `maxValue`), but check whether any are unreachable when they shouldn't be.
5. Multi-select `rel_eq_*` rows in the sample don't show the answer key (harness formatting). Fix the harness (`pos.answer` is a canonical "i,j" string), then verify.
6. Built-in audits (`harness/audits.py`): all content audits PASS (SPA02–05, REC01, stimulus integration, public semantic hardening, R318). Many H-series UI audits report FAIL when run from the menu; they look context-dependent (they expect a live trial), not answer errors, but confirm.

**Not yet audited** (most likely places for the reported errors): the rest of `l0_review.txt` (lines 1,680–2,267); paper-folding analogies (165 categories, skipped); L1 / META operations (`setupL1`, line 51448), L2 (`setupL2`, 59139), L3 (`setupL3`, 61372); frame bursts, update chains and induction chains; the SPA-VER prototype's own oracle (it has its own audit). Apply the same method to L1–L3: build trials directly with forced state, dump question + retained pairs + key, hand-verify.

## 5. v8 design — what to build (reasoning)

### 5.1 Diagnosis: what the relational layer is missing under RFT
Almost every Eucalculia relation is **non-arbitrary**: it can be computed from formal properties of the numbers (magnitude, parity, primality, distance). RFT's core claim is *arbitrarily applicable relational responding* (AARR): relations controlled by contextual cues, with three defining properties — **mutual entailment**, **combinatorial entailment** and **transformation of stimulus functions**. The game already contains pieces of it (cross-representation "same number" is an equivalence class; G4 seriation is combinatorial entailment of comparison; L1 "same order relation" is relating relations). It does not train:

- **Derived relations**: the player never derives an untrained relation from trained ones in a network.
- **Opposition combinatorics**: opposite-of-opposite = same.
- **Distinction and indeterminacy**: different-from-different is *not derivable* → "can't tell". This links naturally to the SPA evidence track (necessary / possible / impossible).
- **Hierarchy with asymmetric inheritance**: a property flows down from class to member, never up.
- **Temporal and causal frames** as derived networks, not just before/after pairs.
- **Deictic frames** (I–YOU, HERE–THERE, NOW–THEN; simple, reversed, double-reversed), the RFT basis of perspective-taking. Completely absent.
- **Transformation of function through a network**: e.g. `BEK is 2 MORE than ZOF; ZOF = [flashed dice]` → the value of BEK. This is the bridge to the numeric core.
- **Contextual control (Crel/Cfunc) as the trained variable**: gates are close, but the cue→relation mapping is never itself arbitrary.
- **Relating relational networks** (network ↔ network analogy, coherence) and **relational flexibility** (responding under a reversed or overridden relation: "if SAME meant OPPOSITE…").

**Curriculum frame**: use the Barnes-Holmes hyper-dimensional multi-level framework (HDML) as the adaptive state. Levels: mutual entailing → relational framing → relational networking → relating relations → relating relational networks. Dimensions: coherence, complexity, derivation, flexibility. Use fresh nonsense words every trial to keep *derivation* high — this matches the existing "genuine vs rote" guards.

### 5.2 RFT relational-frame engine (new family, own adaptive axis)
- Premises flash one at a time under the canonical mask (same encode → mask → delayed-question grammar as L0), then a delayed question: YES / NO / (later) CAN'T TELL, or 4-option.
- Beginner entry: 2 premises, SAME/DIFFERENT, a directly entailed question (mutual entailment only).
- Axes: number of premises (2→6), frame mix (coordination, distinction, opposition, comparison, hierarchy, temporal, deictic, conditional), derivation distance, scrambled premise order, count of oppositions, negation, indeterminacy options, transformation of function onto Eucalculia representations, relating relations, relational flexibility.
- An oracle solves every network exactly (a relation-algebra closure per frame family; "indeterminate" is a first-class result). Balance answer keys the way the SPA audit does (key-marginal gate).

### 5.3 N-back (new, intensive, adaptive)
- Served as compound episodes through the same pipeline (one run = one scored trial), dosed by its own axis; 1–3 runs per block as proficiency grows.
- Streams built from Eucalculia's representations: **value match across formats** (coordination: same number, different representation) plus position (a 3×3 grid). Then a **relational N-back**: the target is a *cued relation* to the item N back (+2, sum-10 complement, same parity, opposite around 5), not identity. Dual streams per Jaeggi: fewer than 3 errors per modality → N+1; more than 5 → N−1. Start at 1-back single-stream.
- Each item must respect the watchdog (re-enter FLASH per item; each stimulus + ISI ≤ 6 s).

### 5.4 SPA-VER integration (the requested merge)
- Embed the SPA content engine in a closure namespace (`EUCALCULIA_SPAVER`), with its `SEED` isolated and seeded from the session RNG, like the coordinator's `seedFor`.
- Serve items through the plug-in contract. Single scenes: encode → mask → question. Framed scenes (LST clues, spatial premises, pair frames): one FLASH per frame + mask. Options may be SVG `html` → set the choice-button innerHTML.
- Give each track its own window. Auto interleaves tracks: main and number from the start; induction after main R2; oddity after I2; evidence after R4. Persist per profile.
- Holistic joins: spatial relations (left-of, above, pointing, containment) and numeric relations are the same frame classes. Add **cross-domain relating-relations** probes: "is the relation between the ◆ and the ▲ the same kind as between LEFT and RIGHT?".
- Improve on the prototype as you go: its number track overlaps Eucalculia's numerosity training, so down-weight it. Keep its audit gates (key marginals, leakage, degenerate twins) and add them to the v8 audit.

### 5.5 P-FIT integration
Jung & Haier: posterior sensory/association → parietal abstraction (BA 7/39/40; the IPS carries magnitude) → frontal hypothesis testing and working memory (BA 6/9/10/45–47) → ACC response selection, linked by white matter. Design implications: **cross-code binding items** (one item needs the numeric pair + the spatial scene + the verbal network together); indeterminacy and inhibition options for response selection (ACC); timed fluency on mastered material (integration speed); induction and active testing (frontal hypothesis testing). Extend the existing silent P-FIT tagging to dose integration items per block.

### 5.6 Questions to settle
- Should RFT networks feed the META/MEM cascade (a derived relation as a retained unit for L1)? This is powerful, but needs a separate MEM contract so it doesn't break the existing chain semantics. Start with it off.
- What N-back dose inside 20-trial blocks counts as "intensive"? A possible alternative is a dedicated N-back block type chosen by Auto.
- Should arbitrary contextual cues (learned glyphs for SAME/OPPOSITE/MORE) replace words at high levels? That is true AARR, and it adds an onboarding cost.

## 6. Harness (in `harness/`)
- `run_js.py` — loads a page from a local server and runs a JS snippet, writing its return value to a file. Usage: `python harness/run_js.py harness/sample_all.js '{"n":8,"skipFam":["l0_paper_folding_analogy"]}' out.txt Eucalculia_experimental.html`
- `sample_all.js` — the L0 forced-category sampler used for the audit.
- `audits.py` — runs every `EUCALCULIA_*.audit/runAudit/selfAudit` and prints status.
- `probe.py` — boots the page, presses Space, prints the state sequence and saves screenshots.
- Requires `pip install playwright` and `playwright install chromium`, plus the local server from §3.

## 7. Next steps (suggested order)
1. Copy `Eucalculia_experimental.html` → `Eucalculia_v8.html`. Only ever edit the copy.
2. Fix finding 1 (and decide on 2) in the copy. Finish the L0 review, then audit L1/L2/L3 and paper folding.
3. Build the v8 coordinator (new adaptive axes and persistence).
4. RFT engine → N-back → SPA-VER embedding → cross-code (P-FIT) items. Each gets its own `runAudit()` (oracle, key marginals, render tokens free of `NaN` and `undefined`).
5. Headless play-through with the harness at desktop and phone widths: zero runtime errors, no watchdog panics, reviews render.
6. Update the in-app guide (Player / Technical reference) with the new families and the rationale.
