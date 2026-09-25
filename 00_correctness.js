/* V8.0 CORRECTNESS LAYER:START
   Runtime corrections that cannot be expressed as a one-line source patch.
   1. L1 retained-stimulus transforms. "Mentally change Pair k SIDE using T" used to
      materialise T's metadata from a NEW random stimulus (selectL0TransformForSide only
      receives rep + value). For layout-dependent transforms (grid corners/centre/edges/lines,
      coin kinds and denominations, domino halves, dice faces, cluster subgroups, card
      suits, cube views) the key was therefore computed on a layout the player never saw.
      The candidates are now built from the retained replay spec, fail-closed when the
      spec is missing or does not encode the retained value.
   2. "1 counts as a power of 2" review note wherever a power-of-2 item involves the value 1.
*/
(function installV8Correctness(){
  "use strict";
  if(globalThis.EUCALCULIA_V8_CORRECTNESS) return;
  const PATCH_ID = "v8.0-correctness";
  const LAYOUT_REPS = new Set(["grid","coins","domino","dice","cluster","card","cube"]);
  const stats = {retainedBuilt:0, retainedRejected:0, valueOnly:0, specMissing:0, powerNotes:0};

  const num = x => Number(x);
  const sum = arr => arr.reduce((s,x)=>s+Number(x||0),0);

  // Build transform metadata from a retained replay spec (the stimulus the player saw).
  function retainedMeta(rep, value, spec){
    if(!spec) return null;
    try{
      if(rep === "grid"){
        const layout = typeof cloneGenericGridLayout === "function" ? cloneGenericGridLayout(spec) : spec;
        if(!layout || !Array.isArray(layout.cells) || layout.cells.length !== value) return null;
        return {gridLayout:layout, layout, retained:true};
      }
      if(rep === "coins"){
        const coins = Array.isArray(spec) ? spec.map(num).filter(Number.isFinite) : null;
        if(!coins || !coins.length || sum(coins) !== value) return null;
        return {coins, retained:true};
      }
      if(rep === "domino"){
        const h = Array.isArray(spec) ? spec.map(num) : null;
        if(!h || h.length !== 2 || !h.every(Number.isFinite) || h[0] + h[1] !== value) return null;
        return {dominoes:[{a:h[0], b:h[1]}], retained:true};
      }
      if(rep === "cluster"){
        const groups = Array.isArray(spec) ? spec.map(num).filter(n => Number.isFinite(n) && n > 0) : null;
        if(!groups || !groups.length || sum(groups) !== value) return null;
        return {groups, retained:true};
      }
      if(rep === "card"){
        const cardSpec = Array.isArray(spec) ? spec.map(c => ({val:num(c.val), suit:num(c.suit)})).filter(c => Number.isFinite(c.val) && Number.isFinite(c.suit)) : null;
        if(!cardSpec || !cardSpec.length || sum(cardSpec.map(c=>c.val)) !== value) return null;
        return {cardSpec, cards:cardSpec.map(c=>c.val), retained:true};
      }
      if(rep === "dice"){
        const dice = typeof cloneDieReplaySpec === "function" ? cloneDieReplaySpec(spec) : spec;
        const d0 = Array.isArray(dice) ? dice[0] : null;
        if(!d0 || !d0.orientation || num(d0.orientation.top) !== value) return null;
        return {dice, orientation:d0.orientation, rotation:Number.isFinite(num(d0.rotation)) ? num(d0.rotation) : 0, retained:true};
      }
      if(rep === "cube"){
        const grid = typeof cloneCubeGrid === "function" ? cloneCubeGrid(spec.layout) : spec.layout;
        const total = Array.isArray(grid) ? grid.flat().filter(Boolean).length : -1;
        if(total !== value) return null;
        return {layout:grid, orientation:spec.orientation || null, retained:true};
      }
    }catch(_){ }
    return null;
  }

  function weightFor(rep, id){
    let w = 1;
    try{ if(typeof representationTransformWeaknessWeight === "function") w *= representationTransformWeaknessWeight(rep, id); }catch(_){ }
    try{ if(typeof visualTransformSamplingPriority === "function") w *= visualTransformSamplingPriority(rep, id); }catch(_){ }
    return Number.isFinite(w) && w > 0 ? w : 1;
  }

  // Same contract as selectL0TransformForSide, but every candidate is evaluated on the
  // retained layout. Returns {id, transformId, tier, transformMeta, transformedValue, displayValue}.
  function selectRetainedTransform(rep, value, spec, maxTier){
    const base = retainedMeta(rep, value, spec);
    if(!base){ stats.specMissing++; return null; }
    const repMod = (typeof REPRESENTATION_TRANSFORMS !== "undefined" && REPRESENTATION_TRANSFORMS[rep]) || {};
    const tierLimit = Number.isFinite(maxTier) ? maxTier : 3;
    const deferred = (typeof L0_TRANSFORM_DEFERRED !== "undefined" && L0_TRANSFORM_DEFERRED) || new Set();
    const out = [];
    for(const id of Object.keys(repMod)){
      const t = repMod[id];
      if(!t || deferred.has(id) || Number(t.tier || 1) > tierLimit) continue;
      const queries = rep === "cube" && typeof cubeQueriesForTier === "function" ? cubeQueriesForTier(tierLimit) : [null];
      for(const query of queries){
        const meta = {...base, ...(query ? {query} : {})};
        let ok = true;
        try{ if(typeof t.canApply === "function" && !t.canApply(value, meta)) ok = false; }catch(_){ ok = false; }
        if(!ok) continue;
        let v = null;
        try{ v = applyRepresentationTransform(rep, value, id, meta); }catch(_){ v = null; }
        if(!Number.isInteger(v)) continue;
        out.push({id, transformId:id, tier:t.tier || 1, query, transformMeta:meta, transformedValue:v, displayValue:value, retainedSpec:true, weight:weightFor(rep, id)});
      }
    }
    if(!out.length){ stats.retainedRejected++; return null; }
    const total = out.reduce((s,c)=>s+c.weight,0);
    let r = (typeof eucaLegacyRandom === "function" ? eucaLegacyRandom() : Math.random()) * total;
    for(const c of out){ r -= c.weight; if(r <= 0){ stats.retainedBuilt++; return c; } }
    stats.retainedBuilt++;
    return out[out.length-1];
  }

  function installRetainedTransforms(){
    const previous = globalThis.l1RetainedTransformCandidates;
    if(typeof previous !== "function" || previous.__v8Retained) return !!previous?.__v8Retained;
    const wrapped = function l1RetainedTransformCandidatesV8(pair1, pair2, maxTier){
      const out = [];
      for(const {idx, p} of [{idx:1, p:pair1}, {idx:2, p:pair2}]){
        if(!p || p.hasRepresentationTransform) continue;
        for(const side of ["a","b"]){
          const value = Number(p[side]);
          const rep = side === "a" ? (p.repA || null) : (p.repB || null);
          if(!Number.isInteger(value) || !rep || rep === "digit") continue;
          let sel = null;
          if(LAYOUT_REPS.has(rep)){
            sel = selectRetainedTransform(rep, value, side === "a" ? p.stimSpecA : p.stimSpecB, maxTier);
          } else {
            try{ sel = selectL0TransformForSide(rep, value, maxTier); }catch(_){ sel = null; }
            if(sel) stats.valueOnly++;
          }
          if(!sel) continue;
          let weight = 1;
          try{ weight = representationTransformWeaknessWeight(rep, sel.transformId || sel.id); }catch(_){ }
          out.push({pairIndex:idx, side, rep, value, sel, weight});
        }
      }
      return out;
    };
    wrapped.__v8Retained = true;
    wrapped.__v8Original = previous;
    globalThis.l1RetainedTransformCandidates = wrapped;
    try{ l1RetainedTransformCandidates = wrapped; }catch(_){ }
    return true;
  }

  // ---- power-of-2 review note ------------------------------------------------------------
  function valuesInPlay(info){
    const out = [];
    const push = v => { const n = Number(v); if(Number.isFinite(n)) out.push(n); };
    if(!info) return out;
    push(info.a); push(info.b); push(info.displayA); push(info.displayB);
    for(const k of ["pair1","pair2","rawPair1","rawPair2","p1","p2"]){ const p = info[k]; if(p){ push(p.a); push(p.b); } }
    return out;
  }
  function textOf(info){
    const parts = [info?.question, info?.delayedPrompt, info?.relationQuestion];
    if(Array.isArray(info?.options)) for(const o of info.options) parts.push(typeof o === "string" ? o : (o?.text || o?.label || ""));
    return parts.filter(Boolean).join(" ");
  }
  function installPowerOfTwoNote(){
    const previous = globalThis.h35ReviewBuildModel;
    if(typeof previous !== "function" || previous.__v8Pow2) return !!previous?.__v8Pow2;
    const wrapped = function h35ReviewBuildModelV8Pow2(info){
      const model = previous.apply(this, arguments);
      try{
        const i = info || (typeof State !== "undefined" ? State.trialInfo : null);
        if(model && Array.isArray(model.reasons) && /powers? of 2|power-of-2/i.test(textOf(i)) && valuesInPlay(i).includes(1)){
          const note = "Remember: 1 counts as a power of 2, because 1 = 2⁰.";
          if(!model.reasons.includes(note)){ model.reasons = model.reasons.concat([note]); stats.powerNotes++; }
        }
      }catch(_){ }
      return model;
    };
    for(const key of Reflect.ownKeys(previous)){ if(["length","name","prototype","arguments","caller"].includes(String(key))) continue; try{ Object.defineProperty(wrapped, key, Object.getOwnPropertyDescriptor(previous, key)); }catch(_){ } }
    wrapped.__v8Pow2 = true;
    globalThis.h35ReviewBuildModel = wrapped;
    try{ h35ReviewBuildModel = wrapped; }catch(_){ }
    return true;
  }

  // ---- L2 dependency features aligned with their public labels ----------------------------
  // v6.6.18 narrowed the player-facing labels to "within-pair gap/difference" and
  // "same-named side readout (LEFT-with-LEFT or RIGHT-with-RIGHT)" but kept the older, broader
  // predicates, so L2 keys could contradict the wording (a cross-pair distance counted as a
  // within-pair gap; an opposite-side transfer counted as a same-named readout; doubling each
  // within-pair difference did not count). The predicates below follow the labels.
  const GAP_WITHIN_FAMILIES = new Set(["gap","gap_diff","registry_l1_gap"]);
  const GAP_WITHIN_IDS = new Set(["gap_from_higher_total","max_from_wider_gap","total_from_closer_pair","pair_with_smaller_max_then_gap",
    "gap1_plus_min2","gap2_plus_min1","double_each_gap_larger","gap_from_pair_with_exactly_one_even","gap_from_pair_spanning_center",
    "gap_from_pair_failing_branch_even_gt5_else_lte5","total_from_pair_with_diff_multiple3","proportion_imbalance","inverse_sum_gap",
    "inverse_transform_anchor","propagated_larger_gap","propagated_more_imbalanced","retained_gap_relation_match","retained_state_gap_change",
    "select_wider_gap_extract_larger","select_wider_gap_extract_closest10","select_wider_gap_extract_closest_center","select_wider_gap_extract_unique_prime",
    "select_narrower_gap_extract_smaller","select_narrower_gap_extract_closest_center","select_narrower_gap_extract_unique_even"]);
  const GAP_CROSS_IDS = new Set(["cross_role_gap_1","cross_role_gap_2","left_values_gap","right_values_gap","range_all","middle_gap",
    "crosspair_left_gap","crosspair_right_gap","crosspair_diag_gap","crosspair_anti_gap","crosspair_diag_anti_gap_max","crosspair_diag_anti_sum_gap",
    "max_diff","min_diff","sum_diff","pair_total_diff","mental_symmetric_distance","mental_step_recovery"]);
  const GAP_WITHIN_TEXT = /(within-pair (gap|difference)|differences? inside (each|the|that) pair|inside each pair|\bpair [12](?:'s)? gap\b|\btwo gaps\b|each pair's gap|\bits gap\b|that pair's (gap|difference|within-pair difference)|internal difference|pair-difference|double (its|each|both) (gap|difference)|\bthe gap is \d|wider gap|narrower gap|values farther apart|closer together)/i;
  const POSITION_IDS = new Set(["left_total","right_total","side_total_diff","larger_side_total","left_values_gap","right_values_gap",
    "left_total_distance_10","right_total_distance_10","crosspair_left_sum","crosspair_right_sum","crosspair_left_gap","crosspair_right_gap",
    "sum_even_left_side","count_even_left_side","side_changed_more_value_p2","side_approached_10_more_value_p2","side_approached_center_more_value_p2",
    "retained_state_direction_change","retained_state_side_changed_more","signed_net_change_direction","signed_net_change_distance",
    "vtx_p1_left_vs_p2_left","vtx_p1_right_vs_p2_right","vtx_p2_left_vs_p1_left","vtx_p2_right_vs_p1_right","bridge_larger_left_pair"]);
  function l1IdOf(obj){ try{ const op = typeof opFromL1Result === "function" ? opFromL1Result(obj) : obj?.op; return String(op?.id || obj?.opId || obj?.op?.id || ""); }catch(_){ return String(obj?.opId || obj?.op?.id || ""); } }
  function l1FamOf(obj){ try{ return String(typeof l1Family === "function" ? l1Family(obj) : (obj?.family || obj?.op?.family || "")); }catch(_){ return String(obj?.family || ""); } }
  function usesWithinPairGap(obj){
    const id = l1IdOf(obj), fam = l1FamOf(obj);
    if(GAP_CROSS_IDS.has(id)) return false;
    if(GAP_WITHIN_IDS.has(id) || GAP_WITHIN_FAMILIES.has(fam)) return true;
    return GAP_WITHIN_TEXT.test(String(obj?.question || ""));
  }
  function usesSameNamedSide(obj){
    const id = l1IdOf(obj);
    return POSITION_IDS.has(id) || /^same_side_as_p1_/.test(id);
  }
  function installDependencyFeatures(){
    let ok = true;
    const prevUses = globalThis.l1Uses;
    if(typeof prevUses === "function" && !prevUses.__v8Features){
      const wrapped = function l1UsesV8(obj, feature){
        if(feature === "gap") return usesWithinPairGap(obj);
        if(feature === "position") return usesSameNamedSide(obj);
        return prevUses.apply(this, arguments);
      };
      wrapped.__v8Features = true; wrapped.__v8Original = prevUses;
      globalThis.l1Uses = wrapped; try{ l1Uses = wrapped; }catch(_){ }
    } else ok = !!prevUses?.__v8Features;
    const prevGroup = globalThis.l1Group;
    if(typeof prevGroup === "function" && !prevGroup.__v8Features){
      const wrapped = function l1GroupV8(obj){
        const id = l1IdOf(obj), fam = l1FamOf(obj);
        if(id === "pair_total_diff") return "pair_compare";
        if(fam === "crosspair_same_role") return "position";
        return prevGroup.apply(this, arguments);
      };
      wrapped.__v8Features = true; wrapped.__v8Original = prevGroup;
      globalThis.l1Group = wrapped; try{ l1Group = wrapped; }catch(_){ }
    } else ok = ok && !!prevGroup?.__v8Features;
    return ok;
  }

  // ---- L2 question/option alignment ---------------------------------------------------------
  // At the full META² phase, buildL2BoundChoice (source-to-result bindings) and the generic
  // two-feature grid often return options about a different axis than the selected category,
  // while setupL2 still displays the category's own question ("Were both answers Fibonacci
  // numbers?" over options about which task produced the larger answer). Both conclusion styles
  // are kept; the displayed question is made to ask about what the options actually test.
  const L2_NEUTRAL_Q = "Which conclusion about the two previous META questions is fully correct?";
  const L2_TWO_PART_SUFFIX = " Pick the conclusion whose two parts are both true.";
  const L2_EXTRA_PRIMARY = {l2_sum_odd:"combined_parity", l2_lt:"winner", l2_gap_odd:"gap_parity"};
  function expectedL2Primary(cat){
    if(!cat) return null;
    if(L2_EXTRA_PRIMARY[cat.id]) return L2_EXTRA_PRIMARY[cat.id];
    try{ const f = primaryFeatureIdForL2Cat(cat); return f === "winner" && !["l2_gt","l2_lt"].includes(cat.id) ? null : f; }catch(_){ return null; }
  }
  function boundQuestion(featureId){
    return /closer10/.test(String(featureId || ""))
      ? "Which kind of previous META question produced the answer closer to 10?"
      : "Which kind of previous META question produced the larger answer?";
  }
  const l2AlignStats = {bound:0, neutral:0, suffixed:0};
  function installL2Alignment(){
    let ok = true;
    const prevBuild = globalThis.buildL2ConclusionChoice;
    if(typeof prevBuild === "function" && !prevBuild.__v8Align){
      const wrapped = function buildL2ConclusionChoiceV8(cat){
        const res = prevBuild.apply(this, arguments);
        try{
          if(res && !res.relationQuestion && typeof cat?.choiceBuilder !== "function"){
            if(res.secondaryFeature === "bound_relation"){ res.relationQuestion = boundQuestion(res.primaryFeature); res.v8L2Align = "bound"; l2AlignStats.bound++; }
            else if(res.primaryFeature && res.secondaryFeature){
              const want = expectedL2Primary(cat);
              if(want && res.primaryFeature === want){ res.v8L2Align = "matched_two_part"; }
              else { res.relationQuestion = L2_NEUTRAL_Q; res.v8L2Align = "neutral"; l2AlignStats.neutral++; }
            }
          }
        }catch(_){ }
        return res;
      };
      wrapped.__v8Align = true; wrapped.__v8Original = prevBuild;
      globalThis.buildL2ConclusionChoice = wrapped; try{ buildL2ConclusionChoice = wrapped; }catch(_){ }
    } else ok = !!prevBuild?.__v8Align;
    const prevSetup = globalThis.setupL2;
    if(typeof prevSetup === "function" && !prevSetup.__v8Align){
      const wrapped = function setupL2V8Align(){
        const l2 = prevSetup.apply(this, arguments);
        try{
          const two = l2 && l2.secondaryFeature && l2.secondaryFeature !== "bound_relation";
          const q = String(l2?.relationQuestion || "");
          if(two && q && q !== L2_NEUTRAL_Q && !q.endsWith(L2_TWO_PART_SUFFIX.trim()) && !/^Which kind of previous META question/.test(q)){
            l2.relationQuestion = q + L2_TWO_PART_SUFFIX; l2AlignStats.suffixed++;
          }
        }catch(_){ }
        return l2;
      };
      for(const key of Reflect.ownKeys(prevSetup)){ if(["length","name","prototype","arguments","caller"].includes(String(key))) continue; try{ Object.defineProperty(wrapped, key, Object.getOwnPropertyDescriptor(prevSetup, key)); }catch(_){ } }
      wrapped.__v8Align = true; wrapped.__v8Original = prevSetup;
      globalThis.setupL2 = wrapped; try{ setupL2 = wrapped; }catch(_){ }
    } else ok = ok && !!prevSetup?.__v8Align;
    return ok;
  }

  // ---- L2 feature presuppositions, categorical YES/NO results, readable task labels ----------
  // "the smaller answer (did not) divide ..." presupposes a unique, non-trivial smaller answer.
  // With a tie or a smaller answer of 0/1 the statement pair is degenerate (e.g. keyed
  // "did not divide" when the smaller answer is 1), so such features are not offered.
  const NEEDS_UNIQUE_SMALLER = new Set(["larger_double","strict_factor","exact_double","less_than_half","sum_divisible_by_smaller"]);
  function degenerateL2Feature(id, r1, r2){
    const a = Number(r1), b = Number(r2);
    if(!Number.isFinite(a) || !Number.isFinite(b)) return false;
    const lo = Math.min(a, b);
    if(NEEDS_UNIQUE_SMALLER.has(id) && (a === b || lo <= 0)) return true;
    if(id === "sum_divisible_by_smaller" && lo <= 1) return true;
    return false;
  }
  const L2_GROUP_LABELS = {crosspair_cross:"diagonal cross-pair", crosspair_cross_role:"cross-pair larger/smaller", crosspair_two_step:"two-cross-sum",
    pair_select_extract:"choose-a-pair-then-read", place_value:"place-value", ternary_triangle:"triangle-check", witness:"search-for-a-number",
    counterfactual:"what-if", coherence:"statement-check", memory_bridge:"memory bridge", program_card_l1:"program-card", balance_derive:"balance",
    signed_accumulation:"net-change", fair_share:"fair-share", inclusion_exclusion:"overlapping-groups", redistribution:"redistribution",
    constraint_satisfaction:"constraint", collective_uniqueness:"remainder-class", inverse_rule_probe:"hidden-rule", l0_question_comparison:"question-comparison",
    retained_rule_outlier_choice:"rule-outlier", retained_rule_next_value:"rule-continuation", product:"product"};
  function installL2Semantics(){
    let ok = true;
    const prevFeat = globalThis.l2ConclusionFeatureList;
    if(typeof prevFeat === "function" && !prevFeat.__v8Presup){
      const wrapped = function l2ConclusionFeatureListV8(cat, threshold, r1, r2){
        const list = prevFeat.apply(this, arguments);
        return Array.isArray(list) ? list.filter(f => !degenerateL2Feature(f?.id, r1, r2)) : list;
      };
      wrapped.__v8Presup = true; wrapped.__v8Original = prevFeat;
      globalThis.l2ConclusionFeatureList = wrapped; try{ l2ConclusionFeatureList = wrapped; }catch(_){ }
    } else ok = !!prevFeat?.__v8Presup;
    const prevCat = globalThis.l1ResultIsCategorical;
    if(typeof prevCat === "function" && !prevCat.__v8Bool){
      const wrapped = function l1ResultIsCategoricalV8(obj){
        if(obj && (obj.answerKind === "bool" || obj.responseFormat === "bool" || obj.responseFormat === "yesno")) return true;
        return prevCat.apply(this, arguments);
      };
      wrapped.__v8Bool = true; wrapped.__v8Original = prevCat;
      globalThis.l1ResultIsCategorical = wrapped; try{ l1ResultIsCategorical = wrapped; }catch(_){ }
    } else ok = ok && !!prevCat?.__v8Bool;
    const prevLabel = globalThis.l2OpGroupUserLabel;
    if(typeof prevLabel === "function" && !prevLabel.__v8Labels){
      const wrapped = function l2OpGroupUserLabelV8(group){
        const g = String(group || "");
        if(L2_GROUP_LABELS[g]) return L2_GROUP_LABELS[g];
        if(/^place_value/.test(g)) return "place-value";
        return prevLabel.apply(this, arguments);
      };
      wrapped.__v8Labels = true; wrapped.__v8Original = prevLabel;
      globalThis.l2OpGroupUserLabel = wrapped; try{ l2OpGroupUserLabel = wrapped; }catch(_){ }
    } else ok = ok && !!prevLabel?.__v8Labels;
    const prevGroupLabel = globalThis.groupLabel;
    if(typeof prevGroupLabel === "function" && !prevGroupLabel.__v8Labels){
      const wrapped = function groupLabelV8(group){
        const g = String(group || "");
        if(L2_GROUP_LABELS[g]) return L2_GROUP_LABELS[g] + " task";
        if(/^place_value/.test(g)) return "place-value task";
        return prevGroupLabel.apply(this, arguments);
      };
      wrapped.__v8Labels = true; wrapped.__v8Original = prevGroupLabel;
      globalThis.groupLabel = wrapped; try{ groupLabel = wrapped; }catch(_){ }
    } else ok = ok && !!prevGroupLabel?.__v8Labels;
    return ok;
  }

  const reinstall = () => { installRetainedTransforms(); installPowerOfTwoNote(); installDependencyFeatures(); installL2Alignment(); installL2Semantics(); };
  reinstall();
  try{ queueMicrotask(reinstall); setTimeout(reinstall, 0); setTimeout(reinstall, 300); window.addEventListener("pageshow", reinstall, {passive:true}); }catch(_){ }

  // Audit: every retained-spec transform must reproduce the value the transform table computes
  // on the SAME layout, and must never be computed without a spec.
  function audit(){
    const blockers = [], samples = [];
    const reps = ["grid","coins","domino","cluster","dice","cube","card"];
    let checked = 0;
    for(const rep of reps){
      for(let v = 1; v <= 12; v++){
        let stim = null;
        try{ if(typeof hardAllowedReps === "function" && !hardAllowedReps(v).includes(rep)) continue; stim = makeStim(v, rep, {seed:v*131+rep.length}); }catch(_){ continue; }
        const spec = typeof extractStimReplaySpec === "function" ? extractStimReplaySpec(rep, stim) : null;
        if(!spec) continue;
        const meta = retainedMeta(rep, v, cloneStimReplaySpec(rep, spec));
        if(!meta){ blockers.push(`${rep}:${v}: retained spec rejected`); continue; }
        const sel = selectRetainedTransform(rep, v, cloneStimReplaySpec(rep, spec), 3);
        if(!sel) continue;
        checked++;
        const again = applyRepresentationTransform(rep, v, sel.transformId, sel.transformMeta);
        if(again !== sel.transformedValue) blockers.push(`${rep}:${v}:${sel.transformId}: ${again} != ${sel.transformedValue}`);
        if(samples.length < 12) samples.push({rep, v, id:sel.transformId, out:sel.transformedValue});
      }
    }
    if(selectRetainedTransform("grid", 4, null, 3) !== null) blockers.push("transform built without a spec");
    // Dependency features follow their labels on representative ops.
    const fake = (id, family, question="") => ({op:{id, family}, opId:id, family, question});
    const expectGap = [["double_each_gap_larger","transformation",true],["cross_role_gap_1","cross_role_gap",false],["left_values_gap","position_gap",false],["gap_sum","gap",true],["range_all","global_order",false]];
    for(const [id,fam,want] of expectGap) if(usesWithinPairGap(fake(id,fam)) !== want) blockers.push(`gap feature ${id} != ${want}`);
    const expectPos = [["opposite_side_from_p1_min","role_transfer",false],["crosspair_left_sum","crosspair_same_role",true],["same_side_as_p1_max","role_transfer",true],["pair_total_diff","position",false],["abacus_p1_left_lower_p2_right_upper","structured_state_composition",false]];
    for(const [id,fam,want] of expectPos) if(usesSameNamedSide(fake(id,fam)) !== want) blockers.push(`position feature ${id} != ${want}`);
    const installed = {retained:globalThis.l1RetainedTransformCandidates?.__v8Retained === true, pow2:globalThis.h35ReviewBuildModel?.__v8Pow2 === true, features:globalThis.l1Uses?.__v8Features === true && globalThis.l1Group?.__v8Features === true};
    if(!installed.features) blockers.push("dependency feature hooks not installed");
    installed.l2Align = globalThis.buildL2ConclusionChoice?.__v8Align === true && globalThis.setupL2?.__v8Align === true;
    if(!installed.l2Align) blockers.push("L2 alignment hooks not installed");
    if(boundQuestion("op_group_closer10_bind").indexOf("closer to 10") < 0) blockers.push("bound question mapping");
    installed.l2Semantics = globalThis.l2ConclusionFeatureList?.__v8Presup === true && globalThis.l1ResultIsCategorical?.__v8Bool === true && globalThis.groupLabel?.__v8Labels === true;
    if(!installed.l2Semantics) blockers.push("L2 semantic hooks not installed");
    if(!degenerateL2Feature("sum_divisible_by_smaller", 3, 1) || degenerateL2Feature("sum_divisible_by_smaller", 6, 3) || !degenerateL2Feature("strict_factor", 4, 4)) blockers.push("presupposition filter");
    try{ if(!l1ResultIsCategorical({answer:1, responseFormat:"bool", answerKind:"bool"})) blockers.push("bool L1 not categorical"); }catch(e){ blockers.push("categorical check threw"); }
    if(!installed.retained) blockers.push("retained transform hook not installed");
    if(!installed.pow2) blockers.push("power-of-2 note hook not installed");
    return {patch:PATCH_ID, status:blockers.length ? "BLOCK" : "PASS", blockers, checked, samples, installed, stats:{...stats}};
  }

  globalThis.EUCALCULIA_V8_CORRECTNESS = Object.freeze({patch:PATCH_ID, retainedMeta, selectRetainedTransform, usesWithinPairGap, usesSameNamedSide, audit, stats:() => ({...stats, l2Align:{...l2AlignStats}})});
})();
/* V8.0 CORRECTNESS LAYER:END */
