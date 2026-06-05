// builders.js - Contains the logic to create 3D components for ViZo

// Posiciones fijas por número de dashboards
const POSITIONS = [
  { x: 0, y: 0.1, z: 20 }, // Slot 0: BOATS
];

/**
 * Calcula dinámicamente la posición y rotación de un pedestal satélite en arco semicircular.
 * @param {number} index - Índice del satélite (0, 1, 2).
 * @param {number} total - Cantidad total de satélites activos.
 */
function calculateSatellitePosition(index, total) {
  if (total <= 0) return { x: 0, y: 0.1, z: 20, rotY: 0 };

  const R = 13.5; // Radio de la media luna
  const X_CENTER = 0;
  const Z_CENTER = 20; // Centro de la ciudad boats

  let angleDeg;
  if (total === 1) {
    angleDeg = 270; // Justo en el fondo (mirando al sur hacia Z=30)
  } else if (total === 2) {
    angleDeg = index === 0 ? 230 : 310;
  } else {
    // Tres satélites
    const angles = [220, 270, 320];
    angleDeg = angles[index] || 270;
  }

  const angleRad = (angleDeg * Math.PI) / 180;
  const posX = X_CENTER + R * Math.cos(angleRad);
  const posZ = Z_CENTER + R * Math.sin(angleRad);

  // Calcular la rotación Y para que el visualizador mire hacia la ciudad
  const rotY = (360 - angleDeg + 90) % 360;

  return { x: posX, y: 0.1, z: posZ, rotY: rotY };
}

// Local proxy to delegate to the modular control-panel script
function buildControlPanel(scene, dash, vizId, pos, type) {
  if (window.ViZoBuilders && typeof window.ViZoBuilders.buildControlPanel === "function") {
    window.ViZoBuilders.buildControlPanel(scene, dash, vizId, pos, type);
  } else {
    console.error("ViZo // buildControlPanel was called but window.ViZoBuilders.buildControlPanel is not defined.");
  }
}

/**
 * babia-boats: necesita un babia-treebuilder intermedio.
 * Usa el campo "id" como jerarquía (path del archivo).
 */
function buildCity(scene, dash, loaderId, pos) {
  const treebuilderId = "vizo-tree-" + dash.id;
  const treeEl = document.createElement("a-entity");
  treeEl.setAttribute("id", treebuilderId);
  treeEl.setAttribute("babia-treebuilder", "from: " + loaderId + "; field: id");
  scene.appendChild(treeEl);

  const m = dash.mappings;
  const vizEl = document.createElement("a-entity");
  vizEl.setAttribute("id", "vizo-viz-" + dash.id);
  vizEl.setAttribute("position", pos.x + " 0.1 " + pos.z);
  vizEl.setAttribute("scale", "0.3 0.3 0.3");

  vizEl.setAttribute(
    "babia-boats",
    [
      "from: " + treebuilderId,
      "height: " + (m.height || "nloc"),
      "area: " + (m.area || "ccn"),
      "streets: true",
      "extra: 1.5",
      "split: pivot",
      "base_color: #0d1220",
      "building_color: #0a1a3a",
      "minBuildingHeight: 1",
      "maxBuildingHeight: 10",
      "separation: 0.25",
      "legend_text: {name}\nNLOC: {nloc} | CCN: {ccn}\nCommits: {commits} | Funcs: {num_functions}\nEdad: {age_days}d | Owner: {owner_name} ({ownership}%)",
      "color: " + (m.color || m.height || "nloc"),
      "autoscale: true",
      "highlightQuarter: true",
      "highlightQuarterByClick: true",
    ].join("; "),
  );

  scene.appendChild(vizEl);
  vizEl.setAttribute("vizo-podio", "");
  console.log("ViZo // babia-boats creado sobre pedestal");
  buildControlPanel(scene, dash, "vizo-viz-" + dash.id, pos, "boats");
}

/**
 * babia-cyls: cilindros, altura = nloc, radio = count (archivos por lenguaje).
 */
function buildCyls(scene, dash, loaderId, pos) {
  const m = dash.mappings;
  const vizEl = document.createElement("a-entity");
  vizEl.setAttribute("id", "vizo-viz-" + dash.id);
  vizEl.setAttribute("position", pos.x + " 0.1 " + pos.z);
  vizEl.setAttribute("scale", "0.15 0.15 0.15");
  vizEl.setAttribute("rotation", `0 ${pos.rotY} 0`);
  vizEl.setAttribute(
    "babia-cyls",
    [
      "from: " + loaderId,
      "x_axis: " + (m.x_axis || "language"),
      "height: " + (m.height || "nloc"),
      "radius: " + (m.radius || "count"),
      "legend: true",
      "animation: true",
      "titlePosition: 18 8 0",
      "titleFont: #font",
      "titleColor: #00d4ff",
      "palette: pearl",
    ].join("; "),
  );

  scene.appendChild(vizEl);
  vizEl.setAttribute("vizo-podio", "");
  console.log("ViZo // babia-cyls creado sobre pedestal");
  buildControlPanel(scene, dash, "vizo-viz-" + dash.id, pos, "cyls");
}

/**
 * babia-doughnut: distribución de archivos por lenguaje.
 */
function buildDoughnut(scene, dash, loaderId, pos) {
  const m = dash.mappings;
  const vizEl = document.createElement("a-entity");
  vizEl.setAttribute("id", "vizo-viz-" + dash.id);
  vizEl.setAttribute("position", pos.x + " 1.2 " + pos.z);
  vizEl.setAttribute("rotation", `90 ${pos.rotY} 0`);
  vizEl.setAttribute("scale", "0.6 0.6 0.6");
  vizEl.setAttribute(
    "babia-doughnut",
    [
      "from: " + loaderId,
      "key: " + (m.key || "language"),
      "size: " + (m.size || "count"),
      "legend: true",
      "animation: true",
      "titlePosition: 2 0 -3",
      "palette: pearl",
    ].join("; "),
  );

  scene.appendChild(vizEl);
  vizEl.setAttribute("vizo-podio", "");
  console.log("ViZo // babia-doughnut creado sobre pedestal");
  buildControlPanel(scene, dash, "vizo-viz-" + dash.id, pos, "doughnut");
}

/**
 * babia-barsmap: mapa de barras 2D por lenguaje/commits.
 */
function buildBarsmap(scene, dash, loaderId, pos) {
  const m = dash.mappings;
  const vizEl = document.createElement("a-entity");
  vizEl.setAttribute("id", "vizo-viz-" + dash.id);
  vizEl.setAttribute("position", pos.x + " 0.1 " + pos.z);
  vizEl.setAttribute("scale", "0.2 0.2 0.2");
  vizEl.setAttribute("rotation", `0 ${pos.rotY} 0`);
  vizEl.setAttribute(
    "babia-barsmap",
    [
      "from: " + loaderId,
      "x_axis: " + (m.x_axis || "language"),
      "z_axis: " + (m.z_axis || "language"),
      "height: " + (m.height || "commits"),
      "legend: true",
      "palette: pearl",
      "titlePosition: -5 12 0",
      "axis_name: true",
      "animation: true",
    ].join("; "),
  );

  scene.appendChild(vizEl);
  vizEl.setAttribute("vizo-podio", "");
  console.log("ViZo // babia-barsmap creado sobre pedestal");
  buildControlPanel(scene, dash, "vizo-viz-" + dash.id, pos, "barsmap");
}

// Export for global access
window.ViZoBuilders = window.ViZoBuilders || {};
window.ViZoBuilders.POSITIONS = POSITIONS;
window.ViZoBuilders.calculateSatellitePosition = calculateSatellitePosition;
window.ViZoBuilders.buildCity = buildCity;
window.ViZoBuilders.buildCyls = buildCyls;
window.ViZoBuilders.buildDoughnut = buildDoughnut;
window.ViZoBuilders.buildBarsmap = buildBarsmap;
