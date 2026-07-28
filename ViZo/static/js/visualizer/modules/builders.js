/**
 * ViZzo // builders.js  —  3D Object Builders for A-Frame Scene
 */

import { ensureNetworkLoaders } from './helpers.js';
import { buildControlPanel } from './components/control-panel.js';

export const PODIUM_HEIGHT = 0.4;

export const PALETTES = {
  Pearl: "pearl",
  Blues: "blues",
  Icecream: "icecream",
  Sunset: "sunset",
  Flat: "flat",
  Foxy: "foxy",
  Ubuntu: "ubuntu",
  Commerce: "commerce",
  Bussiness: "bussiness",
};

export function getRandomPalette() {
  const values = Object.values(PALETTES);
  const randomIndex = Math.floor(Math.random() * values.length);
  return values[randomIndex];
}

// Posiciones fijas por número de dashboards
export const POSITIONS = [
  { x: 0, y: PODIUM_HEIGHT, z: 21 }, // Slot 0: BOATS
];

/**
 * Calcula dinámicamente la posición y rotación de un pedestal satélite en cuadrícula por filas.
 */
export function calculateSatellitePosition(index, total) {
  if (total <= 0) return { x: 0, y: PODIUM_HEIGHT, z: 21, rotY: 0 };

  const COLUMNS = 3;
  const X_SPACING = 14.5;
  const Z_SPACING = 14.5;
  const Z_START = 12.0; // Detrás de la ciudad (Z=21)

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

/**
 * babia-boats: necesita un babia-treebuilder intermedio.
 * Usa el campo "id" como jerarquía (path del archivo).
 */
export function buildCity(scene, dash, loaderId, pos) {
  // Calcular escala dinámica basada en cantidad de archivos para evitar edificios delgados en repos grandes
  const dataEl = document.getElementById("vizzo-data-json");
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

  const treebuilderId = "vizzo-tree-" + dash.id;
  const treeEl = document.createElement("a-entity");
  treeEl.setAttribute("id", treebuilderId);
  treeEl.setAttribute("babia-treebuilder", "from: " + loaderId + "; field: id");
  scene.appendChild(treeEl);

  const m = dash.mappings;
  const vizEl = document.createElement("a-entity");
  vizEl.setAttribute("id", "vizzo-viz-" + dash.id);
  vizEl.setAttribute("data-dataset", dash.dataset);
  vizEl.setAttribute("position", pos.x + " " + PODIUM_HEIGHT + " " + pos.z);
  vizEl.setAttribute("scale", "0.48 0.48 0.48");

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
      "highlightQuarter: true",
      "highlightQuarterByClick: true",
    ].join("; "),
  );

  scene.appendChild(vizEl);
  vizEl.setAttribute("vizzo-podio", "");
  console.log("ViZzo // babia-boats creado sobre pedestal");
  buildControlPanel(scene, dash, "vizzo-viz-" + dash.id, pos, "boats");
}

/**
 * babia-cyls: cilindros, altura = nloc, radio = count (archivos por lenguaje).
 */
export function buildCyls(scene, dash, loaderId, pos) {
  const m = dash.mappings;
  const vizEl = document.createElement("a-entity");
  vizEl.setAttribute("id", "vizzo-viz-" + dash.id);
  vizEl.setAttribute("data-dataset", dash.dataset);
  vizEl.setAttribute("position", pos.x + " " + PODIUM_HEIGHT + " " + pos.z);
  vizEl.setAttribute("scale", "0.3 0.3 0.3");
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
      "titlePosition: 0 8 0",
      "titleFont: #font",
      "titleColor: #00d4ff",
      "palette: " + getRandomPalette(),
    ].join("; "),
  );

  scene.appendChild(vizEl);
  vizEl.setAttribute("vizzo-podio", "");
  console.log("ViZzo // babia-cyls creado sobre pedestal");
  buildControlPanel(scene, dash, "vizzo-viz-" + dash.id, pos, "cyls");
}

/**
 * babia-doughnut: distribución de archivos por lenguaje.
 */
export function buildDoughnut(scene, dash, loaderId, pos) {
  const m = dash.mappings;
  const vizEl = document.createElement("a-entity");
  vizEl.setAttribute("id", "vizzo-viz-" + dash.id);
  vizEl.setAttribute("data-dataset", dash.dataset);
  vizEl.setAttribute(
    "position",
    pos.x + " " + (PODIUM_HEIGHT + 1.6) + " " + pos.z,
  );
  vizEl.setAttribute("rotation", `90 ${pos.rotY} 0`);
  vizEl.setAttribute("scale", "1.0 1.0 1.0");
  vizEl.setAttribute(
    "babia-doughnut",
    [
      "from: " + loaderId,
      "key: " + (m.key || "language"),
      "size: " + (m.size || "count"),
      "legend: true",
      "animation: true",
      "titlePosition: 0 3 0",
      "palette: " + getRandomPalette(),
    ].join("; "),
  );

  scene.appendChild(vizEl);
  vizEl.setAttribute("vizzo-podio", "");
  console.log("ViZzo // babia-doughnut creado sobre pedestal");
  buildControlPanel(scene, dash, "vizzo-viz-" + dash.id, pos, "doughnut");
}

/**
 * babia-barsmap: mapa de barras 2D por lenguaje/commits.
 */
export function buildBarsmap(scene, dash, loaderId, pos) {
  const m = dash.mappings;
  const vizEl = document.createElement("a-entity");
  vizEl.setAttribute("id", "vizzo-viz-" + dash.id);
  vizEl.setAttribute("data-dataset", dash.dataset);
  vizEl.setAttribute("position", pos.x + " " + PODIUM_HEIGHT + " " + pos.z);
  vizEl.setAttribute("scale", "0.4 0.4 0.4");
  vizEl.setAttribute("rotation", `0 ${pos.rotY} 0`);
  vizEl.setAttribute(
    "babia-barsmap",
    [
      "from: " + loaderId,
      "x_axis: " + (m.x_axis || "language"),
      "z_axis: " + (m.z_axis || "language"),
      "height: " + (m.height || "commits"),
      "legend: true",
      "palette: " + getRandomPalette(),
      "titlePosition: 0 10 0",
      "axis_name: true",
      "animation: true",
    ].join("; "),
  );

  scene.appendChild(vizEl);
  vizEl.setAttribute("vizzo-podio", "");
  console.log("ViZzo // babia-barsmap creado sobre pedestal");
  buildControlPanel(scene, dash, "vizzo-viz-" + dash.id, pos, "barsmap");
}

export function buildNetwork(scene, dash, nodesLoaderId, linksLoaderId, pos) {
  // 1. Crear el contenedor invisible del plinth para definir los límites de espacio
  const plinthEl = document.createElement("a-entity");
  plinthEl.setAttribute("id", "vizzo-plinth-" + dash.id);
  plinthEl.setAttribute("position", pos.x + " 0.5 " + pos.z);
  plinthEl.setAttribute("rotation", `0 ${pos.rotY} 0`);
  plinthEl.setAttribute("lounge-plinth", "width: 4.8; depth: 4.8");
  plinthEl.setAttribute("lounge-staydown", "");

  // 2. Crear la entidad de babia-network propiamente dicha dentro del plinth
  const vizEl = document.createElement("a-entity");
  vizEl.setAttribute("id", "vizzo-viz-" + dash.id);
  vizEl.setAttribute("data-dataset", dash.dataset);
  vizEl.setAttribute("position", "0 2.7 0");
  vizEl.setAttribute("rotation", "0 0 -90");
  vizEl.setAttribute("scale", "0.064 0.064 0.064");
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
      "linkWidth: 0.4",
      "linkLabel: fileLabel",
      "nodeLegend: true",
      "linkLegend: true",
      "legend_scale: 2",
    ].join("; "),
  );

  plinthEl.appendChild(vizEl);
  scene.appendChild(plinthEl);
  vizEl.setAttribute("vizzo-podio", "");
  console.log(
    "ViZzo // babia-network creado sobre pedestal con límites invisibles",
  );
  buildControlPanel(scene, dash, "vizzo-viz-" + dash.id, pos, "network");
}

/**
 * babia-bars: gráfico de barras 2D.
 */
export function buildBars(scene, dash, loaderId, pos) {
  const m = dash.mappings;
  const vizEl = document.createElement("a-entity");
  vizEl.setAttribute("id", "vizzo-viz-" + dash.id);
  vizEl.setAttribute("data-dataset", dash.dataset);
  vizEl.setAttribute("position", pos.x + " " + PODIUM_HEIGHT + " " + pos.z);
  vizEl.setAttribute("scale", "0.4 0.4 0.4");
  vizEl.setAttribute("rotation", `0 ${pos.rotY} 0`);
  vizEl.setAttribute(
    "babia-bars",
    [
      "from: " + loaderId,
      "x_axis: " + (m.x_axis || "title"),
      "height: " + (m.height || m.size || m.comments || "comments"),
      "legend: true",
      "palette: " + getRandomPalette(),
      "titlePosition: 0 10 0",
      "axis_name: true",
      "animation: true",
    ].join("; "),
  );

  scene.appendChild(vizEl);
  vizEl.setAttribute("vizzo-podio", "");
  console.log("ViZzo // babia-bars creado sobre pedestal");
  buildControlPanel(scene, dash, "vizzo-viz-" + dash.id, pos, "bars");
}

/**
 * Renderiza los trofeos 3D proporcionales de Stars y Forks a los lados de la ciudad
 */
export function buildStatsTrophies(scene, summary) {
  const starsCount = parseInt(summary.stars) || 0;
  const forksCount = parseInt(summary.forks) || 0;

  // 1. --- TROFEO DE STARS (Derecha de la ciudad) ---
  const posStars = { x: 12.0, y: 0.1, z: 22.5 };
  const starsTrophyEl = document.createElement("a-entity");
  starsTrophyEl.setAttribute("id", "vizzo-stars-trophy");
  starsTrophyEl.setAttribute(
    "position",
    `${posStars.x} ${posStars.y} ${posStars.z}`,
  );
  starsTrophyEl.setAttribute("visible", "true");

  const pedStars = document.createElement("a-cylinder");
  pedStars.setAttribute("radius", "1");
  pedStars.setAttribute("height", "1.4");
  pedStars.setAttribute("src", "#marmol-texture");
  pedStars.setAttribute("material", "roughness: 0.3; metalness: 0.2");
  starsTrophyEl.appendChild(pedStars);

  // Estrella de metal dorado de 5 puntas (Escala adaptada a VR)
  const starGeomEl = document.createElement("a-entity");
  starGeomEl.setAttribute("position", "0 1.6 0");
  starGeomEl.setAttribute("scale", "1.5 1.5 1.5");
  starGeomEl.setAttribute(
    "animation",
    "property: rotation; to: 0 360 0; loop: true; dur: 8000; easing: linear",
  );

  // Esfera central (Dorada)
  const coreStar = document.createElement("a-sphere");
  coreStar.setAttribute("radius", "0.16");
  coreStar.setAttribute("color", "#d4af37");
  coreStar.setAttribute("material", "roughness: 0.15; metalness: 0.9");
  starGeomEl.appendChild(coreStar);

  // 5 conos radiales espaciados a 72 grados
  for (let i = 0; i < 5; i++) {
    const angleRad = (i * 72 * Math.PI) / 180;
    const punta = document.createElement("a-cone");
    punta.setAttribute("radius-bottom", "0.1");
    punta.setAttribute("height", "0.36");
    punta.setAttribute("color", "#d4af37");
    punta.setAttribute("material", "metalness: 0.9; roughness: 0.15");

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
  textStars.setAttribute("position", "0 2.8 0");
  textStars.setAttribute("align", "center");
  textStars.setAttribute("color", "#fff");
  textStars.setAttribute("width", "4.8");
  textStars.setAttribute("side", "double");
  textStars.setAttribute("font", "https://cdn.aframe.io/fonts/Exo2Bold.fnt");
  starsTrophyEl.appendChild(textStars);

  scene.appendChild(starsTrophyEl);

  // 2. --- TROFEO DE FORKS (Izquierda de la ciudad) ---
  const posForks = { x: -12.0, y: 0.1, z: 22.5 };
  const forksTrophyEl = document.createElement("a-entity");
  forksTrophyEl.setAttribute("id", "vizzo-forks-trophy");
  forksTrophyEl.setAttribute(
    "position",
    `${posForks.x} ${posForks.y} ${posForks.z}`,
  );
  forksTrophyEl.setAttribute("visible", "true");

  const pedForks = document.createElement("a-cylinder");
  pedForks.setAttribute("radius", "1");
  pedForks.setAttribute("height", "1.4");
  pedForks.setAttribute("src", "#marmol-texture");
  pedForks.setAttribute("material", "roughness: 0.3; metalness: 0.2");
  forksTrophyEl.appendChild(pedForks);

  // Figura de Fork simple: Bifurcación simétrica en "Y" (Escala adaptada a VR)
  const forkGeomEl = document.createElement("a-entity");
  forkGeomEl.setAttribute("position", "0 1.5 0");
  forkGeomEl.setAttribute("scale", "1.8 1.8 1.8");
  forkGeomEl.setAttribute(
    "animation",
    "property: rotation; to: 0 -360 0; loop: true; dur: 8000; easing: linear",
  );

  // Tronco central (abajo)
  const tronco = document.createElement("a-cylinder");
  tronco.setAttribute("radius", "0.036");
  tronco.setAttribute("height", "0.3");
  tronco.setAttribute("position", "0 -0.14 0");
  tronco.setAttribute("color", "#cbd5e1");
  tronco.setAttribute("material", "metalness: 0.8; roughness: 0.2");
  forkGeomEl.appendChild(tronco);

  // Esfera de unión central
  const unionNode = document.createElement("a-sphere");
  unionNode.setAttribute("radius", "0.06");
  unionNode.setAttribute("position", "0 0 0");
  unionNode.setAttribute("color", "#cbd5e1");
  unionNode.setAttribute("material", "metalness: 0.8; roughness: 0.2");
  forkGeomEl.appendChild(unionNode);

  // Rama Izquierda (30 grados a la izquierda)
  const ramaIzq = document.createElement("a-cylinder");
  ramaIzq.setAttribute("radius", "0.028");
  ramaIzq.setAttribute("height", "0.32");
  ramaIzq.setAttribute("position", "-0.088 0.136 0");
  ramaIzq.setAttribute("rotation", "0 0 30");
  ramaIzq.setAttribute("color", "#cbd5e1");
  ramaIzq.setAttribute("material", "metalness: 0.8; roughness: 0.2");
  forkGeomEl.appendChild(ramaIzq);

  // Esfera extrema izquierda
  const nodeIzq = document.createElement("a-sphere");
  nodeIzq.setAttribute("radius", "0.064");
  nodeIzq.setAttribute("position", "-0.168 0.272 0");
  nodeIzq.setAttribute("color", "#cbd5e1");
  nodeIzq.setAttribute("material", "metalness: 0.8; roughness: 0.2");
  forkGeomEl.appendChild(nodeIzq);

  // Rama Derecha (30 grados a la derecha)
  const ramaDer = document.createElement("a-cylinder");
  ramaDer.setAttribute("radius", "0.028");
  ramaDer.setAttribute("height", "0.32");
  ramaDer.setAttribute("position", "0.088 0.136 0");
  ramaDer.setAttribute("rotation", "0 0 -30");
  ramaDer.setAttribute("color", "#cbd5e1");
  ramaDer.setAttribute("material", "metalness: 0.8; roughness: 0.2");
  forkGeomEl.appendChild(ramaDer);

  // Esfera extrema derecha
  const nodeDer = document.createElement("a-sphere");
  nodeDer.setAttribute("radius", "0.064");
  nodeDer.setAttribute("position", "0.168 0.272 0");
  nodeDer.setAttribute("color", "#cbd5e1");
  nodeDer.setAttribute("material", "metalness: 0.8; roughness: 0.2");
  forkGeomEl.appendChild(nodeDer);

  forksTrophyEl.appendChild(forkGeomEl);

  const textForks = document.createElement("a-text");
  textForks.setAttribute("value", `${forksCount}\nFORKS`);
  textForks.setAttribute("position", "0 2.8 0");
  textForks.setAttribute("align", "center");
  textForks.setAttribute("color", "#fff");
  textForks.setAttribute("width", "4.8");
  textForks.setAttribute("font", "https://cdn.aframe.io/fonts/Exo2Bold.fnt");
  textForks.setAttribute("side", "double");
  forksTrophyEl.appendChild(textForks);

  scene.appendChild(forksTrophyEl);
  console.log(
    `ViZzo // Trofeos creados: ${starsCount} Stars, ${forksCount} Forks.`,
  );
}

/**
 * babia-pie: gráfico de sectores/tarta 3D.
 */
export function buildPie(scene, dash, loaderId, pos) {
  const m = dash.mappings || {};
  const vizEl = document.createElement("a-entity");
  vizEl.setAttribute("id", "vizzo-viz-" + dash.id);
  vizEl.setAttribute("data-dataset", dash.dataset);
  vizEl.setAttribute(
    "position",
    pos.x + " " + (PODIUM_HEIGHT + 1.2) + " " + pos.z,
  );
  vizEl.setAttribute("rotation", `90 ${pos.rotY} 0`);
  vizEl.setAttribute("scale", "0.8 0.8 0.8");
  vizEl.setAttribute(
    "babia-pie",
    [
      "from: " + loaderId,
      "key: " + (m.key || "key"),
      "size: " + (m.size || "size"),
      "legend: true",
      "animation: true",
      "titlePosition: 2 0 -3",
      "palette: " + getRandomPalette(),
    ].join("; "),
  );

  scene.appendChild(vizEl);
  vizEl.setAttribute("vizzo-podio", "");
  console.log("ViZzo // babia-pie creado sobre pedestal");
  buildControlPanel(scene, dash, "vizzo-viz-" + dash.id, pos, "doughnut");
}
