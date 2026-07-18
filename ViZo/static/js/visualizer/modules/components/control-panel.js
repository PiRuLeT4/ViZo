/**
 * ViZzo // control-panel.js  —  Interactive 3D Atrils
 */

// Configuración de posición, rotación e interactividad (botones) de los paneles de control de cada tipo de dashboard.
export const PANEL_CONFIGS = {
  boats: {
    y: 0.45,
    dist: 2.6,
    height: 1.2,
    width: 0.85,
    buttons: [
      // Columna Izquierda: Altura de edificios (X: -0.21)
      {
        text: "NLOC",
        action: "set-height",
        value: "nloc",
        x: -0.21,
        y: 0.30,
        w: 0.32,
        h: 0.09,
      },
      {
        text: "CCN",
        action: "set-height",
        value: "ccn",
        x: -0.21,
        y: 0.17,
        w: 0.32,
        h: 0.09,
      },
      {
        text: "COMMITS",
        action: "set-height",
        value: "commits",
        x: -0.21,
        y: 0.04,
        w: 0.32,
        h: 0.09,
      },
      {
        text: "FUNCIONES",
        action: "set-height",
        value: "num_functions",
        x: -0.21,
        y: -0.09,
        w: 0.32,
        h: 0.09,
      },

      // Columna Derecha: Color de edificios (X: 0.21)
      {
        text: "COMMITS",
        action: "set-color",
        value: "commits",
        x: 0.21,
        y: 0.30,
        w: 0.32,
        h: 0.09,
      },
      {
        text: "CCN (AREA)",
        action: "set-color",
        value: "ccn",
        x: 0.21,
        y: 0.17,
        w: 0.32,
        h: 0.09,
      },
      {
        text: "PROPIEDAD",
        action: "set-color",
        value: "ownership",
        x: 0.21,
        y: 0.04,
        w: 0.32,
        h: 0.09,
      },
      {
        text: "EDAD (DIAS)",
        action: "set-color",
        value: "age_days",
        x: 0.21,
        y: -0.09,
        w: 0.32,
        h: 0.09,
      },

      // Controles generales (Abajo, centrado)
      {
        text: "EXPLICAR REPO",
        action: "explain-ai",
        x: 0,
        y: -0.26,
        w: 0.6,
        h: 0.1,
      },
    ],
    headers: [
      { text: "ALTURA", x: -0.21, y: 0.42 },
      { text: "COLOR", x: 0.21, y: 0.42 },
    ],
  },
  cyls: {
    y: 0.45,
    dist: 2.1,
    height: 0.65,
    width: 0.55,
    buttons: [
      { text: "EXPLICAR", action: "explain-ai", x: 0, y: 0.06, w: 0.38, h: 0.09 },
      { text: "COLOR", action: "change-palette", x: 0, y: -0.08, w: 0.38, h: 0.09 },
    ],
  },
  doughnut: {
    y: 0.45,
    dist: 2.1,
    height: 0.65,
    width: 0.55,
    buttons: [
      { text: "EXPLICAR", action: "explain-ai", x: 0, y: 0.06, w: 0.38, h: 0.09 },
      { text: "COLOR", action: "change-palette", x: 0, y: -0.08, w: 0.38, h: 0.09 },
    ],
  },
  barsmap: {
    y: 0.45,
    dist: 3.0,
    height: 0.65,
    width: 0.55,
    buttons: [
      { text: "EXPLICAR", action: "explain-ai", x: 0, y: 0.06, w: 0.38, h: 0.09 },
      { text: "COLOR", action: "change-palette", x: 0, y: -0.08, w: 0.38, h: 0.09 },
    ],
  },
  network: {
    y: 0.45,
    dist: 2.1,
    height: 0.55,
    width: 0.55,
    buttons: [
      { text: "EXPLICAR", action: "explain-ai", x: 0, y: -0.02, w: 0.38, h: 0.09 },
    ],
  },
  bars: {
    y: 0.45,
    dist: 2.1,
    height: 0.65,
    width: 0.55,
    buttons: [
      { text: "EXPLICAR", action: "explain-ai", x: 0, y: 0.06, w: 0.38, h: 0.09 },
      { text: "COLOR", action: "change-palette", x: 0, y: -0.08, w: 0.38, h: 0.09 },
    ],
  },
};

/**
 * Generates an interactive 3D control panel in front of each visualizer
 */
export function buildControlPanel(scene, dash, vizId, pos, type) {
  const cfg = PANEL_CONFIGS[type];
  if (!cfg) return;

  // Orientar y posicionar dinámicamente el panel de control
  var yawDegrees = pos.rotY || 0;
  var panelX, panelY, panelZ;

  // Comprobar si se ha especificado posicionamiento manual en pos o en dash
  var manualPos = null;
  if (pos && (pos.panelX !== undefined || pos.panelPos !== undefined)) {
    manualPos = pos.panelPos || pos;
  } else if (dash && (dash.panelPos !== undefined || dash.panelPosition !== undefined)) {
    manualPos = dash.panelPos || dash.panelPosition;
  }

  if (manualPos && manualPos.panelX !== undefined) {
    // Si viene plano como panelX, panelY, panelZ, panelRotY
    panelX = manualPos.panelX;
    panelY = manualPos.panelY !== undefined ? manualPos.panelY : (cfg.y || 0.45);
    panelZ = manualPos.panelZ;
    yawDegrees = manualPos.panelRotY !== undefined ? manualPos.panelRotY : (pos.rotY || 0);
  } else if (manualPos && manualPos.x !== undefined) {
    // Si viene como un objeto con x, y, z, rotY/rot
    panelX = manualPos.x;
    panelY = manualPos.y !== undefined ? manualPos.y : (cfg.y || 0.45);
    panelZ = manualPos.z;
    yawDegrees = manualPos.rotY !== undefined ? manualPos.rotY : (manualPos.rot !== undefined ? manualPos.rot : (pos.rotY || 0));
  } else {
    // Cálculo automático adaptativo en esquina de dashboards (evita colisiones con gráficos)
    var yawRad = (yawDegrees * Math.PI) / 180;
    var forwardDist = 1.3;
    var rightDist = 1.0;

    // Estimar el tamaño del dataset
    var datasetKey = dash.dataset;
    var data = (window.ViZzoState && window.ViZzoState.dataMap) ? window.ViZzoState.dataMap[datasetKey] : null;
    var numElements = Array.isArray(data) ? data.length : 8;

    if (type === "boats") {
      // Ciudad: Escala 0.24, base dynamicSize (4 a 12)
      var dynamicSize = Math.min(12, Math.max(4, Math.ceil(Math.sqrt(numElements) * 0.6)));
      var extent = (dynamicSize * 0.24) / 2;
      rightDist = extent + 1.4;
      forwardDist = extent + 1.2;
    } else if (type === "bars") {
      // Gráfico de barras 2D: Escala 0.2, separación de barras
      var N = Math.min(numElements, 15);
      var extentX = (N * 1.5 * 0.2) / 2; // Extensión a la derecha del centro en metros
      rightDist = extentX + 0.8;
      forwardDist = 1.4;
    } else if (type === "barsmap") {
      // Mapa de barras 3D: Escala 0.16, cuadrícula max 10x10
      var extent = (10 * 1.5 * 0.16) / 2; // ~1.2 metros
      rightDist = extent + 0.9;
      forwardDist = extent + 0.9;
    } else if (type === "cyls") {
      // Cilindros: Escala 0.12, fila
      var N = Math.min(numElements, 10);
      var extentX = (N * 1.5 * 0.12) / 2;
      rightDist = extentX + 0.8;
      forwardDist = 1.4;
    } else if (type === "doughnut" || type === "pie") {
      // Tarta: Escala 0.5, radio ~1.5
      rightDist = 1.5;
      forwardDist = 1.3;
    } else if (type === "network") {
      // Red: Escala 0.032, radio ~1.3m
      rightDist = 1.8;
      forwardDist = 1.6;
    }

    panelX = pos.x + forwardDist * Math.sin(yawRad) + rightDist * Math.cos(yawRad);
    panelY = cfg.y || 0.45;
    panelZ = pos.z + forwardDist * Math.cos(yawRad) - rightDist * Math.sin(yawRad);

    yawDegrees = pos.rotY || 0; // Paralelo al pedestal (sin inclinación adicional en Y)
  }

  var panelHeight = cfg.height || 0.7;
  var halfHeight = panelHeight / 2;

  // Calculate panel width dynamically based on title length
  var titleTextRaw = dash.title ? dash.title.toUpperCase() : "PANEL DE CONTROL";
  // Remove accents to support Exo2Bold font glyphs
  var titleTextValue = titleTextRaw
    .replace(/[ÁÀÄÂ]/g, "A")
    .replace(/[ÉÈËÊ]/g, "E")
    .replace(/[ÍÌÏÎ]/g, "I")
    .replace(/[ÓÒÖÔ]/g, "O")
    .replace(/[ÚÙÜÛ]/g, "U")
    .replace(/[Ñ]/g, "N");
  var titleLen = titleTextValue.length;
  // Set panel width: from config, or fallback based on type
  var panelWidth = cfg.width || (type === "boats" ? 1.46 : 0.8);

  var panelEl = document.createElement("a-entity");
  panelEl.setAttribute("id", "vizzo-panel-" + dash.id);
  panelEl.setAttribute("data-viz-type", type);
  panelEl.setAttribute("position", `${panelX} ${panelY} ${panelZ}`);
  panelEl.setAttribute("rotation", `0 ${yawDegrees} 0`);

  // Create tilted sub-entity for the screen plate (tilted wood board, floating)
  var screenEl = document.createElement("a-entity");
  var tiltAngle = "-25 0 0";
  screenEl.setAttribute("position", "0 0 0");
  screenEl.setAttribute("rotation", tiltAngle);

  // Back plate: a-box wood frame for the panel
  var backPlate = document.createElement("a-box");
  backPlate.setAttribute("width", (panelWidth + 0.08).toString());
  backPlate.setAttribute("height", (panelHeight + 0.08).toString());
  backPlate.setAttribute("depth", "0.03");
  backPlate.setAttribute("position", "0 0 0");
  backPlate.setAttribute("src", "#marmol-texture");
  backPlate.setAttribute("material", "roughness: 0.8; metalness: 0.1");
  screenEl.appendChild(backPlate);


  // Title text - Uses custom dashboard title
  var titleText = document.createElement("a-text");
  titleText.setAttribute("value", titleTextValue);
  var titleY = halfHeight - 0.07;
  var titleZ = 0.015;
  var titleWrap = type === "boats" ? Math.max(26, titleLen + 4) : Math.max(20, titleLen + 2);
  titleText.setAttribute("position", `0 ${titleY} ${titleZ}`);
  titleText.setAttribute("align", "center");
  titleText.setAttribute("color", "#0f172a");
  titleText.setAttribute("width", (panelWidth - 0.1).toString());
  titleText.setAttribute("wrap-count", titleWrap.toString());
  titleText.setAttribute("font", "https://cdn.aframe.io/fonts/Exo2Bold.fnt");
  screenEl.appendChild(titleText);

  // Render dynamic section headers
  var headers = cfg.headers || [];
  headers.forEach(function (h) {
    var headerText = document.createElement("a-text");
    headerText.setAttribute("value", h.text);
    headerText.setAttribute("position", `${h.x} ${h.y} ${titleZ}`);
    headerText.setAttribute("align", "center");
    headerText.setAttribute("color", "#334155");
    headerText.setAttribute("width", type === "boats" ? "1.1" : (panelWidth - 0.1).toString());
    headerText.setAttribute("font", "https://cdn.aframe.io/fonts/Exo2Bold.fnt");
    screenEl.appendChild(headerText);
  });

  // Buttons definitions dynamically based on viz type config
  var buttons = cfg.buttons || [];

  // Generate A-Frame button entities
  buttons.forEach(function (btn) {
    var btnEl = document.createElement("a-entity");
    var btnZ = 0.015;
    btnEl.setAttribute("position", `${btn.x} ${btn.y} ${btnZ}`);
    btnEl.setAttribute(
      "vizzo-control-btn",
      `action: ${btn.action}; targetId: ${vizId}; vizType: ${type}; value: ${btn.value || ""}`,
    );

    var btnWidth = btn.w || (btn.action === "explain-ai" ? 0.72 : 0.52);
    if (type !== "boats") {
      btnWidth = Math.min(btnWidth, panelWidth - 0.1); // Limit width to fit panel width
    }
    var btnHeight =
      btn.h ||
      (btn.action === "explain-ai" || btn.action === "wireframe" ? 0.14 : 0.11);
    var btnBorderWidth = btnWidth + 0.01;
    var btnBorderHeight = btnHeight + 0.01;

    // Interactive button box base (Clean look with button-texture)
    var btnBase = document.createElement("a-box");
    btnBase.setAttribute("class", "clickable vizzo-btn-base");
    btnBase.setAttribute("width", btnWidth.toString());
    btnBase.setAttribute("height", btnHeight.toString());
    btnBase.setAttribute("depth", "0.012");
    btnBase.setAttribute("src", "#button-texture");
    btnBase.setAttribute("color", "#ffffff");
    btnBase.setAttribute("material", "roughness: 0.6; metalness: 0.1");
    btnEl.appendChild(btnBase);

    // Border (Fine clean slate gray border)
    var btnBorder = document.createElement("a-box");
    btnBorder.setAttribute("class", "vizzo-btn-border");
    btnBorder.setAttribute("position", "0 0 -0.006");
    btnBorder.setAttribute("width", btnBorderWidth.toString());
    btnBorder.setAttribute("height", btnBorderHeight.toString());
    btnBorder.setAttribute("depth", "0.005");
    btnBorder.setAttribute("color", "#cbd5e1");
    btnBorder.setAttribute("material", "roughness: 0.6; metalness: 0.1");
    btnEl.appendChild(btnBorder);

    // Label text (Dark text)
    var btnTxt = document.createElement("a-text");
    btnTxt.setAttribute("value", btn.text);
    btnTxt.setAttribute("position", "0 0 0.008");
    btnTxt.setAttribute("align", "center");
    btnTxt.setAttribute("color", "#334155");
    btnTxt.setAttribute(
      "width",
      (
        btnWidth *
        (type === "boats" ? (btn.action === "explain-ai" ? 2.4 : 2.8) : 2.5)
      ).toString(),
    );
    btnTxt.setAttribute("font", "https://cdn.aframe.io/fonts/Exo2Bold.fnt");
    btnEl.appendChild(btnTxt);

    screenEl.appendChild(btnEl);
  });

  panelEl.appendChild(screenEl);

  scene.appendChild(panelEl);
  console.log(
    "ViZzo // Panel de Control creado para el dashboard (" +
      type +
      ") como atril fisico de madera y metal",
  );
}
