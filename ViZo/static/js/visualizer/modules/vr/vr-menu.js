/**
 * vr-menu.js - Contains the logic to create 3D holographic wrist menu for VR controllers
 */

/**
 * Genera dinámicamente un panel holográfico 3D de muñeca para VR anclado al mando izquierdo
 */
export function buildVRWristMenu(parentEl) {
  console.log("ViZzo // Generando Menú de Muñeca VR holográfico...");

  // Base panel plate (semi-transparente, azul holográfico)
  var plate = document.createElement("a-plane");
  plate.setAttribute("width", "0.85");
  plate.setAttribute("height", "0.85");
  plate.setAttribute("color", "#021530");
  plate.setAttribute(
    "material",
    "opacity: 0.85; transparent: true; roughness: 0.1; metalness: 0.9",
  );
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
    {
      text: "EXP. BOATS",
      action: "explain-ai",
      type: "boats",
      x: -0.22,
      y: 0.12,
    },
    { text: "EXP. CYLS", action: "explain-ai", type: "cyls", x: 0.22, y: 0.12 },
    {
      text: "EXP. DONUT",
      action: "explain-ai",
      type: "doughnut",
      x: -0.22,
      y: -0.06,
    },
    {
      text: "EXP. BARS",
      action: "explain-ai",
      type: "barsmap",
      x: 0.22,
      y: -0.06,
    },
    { text: "W-FRAME", action: "wireframe", type: "boats", x: -0.22, y: -0.24 },
    {
      text: "SWAP EJES",
      action: "swap-mappings",
      type: "boats",
      x: 0.22,
      y: -0.24,
    },
  ];

  buttons.forEach(function (btn) {
    var btnEl = document.createElement("a-entity");
    btnEl.setAttribute("position", `${btn.x} ${btn.y} 0.02`);
    btnEl.setAttribute(
      "vizzo-control-btn",
      `action: ${btn.action}; targetId: vizzo-viz-dummy; vizType: ${btn.type}`,
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
