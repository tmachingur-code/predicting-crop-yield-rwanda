# Problems found and how to fix them

Review of `main` at commit `60d8747`. It is based on the committed notebook code and its saved outputs, compared with the Week 3 project documentation. The notebook was **not re-run** during the review.

## Summary

| # | Problem | Impact | Effort | Status |
|---|---|---|---|---|
| 1 | Notebook only runs on Colab | High | Low | Fixed in this PR |
| 2 | Flexible model overfits | High | Low | To do |
| 3 | Decision rule uses the best of four variants | High | Low | To do |
| 4 | Single-crop subsets are tiny | Medium | Low | To do |
| 5 | Classification backup has no saved output | Medium | Low | To do |
| 6 | Planned work missing (year test, screening table, features) | High | High | To do |
| 7 | Plot size and area may create a spurious signal | Medium | Low | To check |
| 8 | Missing and zero yields dropped without a pattern check | Medium | Low | To check |
| 9 | Irrigation blank in about 92% of rows | Medium | Low | To check |
| 10 | Feature-importance analysis is thin | Medium | Medium | To do |
| 11 | All warnings are hidden | Low | Low | To do |
| 12 | EDA caps use all rows | Low | Low | To label |
| 13 | Survey weights unused | Low | Medium | Decide |
| 14 | Code lives only in a notebook, no tests, no licence | Medium | Medium | To do |

## 1. Notebook only runs on Colab (fixed in this PR)

**Evidence:** `drive.mount(...)` and the hardcoded path `/content/drive/MyDrive/rwanda_sas_zips`. Nobody else can re-run it.

**Fix (done):** cell 5 now uses Colab when available and otherwise reads `../data/raw` or the folder in the `CROP_DATA_DIR` environment variable. `requirements.txt`, `.gitignore` and a README with setup steps were added.

**Next:** move the merge and cleaning code into small functions in a `src/` folder (see #14).

## 2. The flexible model overfits

**Evidence:**

| Crop | Flexible test R2 | Flexible train R2 | Simple test R2 |
|---|---|---|---|
| Maize | 0.133 | 0.509 | 0.170 |
| Bush bean | 0.054 | 0.513 | 0.102 |
| Cassava | 0.113 | 0.792 | 0.230 |

The pooled model also uses the flexible setting (test 0.145, train 0.293).

**Best fix:**
1. Make the simple setting the reference model and always show train and test R2 side by side.
2. Regularise the boosting model: `max_depth` 3 to 4, `min_samples_leaf` of 50 or more, a positive `l2_regularization`, a lower `learning_rate`, and early stopping.
3. Tune with a small grid inside the training folds (nested grouped CV). Do not tune on the test folds.
4. Add the Ridge baseline the project documentation promises, so there is a floor to beat.

## 3. The decision rule uses the best of four variants

**Evidence:** `best = quick.groupby("crop")["test_R2"].max()` takes the highest test R2 over four configurations (all plots or single-crop, simple or flexible). Picking the maximum after seeing the test scores is optimistic.

**Best fix:**
1. Fix one configuration per crop before looking at results (for example simple model, all plots) and base the verdict on that one.
2. Report the other variants as sensitivity checks.
3. Return the R2 of each fold from `run_cv` and report mean and spread, or repeat the CV with different random assignments of segments to folds. Note that scikit-learn 1.5 `GroupKFold` is not shuffled, so assign segments to folds yourself or use repeated `GroupShuffleSplit`.
4. Report a bootstrap interval resampled by segment.

## 4. Single-crop subsets are tiny

**Evidence:** 791 maize, 312 bush bean and 461 cassava rows. Bush bean on single-crop plots gives R2 of -0.033 (simple) and -0.232 (flexible). Only about 13% of crop rows are on single-crop plots.

**Best fix:**
- Treat these runs as a sensitivity check, not as evidence for or against the approach.
- `n_crops_on_plot` is already computed but is not in `FEATURES`. Test adding it. It describes the plot layout, not the harvest, so it does not leak.

## 5. The classification backup has no saved output

**Evidence:** the classification cell (Step 10) has no saved output, so there is no F1 or baseline number. The code also does not compute the confusion matrix the project documentation asks for.

**Best fix:** re-run it, save the outputs, and add `confusion_matrix`. The labels are split at the crop median, so the classes are close to 50/50 and the majority-class baseline is about 0.5. Compare the model with that baseline and report F1 per crop.

## 6. Planned work that is not in the notebook yet

| Item in the project documentation | Where it stands |
|---|---|
| Train on 2020/21, test on 2021/22 | Only 2021/22 is loaded |
| Anti-erosion screening table (measure types, cost) | Not loaded; the 2021/22 screening zip is not among the three zips |
| Seed, labour, planting-timing features | Not in `FEATURES` |
| One pooled model vs one model per crop | Only the pooled flexible model |
| Linear baseline | Missing |

**Best way to do the year-to-year test:**
1. Download the four 2020/21 tables.
2. Harmonise column names with the metadata files.
3. Map the 2020/21 crop codes (such as 101 and 305) to the 1 to 17 codes used in 2021/22.
4. Recompute yield as quantity divided by area and check that it matches the 2021/22 definition.
5. Fit on 2020/21 with `make_target(train, test)` so medians and caps come from 2020/21 only, then score on 2021/22.
6. Say clearly that part of any drop in score comes from weather and conditions differing between years.

## 7. Plot size and area may create a spurious signal

**Evidence:** yield is harvested quantity divided by harvested area, and `s2q2` (plot size) is a feature. Measurement error in area appears in the denominator of the target and can create a correlation with plot size that has nothing to do with farming. The project documentation also says to check area and units for implausible yields before capping, but the notebook only caps at the 99th percentile.

**Best fix:** check `harv_area` against `s2q2`, look at rows with tiny areas or implausible yields, and compare the model with and without `s2q2`. If the score barely changes, drop it.

## 8. Missing and zero yields are dropped without a pattern check

**Evidence:** 4,381 rows (about 10.5%) have a missing yield and 1,319 (about 3.2%) have a zero yield.

**Best fix:** count both by crop, province and district. Perennials such as bananas may simply not have been harvested in the season, and genuine crop failures are informative. Report the counts in the README and consider a separate crop-failure analysis (zero or not).

## 9. Irrigation is blank in about 92% of rows

**Evidence:** the missing-value table shows `irrigated` at 0.917. This is probably skip logic.

**Best fix:** confirm the skip rule in the survey metadata. If blank means the question was not asked because the plot is not irrigated, encode it as "no" or as its own level. Then re-check whether irrigation ranks differently.

## 10. Feature importance is thin

**Evidence:** one random 75/25 segment split, five permutation repeats, maize only.

**Best fix:**
1. Average permutation importance over the grouped CV folds.
2. Permute related features together (location, fertilizer and pesticide, erosion and anti-erosion), because correlated features split the credit.
3. Add SHAP (install `shap`) once the model is settled, and do it per crop.
4. Report only for crops where the model clearly beats the median baseline, as the project documentation says.

## 11. All warnings are hidden

**Evidence:** `warnings.filterwarnings("ignore")` in the imports cell.

**Best fix:** remove it, or silence only specific known messages, so real problems (such as pandas deprecations) stay visible.

## 12. EDA caps use all rows

**Evidence:** `caps_all` is computed on the full data for the EDA charts. That is fine for plots, but it differs from the fold-safe caps used in modelling.

**Best fix:** add a comment that it is for EDA only and must never feed a model.

## 13. Survey weights are unused

**Best fix:** use weights for descriptive statistics and test `sample_weight` in the fit as a sensitivity check, then record the decision in the README.

## 14. Code lives only in a notebook

**Best fix:**
- Move merging, cleaning and `make_target` into `src/` and call them from the notebook.
- Add a small test that changing the test rows does not change the crop medians or caps, since that is the no-leakage property the project depends on.
- Add a `LICENSE` (the team should choose which).
- Optionally add a simple CI check that installs `requirements.txt` and imports the code.

## Suggested order

1. Finish #1 (done), then fix #2 and #3, because they decide how much anyone can trust the headline scores.
2. Check #7, #8 and #9 before adding more features.
3. Do #6 (year-to-year test and screening table), the biggest remaining piece of the plan.
4. Re-run and save #5, then #10 for the explanations.
5. Tidy #11 to #14 as time allows.
