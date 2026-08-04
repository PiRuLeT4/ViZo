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

function translateDashboardTitle(title, isEn) {
  if (!title) return isEn ? "CONTROL PANEL" : "PANEL DE CONTROL";
  var raw = title.trim();
  var upper = raw.toUpperCase();

  if (isEn) {
    if (upper.includes("CIUDAD")) return "CODE CITY";
    if (upper.includes("RED DE CO-REVISIONES") || upper.includes("CO-REVISIONES")) return "CODE REVIEWS NETWORK";
    if (upper.includes("RED DE COLABORACION") || upper.includes("RED DE COLABORACIÓN")) return "COLLABORATION NETWORK";
    if (upper.includes("LENGUAJE")) return "LANGUAGES DISTRIBUTION";
    if (upper.includes("HISTORIAL DE COMMIT") || upper.includes("EVOLUCION DEL CODIGO") || upper.includes("EVOLUCIÓN DEL CÓDIGO")) return "COMMITS EVOLUTION";
    if (upper.includes("SALUD DE RELEASES") || upper.includes("EVOLUCION POR RELEASES") || upper.includes("EVOLUCIÓN POR RELEASES")) return "RELEASES HEALTH";
    if (upper.includes("ACTIVIDAD DE LA COMUNIDAD") || upper.includes("ACTIVIDAD COMUNIDAD")) return "COMMUNITY ACTIVITY";
    if (upper.includes("PROPIEDAD DE ARCHIVO") || upper.includes("BUS FACTOR")) return "FILE OWNERSHIP";
    if (upper.includes("ACTIVIDAD TEMPORAL") || upper.includes("ACTIVIDAD DE AUTOR")) return "DEVELOPER ACTIVITY MAP";
    if (upper.includes("ANTIGUEDAD") || upper.includes("ANTIGÜEDAD") || upper.includes("EDAD DEL CÓDIGO") || upper.includes("EDAD DEL CODIGO")) return "CODE AGE & LEGACY";
    if (upper.includes("ARCHIVOS COMPLEJOS") || upper.includes("TOP COMPLEJIDAD") || upper.includes("COMPLEJIDAD CICLOMÁTICA") || upper.includes("COMPLEJIDAD CICLOMATICA")) return "TOP COMPLEX FILES";
    if (upper.includes("CHURN") || upper.includes("HOTSPOT")) return "TOP CHURN FILES";
    if (upper.includes("SALUD DE ISSUES") || upper.includes("ESTADO DE ISSUES")) return "ISSUES HEALTH";
    if (upper.includes("PULL REQUEST")) return "PULL REQUESTS";
    if (upper === "CODE COMPLEXITY BOATS") return "CODE CITY";
    if (upper === "PANEL DE CONTROL") return "CONTROL PANEL";

    return upper;
  } else {
    if (upper === "CODE COMPLEXITY BOATS" || upper === "CODE CITY") return "CIUDAD DE CODIGO";
    if (upper === "CONTROL PANEL") return "PANEL DE CONTROL";
    return upper;
  }
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

  var isEn = localStorage.getItem("vizzo_lang") === "en";
  var defaultTitle = isEn ? "CONTROL PANEL" : "PANEL DE CONTROL";
  var titleTextRaw = customTitle || (dash && dash.title ? translateDashboardTitle(dash.title, isEn) : defaultTitle);
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
  panelEl.setAttribute("rotation", `-22 ${yawDegrees} 0`);
  panelEl.setAttribute("scale", "1.18 1.18 1.18");

  // Wooden backplate frame for the control panel atril
  var woodBackplate = document.createElement("a-box");
  woodBackplate.setAttribute("width", (panelWidth + 0.08).toString());
  woodBackplate.setAttribute("height", (panelHeight + 0.08).toString());
  woodBackplate.setAttribute("depth", "0.04");
  woodBackplate.setAttribute("position", "0 0 -0.022");
  woodBackplate.setAttribute("src", "#panel-texture");
  woodBackplate.setAttribute("material", "roughness: 0.7; metalness: 0.1");
  panelEl.appendChild(woodBackplate);

  // Screen background plate (semi-transparent plate on wood atril)
  var screenEl = document.createElement("a-plane");
  screenEl.setAttribute("width", panelWidth.toString());
  screenEl.setAttribute("height", panelHeight.toString());
  screenEl.setAttribute(
    "material",
    "color: #ffffff; opacity: 0.15; transparent: true; roughness: 0.5; metalness: 0.1",
  );

  // Title text (slate-900 dark text)
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

  // Render headers if defined (for boats / babia-boats-metrics)
  var isBoats = (normConfigType === "boats" || normConfigType === "boats_metrics" || normConfigType === "boats_ai");
  var headers = cfg.headers || [];
  headers.forEach(function (h) {
    var headerText = document.createElement("a-text");
    var isEn = localStorage.getItem("vizzo_lang") === "en";
    var txtVal = h.text;
    if (h.text === "ALTURA") txtVal = isEn ? "HEIGHT" : "ALTURA";
    else if (h.text === "COLOR") txtVal = isEn ? "COLOR" : "COLOR";
    headerText.setAttribute("value", txtVal);
    headerText.setAttribute("position", `${h.x} ${h.y} ${titleZ}`);
    headerText.setAttribute("align", "center");
    headerText.setAttribute("color", "#334155");
    headerText.setAttribute("width", isBoats ? "1.1" : maxTitleWidth.toString());
    headerText.setAttribute("font", "https://cdn.aframe.io/fonts/Exo2Bold.fnt");
    screenEl.appendChild(headerText);
  });

  // Render buttons
  var buttons = cfg.buttons || [];
  buttons.forEach(function (btn) {
    var btnEl = document.createElement("a-entity");
    btnEl.setAttribute("position", `${btn.x} ${btn.y} 0.015`);
    btnEl.setAttribute(
      "vizzo-control-btn",
      `action: ${btn.action || ""}; targetId: ${vizId}; vizType: ${normVizKey}; value: ${btn.value || ""}`,
    );

    var btnWidth = btn.w || 0.34;
    var btnHeight = btn.h || 0.12;

    // Base button plane with texture
    var btnBase = document.createElement("a-box");
    btnBase.setAttribute("class", "clickable vizzo-btn-base");
    btnBase.setAttribute("width", btnWidth.toString());
    btnBase.setAttribute("height", btnHeight.toString());
    btnBase.setAttribute("depth", "0.015");
    btnBase.setAttribute(
      "material",
      "src: #button-texture; color: #ffffff; roughness: 0.6; metalness: 0.1",
    );

    // Attach actions / dataset / component metadata
    if (btn.action) btnBase.setAttribute("data-panel-action", btn.action);
    if (btn.value) btnBase.setAttribute("data-panel-value", btn.value);

    btnBase.setAttribute("data-panel-dash", dash.id);
    btnBase.setAttribute("data-panel-type", normVizKey);

    btnEl.appendChild(btnBase);

    // Fine clean slate border
    var btnBorder = document.createElement("a-box");
    btnBorder.setAttribute("class", "vizzo-btn-border");
    btnBorder.setAttribute("width", (btnWidth + 0.012).toString());
    btnBorder.setAttribute("height", (btnHeight + 0.012).toString());
    btnBorder.setAttribute("depth", "0.008");
    btnBorder.setAttribute("position", "0 0 -0.003");
    btnBorder.setAttribute(
      "material",
      "color: #cbd5e1; roughness: 0.6; metalness: 0.1",
    );
    btnEl.appendChild(btnBorder);

    if (btn.action === "play-tts") {
      var iconGroup = document.createElement("a-entity");
      iconGroup.setAttribute("class", "vizzo-btn-icon");

      var spkBody = document.createElement("a-box");
      spkBody.setAttribute("position", "-0.024 0 0.008");
      spkBody.setAttribute("width", "0.018");
      spkBody.setAttribute("height", "0.022");
      spkBody.setAttribute("depth", "0.004");
      spkBody.setAttribute("material", "color: #334155; roughness: 0.5");
      iconGroup.appendChild(spkBody);

      var spkCone = document.createElement("a-cone");
      spkCone.setAttribute("position", "-0.008 0 0.008");
      spkCone.setAttribute("rotation", "0 0 90");
      spkCone.setAttribute("radius-bottom", "0.020");
      spkCone.setAttribute("radius-top", "0.008");
      spkCone.setAttribute("height", "0.018");
      spkCone.setAttribute("material", "color: #334155; roughness: 0.5");
      iconGroup.appendChild(spkCone);

      var wave1 = document.createElement("a-ring");
      wave1.setAttribute("position", "0.008 0 0.008");
      wave1.setAttribute("radius-inner", "0.014");
      wave1.setAttribute("radius-outer", "0.020");
      wave1.setAttribute("theta-start", "-45");
      wave1.setAttribute("theta-length", "90");
      wave1.setAttribute("side", "double");
      wave1.setAttribute("material", "color: #334155; roughness: 0.5");
      iconGroup.appendChild(wave1);

      var wave2 = document.createElement("a-ring");
      wave2.setAttribute("position", "0.012 0 0.008");
      wave2.setAttribute("radius-inner", "0.024");
      wave2.setAttribute("radius-outer", "0.030");
      wave2.setAttribute("theta-start", "-45");
      wave2.setAttribute("theta-length", "90");
      wave2.setAttribute("side", "double");
      wave2.setAttribute("material", "color: #334155; roughness: 0.5");
      iconGroup.appendChild(wave2);

      var strikeLine = document.createElement("a-box");
      strikeLine.setAttribute("class", "vizzo-btn-strike");
      strikeLine.setAttribute("position", "-0.002 0 0.012");
      strikeLine.setAttribute("rotation", "0 0 -45");
      strikeLine.setAttribute("width", "0.006");
      strikeLine.setAttribute("height", "0.092");
      strikeLine.setAttribute("depth", "0.004");
      strikeLine.setAttribute("material", "color: #000000; roughness: 0.4");
      strikeLine.setAttribute("visible", "true");
      iconGroup.appendChild(strikeLine);

      btnEl.appendChild(iconGroup);
    } else {
      var btnTxt = document.createElement("a-text");
      var isEn = localStorage.getItem("vizzo_lang") === "en";
      var displayBtnText = btn.text;
      if (btn.action === "fetch-ai-info") displayBtnText = isEn ? "EXPLAIN" : "EXPLICAR";
      else if (btn.value === "summary") displayBtnText = isEn ? "SUMMARY" : "RESUMEN";
      else if (btn.value === "problems") displayBtnText = isEn ? "PROBLEMS" : "PROBLEMAS";
      else if (btn.value === "recommendations") displayBtnText = isEn ? "RECOMMENDATIONS" : "MEJORAS";
      else if (btn.action === "change-palette") displayBtnText = isEn ? "CHANGE COLOR" : "CAMBIAR COLOR";
      else if (btn.text === "FUNCIONES") displayBtnText = isEn ? "FUNCTIONS" : "FUNCIONES";
      else if (btn.text === "PROPIEDAD") displayBtnText = isEn ? "OWNERSHIP" : "PROPIEDAD";
      else if (btn.text === "EDAD (DIAS)") displayBtnText = isEn ? "AGE (DAYS)" : "EDAD (DIAS)";

      btnTxt.setAttribute("value", displayBtnText);
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

  var isEn = localStorage.getItem("vizzo_lang") === "en";
  var customTitle = (normType === "boats" || normType === "boats_metrics" || normType === "boats_ai")
    ? (isEn ? "CODE CITY" : "CIUDAD DE CODIGO")
    : translateDashboardTitle(dash ? dash.title : "", isEn);

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
