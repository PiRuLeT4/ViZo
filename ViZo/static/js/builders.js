// builders.js - Contains the logic to create 3D components for ViZo

// Posiciones fijas por número de dashboards
const POSITIONS = [
  { x: 0, y: 0.1, z: 8 }, // Slot 0: BOATS
  { x: -12, y: 0.1, z: 2 }, // Slot 1: CYLS
  { x: 12, y: 0.1, z: 2 }, // Slot 2: DONUT
  { x: 0, y: 0.1, z: -3 }, // Slot 3: BARSMAP
];

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
  vizEl.setAttribute("scale", "0.2 0.2 0.2");

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
      "legend_text: {name}\n{height}(NLOC)x{area}(CCN)",
      "color: " + m.height,
      "autoscale: true",
    ].join("; "),
  );

  scene.appendChild(vizEl);
  vizEl.setAttribute("vizo-podio", "");
  console.log("ViZo // babia-boats creado sobre pedestal");
}

/**
 * babia-cyls: cilindros, altura = nloc, radio = count (archivos por lenguaje).
 */
function buildCyls(scene, dash, loaderId, pos) {
  const m = dash.mappings;
  const vizEl = document.createElement("a-entity");
  vizEl.setAttribute("id", "vizo-viz-" + dash.id);
  vizEl.setAttribute("position", pos.x + " 0.1 " + (pos.z - 4));
  vizEl.setAttribute("scale", "0.3 0.3 0.3");
  vizEl.setAttribute(
    "babia-cyls",
    [
      "from: " + loaderId,
      "x_axis: " + (m.x_axis || "language"),
      "height: " + (m.height || "nloc"),
      "radius: " + (m.radius || "count"),
      "legend: true",
      "animation: true",
      "title: " + dash.title,
      "titlePosition: 18 8 0",
      "titleFont: #font",
      "titleColor: #00d4ff",
      "palette: pearl",
    ].join("; "),
  );

  scene.appendChild(vizEl);
  vizEl.setAttribute("vizo-podio", "");
  console.log("ViZo // babia-cyls creado sobre pedestal");
}

/**
 * babia-doughnut: distribución de archivos por lenguaje.
 */
function buildDoughnut(scene, dash, loaderId, pos) {
  const m = dash.mappings;
  const vizEl = document.createElement("a-entity");
  vizEl.setAttribute("id", "vizo-viz-" + dash.id);
  vizEl.setAttribute("position", pos.x + " 1.2 " + (pos.z - 4));
  vizEl.setAttribute("rotation", "90 0 0");
  vizEl.setAttribute("scale", "0.6 0.6 0.6");
  vizEl.setAttribute(
    "babia-doughnut",
    [
      "from: " + loaderId,
      "key: " + (m.key || "language"),
      "size: " + (m.size || "count"),
      "legend: true",
      "animation: true",
      "title: " + dash.title,
      "titlePosition: 2 0 -3",
      "palette: pearl",
    ].join("; "),
  );

  scene.appendChild(vizEl);
  vizEl.setAttribute("vizo-podio", "");
  console.log("ViZo // babia-doughnut creado sobre pedestal");
}

/**
 * babia-barsmap: mapa de barras 2D por lenguaje/commits.
 */
function buildBarsmap(scene, dash, loaderId, pos) {
  const m = dash.mappings;
  const vizEl = document.createElement("a-entity");
  vizEl.setAttribute("id", "vizo-viz-" + dash.id);
  vizEl.setAttribute("position", pos.x + " 0.1 " + (pos.z - 4));
  vizEl.setAttribute("scale", "0.2 0.2 0.2");
  vizEl.setAttribute(
    "babia-barsmap",
    [
      "from: " + loaderId,
      "x_axis: " + (m.x_axis || "language"),
      "z_axis: " + (m.z_axis || "language"),
      "height: " + (m.height || "commits"),
      "legend: true",
      "palette: pearl",
      "title: " + dash.title,
      "titlePosition: -3 10 0",
      "axis_name: true",
    ].join("; "),
  );

  scene.appendChild(vizEl);
  vizEl.setAttribute("vizo-podio", "");
  console.log("ViZo // babia-barsmap creado sobre pedestal");
}

// Export for global access
window.ViZoBuilders = {
  POSITIONS,
  buildCity,
  buildCyls,
  buildDoughnut,
  buildBarsmap,
};
