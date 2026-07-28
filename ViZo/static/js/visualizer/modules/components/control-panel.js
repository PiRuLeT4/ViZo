/**
 * ViZzo // control-panel.js  —  Interactive 3D Atrils
 */

// Configuración de posición, rotación e interactividad (botones) de los paneles de control de cada tipo de dashboard.
export const PANEL_CONFIGS = {
  boats: {
    y: 0.55,
    dist: 2.6,
    height: 0.88,
    width: 1.48,
    headers: [
      { text: "ALTURA", x: -0.50, y: 0.22 },
      { text: "COLOR", x: -0.14, y: 0.22 },
    ],
    buttons: [
      // Columna 1: Altura de edificios (X: -0.50)
      { text: "NLOC", action: "set-height", value: "nloc", x: -0.50, y: 0.10, w: 0.32, h: 0.09 },
      { text: "CCN", action: "set-height", value: "ccn", x: -0.50, y: -0.02, w: 0.32, h: 0.09 },
      { text: "COMMITS", action: "set-height", value: "commits", x: -0.50, y: -0.14, w: 0.32, h: 0.09 },
      { text: "FUNCIONES", action: "set-height", value: "num_functions", x: -0.50, y: -0.26, w: 0.32, h: 0.09 },

      // Columna 2: Color de edificios (X: -0.14)
      { text: "COMMITS", action: "set-color", value: "commits", x: -0.14, y: 0.10, w: 0.32, h: 0.09 },
      { text: "CCN (AREA)", action: "set-color", value: "ccn", x: -0.14, y: -0.02, w: 0.32, h: 0.09 },
      { text: "PROPIEDAD", action: "set-color", value: "ownership", x: -0.14, y: -0.14, w: 0.32, h: 0.09 },
      { text: "EDAD (DIAS)", action: "set-color", value: "age_days", x: -0.14, y: -0.26, w: 0.32, h: 0.09 },

      // Columna 3: Asistente IA (X: 0.36)
      { text: "EXPLICAR", action: "fetch-ai-info", x: 0.36, y: 0.10, w: 0.44, h: 0.09 },

      { text: "RESUMEN", action: "explain-ai", value: "summary", x: 0.29, y: -0.02, w: 0.30, h: 0.09 },
      { text: "🔊", action: "play-tts", value: "summary", x: 0.51, y: -0.02, w: 0.11, h: 0.09 },

      { text: "PROBLEMAS", action: "explain-ai", value: "problems", x: 0.29, y: -0.14, w: 0.30, h: 0.09 },
      { text: "🔊", action: "play-tts", value: "problems", x: 0.51, y: -0.14, w: 0.11, h: 0.09 },

      { text: "MEJORAS", action: "explain-ai", value: "recommendations", x: 0.29, y: -0.26, w: 0.30, h: 0.09 },
      { text: "🔊", action: "play-tts", value: "recommendations", x: 0.51, y: -0.26, w: 0.11, h: 0.09 },
    ],
  },
  boats_metrics: null,
  boats_ai: null,
  cyls: {
    y: 0.55,
    dist: 2.1,
    height: 0.95,
    width: 0.58,
    buttons: [
      { text: "EXPLICAR", action: "fetch-ai-info", x: 0, y: 0.22, w: 0.48, h: 0.09 },

      { text: "RESUMEN", action: "explain-ai", value: "summary", x: -0.07, y: 0.10, w: 0.34, h: 0.09 },
      { text: "🔊", action: "play-tts", value: "summary", x: 0.18, y: 0.10, w: 0.12, h: 0.09 },

      { text: "PROBLEMAS", action: "explain-ai", value: "problems", x: -0.07, y: -0.02, w: 0.34, h: 0.09 },
      { text: "🔊", action: "play-tts", value: "problems", x: 0.18, y: -0.02, w: 0.12, h: 0.09 },

      { text: "MEJORAS", action: "explain-ai", value: "recommendations", x: -0.07, y: -0.14, w: 0.34, h: 0.09 },
      { text: "🔊", action: "play-tts", value: "recommendations", x: 0.18, y: -0.14, w: 0.12, h: 0.09 },

      { text: "CAMBIAR COLOR", action: "change-palette", x: 0, y: -0.26, w: 0.48, h: 0.09 },
    ],
  },
  doughnut: {
    y: 0.55,
    dist: 2.1,
    height: 0.95,
    width: 0.58,
    buttons: [
      { text: "EXPLICAR", action: "fetch-ai-info", x: 0, y: 0.22, w: 0.48, h: 0.09 },

      { text: "RESUMEN", action: "explain-ai", value: "summary", x: -0.07, y: 0.10, w: 0.34, h: 0.09 },
      { text: "🔊", action: "play-tts", value: "summary", x: 0.18, y: 0.10, w: 0.12, h: 0.09 },

      { text: "PROBLEMAS", action: "explain-ai", value: "problems", x: -0.07, y: -0.02, w: 0.34, h: 0.09 },
      { text: "🔊", action: "play-tts", value: "problems", x: 0.18, y: -0.02, w: 0.12, h: 0.09 },

      { text: "MEJORAS", action: "explain-ai", value: "recommendations", x: -0.07, y: -0.14, w: 0.34, h: 0.09 },
      { text: "🔊", action: "play-tts", value: "recommendations", x: 0.18, y: -0.14, w: 0.12, h: 0.09 },

      { text: "CAMBIAR COLOR", action: "change-palette", x: 0, y: -0.26, w: 0.48, h: 0.09 },
    ],
  },
  barsmap: {
    y: 0.55,
    dist: 3.0,
    height: 0.95,
    width: 0.58,
    buttons: [
      { text: "EXPLICAR", action: "fetch-ai-info", x: 0, y: 0.22, w: 0.48, h: 0.09 },

      { text: "RESUMEN", action: "explain-ai", value: "summary", x: -0.07, y: 0.10, w: 0.34, h: 0.09 },
      { text: "🔊", action: "play-tts", value: "summary", x: 0.18, y: 0.10, w: 0.12, h: 0.09 },

      { text: "PROBLEMAS", action: "explain-ai", value: "problems", x: -0.07, y: -0.02, w: 0.34, h: 0.09 },
      { text: "🔊", action: "play-tts", value: "problems", x: 0.18, y: -0.02, w: 0.12, h: 0.09 },

      { text: "MEJORAS", action: "explain-ai", value: "recommendations", x: -0.07, y: -0.14, w: 0.34, h: 0.09 },
      { text: "🔊", action: "play-tts", value: "recommendations", x: 0.18, y: -0.14, w: 0.12, h: 0.09 },

      { text: "CAMBIAR COLOR", action: "change-palette", x: 0, y: -0.26, w: 0.48, h: 0.09 },
    ],
  },
  network: {
    y: 0.55,
    dist: 2.1,
    height: 0.85,
    width: 0.58,
    buttons: [
      { text: "EXPLICAR", action: "fetch-ai-info", x: 0, y: 0.18, w: 0.48, h: 0.09 },

      { text: "RESUMEN", action: "explain-ai", value: "summary", x: -0.07, y: 0.06, w: 0.34, h: 0.09 },
      { text: "🔊", action: "play-tts", value: "summary", x: 0.18, y: 0.06, w: 0.12, h: 0.09 },

      { text: "PROBLEMAS", action: "explain-ai", value: "problems", x: -0.07, y: -0.06, w: 0.34, h: 0.09 },
      { text: "🔊", action: "play-tts", value: "problems", x: 0.18, y: -0.06, w: 0.12, h: 0.09 },

      { text: "MEJORAS", action: "explain-ai", value: "recommendations", x: -0.07, y: -0.18, w: 0.34, h: 0.09 },
      { text: "🔊", action: "play-tts", value: "recommendations", x: 0.18, y: -0.18, w: 0.12, h: 0.09 },
    ],
  },
  bars: {
    y: 0.55,
    dist: 2.1,
    height: 0.95,
    width: 0.58,
    buttons: [
      { text: "EXPLICAR", action: "fetch-ai-info", x: 0, y: 0.22, w: 0.48, h: 0.09 },

      { text: "RESUMEN", action: "explain-ai", value: "summary", x: -0.07, y: 0.10, w: 0.34, h: 0.09 },
      { text: "🔊", action: "play-tts", value: "summary", x: 0.18, y: 0.10, w: 0.12, h: 0.09 },

      { text: "PROBLEMAS", action: "explain-ai", value: "problems", x: -0.07, y: -0.02, w: 0.34, h: 0.09 },
      { text: "🔊", action: "play-tts", value: "problems", x: 0.18, y: -0.02, w: 0.12, h: 0.09 },

      { text: "MEJORAS", action: "explain-ai", value: "recommendations", x: -0.07, y: -0.14, w: 0.34, h: 0.09 },
      { text: "🔊", action: "play-tts", value: "recommendations", x: 0.18, y: -0.14, w: 0.12, h: 0.09 },

      { text: "CAMBIAR COLOR", action: "change-palette", x: 0, y: -0.26, w: 0.48, h: 0.09 },
    ],
  },
};

// Asignar alias para retrocompatibilidad y componentes con nombres de A-Frame
PANEL_CONFIGS.boats_metrics = PANEL_CONFIGS.boats;
PANEL_CONFIGS.boats_ai = PANEL_CONFIGS.boats;
PANEL_CONFIGS["babia-boats"] = PANEL_CONFIGS.boats;
PANEL_CONFIGS["babia-cyls"] = PANEL_CONFIGS.cyls;
PANEL_CONFIGS["babia-doughnut"] = PANEL_CONFIGS.doughnut;
PANEL_CONFIGS.pie = PANEL_CONFIGS.doughnut;
PANEL_CONFIGS["babia-pie"] = PANEL_CONFIGS.doughnut;
PANEL_CONFIGS["babia-barsmap"] = PANEL_CONFIGS.barsmap;
PANEL_CONFIGS["babia-network"] = PANEL_CONFIGS.network;
PANEL_CONFIGS["babia-bars"] = PANEL_CONFIGS.bars;

/**
 * Normaliza cualquier identificador de componente (ej: "babia-cyls" -> "cyls", "pie" -> "doughnut")
 */
function normalizeVizType(type) {
  if (!type) return "cyls";
  var raw = type.toString().toLowerCase().trim();
  var clean = raw.replace("babia-", "");
  if (clean === "pie") return "doughnut";
  if (clean === "boats" || clean === "boats_metrics" || clean === "boats_ai") return "boats";
  if (PANEL_CONFIGS[clean]) return clean;
  return "cyls"; // Fallback por defecto si el tipo no existe en PANEL_CONFIGS
}

/**
 * Calcula la posición central predeterminada para el pedestal de control
 */
function getPanelCenterPosition(dash, vizId, pos, type) {
  var normType = normalizeVizType(type);
  const cfg = PANEL_CONFIGS[normType] || PANEL_CONFIGS["boats_metrics"];
  var yawDegrees = pos.rotY || 0;
  var panelX, panelY, panelZ;

  var manualPos = null;
  if (pos && (pos.panelX !== undefined || pos.panelPos !== undefined)) {
    manualPos = pos.panelPos || pos;
  } else if (dash && (dash.panelPos !== undefined || dash.panelPosition !== undefined)) {
    manualPos = dash.panelPos || dash.panelPosition;
  }

  if (manualPos && manualPos.panelX !== undefined) {
    panelX = manualPos.panelX;
    panelY = manualPos.panelY !== undefined ? manualPos.panelY : (cfg.y || 0.45);
    panelZ = manualPos.panelZ;
    yawDegrees = manualPos.panelRotY !== undefined ? manualPos.panelRotY : (pos.rotY || 0);
  } else if (manualPos && manualPos.x !== undefined) {
    panelX = manualPos.x;
    panelY = manualPos.y !== undefined ? manualPos.y : (cfg.y || 0.45);
    panelZ = manualPos.z;
    yawDegrees = manualPos.rotY !== undefined ? manualPos.rotY : (manualPos.rot !== undefined ? manualPos.rot : (pos.rotY || 0));
  } else {
    var yawRad = (yawDegrees * Math.PI) / 180;
    var forwardDist = 1.8;
    var rightDist = 1.2;

    var datasetKey = dash.dataset;
    var data = (window.ViZzoState && window.ViZzoState.dataMap) ? window.ViZzoState.dataMap[datasetKey] : null;
    var numElements = Array.isArray(data) ? data.length : 8;

    if (normType === "boats" || normType === "boats_metrics" || normType === "boats_ai") {
      var dynamicSize = Math.min(12, Math.max(4, Math.ceil(Math.sqrt(numElements) * 0.6)));
      var extent = (dynamicSize * 0.48) / 2;
      rightDist = extent + 0.2;
      forwardDist = extent + 1.8;
    } else if (normType === "bars") {
      var N = Math.min(numElements, 15);
      var extentX = (N * 1.5 * 0.27) / 2;
      rightDist = extentX + 0.2;
      forwardDist = 1.8;
    } else if (normType === "barsmap") {
      var extent = (10 * 1.5 * 0.21) / 2;
      rightDist = extent + 0.2;
      forwardDist = extent + 1.6;
    } else if (normType === "cyls") {
      var N = Math.min(numElements, 10);
      var extentX = (N * 1.5 * 0.16) / 2;
      rightDist = extentX + 0.2;
      forwardDist = 1.8;
    } else if (normType === "doughnut") {
      rightDist = 1.5;
      forwardDist = 2.0;
    } else if (normType === "network") {
      rightDist = 2.5;
      forwardDist = 2.8;
    }

    panelX = pos.x + forwardDist * Math.sin(yawRad) + rightDist * Math.cos(yawRad);
    panelY = cfg.y || 0.45;
    panelZ = pos.z + forwardDist * Math.cos(yawRad) - rightDist * Math.sin(yawRad);
    yawDegrees = pos.rotY || 0;
  }

  return { panelX, panelY, panelZ, yawDegrees, x: panelX, y: panelY, z: panelZ };
}

/**
 * Construye un atril físico individual
 */
function buildSinglePanel(scene, dash, vizId, panelPos, configType, vizTypeKey, customTitle) {
  var normConfigType = normalizeVizType(configType);
  var normVizKey = normalizeVizType(vizTypeKey);
  const cfg = PANEL_CONFIGS[normConfigType] || PANEL_CONFIGS["cyls"];
  if (!cfg) return;

  var panelX = panelPos.x !== undefined ? panelPos.x : panelPos.panelX;
  var panelY = panelPos.y !== undefined ? panelPos.y : (panelPos.panelY !== undefined ? panelPos.panelY : 0.45);
  var panelZ = panelPos.z !== undefined ? panelPos.z : panelPos.panelZ;
  var yawDegrees = panelPos.yawDegrees !== undefined ? panelPos.yawDegrees : (panelPos.rotY || 0);

  var panelHeight = cfg.height || 0.7;
  var halfHeight = panelHeight / 2;

  var titleTextRaw = customTitle || (dash.title ? dash.title.toUpperCase() : "PANEL DE CONTROL");
  var titleTextValue = titleTextRaw
    .replace(/[ÁÀÄÂ]/g, "A")
    .replace(/[ÉÈËÊ]/g, "E")
    .replace(/[ÍÌÏÎ]/g, "I")
    .replace(/[ÓÒÖÔ]/g, "O")
    .replace(/[ÚÙÜÛ]/g, "U")
    .replace(/[Ñ]/g, "N");

  var panelWidth = cfg.width || 0.8;

  var panelEl = document.createElement("a-entity");
  panelEl.setAttribute("id", "vizzo-panel-" + normConfigType + "-" + dash.id);
  panelEl.setAttribute("data-dash-id", dash.id);
  panelEl.setAttribute("data-viz-type", normVizKey);
  panelEl.setAttribute("position", `${panelX} ${panelY} ${panelZ}`);
  panelEl.setAttribute("rotation", `0 ${yawDegrees} 0`);
  panelEl.setAttribute("scale", "1.4 1.4 1.4");

  var screenEl = document.createElement("a-entity");
  var tiltAngle = "-25 0 0";
  screenEl.setAttribute("position", "0 0 0");
  screenEl.setAttribute("rotation", tiltAngle);

  var backPlate = document.createElement("a-box");
  backPlate.setAttribute("width", (panelWidth + 0.08).toString());
  backPlate.setAttribute("height", (panelHeight + 0.08).toString());
  backPlate.setAttribute("depth", "0.03");
  backPlate.setAttribute("position", "0 0 0");
  backPlate.setAttribute("src", "#marmol-texture");
  backPlate.setAttribute("material", "roughness: 0.8; metalness: 0.1");
  screenEl.appendChild(backPlate);

  var titleText = document.createElement("a-text");
  titleText.setAttribute("value", titleTextValue);
  var titleY = halfHeight - 0.08;
  var titleZ = 0.015;
  var maxTitleWidth = Math.max(0.4, panelWidth - 0.12);

  titleText.setAttribute("position", `0 ${titleY} ${titleZ}`);
  titleText.setAttribute("align", "center");
  titleText.setAttribute("color", "#0f172a");
  titleText.setAttribute("width", maxTitleWidth.toString());
  titleText.setAttribute("wrap-count", (normConfigType === "boats" || normConfigType === "boats_metrics") ? "35" : "18");
  titleText.setAttribute("font", "https://cdn.aframe.io/fonts/Exo2Bold.fnt");
  screenEl.appendChild(titleText);

  var headers = cfg.headers || [];
  headers.forEach(function (h) {
    var headerText = document.createElement("a-text");
    headerText.setAttribute("value", h.text);
    headerText.setAttribute("position", `${h.x} ${h.y} ${titleZ}`);
    headerText.setAttribute("align", "center");
    headerText.setAttribute("color", "#334155");
    var isBoats = (normConfigType === "boats" || normConfigType === "boats_metrics");
    headerText.setAttribute("width", isBoats ? "0.45" : maxTitleWidth.toString());
    headerText.setAttribute("wrap-count", isBoats ? "12" : "14");
    headerText.setAttribute("font", "https://cdn.aframe.io/fonts/Exo2Bold.fnt");
    screenEl.appendChild(headerText);
  });

  var buttons = cfg.buttons || [];
  buttons.forEach(function (btn) {
    var btnEl = document.createElement("a-entity");
    var btnZ = 0.015;
    btnEl.setAttribute("position", `${btn.x} ${btn.y} ${btnZ}`);
    btnEl.setAttribute(
      "vizzo-control-btn",
      `action: ${btn.action}; targetId: ${vizId}; vizType: ${normVizKey}; value: ${btn.value || ""}`,
    );

    var btnWidth = btn.w || 0.52;
    var btnHeight = btn.h || 0.09;
    var btnBorderWidth = btnWidth + 0.01;
    var btnBorderHeight = btnHeight + 0.01;

    var btnBase = document.createElement("a-box");
    btnBase.setAttribute("class", "clickable vizzo-btn-base");
    btnBase.setAttribute("width", btnWidth.toString());
    btnBase.setAttribute("height", btnHeight.toString());
    btnBase.setAttribute("depth", "0.012");
    btnBase.setAttribute("src", "#button-texture");
    btnBase.setAttribute("color", "#ffffff");
    btnBase.setAttribute("material", "roughness: 0.6; metalness: 0.1");
    btnEl.appendChild(btnBase);

    var btnBorder = document.createElement("a-box");
    btnBorder.setAttribute("class", "vizzo-btn-border");
    btnBorder.setAttribute("position", "0 0 -0.006");
    btnBorder.setAttribute("width", btnBorderWidth.toString());
    btnBorder.setAttribute("height", btnBorderHeight.toString());
    btnBorder.setAttribute("depth", "0.005");
    btnBorder.setAttribute("color", "#cbd5e1");
    btnBorder.setAttribute("material", "roughness: 0.6; metalness: 0.1");
    btnEl.appendChild(btnBorder);

    if (btn.action === "play-tts") {
      var iconGroup = document.createElement("a-entity");
      iconGroup.setAttribute("class", "vizzo-btn-icon");

      var spkBody = document.createElement("a-box");
      spkBody.setAttribute("position", "-0.024 0 0.008");
      spkBody.setAttribute("width", "0.018");
      spkBody.setAttribute("height", "0.022");
      spkBody.setAttribute("depth", "0.004");
      spkBody.setAttribute("color", "#334155");
      spkBody.setAttribute("material", "roughness: 0.5");
      iconGroup.appendChild(spkBody);

      var spkCone = document.createElement("a-cone");
      spkCone.setAttribute("position", "-0.008 0 0.008");
      spkCone.setAttribute("rotation", "0 0 90");
      spkCone.setAttribute("radius-bottom", "0.020");
      spkCone.setAttribute("radius-top", "0.008");
      spkCone.setAttribute("height", "0.018");
      spkCone.setAttribute("color", "#334155");
      spkCone.setAttribute("material", "roughness: 0.5");
      iconGroup.appendChild(spkCone);

      var wave1 = document.createElement("a-ring");
      wave1.setAttribute("position", "0.008 0 0.008");
      wave1.setAttribute("radius-inner", "0.014");
      wave1.setAttribute("radius-outer", "0.020");
      wave1.setAttribute("theta-start", "-45");
      wave1.setAttribute("theta-length", "90");
      wave1.setAttribute("color", "#334155");
      wave1.setAttribute("side", "double");
      wave1.setAttribute("material", "roughness: 0.5");
      iconGroup.appendChild(wave1);

      var wave2 = document.createElement("a-ring");
      wave2.setAttribute("position", "0.012 0 0.008");
      wave2.setAttribute("radius-inner", "0.024");
      wave2.setAttribute("radius-outer", "0.030");
      wave2.setAttribute("theta-start", "-45");
      wave2.setAttribute("theta-length", "90");
      wave2.setAttribute("color", "#334155");
      wave2.setAttribute("side", "double");
      wave2.setAttribute("material", "roughness: 0.5");
      iconGroup.appendChild(wave2);

      var strikeLine = document.createElement("a-box");
      strikeLine.setAttribute("class", "vizzo-btn-strike");
      strikeLine.setAttribute("position", "-0.002 0 0.012");
      strikeLine.setAttribute("rotation", "0 0 -45");
      strikeLine.setAttribute("width", "0.006");
      strikeLine.setAttribute("height", "0.092");
      strikeLine.setAttribute("depth", "0.004");
      strikeLine.setAttribute("color", "#000");
      strikeLine.setAttribute("material", "roughness: 0.4");
      strikeLine.setAttribute("visible", "true");
      iconGroup.appendChild(strikeLine);

      btnEl.appendChild(iconGroup);
    } else {
      var btnTxt = document.createElement("a-text");
      btnTxt.setAttribute("value", btn.text);
      btnTxt.setAttribute("position", "0 0 0.008");
      btnTxt.setAttribute("align", "center");
      btnTxt.setAttribute("color", "#334155");
      btnTxt.setAttribute("width", (btnWidth * 2.3).toString());
      btnTxt.setAttribute("font", "https://cdn.aframe.io/fonts/Exo2Bold.fnt");
      btnEl.appendChild(btnTxt);
    }

    screenEl.appendChild(btnEl);
  });

  panelEl.appendChild(screenEl);
  scene.appendChild(panelEl);
}

/**
 * Genera los pedestales físicos 3D de control
 */
export function buildControlPanel(scene, dash, vizId, pos, type) {
  var normType = normalizeVizType(type);
  var centerPos = getPanelCenterPosition(dash, vizId, pos, normType);

  var customTitle = (normType === "boats" || normType === "boats_metrics" || normType === "boats_ai")
    ? "CIUDAD DE CODIGO"
    : (dash.title ? dash.title.toUpperCase() : "PANEL DE CONTROL");

  buildSinglePanel(
    scene,
    dash,
    vizId,
    centerPos,
    normType,
    normType,
    customTitle,
  );
}
