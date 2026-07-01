// control-panel.js - Contains the logic and configuration to create 3D control panels/consoles

// Configuración de posición, rotación e interactividad (botones) de los paneles de control de cada tipo de dashboard.
const PANEL_CONFIGS = {
  boats: {
    y: 0.4,
    dist: 3.4,
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
        x: -0.5,
        y: -0.3,
        w: 0.32,
        h: 0.07,
      },
      {
        text: "+0.1 ESC",
        action: "scale-up",
        x: -0.18,
        y: -0.3,
        w: 0.26,
        h: 0.07,
      },
      {
        text: "-0.1 ESC",
        action: "scale-down",
        x: 0.18,
        y: -0.3,
        w: 0.26,
        h: 0.07,
      },
      {
        text: "WIREFRAMES",
        action: "wireframe",
        x: 0.5,
        y: -0.3,
        w: 0.32,
        h: 0.07,
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
    dist: 3,
    height: 0.75,
    buttons: [
      { text: "EXPLICAR", action: "explain-ai", x: 0, y: 0.08, w: 0.6, h: 0.09 },
      { text: "+0.1 ESC", action: "scale-up", x: -0.28, y: -0.12, w: 0.45, h: 0.09 },
      { text: "-0.1 ESC", action: "scale-down", x: 0.28, y: -0.12, w: 0.45, h: 0.09 },
    ],
  },
  doughnut: {
    y: 0.45,
    dist: 3,
    height: 0.75,
    buttons: [
      { text: "EXPLICAR", action: "explain-ai", x: 0, y: 0.08, w: 0.6, h: 0.09 },
      { text: "+0.1 ESC", action: "scale-up", x: -0.28, y: -0.12, w: 0.45, h: 0.09 },
      { text: "-0.1 ESC", action: "scale-down", x: 0.28, y: -0.12, w: 0.45, h: 0.09 },
    ],
  },
  barsmap: {
    y: 0.45,
    dist: 3,
    height: 0.75,
    buttons: [
      { text: "COMMITS/INS", action: "cycle-height", x: -0.38, y: 0.08, w: 0.55, h: 0.09 },
      { text: "EXPLICAR", action: "explain-ai", x: 0.38, y: 0.08, w: 0.55, h: 0.09 },
      { text: "+0.1 ESC", action: "scale-up", x: -0.28, y: -0.12, w: 0.45, h: 0.09 },
      { text: "-0.1 ESC", action: "scale-down", x: 0.28, y: -0.12, w: 0.45, h: 0.09 },
    ],
  },
  network: {
    y: 0.45,
    dist: 3,
    height: 0.75,
    buttons: [
      { text: "EXPLICAR", action: "explain-ai", x: 0, y: 0.08, w: 0.6, h: 0.09 },
      { text: "+0.1 ESC", action: "scale-up", x: -0.28, y: -0.12, w: 0.45, h: 0.09 },
      { text: "-0.1 ESC", action: "scale-down", x: 0.28, y: -0.12, w: 0.45, h: 0.09 },
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
    panelX = 0;
    panelY = cfg.y || 0.4; // cerca del suelo pero levantado para visibilidad completa
    panelZ = 23.2;
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
  // Standard title "CODE COMPLEXITY BOATS" has 21 chars, fits on width 1.9
  // 1.9 / 21 = ~0.09. Let's use 0.085 per char + 0.3 offset, minimum 1.9 meters wide
  var panelWidth = Math.max(1.9, titleLen * 0.085 + 0.3);
  if (type === "barsmap") {
    panelWidth = Math.max(panelWidth, 2.2);
  } else if (type === "boats") {
    panelWidth = 1.46; // Fixed compact width for boats holographic console
  }

  var panelEl = document.createElement("a-entity");
  panelEl.setAttribute("id", "vizo-panel-" + dash.id);
  panelEl.setAttribute("data-viz-type", type);
  panelEl.setAttribute("position", `${panelX} ${panelY} ${panelZ}`);
  panelEl.setAttribute("rotation", `0 ${yawDegrees} 0`);

  // Create tilted sub-entity for the screen plate
  var screenEl = document.createElement("a-entity");
  var tiltAngle = type === "boats" ? "-50 0 0" : "-65 0 0";
  screenEl.setAttribute("rotation", tiltAngle);

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

  // Glowing borders (dynamic size/thickness for compact holographic look)
  var borderThickness = type === "boats" ? 0.015 : 0.04;
  var borderDepth = type === "boats" ? 0.01 : 0.02;
  var borderZOffset = type === "boats" ? 0.005 : 0.01;
  var borderMargin = type === "boats" ? 0.015 : 0.05;

  var borderTop = document.createElement("a-box");
  borderTop.setAttribute("position", `0 ${halfHeight} ${borderZOffset}`);
  borderTop.setAttribute("width", (panelWidth + borderMargin).toString());
  borderTop.setAttribute("height", borderThickness.toString());
  borderTop.setAttribute("depth", borderDepth.toString());
  borderTop.setAttribute("color", "#00d4ff");
  borderTop.setAttribute("emissive", "#00d4ff");
  borderTop.setAttribute("emissive-intensity", "1.5");
  screenEl.appendChild(borderTop);

  var borderBottom = document.createElement("a-box");
  borderBottom.setAttribute("position", `0 ${-halfHeight} ${borderZOffset}`);
  borderBottom.setAttribute("width", (panelWidth + borderMargin).toString());
  borderBottom.setAttribute("height", borderThickness.toString());
  borderBottom.setAttribute("depth", borderDepth.toString());
  borderBottom.setAttribute("color", "#00d4ff");
  borderBottom.setAttribute("emissive", "#00d4ff");
  borderBottom.setAttribute("emissive-intensity", "1.5");
  screenEl.appendChild(borderBottom);

  var borderLeft = document.createElement("a-box");
  borderLeft.setAttribute("position", `${-panelWidth / 2} 0 ${borderZOffset}`);
  borderLeft.setAttribute("width", borderThickness.toString());
  borderLeft.setAttribute("height", panelHeight.toString());
  borderLeft.setAttribute("depth", borderDepth.toString());
  borderLeft.setAttribute("color", "#00d4ff");
  borderLeft.setAttribute("emissive", "#00d4ff");
  borderLeft.setAttribute("emissive-intensity", "1.5");
  screenEl.appendChild(borderLeft);

  var borderRight = document.createElement("a-box");
  borderRight.setAttribute("position", `${panelWidth / 2} 0 ${borderZOffset}`);
  borderRight.setAttribute("width", borderThickness.toString());
  borderRight.setAttribute("height", panelHeight.toString());
  borderRight.setAttribute("depth", borderDepth.toString());
  borderRight.setAttribute("color", "#00d4ff");
  borderRight.setAttribute("emissive", "#00d4ff");
  borderRight.setAttribute("emissive-intensity", "1.5");
  screenEl.appendChild(borderRight);

  // Title text - Uses custom dashboard title
  var titleText = document.createElement("a-text");
  titleText.setAttribute("value", titleTextValue);
  var titleY = type === "boats" ? halfHeight - 0.07 : halfHeight - 0.08;
  var titleWrap =
    type === "boats" ? Math.max(26, titleLen + 4) : Math.max(24, titleLen + 3);
  titleText.setAttribute("position", `0 ${titleY} 0.02`);
  titleText.setAttribute("align", "center");
  titleText.setAttribute("color", "#4af7a0");
  titleText.setAttribute("emissive", "#4af7a0");
  titleText.setAttribute("emissive-intensity", "1");
  titleText.setAttribute("width", (panelWidth - 0.3).toString());
  titleText.setAttribute("wrap-count", titleWrap.toString());
  titleText.setAttribute("font", "https://cdn.aframe.io/fonts/Exo2Bold.fnt");
  screenEl.appendChild(titleText);

  // Render dynamic section headers
  var headers = cfg.headers || [];
  headers.forEach(function (h) {
    var headerText = document.createElement("a-text");
    headerText.setAttribute("value", h.text);
    headerText.setAttribute("position", `${h.x} ${h.y} 0.02`);
    headerText.setAttribute("align", "center");
    headerText.setAttribute("color", "#a5b4fc");
    headerText.setAttribute("width", type === "boats" ? "1.1" : "1.8");
    headerText.setAttribute("font", "https://cdn.aframe.io/fonts/Exo2Bold.fnt");
    screenEl.appendChild(headerText);
  });

  // Buttons definitions dynamically based on viz type config
  var buttons = cfg.buttons || [];

  // Generate A-Frame button entities
  buttons.forEach(function (btn) {
    var btnEl = document.createElement("a-entity");
    btnEl.setAttribute("position", `${btn.x} ${btn.y} 0.02`);
    btnEl.setAttribute(
      "vizo-control-btn",
      `action: ${btn.action}; targetId: ${vizId}; vizType: ${type}; value: ${btn.value || ""}`,
    );

    var btnWidth = btn.w || (btn.action === "explain-ai" ? 0.72 : 0.52);
    var btnHeight =
      btn.h ||
      (btn.action === "explain-ai" || btn.action === "wireframe" ? 0.14 : 0.11);
    var btnBorderWidth = btnWidth + 0.02;
    var btnBorderHeight = btnHeight + 0.02;

    // Interactive button box base (thinner, sleeker height and depth)
    var btnBase = document.createElement("a-box");
    btnBase.setAttribute("class", "clickable vizo-btn-base");
    btnBase.setAttribute("width", btnWidth.toString());
    btnBase.setAttribute("height", btnHeight.toString());
    btnBase.setAttribute("depth", "0.015");
    btnBase.setAttribute("color", "#002a5a");
    btnBase.setAttribute("emissive", "#002a5a");
    btnBase.setAttribute("emissive-intensity", "0.5");
    btnBase.setAttribute("material", "roughness: 0.2; metalness: 0.8");
    btnEl.appendChild(btnBase);

    // Glowing solid backplate border (thinner, more precise cyberpunk outlines)
    var btnBorder = document.createElement("a-box");
    btnBorder.setAttribute("class", "vizo-btn-border");
    btnBorder.setAttribute("position", "0 0 -0.008");
    btnBorder.setAttribute("width", btnBorderWidth.toString());
    btnBorder.setAttribute("height", btnBorderHeight.toString());
    btnBorder.setAttribute("depth", "0.005");
    btnBorder.setAttribute("color", "#00d4ff");
    btnBorder.setAttribute("emissive", "#00d4ff");
    btnBorder.setAttribute("emissive-intensity", "1.2");
    btnBorder.setAttribute("material", "roughness: 0.1; metalness: 0.9");
    btnEl.appendChild(btnBorder);

    // Label text (dynamically scaled width to fit small button borders)
    var btnTxt = document.createElement("a-text");
    btnTxt.setAttribute("value", btn.text);
    btnTxt.setAttribute("position", "0 0 0.01");
    btnTxt.setAttribute("align", "center");
    btnTxt.setAttribute("color", "#00d4ff");
    btnTxt.setAttribute("emissive", "#00d4ff");
    btnTxt.setAttribute("emissive-intensity", "1.5");
    btnTxt.setAttribute(
      "width",
      (btnWidth * (type === "boats" ? 2.8 : 2.5)).toString(),
    );
    btnTxt.setAttribute("font", "https://cdn.aframe.io/fonts/Exo2Bold.fnt");
    btnEl.appendChild(btnTxt);

    screenEl.appendChild(btnEl);
  });

  panelEl.appendChild(screenEl);

  // Futuristic Metallic Console Desk Stand (only for non-boats dashboard panels)
  if (type !== "boats") {
    var standCol = document.createElement("a-cylinder");
    standCol.setAttribute("radius", "0.04");
    standCol.setAttribute("height", panelY.toString());
    standCol.setAttribute("color", "#101828");
    standCol.setAttribute("roughness", "0.5");
    standCol.setAttribute("metalness", "0.8");
    standCol.setAttribute("position", `0 ${-panelY / 2} 0`);
    panelEl.appendChild(standCol);

    var standBase = document.createElement("a-cylinder");
    standBase.setAttribute("radius", "0.3");
    standBase.setAttribute("height", "0.05");
    standBase.setAttribute("color", "#101828");
    standBase.setAttribute("roughness", "0.4");
    standBase.setAttribute("metalness", "0.9");
    standBase.setAttribute("position", `0 ${-(panelY - 0.02)} 0`);
    panelEl.appendChild(standBase);

    // Solid box collider for player collision resolution dynamically sized
    var solidEl = document.createElement("a-entity");
    solidEl.setAttribute(
      "solid-box",
      `cx: ${panelX}; cy: 0.5; cz: ${panelZ}; halfW: ${(panelWidth / 2 + 0.05).toFixed(2)}; halfH: 0.5; halfD: 0.4`,
    );
    // scene.appendChild(solidEl);
  }

  scene.appendChild(panelEl);
  console.log(
    "ViZo // Panel de Control creado para el dashboard (" +
      type +
      ") como " +
      (type === "boats"
        ? "consola holografica flotante"
        : "consola de escritorio inclinada"),
  );
}

// Export for global access
window.ViZoBuilders = window.ViZoBuilders || {};
window.ViZoBuilders.PANEL_CONFIGS = PANEL_CONFIGS;
window.ViZoBuilders.buildControlPanel = buildControlPanel;
