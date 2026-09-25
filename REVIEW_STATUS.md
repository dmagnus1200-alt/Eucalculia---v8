# L0 audit status

- `l0_samples.txt`: raw forced-category samples (4,712 lines; `NOT_SERVED` rows list categories that could not be built at level 20 / max 12).
- `l0_review.txt`: de-duplicated review set (2,267 lines). Hand-verified lines 1–1,679. Continue from line 1,680.
- Confirmed error: `sum_multiple_5` wording "Does the total cross to the next decade exactly?" (Eucalculia_experimental.html line ≈ 22495) contradicts the `%5` predicate.
- Perceived-error risk: 1 counted as a power of 2 (2⁰) in power-of-2 set items.
- Multi-select `rel_eq_*` rows in these files lack the answer key (a harness bug, since fixed in `harness/sample_all.js`); re-run to verify them.
