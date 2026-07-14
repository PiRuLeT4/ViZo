// control-panel.js - Contains the logic and configuration to create 3D control panels/consoles

// Configuración de posición, rotación e interactividad (botones) de los paneles de control de cada tipo de dashboard.
const PANEL_CONFIGS = {
  boats: {
    y: 0.4,
    dist: 2.6,
    height: 0.8,
    buttons: [
      // Altura de edificios (Y: 0.12)
      {
        text: "NLOC",
        action: "set-height",
        value: "nloc",
        x: -0.48,
        y: 0.12,
        w: 0.28,
        h: 0.07,
      },
      {
        text: "CCN",
        action: "set-height",
        value: "ccn",
        x: -0.16,
        y: 0.12,
        w: 0.28,
        h: 0.07,
      },
      {
        text: "COMMITS",
        action: "set-height",
        value: "commits",
        x: 0.16,
        y: 0.12,
        w: 0.28,
        h: 0.07,
      },
      {
        text: "FUNCIONES",
        action: "set-height",
        value: "num_functions",
        x: 0.48,
        y: 0.12,
        w: 0.28,
        h: 0.07,
      },

      // Color de edificios (Y: -0.10)
      {
        text: "COMMITS",
        action: "set-color",
        value: "commits",
        x: -0.48,
        y: -0.1,
        w: 0.28,
        h: 0.07,
      },
      {
        text: "CCN (AREA)",
        action: "set-color",
        value: "ccn",
        x: -0.16,
        y: -0.1,
        w: 0.28,
        h: 0.07,
      },
      {
        text: "PROPIEDAD",
        action: "set-color",
        value: "ownership",
        x: 0.16,
        y: -0.1,
        w: 0.28,
        h: 0.07,
      },
      {
        text: "EDAD (DIAS)",
        action: "set-color",
        value: "age_days",
        x: 0.48,
        y: -0.1,
        w: 0.28,
        h: 0.07,
      },

      // Controles generales (Y: -0.30)
      {
        text: "EXPLICAR",
        action: "explain-ai",
        x: 0,
        y: -0.3,
        w: 0.35,
        h: 0.05,
      },
    ],
    headers: [
      { text: "ALTURA DE EDIFICIOS", x: 0, y: 0.22 },
      { text: "COLOR DE EDIFICIOS", x: 0, y: 0.0 },
      { text: "CONTROLES GENERALES", x: 0, y: -0.21 },
    ],
  },
  cyls: {
    y: 0.45,
    dist: 2.1,
    height: 0.4,
    buttons: [
      { text: "EXPLICAR", action: "explain-ai", x: 0, y: 0.0, w: 0.6, h: 0.1 },
    ],
  },
  doughnut: {
    y: 0.45,
    dist: 2.1,
    height: 0.4,
    buttons: [
      { text: "EXPLICAR", action: "explain-ai", x: 0, y: 0.0, w: 0.6, h: 0.1 },
    ],
  },
  barsmap: {
    y: 0.45,
    dist: 3.0,
    height: 0.4,
    buttons: [
      { text: "EXPLICAR", action: "explain-ai", x: 0, y: 0.0, w: 0.6, h: 0.1 },
    ],
  },
  network: {
    y: 0.45,
    dist: 2.1,
    height: 0.4,
    buttons: [
      { text: "EXPLICAR", action: "explain-ai", x: 0, y: 0.0, w: 0.6, h: 0.1 },
    ],
  },
  bars: {
    y: 0.45,
    dist: 2.1,
    height: 0.4,
    buttons: [
      { text: "EXPLICAR", action: "explain-ai", x: 0, y: 0.0, w: 0.6, h: 0.1 },
    ],
  },
};

/**
 * Generates an interactive 3D control panel in front of each visualizer
 */
function buildControlPanel(scene, dash, vizId, pos, type) {
  const cfg = PANEL_CONFIGS[type];
  if (!cfg) return;

  // Orientar y posicionar dinámicamente el panel de control enfrente del pedestal
  var yawDegrees = pos.rotY || 0;
  var panelX, panelY, panelZ;

  if (type === "boats") {
    // Colocar el panel enfrente de la ciudad, centrado y cerca del suelo
    panelX = pos.x || 0;
    panelY = cfg.y || 0.4; // cerca del suelo pero levantado para visibilidad completa
    panelZ = pos.z + (cfg.dist || 2.6);
    yawDegrees = 0; // Encarando al usuario de frente
  } else {
    var yawRad = (yawDegrees * Math.PI) / 180;
    var dist = cfg.dist || 3;
    panelX = pos.x + dist * Math.sin(yawRad); // Desplazado hacia la izquierda (esquina del dashboard)
    panelY = cfg.y;
    panelZ = pos.z + dist * Math.cos(yawRad);
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
  // Set panel width: 1.46 for boats, 0.8 (compact holographic) for others
  var panelWidth = type === "boats" ? 1.46 : 0.8;

  var panelEl = document.createElement("a-entity");
  panelEl.setAttribute("id", "vizo-panel-" + dash.id);
  panelEl.setAttribute("data-viz-type", type);
  panelEl.setAttribute("position", `${panelX} ${panelY} ${panelZ}`);
  panelEl.setAttribute("rotation", `0 ${yawDegrees} 0`);

  // Create tilted sub-entity for the screen plate (tilted like the city panel for all)
  var screenEl = document.createElement("a-entity");
  var tiltAngle = "-50 0 0";
  screenEl.setAttribute("rotation", tiltAngle);

  // Base plate: a-plane for all floating holographic screens
  var plate = document.createElement("a-plane");
  plate.setAttribute("width", panelWidth.toString());
  plate.setAttribute("height", panelHeight.toString());
  plate.setAttribute("color", "#0c0c12");
  // plate.setAttribute("src", "#panel-texture");
  
  plate.setAttribute(
    "material",
    "opacity: 0.9; transparent: true; roughness: 0.5; metalness: 0.1",
  );
  screenEl.appendChild(plate);

  // Glowing borders (thin holographic styling for all)
  var borderThickness = 0.015;
  var borderDepth = 0.01;
  var borderZOffset = 0.005;
  var borderMargin = 0.015;

  var borderTop = document.createElement("a-box");
  borderTop.setAttribute("position", `0 ${halfHeight} ${borderZOffset}`);
  borderTop.setAttribute("width", (panelWidth + borderMargin).toString());
  borderTop.setAttribute("height", borderThickness.toString());
  borderTop.setAttribute("depth", borderDepth.toString());
  borderTop.setAttribute("color", "#8B0A2E");
  borderTop.setAttribute("emissive", "#8B0A2E");
  borderTop.setAttribute("emissive-intensity", "0.8");
  screenEl.appendChild(borderTop);

  var borderBottom = document.createElement("a-box");
  borderBottom.setAttribute("position", `0 ${-halfHeight} ${borderZOffset}`);
  borderBottom.setAttribute("width", (panelWidth + borderMargin).toString());
  borderBottom.setAttribute("height", borderThickness.toString());
  borderBottom.setAttribute("depth", borderDepth.toString());
  borderBottom.setAttribute("color", "#8B0A2E");
  borderBottom.setAttribute("emissive", "#8B0A2E");
  borderBottom.setAttribute("emissive-intensity", "0.8");
  screenEl.appendChild(borderBottom);

  var borderLeft = document.createElement("a-box");
  borderLeft.setAttribute("position", `${-panelWidth / 2} 0 ${borderZOffset}`);
  borderLeft.setAttribute("width", borderThickness.toString());
  borderLeft.setAttribute("height", panelHeight.toString());
  borderLeft.setAttribute("depth", borderDepth.toString());
  borderLeft.setAttribute("color", "#8B0A2E");
  borderLeft.setAttribute("emissive", "#8B0A2E");
  borderLeft.setAttribute("emissive-intensity", "0.8");
  screenEl.appendChild(borderLeft);

  var borderRight = document.createElement("a-box");
  borderRight.setAttribute("position", `${panelWidth / 2} 0 ${borderZOffset}`);
  borderRight.setAttribute("width", borderThickness.toString());
  borderRight.setAttribute("height", panelHeight.toString());
  borderRight.setAttribute("depth", borderDepth.toString());
  borderRight.setAttribute("color", "#8B0A2E");
  borderRight.setAttribute("emissive", "#8B0A2E");
  borderRight.setAttribute("emissive-intensity", "0.8");
  screenEl.appendChild(borderRight);

  // Title text - Uses custom dashboard title
  var titleText = document.createElement("a-text");
  titleText.setAttribute("value", titleTextValue);
  var titleY = halfHeight - 0.07;
  var titleZ = 0.02;
  var titleWrap = type === "boats" ? Math.max(26, titleLen + 4) : Math.max(20, titleLen + 2);
  titleText.setAttribute("position", `0 ${titleY} ${titleZ}`);
  titleText.setAttribute("align", "center");
  titleText.setAttribute("color", "#D4364F");
  titleText.setAttribute("emissive", "#D4364F");
  titleText.setAttribute("emissive-intensity", "0.6");
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
    headerText.setAttribute("color", "#FFF8EB");
    headerText.setAttribute("width", type === "boats" ? "1.1" : (panelWidth - 0.1).toString());
    headerText.setAttribute("font", "https://cdn.aframe.io/fonts/Exo2Bold.fnt");
    screenEl.appendChild(headerText);
  });

  // Buttons definitions dynamically based on viz type config
  var buttons = cfg.buttons || [];

  // Generate A-Frame button entities
  buttons.forEach(function (btn) {
    var btnEl = document.createElement("a-entity");
    var btnZ = type === "boats" ? 0.02 : 0.035;
    btnEl.setAttribute("position", `${btn.x} ${btn.y} ${btnZ}`);
    btnEl.setAttribute(
      "vizo-control-btn",
      `action: ${btn.action}; targetId: ${vizId}; vizType: ${type}; value: ${btn.value || ""}`,
    );

    var btnWidth = btn.w || (btn.action === "explain-ai" ? 0.72 : 0.52);
    if (type !== "boats") {
      btnWidth = Math.min(btnWidth, panelWidth - 0.1); // Limit width to fit 0.5m panel width
    }
    var btnHeight =
      btn.h ||
      (btn.action === "explain-ai" || btn.action === "wireframe" ? 0.14 : 0.11);
    var btnBorderWidth = btnWidth + 0.02;
    var btnBorderHeight = btnHeight + 0.02;

    // Interactive button box base
    var btnBase = document.createElement("a-box");
    btnBase.setAttribute("class", "clickable vizo-btn-base");
    btnBase.setAttribute("width", btnWidth.toString());
    btnBase.setAttribute("height", btnHeight.toString());
    btnBase.setAttribute("depth", "0.015");
    btnBase.setAttribute("color", "#1a1a24");
    btnBase.setAttribute("emissive", "#1a1a24");
    btnBase.setAttribute("emissive-intensity", "0.3");
    btnBase.setAttribute("material", "roughness: 0.5; metalness: 0.1");
    btnEl.appendChild(btnBase);

    // Border
    var btnBorder = document.createElement("a-box");
    btnBorder.setAttribute("class", "vizo-btn-border");
    btnBorder.setAttribute("position", "0 0 -0.008");
    btnBorder.setAttribute("width", btnBorderWidth.toString());
    btnBorder.setAttribute("height", btnBorderHeight.toString());
    btnBorder.setAttribute("depth", "0.005");
    btnBorder.setAttribute("color", "#8B0A2E");
    btnBorder.setAttribute("emissive", "#8B0A2E");
    btnBorder.setAttribute("emissive-intensity", "0.8");
    btnBorder.setAttribute("material", "roughness: 0.5; metalness: 0.1");
    btnEl.appendChild(btnBorder);

    // Label text
    var btnTxt = document.createElement("a-text");
    btnTxt.setAttribute("value", btn.text);
    btnTxt.setAttribute("position", "0 0 0.01");
    btnTxt.setAttribute("align", "center");
    btnTxt.setAttribute("color", "#a0aec0");
    btnTxt.setAttribute("emissive", "#a0aec0");
    btnTxt.setAttribute("emissive-intensity", "0.5");
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
    "ViZo // Panel de Control creado para el dashboard (" +
      type +
      ") como consola holografica flotante",
  );
}

// Export for global access
window.ViZoBuilders = window.ViZoBuilders || {};
window.ViZoBuilders.PANEL_CONFIGS = PANEL_CONFIGS;
window.ViZoBuilders.buildControlPanel = buildControlPanel;
