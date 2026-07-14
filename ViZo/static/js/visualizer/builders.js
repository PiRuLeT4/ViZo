// builders.js - Contains the logic to create 3D components for ViZo

const PODIUM_HEIGHT = 0.4;

// Posiciones fijas por número de dashboards
const POSITIONS = [
  { x: 0, y: PODIUM_HEIGHT, z: 14 }, // Slot 0: BOATS
];

/**
 * Calcula dinámicamente la posición y rotación de un pedestal satélite en cuadrícula por filas.
 * @param {number} index - Índice del satélite.
 * @param {number} total - Cantidad total de satélites activos.
 */
function calculateSatellitePosition(index, total) {
  if (total <= 0) return { x: 0, y: PODIUM_HEIGHT, z: 14, rotY: 0 };

  const COLUMNS = 3;
  const X_SPACING = 8.5;
  const Z_SPACING = 7.0;
  const Z_START = 7.0; // Detrás de la ciudad (Z=14)

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

  return { x: posX, y: PODIUM_HEIGHT, z: posZ, rotY: rotY };
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
  vizEl.setAttribute("position", pos.x + " " + PODIUM_HEIGHT + " " + pos.z);
  vizEl.setAttribute("scale", "0.24 0.24 0.24");

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
    posX -= 2.0;
  }
  vizEl.setAttribute("position", posX + " " + PODIUM_HEIGHT + " " + pos.z);
  vizEl.setAttribute("scale", "0.12 0.12 0.12");
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
  vizEl.setAttribute("position", pos.x + " " + (PODIUM_HEIGHT + 0.8) + " " + pos.z);
  vizEl.setAttribute("rotation", `90 ${pos.rotY} 0`);
  vizEl.setAttribute("scale", "0.5 0.5 0.5");
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
  vizEl.setAttribute("position", pos.x + " " + PODIUM_HEIGHT + " " + pos.z);
  vizEl.setAttribute("scale", "0.16 0.16 0.16");
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
  plinthEl.setAttribute("lounge-plinth", "width: 2.4; depth: 2.4");
  plinthEl.setAttribute("lounge-staydown", "");

  // 2. Crear la entidad de babia-network propiamente dicha dentro del plinth
  const vizEl = document.createElement("a-entity");
  vizEl.setAttribute("id", "vizo-viz-" + dash.id);
  vizEl.setAttribute("position", "0 1.5 0");
  vizEl.setAttribute("rotation", "0 0 -90");
  vizEl.setAttribute("scale", "0.032 0.032 0.032");
  vizEl.setAttribute(
    "babia-network",
    [
      "nodesFrom: " + nodesLoaderId,
      "linksFrom: " + linksLoaderId,
      "nodeId: id",
      "nodeLabel: name",
      "nodeAutoColorBy: id",
      "nodeResolution: 30",
      "nodeVal: val",
      "nodeRelSize: 1",
      "linkWidth: 0.2",
      "linkLabel: fileLabel",
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

/**
 * babia-bars: gráfico de barras 2D.
 */
function buildBars(scene, dash, loaderId, pos) {
  const m = dash.mappings;
  const vizEl = document.createElement("a-entity");
  vizEl.setAttribute("id", "vizo-viz-" + dash.id);
  vizEl.setAttribute("position", pos.x + " " + PODIUM_HEIGHT + " " + pos.z);
  vizEl.setAttribute("scale", "0.2 0.2 0.2");
  vizEl.setAttribute("rotation", `0 ${pos.rotY} 0`);
  vizEl.setAttribute(
    "babia-bars",
    [
      "from: " + loaderId,
      "x_axis: " + (m.x_axis || "title"),
      "height: " + (m.height || m.size || m.comments || "comments"),
      "legend: true",
      "palette: pearl",
      "titlePosition: -5 12 0",
      "axis_name: true",
      "animation: true",
    ].join("; "),
  );

  scene.appendChild(vizEl);
  vizEl.setAttribute("vizo-podio", "");
  console.log("ViZo // babia-bars creado sobre pedestal");
  buildControlPanel(scene, dash, "vizo-viz-" + dash.id, pos, "bars");
}

/**
 * Renderiza los trofeos 3D proporcionales de Stars y Forks a los lados de la ciudad
 */
function buildStatsTrophies(scene, summary) {
  const starsCount = parseInt(summary.stars) || 0;
  const forksCount = parseInt(summary.forks) || 0;

  // 1. --- TROFEO DE STARS (Derecha de la ciudad) ---
  const posStars = { x: 8.0, y: 0.1, z: 15 };
  const starsTrophyEl = document.createElement("a-entity");
  starsTrophyEl.setAttribute("id", "vizo-stars-trophy");
  starsTrophyEl.setAttribute(
    "position",
    `${posStars.x} ${posStars.y} ${posStars.z}`,
  );
  starsTrophyEl.setAttribute("visible", "true");

  const pedStars = document.createElement("a-cylinder");
  pedStars.setAttribute("radius", "0.5");
  pedStars.setAttribute("height", "0.5");
  pedStars.setAttribute("color", "#081329");
  pedStars.setAttribute("material", "metalness: 0.8; roughness: 0.2");
  starsTrophyEl.appendChild(pedStars);

  const ringStars = document.createElement("a-ring");
  ringStars.setAttribute("radius-inner", "0.51");
  ringStars.setAttribute("radius-outer", "0.56");
  ringStars.setAttribute("rotation", "-90 0 0");
  ringStars.setAttribute("position", "0 0.251 0");
  ringStars.setAttribute("color", "#ffd700");
  ringStars.setAttribute(
    "material",
    "shader: flat; transparent: true; opacity: 0.8",
  );
  starsTrophyEl.appendChild(ringStars);

  // Estrella amarilla normal de 5 puntas (Escala fija)
  const starGeomEl = document.createElement("a-entity");
  starGeomEl.setAttribute("position", "0 1.0 0");
  starGeomEl.setAttribute("scale", "0.6 0.6 0.6");
  starGeomEl.setAttribute(
    "animation",
    "property: rotation; to: 0 360 0; loop: true; dur: 8000; easing: linear",
  );

  // Esfera central
  const coreStar = document.createElement("a-sphere");
  coreStar.setAttribute("radius", "0.16");
  coreStar.setAttribute("color", "#ffd700");
  coreStar.setAttribute("emissive", "#ffd700");
  coreStar.setAttribute("emissive-intensity", "1.5");
  starGeomEl.appendChild(coreStar);

  // 5 conos radiales espaciados a 72 grados
  for (let i = 0; i < 5; i++) {
    const angleRad = (i * 72 * Math.PI) / 180;
    const punta = document.createElement("a-cone");
    punta.setAttribute("radius-bottom", "0.1");
    punta.setAttribute("height", "0.36");
    punta.setAttribute("color", "#ffd700");
    punta.setAttribute("emissive", "#ffd700");
    punta.setAttribute("emissive-intensity", "1.2");
    punta.setAttribute("material", "metalness: 0.5; roughness: 0.2");

    const dist = 0.12;
    const px = Math.sin(angleRad) * dist;
    const py = Math.cos(angleRad) * dist;
    punta.setAttribute("position", `${px} ${py} 0`);

    const rotZ = -i * 72;
    punta.setAttribute("rotation", `0 0 ${rotZ}`);

    starGeomEl.appendChild(punta);
  }

  starsTrophyEl.appendChild(starGeomEl);

  const textStars = document.createElement("a-text");
  textStars.setAttribute("value", `${starsCount}\nSTARS`);
  textStars.setAttribute("position", "0 1.8 0");
  textStars.setAttribute("align", "center");
  textStars.setAttribute("color", "#ffd700");
  textStars.setAttribute("emissive", "#ffd700");
  textStars.setAttribute("emissive-intensity", "1.2");
  textStars.setAttribute("width", "3.2");
  textStars.setAttribute("side", "double");
  textStars.setAttribute("font", "https://cdn.aframe.io/fonts/Exo2Bold.fnt");
  starsTrophyEl.appendChild(textStars);

  scene.appendChild(starsTrophyEl);

  // 2. --- TROFEO DE FORKS (Izquierda de la ciudad) ---
  const posForks = { x: -8.0, y: 0.1, z: 15 };
  const forksTrophyEl = document.createElement("a-entity");
  forksTrophyEl.setAttribute("id", "vizo-forks-trophy");
  forksTrophyEl.setAttribute(
    "position",
    `${posForks.x} ${posForks.y} ${posForks.z}`,
  );
  forksTrophyEl.setAttribute("visible", "true");

  const pedForks = document.createElement("a-cylinder");
  pedForks.setAttribute("radius", "0.5");
  pedForks.setAttribute("height", "0.5");
  pedForks.setAttribute("color", "#081329");
  pedForks.setAttribute("material", "metalness: 0.8; roughness: 0.2");
  forksTrophyEl.appendChild(pedForks);

  const ringForks = document.createElement("a-ring");
  ringForks.setAttribute("radius-inner", "0.51");
  ringForks.setAttribute("radius-outer", "0.56");
  ringForks.setAttribute("rotation", "-90 0 0");
  ringForks.setAttribute("position", "0 0.251 0");
  ringForks.setAttribute("color", "#00d4ff");
  ringForks.setAttribute(
    "material",
    "shader: flat; transparent: true; opacity: 0.8",
  );
  forksTrophyEl.appendChild(ringForks);

  // Figura de Fork simple: Bifurcación simétrica en "Y" (Escala fija)
  const forkGeomEl = document.createElement("a-entity");
  forkGeomEl.setAttribute("position", "0 0.9 0");
  forkGeomEl.setAttribute("scale", "0.8 0.8 0.8");
  forkGeomEl.setAttribute(
    "animation",
    "property: rotation; to: 0 -360 0; loop: true; dur: 8000; easing: linear",
  );

  // Tronco central (abajo)
  const tronco = document.createElement("a-cylinder");
  tronco.setAttribute("radius", "0.036");
  tronco.setAttribute("height", "0.3");
  tronco.setAttribute("position", "0 -0.14 0");
  tronco.setAttribute("color", "#00d4ff");
  tronco.setAttribute("emissive", "#00d4ff");
  tronco.setAttribute("emissive-intensity", "1.2");
  tronco.setAttribute("material", "metalness: 0.6; roughness: 0.2");
  forkGeomEl.appendChild(tronco);

  // Esfera de unión central
  const unionNode = document.createElement("a-sphere");
  unionNode.setAttribute("radius", "0.06");
  unionNode.setAttribute("position", "0 0 0");
  unionNode.setAttribute("color", "#00d4ff");
  unionNode.setAttribute("emissive", "#00d4ff");
  unionNode.setAttribute("emissive-intensity", "1.5");
  forkGeomEl.appendChild(unionNode);

  // Rama Izquierda (30 grados a la izquierda)
  const ramaIzq = document.createElement("a-cylinder");
  ramaIzq.setAttribute("radius", "0.028");
  ramaIzq.setAttribute("height", "0.32");
  ramaIzq.setAttribute("position", "-0.088 0.136 0");
  ramaIzq.setAttribute("rotation", "0 0 30");
  ramaIzq.setAttribute("color", "#00d4ff");
  ramaIzq.setAttribute("emissive", "#00d4ff");
  ramaIzq.setAttribute("emissive-intensity", "1.2");
  ramaIzq.setAttribute("material", "metalness: 0.6; roughness: 0.2");
  forkGeomEl.appendChild(ramaIzq);

  // Esfera extrema izquierda
  const nodeIzq = document.createElement("a-sphere");
  nodeIzq.setAttribute("radius", "0.064");
  nodeIzq.setAttribute("position", "-0.168 0.272 0");
  nodeIzq.setAttribute("color", "#4af7a0"); // Verde neón
  nodeIzq.setAttribute("emissive", "#4af7a0");
  nodeIzq.setAttribute("emissive-intensity", "1.6");
  forkGeomEl.appendChild(nodeIzq);

  // Rama Derecha (30 grados a la derecha)
  const ramaDer = document.createElement("a-cylinder");
  ramaDer.setAttribute("radius", "0.028");
  ramaDer.setAttribute("height", "0.32");
  ramaDer.setAttribute("position", "0.088 0.136 0");
  ramaDer.setAttribute("rotation", "0 0 -30");
  ramaDer.setAttribute("color", "#00d4ff");
  ramaDer.setAttribute("emissive", "#00d4ff");
  ramaDer.setAttribute("emissive-intensity", "1.2");
  ramaDer.setAttribute("material", "metalness: 0.6; roughness: 0.2");
  forkGeomEl.appendChild(ramaDer);

  // Esfera extrema derecha
  const nodeDer = document.createElement("a-sphere");
  nodeDer.setAttribute("radius", "0.064");
  nodeDer.setAttribute("position", "0.168 0.272 0");
  nodeDer.setAttribute("color", "#4af7a0"); // Verde neón
  nodeDer.setAttribute("emissive", "#4af7a0");
  nodeDer.setAttribute("emissive-intensity", "1.6");
  forkGeomEl.appendChild(nodeDer);

  forksTrophyEl.appendChild(forkGeomEl);

  const textForks = document.createElement("a-text");
  textForks.setAttribute("value", `${forksCount}\nFORKS`);
  textForks.setAttribute("position", "0 1.8 0");
  textForks.setAttribute("align", "center");
  textForks.setAttribute("color", "#00d4ff");
  textForks.setAttribute("emissive", "#00d4ff");
  textForks.setAttribute("emissive-intensity", "1.2");
  textForks.setAttribute("width", "3.2");
  textForks.setAttribute("font", "https://cdn.aframe.io/fonts/Exo2Bold.fnt");
  textForks.setAttribute("side", "double");
  forksTrophyEl.appendChild(textForks);

  scene.appendChild(forksTrophyEl);
  console.log(
    `ViZo // Trofeos creados: ${starsCount} Stars, ${forksCount} Forks.`,
  );
}

/**
 * babia-pie: gráfico de sectores/tarta 3D.
 */
function buildPie(scene, dash, loaderId, pos) {
  const m = dash.mappings || {};
  const vizEl = document.createElement("a-entity");
  vizEl.setAttribute("id", "vizo-viz-" + dash.id);
  vizEl.setAttribute("position", pos.x + " " + (PODIUM_HEIGHT + 0.8) + " " + pos.z);
  vizEl.setAttribute("rotation", `90 ${pos.rotY} 0`);
  vizEl.setAttribute("scale", "0.5 0.5 0.5");
  vizEl.setAttribute(
    "babia-pie",
    [
      "from: " + loaderId,
      "key: " + (m.key || "key"),
      "size: " + (m.size || "size"),
      "legend: true",
      "animation: true",
      "titlePosition: 2 0 -3",
      "palette: pearl",
    ].join("; "),
  );

  scene.appendChild(vizEl);
  vizEl.setAttribute("vizo-podio", "");
  console.log("ViZo // babia-pie creado sobre pedestal");
  buildControlPanel(scene, dash, "vizo-viz-" + dash.id, pos, "doughnut");
}

// Export for global access
window.ViZoBuilders = window.ViZoBuilders || {};
window.ViZoBuilders.POSITIONS = POSITIONS;
window.ViZoBuilders.calculateSatellitePosition = calculateSatellitePosition;
window.ViZoBuilders.buildCity = buildCity;
window.ViZoBuilders.buildCyls = buildCyls;
window.ViZoBuilders.buildDoughnut = buildDoughnut;
window.ViZoBuilders.buildPie = buildPie;
window.ViZoBuilders.buildBarsmap = buildBarsmap;
window.ViZoBuilders.buildNetwork = buildNetwork;
window.ViZoBuilders.buildBars = buildBars;
window.ViZoBuilders.buildStatsTrophies = buildStatsTrophies;
