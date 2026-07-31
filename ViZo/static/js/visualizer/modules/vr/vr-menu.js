/**
 * vr-menu.js - Contains the logic to create 3D holographic wrist menu for VR controllers
 */

import { nextSky, prevSky } from '../components/vizzo-sky-switcher.js';

/**
 * Genera dinámicamente un panel holográfico 3D de muñeca para VR anclado al mando izquierdo
 * Estética adaptada a la escena ViZzo Lab (burdeos / nogal / cálido)
 */
export function buildVRWristMenu(parentEl) {
  console.log("ViZzo // Generando Menú de Muñeca VR adaptado a la escena...");

  // Base panel plate (mismo backplate que los paneles de la sala)
  var plate = document.createElement("a-plane");
  plate.setAttribute("width", "0.85");
  plate.setAttribute("height", "0.85");
  plate.setAttribute("color", "#0c0c12");
  plate.setAttribute(
    "material",
    "opacity: 0.88; transparent: true; roughness: 0.5; metalness: 0.1",
  );
  parentEl.appendChild(plate);

  // Bordes burdeos emisivos (idénticos a los paneles de opacidad de la sala)
  var borderTop = document.createElement("a-box");
  borderTop.setAttribute("position", "0 0.425 0.01");
  borderTop.setAttribute("width", "0.87");
  borderTop.setAttribute("height", "0.02");
  borderTop.setAttribute("depth", "0.01");
  borderTop.setAttribute("color", "#8B0A2E");
  borderTop.setAttribute("emissive", "#8B0A2E");
  borderTop.setAttribute("emissive-intensity", "1.2");
  parentEl.appendChild(borderTop);

  var borderBottom = document.createElement("a-box");
  borderBottom.setAttribute("position", "0 -0.425 0.01");
  borderBottom.setAttribute("width", "0.87");
  borderBottom.setAttribute("height", "0.02");
  borderBottom.setAttribute("depth", "0.01");
  borderBottom.setAttribute("color", "#8B0A2E");
  borderBottom.setAttribute("emissive", "#8B0A2E");
  borderBottom.setAttribute("emissive-intensity", "1.2");
  parentEl.appendChild(borderBottom);

  var borderLeft = document.createElement("a-box");
  borderLeft.setAttribute("position", "-0.425 0 0.01");
  borderLeft.setAttribute("width", "0.02");
  borderLeft.setAttribute("height", "0.87");
  borderLeft.setAttribute("depth", "0.01");
  borderLeft.setAttribute("color", "#8B0A2E");
  borderLeft.setAttribute("emissive", "#8B0A2E");
  borderLeft.setAttribute("emissive-intensity", "1.2");
  parentEl.appendChild(borderLeft);

  var borderRight = document.createElement("a-box");
  borderRight.setAttribute("position", "0.425 0 0.01");
  borderRight.setAttribute("width", "0.02");
  borderRight.setAttribute("height", "0.87");
  borderRight.setAttribute("depth", "0.01");
  borderRight.setAttribute("color", "#8B0A2E");
  borderRight.setAttribute("emissive", "#8B0A2E");
  borderRight.setAttribute("emissive-intensity", "1.2");
  parentEl.appendChild(borderRight);

  // Título (rojo marca ViZzo)
  var titleText = document.createElement("a-text");
  titleText.setAttribute("value", "VZ_CONTROLS_VR");
  titleText.setAttribute("position", "0 0.3 0.02");
  titleText.setAttribute("align", "center");
  titleText.setAttribute("color", "#D4364F");
  titleText.setAttribute("emissive", "#D4364F");
  titleText.setAttribute("emissive-intensity", "0.6");
  titleText.setAttribute("width", "1.8");
  titleText.setAttribute("font", "https://cdn.aframe.io/fonts/Exo2Bold.fnt");
  parentEl.appendChild(titleText);

  var isEn = localStorage.getItem("vizzo_lang") === "en";

  // Grid layout parameters for buttons (2 columns, 4 rows)
  var buttons = [
    // Fila 1: Habitación General
    {
      text: "ROOM ON/OFF",
      component: "vizzo-room-toggle",
      params: "",
      x: 0,
      y: 0.18,
      w: 0.74,
    },
    // Fila 2: Opacidad Suelo
    {
      text: isEn ? "FLOOR +" : "SUELO +",
      component: "vizzo-opacity-control",
      params: "target: #floor-plane; action: increase; valueEl: #val-floor",
      x: -0.2,
      y: 0.02,
      w: 0.34,
    },
    {
      text: isEn ? "FLOOR -" : "SUELO -",
      component: "vizzo-opacity-control",
      params: "target: #floor-plane; action: decrease; valueEl: #val-floor",
      x: 0.2,
      y: 0.02,
      w: 0.34,
    },
    // Fila 3: Opacidad Paredes
    {
      text: isEn ? "WALLS +" : "PAREDES +",
      component: "vizzo-opacity-control",
      params: "target: walls; action: increase",
      x: -0.2,
      y: -0.14,
      w: 0.34,
    },
    {
      text: isEn ? "WALLS -" : "PAREDES -",
      component: "vizzo-opacity-control",
      params: "target: walls; action: decrease",
      x: 0.2,
      y: -0.14,
      w: 0.34,
    },
    // Fila 4: Cielo / Fondos 3D
    {
      text: isEn ? "SKY -" : "CIELO -",
      action: "sky-prev",
      x: -0.2,
      y: -0.30,
      w: 0.34,
    },
    {
      text: isEn ? "SKY +" : "CIELO +",
      action: "sky-next",
      x: 0.2,
      y: -0.30,
      w: 0.34,
    },
  ];

  buttons.forEach(function (btn) {
    var btnEl = document.createElement("a-entity");
    btnEl.setAttribute("position", `${btn.x} ${btn.y} 0.02`);

    var btnWidth = btn.w || 0.34;
    var btnHeight = 0.12;

    // Botón base (metal oscuro de la escena)
    var btnBase = document.createElement("a-box");
    btnBase.setAttribute("class", "clickable");
    btnBase.setAttribute("width", btnWidth.toString());
    btnBase.setAttribute("height", btnHeight.toString());
    btnBase.setAttribute("depth", "0.02");
    btnBase.setAttribute("color", "#1a1a24");
    btnBase.setAttribute("material", "roughness: 0.5; metalness: 0.1");

    // Attach native components if defined
    if (btn.component) {
      btnBase.setAttribute(btn.component, btn.params);
    } else if (btn.action === "sky-next") {
      btnBase.addEventListener("click", () => {
        nextSky();
      });
    } else if (btn.action === "sky-prev") {
      btnBase.addEventListener("click", () => {
        prevSky();
      });
    }

    btnEl.appendChild(btnBase);

    // Borde burdeos sutil del botón
    var btnBorder = document.createElement("a-box");
    btnBorder.setAttribute("position", "0 0 -0.005");
    btnBorder.setAttribute("width", (btnWidth + 0.02).toString());
    btnBorder.setAttribute("height", (btnHeight + 0.02).toString());
    btnBorder.setAttribute("depth", "0.01");
    btnBorder.setAttribute("color", "#8B0A2E");
    btnBorder.setAttribute("emissive", "#8B0A2E");
    btnBorder.setAttribute("emissive-intensity", "0.8");
    btnBorder.setAttribute("material", "roughness: 0.5; metalness: 0.1");
    btnEl.appendChild(btnBorder);

    // Texto del botón (luz cálida de la escena)
    var btnTxt = document.createElement("a-text");
    btnTxt.setAttribute("value", btn.text);
    btnTxt.setAttribute("position", "0 0 0.015");
    btnTxt.setAttribute("align", "center");
    btnTxt.setAttribute("color", "#FFF8EB");
    btnTxt.setAttribute("width", "1.2");
    btnTxt.setAttribute("font", "https://cdn.aframe.io/fonts/Exo2Bold.fnt");
    btnEl.appendChild(btnTxt);

    // Hover: burdeos oscuro (como los botones del sky-switcher)
    btnBase.addEventListener("mouseenter", () => {
      btnEl.setAttribute("scale", "1.06 1.06 1.06");
      btnBase.setAttribute("color", "#2b1016");
      btnBase.setAttribute("emissive", "#2b1016");
      btnBase.setAttribute("emissive-intensity", "0.5");
      btnBorder.setAttribute("color", "#D4364F");
      btnBorder.setAttribute("emissive", "#D4364F");
      btnBorder.setAttribute("emissive-intensity", "1.0");
      btnTxt.setAttribute("color", "#ffffff");
    });
    btnBase.addEventListener("mouseleave", () => {
      btnEl.setAttribute("scale", "1 1 1");
      btnBase.setAttribute("color", "#1a1a24");
      btnBase.removeAttribute("emissive");
      btnBase.removeAttribute("emissive-intensity");
      btnBorder.setAttribute("color", "#8B0A2E");
      btnBorder.setAttribute("emissive", "#8B0A2E");
      btnBorder.setAttribute("emissive-intensity", "0.8");
      btnTxt.setAttribute("color", "#FFF8EB");
    });

    // Click flash (burdeos profundo)
    btnBase.addEventListener("click", () => {
      btnBase.setAttribute("color", "#59041A");
      setTimeout(() => {
        btnBase.setAttribute("color", "#1a1a24");
      }, 150);
    });

    parentEl.appendChild(btnEl);
  });
}
