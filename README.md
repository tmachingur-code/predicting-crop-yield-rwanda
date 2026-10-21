# Predicting Crop Yield in Rwanda

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/tmachingur-code/predicting-crop-yield-rwanda/blob/main/notebooks/Predicting_Crop_Yield_Rwanda.ipynb)

A machine learning project that predicts how well a plot will do compared with a typical plot of the **same crop** in Rwanda's Season A. It uses plot-level microdata from the National Institute of Statistics of Rwanda (NISR) Seasonal Agriculture Survey.

> **Status: work in progress (Week 3 draft).** Data merging, cleaning, EDA and the "quick check" are done for 2021/22. The year-to-year test, the anti-erosion screening table and SHAP are still to do (see [Roadmap](#roadmap)). Known issues and recommended fixes are in [docs/PROBLEMS_AND_FIXES.md](docs/PROBLEMS_AND_FIXES.md).

## Why this project

Rwandan farmers work small plots, often on hillsides, and yields differ a lot between plots, even for the same crop. Extension officers, cooperatives and planners have to decide where to put limited support (fertilizer, irrigation, soil conservation, land consolidation) with little plot-level evidence.

The question: *given the crop, location, soil erosion level, inputs and practices, how far above or below a typical plot of the same crop should we expect this plot's yield to be, and which factors are most linked to it?*

## Target: relative yield

Crops differ enormously in yield, so predicting raw yield mostly rewards the model for knowing the crop. Instead we predict **relative yield**:

```
log_yield        = ln(harvested quantity / harvested area)        # kg/ha
crop_median      = median log_yield of the crop (training rows only)
relative_yield   = log_yield - crop_median                        # 0 = typical plot
ratio to typical = exp(relative_yield)                            # 1.25 = 25% above typical
predicted kg/ha  = crop median yield * exp(predicted relative_yield)
```

Crop medians and the 99th-percentile caps are computed from the training rows only, inside every cross-validation fold, so test rows never leak into the target.

## Data

Season A microdata from NISR, 2021/22 (the only year loaded so far):

| Table | Link |
|---|---|
| Crop production | https://data.gov.rw/datasets/6bedf210-9ba1-4519-a9e6-78b56b28f1c2 |
| Fertilizers & pesticides | https://data.gov.rw/datasets/22d2c879-f825-4a2c-94ad-a43cd5d182d7 |
| Agricultural practice | https://data.gov.rw/datasets/f90119dc-ead8-49d7-9550-0e2c26a1363f |

Portals: https://data.gov.rw/ and https://www.microdata.statistics.gov.rw (downloading from the microdata portal requires registering).

**The raw data is not stored in this repository.** Download the three zip files and place them, unmodified, in `data/raw/`:

```
data/raw/Season_A__Agricultural_Practice.zip
data/raw/Season_A__Crop_production.zip
data/raw/Season_A__Fertilizers___Pesticides.zip
```

A plot is identified by `segment_id`, `s1q6` (farmer) and `s2q1` (plot number). The fertilizer table has one row per product, so it is aggregated to plot level before merging. After merging, the row count matches the crop table.

## Method (what the notebook does)

1. Load and merge the three 2021/22 tables into one crop-on-plot table.
2. Clean: drop rows with missing or zero yield, keep crops with at least 300 rows, cap yield at the 99th percentile within each crop, work on the log scale.
3. Build features: crop, location, farmer, plot size, organic / inorganic fertilizer, pesticide, erosion degree, anti-erosion, land consolidation, irrigation.
4. EDA: distributions, missing values, relative yield by erosion degree.
5. Quick check per main crop (maize, bush bean, cassava) with gradient boosting (a "simple" and a "flexible" setting), compared with a "dumb guess" that always predicts the crop median. All scores use 5-fold cross-validation **grouped by survey segment**, so plots from the same area never appear on both sides.
6. Pooled model for all main crops with per-crop scores.
7. Classification backup (above or below the crop median).
8. Permutation importance for the maize model.

## Results so far (2021/22)

Cleaning: 41,589 crop rows, 4,381 with missing yield and 1,319 with zero yield removed, leaving **34,894 rows across 16 crops**.

Test R2 is measured on relative yield, so 0 means "no better than guessing the crop median".

| Crop | Rows | Simple model (test / train R2) | Flexible model (test / train R2) | MAE kg/ha: simple vs median guess |
|---|---|---|---|---|
| Maize | 7,319 | 0.170 / 0.242 | 0.133 / 0.509 | 778 vs 857 |
| Bush bean | 5,533 | 0.102 / 0.184 | 0.054 / 0.513 | 265 vs 283 |
| Cassava | 1,828 | 0.230 / 0.327 | 0.113 / 0.792 | 4,357 vs 5,433 |

- Pooled model (all main crops, flexible): test R2 **0.145**, train R2 0.293.
- Pooled per-crop test R2 (largest crops): maize 0.177, cooking banana 0.171, Irish potato 0.326, cassava 0.154, climbing bean 0.120, bush bean 0.084, banana for beer 0.038, dessert banana 0.018.
- Erosion: median relative yield rises as erosion gets less severe. Maize goes from -0.193 (severe) to +0.056 (very low); bush bean from -0.210 to +0.038; cassava is nearly flat.
- Against the rule of thumb in the project documentation, maize and cassava reach about 0.2 or higher ("continue with yield") and bush bean is in between ("refine, then decide").

How to read this: the survey explains a small but real share of within-crop differences. The flexible model overfits (train R2 far above test R2), and the simple model generalises better. The factor rankings are associations, not causes. The numbers above are copied from the saved notebook outputs.

## Reproduce

**Local (Windows PowerShell):**

```powershell
git clone https://github.com/tmachingur-code/predicting-crop-yield-rwanda.git
cd predicting-crop-yield-rwanda
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
# put the three zips in data\raw, then:
cd notebooks
jupyter lab Predicting_Crop_Yield_Rwanda.ipynb
```

To keep the zips elsewhere, set `CROP_DATA_DIR` to that folder before starting Jupyter.

**Google Colab:** click the badge above and put the three zips in `My Drive/rwanda_sas_zips`.

## Repository layout

```
notebooks/Predicting_Crop_Yield_Rwanda.ipynb   main analysis
docs/PROBLEMS_AND_FIXES.md                     issues found in review and how to fix them
data/raw/                                      put the NISR zip files here (not committed)
requirements.txt                               Python dependencies
```

## Limitations

- Season A only. Findings do not cover seasons B and C.
- These are associations: irrigated or consolidated plots may simply be in better regions.
- Yield also depends on weather, soil and management that the survey does not capture.
- Only about 13% of crop rows are on single-crop plots, because fertilizer and erosion are recorded per plot, so every crop on a plot gets the same values.
- Irrigation is blank for about 92% of rows. Blanks are treated as missing, and the skip logic still needs confirming.
- Zero yields are dropped (the log of zero is undefined), although some may be genuine crop failures.

## Roadmap

- [x] Merge the 2021/22 crop, fertilizer and practice tables
- [x] Cleaning and relative-yield target with fold-safe medians and caps
- [x] EDA and quick check on maize, bush bean and cassava
- [x] Pooled model with per-crop scores
- [ ] Year-to-year test: train on 2020/21, test on 2021/22
- [ ] Load the anti-erosion screening table (measure types, cost)
- [ ] Add seed, labour and planting-timing features
- [ ] Compare one pooled model with one model per crop, plus a linear baseline
- [ ] Save and report classification-backup results
- [ ] SHAP explanations and plain-language recommendations
- [ ] Add 2023/24 once its coding is harmonised
- [ ] Decide whether to use survey weights

## Team

Charles, Tsungirirai and Mugisha, guided by Stephen.
