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

// Configuración de posición, rotación e interactividad (botones) de los paneles de control de cada tipo de dashboard.
const PANEL_CONFIGS = {
  boats: {
    y: 0.9,
    dist: 3.4,
    height: 0.88,
    buttons: [
      { text: "WIREFRAMES", action: "wireframe", x: -0.52, y: -0.05 },
      { text: "CCN/NLOC", action: "swap-mappings", x: 0.52, y: -0.05 },
      { text: "EXPLICAR CON IA", action: "explain-ai", x: 0, y: -0.26 },
    ],
  },
  cyls: {
    y: 0.9,
    dist: 3.6,
    height: 0.7,
    buttons: [
      { text: "EXPLICAR CON IA", action: "explain-ai", x: 0, y: -0.15 }
    ],
  },
  doughnut: {
    y: 0.9,
    dist: 3.2,
    height: 0.7,
    buttons: [
      { text: "EXPLICAR CON IA", action: "explain-ai", x: 0, y: -0.15 }
    ],
  },
  barsmap: {
    y: 0.9,
    dist: 3.6,
    height: 0.7,
    buttons: [
      { text: "COMMITS/INS", action: "cycle-height", x: -0.52, y: -0.15 },
      { text: "EXPLICAR CON IA", action: "explain-ai", x: 0.52, y: -0.15 }
    ],
  },
};

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
      "legend_text: {name}\nNLOC: {nloc} | CCN: {ccn}",
      "color: " + m.height,
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

/**
 * Generates an interactive 3D control panel in front of each visualizer
 */
/**
 * Generates an interactive 3D control panel in front of each visualizer
 */
function buildControlPanel(scene, dash, vizId, pos, type) {
  const cfg = PANEL_CONFIGS[type];
  if (!cfg) return;

  // Orientar y posicionar dinámicamente el panel de control enfrente del pedestal
  const yawDegrees = pos.rotY || 0;
  const yawRad = (yawDegrees * Math.PI) / 180;
  
  // Distancia del panel al centro del visualizador
  const dist = cfg.dist || 3.2;
  
  // Calcular posición global en base a rotación
  var panelX = pos.x - dist * Math.sin(yawRad);
  var panelY = cfg.y;
  var panelZ = pos.z - dist * Math.cos(yawRad);
  
  var panelHeight = cfg.height || 0.7;
  var halfHeight = panelHeight / 2;

  // Calculate panel width dynamically based on title length
  var titleTextValue = dash.title
    ? dash.title.toUpperCase()
    : "PANEL DE CONTROL";
  var titleLen = titleTextValue.length;
  // Standard title "CODE COMPLEXITY BOATS" has 21 chars, fits on width 1.9
  // 1.9 / 21 = ~0.09. Let's use 0.085 per char + 0.3 offset, minimum 1.9 meters wide
  var panelWidth = Math.max(1.9, titleLen * 0.085 + 0.3);
  if (type === "barsmap" || type === "boats") {
    panelWidth = Math.max(panelWidth, 2.2);
  }

  var panelEl = document.createElement("a-entity");
  panelEl.setAttribute("id", "vizo-panel-" + dash.id);
  panelEl.setAttribute("position", `${panelX} ${panelY} ${panelZ}`);
  panelEl.setAttribute("rotation", `0 ${yawDegrees} 0`);

  // Create tilted sub-entity for the screen plate
  var screenEl = document.createElement("a-entity");
  screenEl.setAttribute("rotation", "-30 0 0");

  // Holographic blue semi-transparent base plate
  var plate = document.createElement("a-plane");
  plate.setAttribute("width", panelWidth.toString());
  plate.setAttribute("height", panelHeight.toString());
  plate.setAttribute("color", "#021530");
  plate.setAttribute(
    "material",
    "opacity: 0.8; transparent: true; roughness: 0.1; metalness: 0.9",
  );
  screenEl.appendChild(plate);

  // Glowing borders
  var borderTop = document.createElement("a-box");
  borderTop.setAttribute("position", `0 ${halfHeight} 0.01`);
  borderTop.setAttribute("width", (panelWidth + 0.05).toString());
  borderTop.setAttribute("height", "0.04");
  borderTop.setAttribute("depth", "0.02");
  borderTop.setAttribute("color", "#00d4ff");
  borderTop.setAttribute("emissive", "#00d4ff");
  borderTop.setAttribute("emissive-intensity", "1.5");
  screenEl.appendChild(borderTop);

  var borderBottom = document.createElement("a-box");
  borderBottom.setAttribute("position", `0 ${-halfHeight} 0.01`);
  borderBottom.setAttribute("width", (panelWidth + 0.05).toString());
  borderBottom.setAttribute("height", "0.04");
  borderBottom.setAttribute("depth", "0.02");
  borderBottom.setAttribute("color", "#00d4ff");
  borderBottom.setAttribute("emissive", "#00d4ff");
  borderBottom.setAttribute("emissive-intensity", "1.5");
  screenEl.appendChild(borderBottom);

  var borderLeft = document.createElement("a-box");
  borderLeft.setAttribute("position", `${-panelWidth / 2} 0 0.01`);
  borderLeft.setAttribute("width", "0.04");
  borderLeft.setAttribute("height", panelHeight.toString());
  borderLeft.setAttribute("depth", "0.02");
  borderLeft.setAttribute("color", "#00d4ff");
  borderLeft.setAttribute("emissive", "#00d4ff");
  borderLeft.setAttribute("emissive-intensity", "1.5");
  screenEl.appendChild(borderLeft);

  var borderRight = document.createElement("a-box");
  borderRight.setAttribute("position", `${panelWidth / 2} 0 0.01`);
  borderRight.setAttribute("width", "0.04");
  borderRight.setAttribute("height", panelHeight.toString());
  borderRight.setAttribute("depth", "0.02");
  borderRight.setAttribute("color", "#00d4ff");
  borderRight.setAttribute("emissive", "#00d4ff");
  borderRight.setAttribute("emissive-intensity", "1.5");
  screenEl.appendChild(borderRight);

  // Title text - Uses custom dashboard title
  var titleText = document.createElement("a-text");
  titleText.setAttribute("value", titleTextValue);
  titleText.setAttribute("position", `0 ${halfHeight - 0.13} 0.02`);
  titleText.setAttribute("align", "center");
  titleText.setAttribute("color", "#4af7a0");
  titleText.setAttribute("emissive", "#4af7a0");
  titleText.setAttribute("emissive-intensity", "1");
  titleText.setAttribute("width", (panelWidth - 0.3).toString());
  titleText.setAttribute("wrap-count", Math.max(24, titleLen + 3).toString());
  titleText.setAttribute("font", "https://cdn.aframe.io/fonts/Exo2Bold.fnt");
  screenEl.appendChild(titleText);

  // Buttons definitions dynamically based on viz type config
  var buttons = cfg.buttons || [];

  // Generate A-Frame button entities
  buttons.forEach(function (btn) {
    var btnEl = document.createElement("a-entity");
    btnEl.setAttribute("position", `${btn.x} ${btn.y} 0.02`);
    btnEl.setAttribute(
      "vizo-control-btn",
      `action: ${btn.action}; targetId: ${vizId}; vizType: ${type}`,
    );

    var btnWidth = btn.action === "explain-ai" ? 0.72 : 0.52;
    var btnBorderWidth = btnWidth + 0.04;

    // Interactive button box base
    var btnBase = document.createElement("a-box");
    btnBase.setAttribute("class", "clickable");
    btnBase.setAttribute("width", btnWidth.toString());
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
    btnBorder.setAttribute("width", btnBorderWidth.toString());
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

    screenEl.appendChild(btnEl);
  });

  panelEl.appendChild(screenEl);

  // Futuristic Metallic Console Desk Stand
  var standCol = document.createElement("a-cylinder");
  standCol.setAttribute("radius", "0.04");
  standCol.setAttribute("height", "0.9");
  standCol.setAttribute("color", "#101828");
  standCol.setAttribute("roughness", "0.5");
  standCol.setAttribute("metalness", "0.8");
  standCol.setAttribute("position", "0 -0.45 0");
  panelEl.appendChild(standCol);

  var standBase = document.createElement("a-cylinder");
  standBase.setAttribute("radius", "0.3");
  standBase.setAttribute("height", "0.05");
  standBase.setAttribute("color", "#101828");
  standBase.setAttribute("roughness", "0.4");
  standBase.setAttribute("metalness", "0.9");
  standBase.setAttribute("position", "0 -0.88 0");
  panelEl.appendChild(standBase);

  // Solid box collider for player collision resolution dynamically sized
  var solidEl = document.createElement("a-entity");
  solidEl.setAttribute(
    "solid-box",
    `cx: ${panelX}; cy: 0.5; cz: ${panelZ}; halfW: ${(panelWidth / 2 + 0.05).toFixed(2)}; halfH: 0.5; halfD: 0.4`,
  );
  scene.appendChild(solidEl);

  scene.appendChild(panelEl);
  console.log(
    "ViZo // Panel de Control creado para el dashboard (" +
      type +
      ") como consola de escritorio inclinada",
  );
}

/**
 * Genera dinámicamente un panel holográfico 3D de muñeca para VR anclado al mando izquierdo
 */
function buildVRWristMenu(parentEl) {
  console.log("ViZo // Generando Menú de Muñeca VR holográfico...");

  // Base panel plate (semi-transparente, azul holográfico)
  var plate = document.createElement("a-plane");
  plate.setAttribute("width", "0.85");
  plate.setAttribute("height", "0.85");
  plate.setAttribute("color", "#021530");
  plate.setAttribute("material", "opacity: 0.85; transparent: true; roughness: 0.1; metalness: 0.9");
  parentEl.appendChild(plate);

  // Glowing neón borders
  var borderTop = document.createElement("a-box");
  borderTop.setAttribute("position", "0 0.425 0.01");
  borderTop.setAttribute("width", "0.87");
  borderTop.setAttribute("height", "0.02");
  borderTop.setAttribute("depth", "0.01");
  borderTop.setAttribute("color", "#00d4ff");
  borderTop.setAttribute("emissive", "#00d4ff");
  borderTop.setAttribute("emissive-intensity", "1.5");
  parentEl.appendChild(borderTop);

  var borderBottom = document.createElement("a-box");
  borderBottom.setAttribute("position", "0 -0.425 0.01");
  borderBottom.setAttribute("width", "0.87");
  borderBottom.setAttribute("height", "0.02");
  borderBottom.setAttribute("depth", "0.01");
  borderBottom.setAttribute("color", "#00d4ff");
  borderBottom.setAttribute("emissive", "#00d4ff");
  borderBottom.setAttribute("emissive-intensity", "1.5");
  parentEl.appendChild(borderBottom);

  var borderLeft = document.createElement("a-box");
  borderLeft.setAttribute("position", "-0.425 0 0.01");
  borderLeft.setAttribute("width", "0.02");
  borderLeft.setAttribute("height", "0.87");
  borderLeft.setAttribute("depth", "0.01");
  borderLeft.setAttribute("color", "#00d4ff");
  borderLeft.setAttribute("emissive", "#00d4ff");
  borderLeft.setAttribute("emissive-intensity", "1.5");
  parentEl.appendChild(borderLeft);

  var borderRight = document.createElement("a-box");
  borderRight.setAttribute("position", "0.425 0 0.01");
  borderRight.setAttribute("width", "0.02");
  borderRight.setAttribute("height", "0.87");
  borderRight.setAttribute("depth", "0.01");
  borderRight.setAttribute("color", "#00d4ff");
  borderRight.setAttribute("emissive", "#00d4ff");
  borderRight.setAttribute("emissive-intensity", "1.5");
  parentEl.appendChild(borderRight);

  // Title header text
  var titleText = document.createElement("a-text");
  titleText.setAttribute("value", "VZ_CONTROLS_VR");
  titleText.setAttribute("position", "0 0.3 0.02");
  titleText.setAttribute("align", "center");
  titleText.setAttribute("color", "#4af7a0");
  titleText.setAttribute("emissive", "#4af7a0");
  titleText.setAttribute("emissive-intensity", "1");
  titleText.setAttribute("width", "1.8");
  titleText.setAttribute("font", "https://cdn.aframe.io/fonts/Exo2Bold.fnt");
  parentEl.appendChild(titleText);

  // Grid layout parameters for buttons (2 columns, 3 rows)
  var buttons = [
    { text: "EXP. BOATS", action: "explain-ai", type: "boats", x: -0.22, y: 0.12 },
    { text: "EXP. CYLS", action: "explain-ai", type: "cyls", x: 0.22, y: 0.12 },
    { text: "EXP. DONUT", action: "explain-ai", type: "doughnut", x: -0.22, y: -0.06 },
    { text: "EXP. BARS", action: "explain-ai", type: "barsmap", x: 0.22, y: -0.06 },
    { text: "W-FRAME", action: "wireframe", type: "boats", x: -0.22, y: -0.24 },
    { text: "SWAP EJES", action: "swap-mappings", type: "boats", x: 0.22, y: -0.24 },
  ];

  buttons.forEach(function (btn) {
    var btnEl = document.createElement("a-entity");
    btnEl.setAttribute("position", `${btn.x} ${btn.y} 0.02`);
    btnEl.setAttribute(
      "vizo-control-btn",
      `action: ${btn.action}; targetId: vizo-viz-dummy; vizType: ${btn.type}`
    );

    // Mini button base box
    var btnBase = document.createElement("a-box");
    btnBase.setAttribute("class", "clickable");
    btnBase.setAttribute("width", "0.38");
    btnBase.setAttribute("height", "0.14");
    btnBase.setAttribute("depth", "0.02");
    btnBase.setAttribute("color", "#002a5a");
    btnBase.setAttribute("emissive", "#002a5a");
    btnBase.setAttribute("emissive-intensity", "0.5");
    btnBase.setAttribute("material", "roughness: 0.2; metalness: 0.8");
    btnEl.appendChild(btnBase);

    // Mini glowing border
    var btnBorder = document.createElement("a-box");
    btnBorder.setAttribute("position", "0 0 -0.005");
    btnBorder.setAttribute("width", "0.4");
    btnBorder.setAttribute("height", "0.16");
    btnBorder.setAttribute("depth", "0.01");
    btnBorder.setAttribute("color", "#00d4ff");
    btnBorder.setAttribute("emissive", "#00d4ff");
    btnBorder.setAttribute("emissive-intensity", "1.2");
    btnBorder.setAttribute("material", "roughness: 0.1; metalness: 0.9");
    btnEl.appendChild(btnBorder);

    // Label text
    var btnTxt = document.createElement("a-text");
    btnTxt.setAttribute("value", btn.text);
    btnTxt.setAttribute("position", "0 0 0.015");
    btnTxt.setAttribute("align", "center");
    btnTxt.setAttribute("color", "#00d4ff");
    btnTxt.setAttribute("emissive", "#00d4ff");
    btnTxt.setAttribute("emissive-intensity", "1.5");
    btnTxt.setAttribute("width", "1.2");
    btnTxt.setAttribute("font", "https://cdn.aframe.io/fonts/Exo2Bold.fnt");
    btnEl.appendChild(btnTxt);

    parentEl.appendChild(btnEl);
  });
}

// Export for global access
window.ViZoBuilders = {
  POSITIONS,
  calculateSatellitePosition,
  buildCity,
  buildCyls,
  buildDoughnut,
  buildBarsmap,
  buildControlPanel,
  buildVRWristMenu,
};
