# Predicting Crop Yield in Rwanda

Machine learning on Rwanda's Seasonal Agriculture Survey (Season A, 2021/22). For maize, bush bean and cassava, the model estimates how far a plot's yield is above or below the **typical plot of the same crop**, and shows which factors are linked to better or worse plots.

**Team:** Charles, Tsungirirai, Mugisha | **Mentor:** Stephen

**Live demo:** https://tmachingur-code.github.io/predicting-crop-yield-rwanda/

## The problem

Yields differ a lot between plots, even for the same crop. Extension officers, cooperatives and agricultural planners need to know where plots are likely to fall short, and which conditions go with that, so limited support can be targeted. Existing survey data answers this only at an aggregate level.

## Approach

- **Target (y), relative yield:** `log(yield in kg/ha) - median log(yield) of the same crop`. A value of 0 is a typical plot, and `exp(y)` is the ratio to typical (1.25 means 25% above typical). Predicting raw yield would mostly reward the model for knowing the crop: crop type alone gave R² = 0.75, but within a single crop the first models explained almost nothing.
- **Features (X):** crop, province, district and land type, farmer type, gender and age, plot size, fertilizer and pesticide use and fertilizer quantity, soil erosion degree, anti-erosion work, land consolidation, irrigation, seed type and cost, planting period, hired labour and mechanisation. Nothing calculated from the harvest is used.
- **Leakage control:** crop medians and outlier caps come from training data only. Cross-validation folds are grouped by survey segment, so plots from the same area never appear in both training and test. Final scores come from 20% of segments never used for tuning.
- **Methods compared:** a median guess (predict that every plot is typical), ridge regression, random forest and gradient boosting.

## Results

Test scores per crop, 5-fold cross-validation grouped by survey segment. R² is measured on relative yield; error is the average absolute error in kg/ha.

| Crop | Median guess (R² / error) | Ridge | Random forest | **Gradient boosting (simple)** |
|---|---|---|---|---|
| Maize | -0.01 / 857 | 0.18 / 767 | 0.20 / 757 | **0.21 / 753** |
| Bush bean | 0.00 / 283 | 0.03 / 266 | 0.11 / 266 | **0.13 / 260** |
| Cassava | -0.01 / 5,433 | 0.23 / 4,403 | 0.14 / 4,760 | **0.23 / 4,353** |

- **Simple gradient boosting is the best of a similar group**, not a clear winner (ridge ties it on cassava). A flexible setting overfits, for example maize train R² 0.60 against test 0.18.
- **Tuning did not help.** On held-out segments the untuned and tuned simple models score within about 0.01 of each other, so we keep the simple setting (held-out R²: maize 0.23, bush bean 0.16, cassava 0.27).
- **Classification backup** (above or below the crop's median): accuracy 66% for maize, 64% for bush bean and 72% for cassava, against 51%, 47% and 46% for always guessing the common class.
- **What drives the models:** district is the largest factor for all three crops, by far for cassava and bush bean. For maize, fertilizer per hectare, plot size and seed cost come next. Soil erosion shows a clear trend in the EDA but matters little in the model. These are associations, not causes.

Overall the survey explains some of the difference between plots of the same crop, not most of it. Weather and management are not in the data.

## Demo

**Live website:** https://tmachingur-code.github.io/predicting-crop-yield-rwanda/

A one-page site that explains the project and lets you try the model. Choose a crop, district, land type, plot size, erosion degree, fertilizer, pesticide, irrigation, seed type and hired labour, and it returns the expected yield and its ratio to the typical plot of that crop. It runs entirely in the browser (the trained model is exported to JavaScript), so there is nothing to install and no server.

The notebook also contains the same demo as a Gradio app for Colab (Step 13), and Step 14 adds two district views: which districts sit above or below typical, and the model's expected yield for a typical plot in each district.

## Data

NISR Seasonal Agriculture Survey, Season A 2021/22. The raw files are **not included** in this repository. Download the three zip files below, or from the NISR microdata portal (registration required), and see [`data/README.md`](data/README.md).

| Table | Link |
|---|---|
| Crop production | https://data.gov.rw/datasets/6bedf210-9ba1-4519-a9e6-78b56b28f1c2 |
| Fertilizers & pesticides | https://data.gov.rw/datasets/22d2c879-f825-4a2c-94ad-a43cd5d182d7 |
| Agricultural practice | https://data.gov.rw/datasets/f90119dc-ead8-49d7-9550-0e2c26a1363f |

The tables link on `segment_id`, farmer (`s1q6`) and plot number (`s2q1`). The fertilizer table has one row per product, so it is collapsed to one row per plot before merging (99.6% of crop rows matched, no duplicated rows). After cleaning, 34,894 plot-crop rows across 16 crops remain.

## Repository structure

```
notebooks/   main notebook: load, merge, clean, EDA, model comparison, tuning, importance, demo, district views
docs/        demo website served by GitHub Pages (index.html, css/, js/) and the project documentation
data/        place the downloaded zip files here (not committed)
README
.gitignore
requirements.txt
```

## How to run

**Google Colab (recommended):**
1. Upload the zip files to a Google Drive folder.
2. Open `notebooks/Predicting_Crop_Yield_Rwanda_Final_with_Demo.ipynb` in Colab and set the folder name in Step 2.
3. Run all cells (about 5 minutes). The last cells print a public demo link that works while the session is running.

**Locally:** `pip install -r requirements.txt`, put the zips in `data/`, and run the notebook with Jupyter. The notebook reads each zip's README to find the survey year and table, so file names do not matter.

## Limitations

- Season A, 2021/22 only. 2020/21 and 2023/24 are not harmonised (different crop codes, text labels, and no yield column in 2023/24), so there is no year-to-year test and **no forecast of future years**. The model describes a normal season like 2021/22.
- Results are associations, not proof of cause. District probably stands in for climate, soil and market access.
- Extreme yields are capped at the 99th percentile within each crop. Seed cost assumes a blank means no purchase.
- Farmer gender and age are controls only. Recommendations should rest on practices and districts.

## Updating the website model

The website uses the trained models exported to `docs/js/model.js` (generated, do not edit by hand). If the model or features change, re-export the models and replace that file, otherwise the website will keep showing the old model.

## Future work

Harmonise 2020/21 for a year-to-year test, add rainfall and temperature by district, extend to more crops and seasons, and explain predictions with SHAP.

## Acknowledgements

Data: National Institute of Statistics of Rwanda (NISR). Thanks to Stephen for mentorship. Survey data is subject to the portal's terms and must not be redistributed.
