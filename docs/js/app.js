/* Rwanda crop yield demo: page logic.
 *
 * 1. Lookup tables        choices shown in the form and their survey codes
 * 2. Model evaluation     runs the trained trees in MODEL (see model.js)
 * 3. Predicting one plot  turns form answers into a prediction
 * 4. The page             builds the form and shows the result
 */

/* ---------- 1. Lookup tables ---------- */

const DISTRICTS = {
  11: "Nyarugenge", 12: "Gasabo", 13: "Kicukiro",
  21: "Nyanza", 22: "Gisagara", 23: "Nyaruguru", 24: "Huye", 25: "Nyamagabe", 26: "Ruhango",
  27: "Muhanga", 28: "Kamonyi",
  31: "Karongi", 32: "Rutsiro", 33: "Rubavu", 34: "Nyabihu", 35: "Ngororero", 36: "Rusizi",
  37: "Nyamasheke",
  41: "Rulindo", 42: "Gakenke", 43: "Musanze", 44: "Burera", 45: "Gicumbi",
  51: "Rwamagana", 52: "Nyagatare", 53: "Gatsibo", 54: "Kayonza", 55: "Kirehe", 56: "Ngoma",
  57: "Bugesera",
};

const CROP_CODES = { "Maize": 1, "Bush bean": 10, "Cassava": 9 };
const LAND_TYPES = { "Hillside cropland": 10, "Marshland cropland": 20, "Rangelands": 30, "Mixed": 40 };
const EROSION_LEVELS = {
  "Severe (rill, gully, landslides)": 1,
  "Moderate": 2,
  "Low": 3,
  "Very low (splash only)": 4,
};
const SEED_TYPES = { "Traditional": 1, "Improved": 2, "Both": 3 };

const MIN_PLOTS_FOR_DISTRICT = 30;   // below this we warn that the district effect is based on little data

/* ---------- 2. Model evaluation ---------- */

/** True if the category `value` is in a categorical split's "go left" set (a 256-bit set). */
function categoryGoesLeft(bitset, value) {
  if (value < 0 || value >= 256) return false;
  return ((bitset[value >> 5] >>> (value & 31)) & 1) === 1;
}

/** Follows one tree from the root to a leaf and returns the leaf value. */
function predictTree(tree, features) {
  let index = 0;
  while (true) {
    const [feature, threshold, left, right, value, isLeaf, missingGoesLeft, isCategorical, bitsetIndex] =
      tree.nodes[index];
    if (isLeaf) return value;

    const x = features[feature];
    let goLeft;
    if (Number.isNaN(x)) goLeft = missingGoesLeft === 1;
    else if (isCategorical) goLeft = categoryGoesLeft(tree.bitsets[bitsetIndex], x);
    else goLeft = x <= threshold;

    index = goLeft ? left : right;
  }
}

/** Gradient boosting: the baseline plus the sum of all tree outputs (a log ratio to the typical plot). */
function predictLogRatio(model, features) {
  return model.trees.reduce((sum, tree) => sum + predictTree(tree, features), model.baseline);
}

/**
 * Puts the feature values in the order the model was trained on: categorical columns first,
 * each replaced by its position in the list of categories seen in training (unknown becomes NaN).
 */
function encodeFeatures(model, valuesByName) {
  const original = MODEL.featureNames.map((name) => valuesByName[name]);
  return model.columnOrder.map((column, position) => {
    if (position >= model.categoricalCount) return original[column];
    const code = model.categories[position].indexOf(original[column]);
    return code < 0 ? NaN : code;
  });
}

/* ---------- 3. Predicting one plot ---------- */

/** Predicts yield for one plot. `plot` holds the form answers (see readForm). */
function predictPlot(plot) {
  const districtCode = Number(Object.keys(DISTRICTS).find((code) => DISTRICTS[code] === plot.district));
  const plotSize = Math.max(plot.plotSize || 0, 50);            // square metres
  const plotHectares = plotSize / 10000;
  const fertilizerKg = Math.max(plot.fertilizerKg || 0, 0);
  const labourRwf = Math.max(plot.labourRwf || 0, 0);

  // Start from the typical plot of this crop, then overwrite what the user told us.
  const values = {
    ...MODEL.typicalValues[plot.crop],
    s1q1: Math.floor(districtCode / 10),                        // province = first digit of district code
    s1q2: districtCode,
    s1q3: LAND_TYPES[plot.landType],
    s2q2: plotSize,
    erosion: EROSION_LEVELS[plot.erosion],
    inorganic: fertilizerKg > 0 ? 1 : 0,
    n_inorg_products: fertilizerKg > 0 ? 1 : 0,                  // we assume one product if any is used
    fert_kg_ha: Math.log1p(fertilizerKg / plotHectares),
    pesticide: plot.pesticide ? 1 : 0,
    irrigated: plot.irrigated ? 1 : 0,
    seed_type: SEED_TYPES[plot.seedType],
    labour_ha: Math.log1p(labourRwf / plotHectares),
  };

  const model = MODEL.models[plot.crop];
  const ratio = Math.exp(predictLogRatio(model, encodeFeatures(model, values)));
  const typicalYield = MODEL.medianYield[plot.crop];

  return {
    ratio,                                                      // 1.0 = typical plot of this crop
    expectedYield: ratio * typicalYield,                        // kg/ha
    typicalYield,
    typicalError: MODEL.typicalError[plot.crop],
    plotsInDistrict: MODEL.plotCounts[`${CROP_CODES[plot.crop]}_${districtCode}`] || 0,
  };
}

/* ---------- 4. The page ---------- */

const formatNumber = (n) => Math.round(n).toLocaleString("en-US");

function selectField(id, label, options, selected) {
  const items = options.map((o) => `<option${o === selected ? " selected" : ""}>${o}</option>`).join("");
  return `<label>${label}<select id="${id}">${items}</select></label>`;
}

function numberField(id, label, value) {
  return `<label>${label}<input type="number" id="${id}" value="${value}" min="0"></label>`;
}

function checkboxField(id, label) {
  return `<label class="checkbox"><input type="checkbox" id="${id}">${label}</label>`;
}

function buildForm() {
  document.getElementById("plot-form").innerHTML = [
    selectField("crop", "Crop", Object.keys(CROP_CODES), "Maize"),
    selectField("district", "District", Object.values(DISTRICTS).sort(), "Nyagatare"),
    selectField("landType", "Land type of the area", Object.keys(LAND_TYPES), "Hillside cropland"),
    numberField("plotSize", "Plot size (square metres)", 3000),
    selectField("erosion", "Soil erosion on the plot", Object.keys(EROSION_LEVELS), "Moderate"),
    numberField("fertilizerKg", "Inorganic fertilizer on the plot (kg, 0 if none)", 0),
    selectField("seedType", "Seed type", Object.keys(SEED_TYPES), "Traditional"),
    numberField("labourRwf", "Hired labour on the plot (Rwf, 0 if none)", 0),
    checkboxField("pesticide", "Pesticide used"),
    checkboxField("irrigated", "Plot irrigated"),
  ].join("");
}

function readForm() {
  const value = (id) => document.getElementById(id).value;
  const checked = (id) => document.getElementById(id).checked;
  return {
    crop: value("crop"),
    district: value("district"),
    landType: value("landType"),
    plotSize: Number(value("plotSize")),
    erosion: value("erosion"),
    fertilizerKg: Number(value("fertilizerKg")),
    seedType: value("seedType"),
    labourRwf: Number(value("labourRwf")),
    pesticide: checked("pesticide"),
    irrigated: checked("irrigated"),
  };
}

function renderResult(plot, result) {
  const crop = plot.crop.toLowerCase();
  const percent = (result.ratio - 1) * 100;
  const position = Math.abs(percent) < 10 ? "close to" : percent > 0 ? "above" : "below";
  const gaugePosition = Math.min(Math.max(result.ratio / 2, 0.02), 0.98) * 100;   // 0x to 2x across the bar
  const difference = position === "close to"
    ? ""
    : ` (${Math.round(Math.abs(percent))}% ${percent > 0 ? "above" : "below"})`;
  const caution = result.plotsInDistrict < MIN_PLOTS_FOR_DISTRICT
    ? `<p class="warning"><b>Caution:</b> the survey has only ${result.plotsInDistrict} ${crop} plots in
       ${plot.district}, so the district effect is based on little data.</p>`
    : "";

  document.getElementById("result").innerHTML = `
    <h3>Expected ${crop} yield: about ${formatNumber(result.expectedYield)} kg/ha</h3>
    <div class="gauge"><span class="gauge-marker" style="left:${gaugePosition}%"></span></div>
    <div class="gauge-labels"><span>0.0x</span><span>1.0x = typical plot</span><span>2.0x</span></div>
    <p>That is <b>${result.ratio.toFixed(2)} times</b> the typical ${crop} plot
       (${formatNumber(result.typicalYield)} kg/ha), so this plot is expected to be
       <b>${position} typical</b>${difference}.</p>
    <p>Typical error of the model for ${crop}: about ${formatNumber(result.typicalError)} kg/ha,
       so read this as a rough guide.</p>
    ${caution}
    <p class="note">Based on the 2021/22 Season A survey. The model shows associations in that data,
       not what a change would do on a real farm. Inputs not shown are set to the typical value for
       the crop. Describes a normal season, not a forecast.</p>`;
}

function update() {
  const plot = readForm();
  renderResult(plot, predictPlot(plot));
}

function init() {
  buildForm();
  document.getElementById("plot-form").addEventListener("input", update);
  update();
}

init();
