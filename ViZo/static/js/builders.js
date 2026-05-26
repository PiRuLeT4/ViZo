// builders.js - Contains the logic to create 3D components for ViZo

// Posiciones fijas por número de dashboards
const POSITIONS = [
  { x: 0, y: 0.1, z: 20 }, // Slot 0: BOATS
  { x: -12, y: 0.1, z: 10 }, // Slot 1: CYLS
  { x: 12, y: 0.1, z: 10 }, // Slot 2: DONUT
  { x: 0, y: 0.1, z: 10 }, // Slot 3: BARSMAP
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
  buildControlPanel(scene, dash, "vizo-viz-" + dash.id, pos, "boats");
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
  vizEl.setAttribute("rotation", "0 90 0");
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
  vizEl.setAttribute("rotation", "90 90 0");
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

/**
 * Generates an interactive 3D control panel in front of each visualizer
 */
function buildControlPanel(scene, dash, vizId, pos, type) {
  if (type !== "boats") return;

  var panelX = pos.x;
  var panelY = 2.3;
  var panelZ = pos.z - 3.0;

  var panelEl = document.createElement("a-entity");
  panelEl.setAttribute("id", "vizo-panel-" + dash.id);
  panelEl.setAttribute("position", `${panelX} ${panelY} ${panelZ}`);
  panelEl.setAttribute("rotation", "0 0 0");

  // Holographic blue semi-transparent base plate
  var plate = document.createElement("a-plane");
  plate.setAttribute("width", "1.9");
  plate.setAttribute("height", "0.7");
  plate.setAttribute("color", "#021530");
  plate.setAttribute(
    "material",
    "opacity: 0.8; transparent: true; roughness: 0.1; metalness: 0.9",
  );
  panelEl.appendChild(plate);

  // Glowing borders
  var borderTop = document.createElement("a-box");
  borderTop.setAttribute("position", "0 0.35 0.01");
  borderTop.setAttribute("width", "1.9");
  borderTop.setAttribute("height", "0.04");
  borderTop.setAttribute("depth", "0.02");
  borderTop.setAttribute("color", "#00d4ff");
  borderTop.setAttribute("emissive", "#00d4ff");
  borderTop.setAttribute("emissive-intensity", "1.5");
  panelEl.appendChild(borderTop);

  var borderBottom = document.createElement("a-box");
  borderBottom.setAttribute("position", "0 -0.35 0.01");
  borderBottom.setAttribute("width", "1.9");
  borderBottom.setAttribute("height", "0.04");
  borderBottom.setAttribute("depth", "0.02");
  borderBottom.setAttribute("color", "#00d4ff");
  borderBottom.setAttribute("emissive", "#00d4ff");
  borderBottom.setAttribute("emissive-intensity", "1.5");
  panelEl.appendChild(borderBottom);

  // Title text
  var titleText = document.createElement("a-text");
  titleText.setAttribute("value", "PANEL DE CONTROL: CIUDAD");
  titleText.setAttribute("position", "0 0.22 0.02");
  titleText.setAttribute("align", "center");
  titleText.setAttribute("color", "#4af7a0");
  titleText.setAttribute("emissive", "#4af7a0");
  titleText.setAttribute("emissive-intensity", "1");
  titleText.setAttribute("width", "3.2");
  titleText.setAttribute("font", "https://cdn.aframe.io/fonts/Exo2Bold.fnt");
  panelEl.appendChild(titleText);

  // Buttons definitions (simplificado para elboats - sin ask-ai)
  var buttons = [
    { text: "WIREFRAMES", action: "wireframe", x: -0.4, y: -0.15 },
    { text: "CCN/NLOC", action: "swap-mappings", x: 0.4, y: -0.15 },
  ];

  // Generate A-Frame button entities
  buttons.forEach(function (btn) {
    var btnEl = document.createElement("a-entity");
    btnEl.setAttribute("position", `${btn.x} ${btn.y} 0.02`);
    btnEl.setAttribute(
      "vizo-control-btn",
      `action: ${btn.action}; targetId: ${vizId}; vizType: ${type}`,
    );

    // Interactive button box base
    var btnBase = document.createElement("a-box");
    btnBase.setAttribute("class", "clickable");
    btnBase.setAttribute("width", "0.52");
    btnBase.setAttribute("height", "0.17");
    btnBase.setAttribute("depth", "0.04");
    btnBase.setAttribute("color", "#002a5a");
    btnBase.setAttribute("emissive", "#002a5a");
    btnBase.setAttribute("emissive-intensity", "0.5");
    btnBase.setAttribute("material", "roughness: 0.2; metalness: 0.8");
    btnEl.appendChild(btnBase);

    // Glowing solid backplate border (completely removes diagonal wireframe lines)
    var btnBorder = document.createElement("a-box");
    btnBorder.setAttribute("position", "0 0 -0.01");
    btnBorder.setAttribute("width", "0.56");
    btnBorder.setAttribute("height", "0.21");
    btnBorder.setAttribute("depth", "0.02");
    btnBorder.setAttribute("color", "#00d4ff");
    btnBorder.setAttribute("emissive", "#00d4ff");
    btnBorder.setAttribute("emissive-intensity", "1.2");
    btnBorder.setAttribute("material", "roughness: 0.1; metalness: 0.9");
    btnEl.appendChild(btnBorder);

    // Label text
    var btnTxt = document.createElement("a-text");
    btnTxt.setAttribute("value", btn.text);
    btnTxt.setAttribute("position", "0 0 0.03");
    btnTxt.setAttribute("align", "center");
    btnTxt.setAttribute("color", "#00d4ff");
    btnTxt.setAttribute("emissive", "#00d4ff");
    btnTxt.setAttribute("emissive-intensity", "1.5");
    btnTxt.setAttribute("width", "1.6");
    btnTxt.setAttribute("font", "https://cdn.aframe.io/fonts/Exo2Bold.fnt");
    btnEl.appendChild(btnTxt);

    panelEl.appendChild(btnEl);
  });

  // Solid box collider for player collision resolution
  var solidEl = document.createElement("a-entity");
  solidEl.setAttribute(
    "solid-box",
    `cx: ${panelX}; cy: ${panelY}; cz: ${panelZ}; halfW: 0.9; halfH: 0.4; halfD: 0.1`,
  );
  scene.appendChild(solidEl);

  scene.appendChild(panelEl);
  console.log("ViZo // Panel de Control creado para la ciudad (boats)");
}

// Export for global access
window.ViZoBuilders = {
  POSITIONS,
  buildCity,
  buildCyls,
  buildDoughnut,
  buildBarsmap,
  buildControlPanel,
};
