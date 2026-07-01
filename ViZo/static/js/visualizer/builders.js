// builders.js - Contains the logic to create 3D components for ViZo

// Posiciones fijas por número de dashboards
const POSITIONS = [
  { x: 0, y: 0.1, z: 20 }, // Slot 0: BOATS
];

/**
 * Calcula dinámicamente la posición y rotación de un pedestal satélite en cuadrícula por filas.
 * @param {number} index - Índice del satélite.
 * @param {number} total - Cantidad total de satélites activos.
 */
function calculateSatellitePosition(index, total) {
  if (total <= 0) return { x: 0, y: 0.1, z: 20, rotY: 0 };

  const COLUMNS = 3;
  const X_SPACING = 11.0;
  const Z_SPACING = 9.0;
  const Z_START = 10.0; // Detrás de la ciudad (Z=20)

  const row = Math.floor(index / COLUMNS);
  const totalRows = Math.ceil(total / COLUMNS);

  // Determinar cuántos elementos hay en esta fila específica para centrado
  let itemsInRow;
  if (row < totalRows - 1) {
    itemsInRow = COLUMNS;
  } else {
    itemsInRow = total % COLUMNS || COLUMNS;
  }

  const col = index % COLUMNS;

  // Calcular la coordenada X centrando el grupo de la fila
  const startX = -((itemsInRow - 1) * X_SPACING) / 2;
  const posX = startX + col * X_SPACING;
  const posZ = Z_START - row * Z_SPACING;
  const rotY = 0; // Encarando al sur hacia la ciudad/jugador

  return { x: posX, y: 0.1, z: posZ, rotY: rotY };
}

// Local proxy to delegate to the modular control-panel script
function buildControlPanel(scene, dash, vizId, pos, type) {
  if (
    window.ViZoBuilders &&
    typeof window.ViZoBuilders.buildControlPanel === "function"
  ) {
    window.ViZoBuilders.buildControlPanel(scene, dash, vizId, pos, type);
  } else {
    console.error(
      "ViZo // buildControlPanel was called but window.ViZoBuilders.buildControlPanel is not defined.",
    );
  }
}

/**
 * babia-boats: necesita un babia-treebuilder intermedio.
 * Usa el campo "id" como jerarquía (path del archivo).
 */
function buildCity(scene, dash, loaderId, pos) {
  // Calcular escala dinámica basada en cantidad de archivos para evitar edificios delgados en repos grandes
  const dataEl = document.getElementById("vizo-data-json");
  let fileCount = 50;
  if (dataEl && dataEl.textContent.trim()) {
    try {
      const data = JSON.parse(dataEl.textContent);
      if (Array.isArray(data)) {
        fileCount = data.length;
      }
    } catch (e) {}
  }
  const dynamicSize = Math.min(
    12,
    Math.max(4, Math.ceil(Math.sqrt(fileCount) * 0.6)),
  );

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
      "autoscaleSizeX: " + dynamicSize,
      // "autoscaleSizeZ: " + dynamicSize,
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
  let posX = pos.x;
  if (
    dash.dataset === "top_complex_files" ||
    (dash.id && dash.id.includes("complex"))
  ) {
    posX -= 2.5;
  }
  vizEl.setAttribute("position", posX + " 0.1 " + pos.z);
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
  const actualPos = { x: posX, y: pos.y, z: pos.z, rotY: pos.rotY };
  buildControlPanel(scene, dash, "vizo-viz-" + dash.id, actualPos, "cyls");
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

function buildNetwork(scene, dash, nodesLoaderId, linksLoaderId, pos) {
  // 1. Crear el contenedor invisible del plinth para definir los límites de espacio
  const plinthEl = document.createElement("a-entity");
  plinthEl.setAttribute("id", "vizo-plinth-" + dash.id);
  plinthEl.setAttribute("position", pos.x + " 0.5 " + pos.z);
  plinthEl.setAttribute("rotation", `0 ${pos.rotY} 0`);
  plinthEl.setAttribute("lounge-plinth", "width: 3; depth: 3");
  plinthEl.setAttribute("lounge-staydown", "");

  // 2. Crear la entidad de babia-network propiamente dicha dentro del plinth
  const vizEl = document.createElement("a-entity");
  vizEl.setAttribute("id", "vizo-viz-" + dash.id);
  vizEl.setAttribute("position", "0 1.2 0");
  vizEl.setAttribute("rotation", "0 0 -90");
  vizEl.setAttribute("scale", "0.03 0.03 0.03");
  vizEl.setAttribute(
    "babia-network",
    [
      "nodesFrom: " + nodesLoaderId,
      "linksFrom: " + linksLoaderId,
      "nodeId: id",
      "nodeLabel: name",
      "nodeAutoColorBy: id",
      "nodeResolution: 30",
      "nodeVal: commits",
      "nodeRelSize: 1",
      "linkWidth: 0.1",
      "nodeLegend: true",
      "linkLegend: true",
      "legend_scale: 2",
    ].join("; "),
  );

  plinthEl.appendChild(vizEl);
  scene.appendChild(plinthEl);
  vizEl.setAttribute("vizo-podio", "");
  console.log(
    "ViZo // babia-network creado sobre pedestal con límites invisibles",
  );
  buildControlPanel(scene, dash, "vizo-viz-" + dash.id, pos, "network");
}

// Export for global access
window.ViZoBuilders = window.ViZoBuilders || {};
window.ViZoBuilders.POSITIONS = POSITIONS;
window.ViZoBuilders.calculateSatellitePosition = calculateSatellitePosition;
window.ViZoBuilders.buildCity = buildCity;
window.ViZoBuilders.buildCyls = buildCyls;
window.ViZoBuilders.buildDoughnut = buildDoughnut;
window.ViZoBuilders.buildBarsmap = buildBarsmap;
window.ViZoBuilders.buildNetwork = buildNetwork;
