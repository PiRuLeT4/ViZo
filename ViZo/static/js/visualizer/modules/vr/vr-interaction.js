/**
 * vr-interaction.js  —  VR Hand Controllers & Session Manager
 */

import { buildVRWristMenu } from './vr-menu.js';

export function initVRInteraction() {
  const scene = document.querySelector("a-scene");
  const leftController = document.getElementById("left-controller");
  const menuEl = document.getElementById("vr-wrist-menu");

  // Pre-construir el menú inmediatamente para evitar race conditions
  if (menuEl) {
    menuEl.innerHTML = "";
    buildVRWristMenu(menuEl);
    console.log(
      "ViZzo // Menú de Muñeca VR pre-construido en la inicialización."
    );
  }

  function showWristMenu() {
    if (menuEl) {
      console.log("ViZzo // Mostrando Menú de Muñeca VR...");
      menuEl.setAttribute("visible", "true");
    }
  }

  if (leftController && menuEl) {
    leftController.addEventListener("controllerconnected", function (evt) {
      console.log("ViZzo // Evento: controllerconnected en mando izquierdo.");
      showWristMenu();
    });

    leftController.addEventListener("controllerdisconnected", function (evt) {
      console.log("ViZzo // Evento: controllerdisconnected en mando izquierdo.");
      menuEl.setAttribute("visible", "false");
    });
  }

  // Fail-safe: Escuchar al evento enter-vr de la escena
  if (scene && menuEl) {
    scene.addEventListener("enter-vr", function () {
      console.log(
        "ViZzo // Entrando en Realidad Virtual (VR). Activando panel de muñeca."
      );
      showWristMenu();
    });
    scene.addEventListener("exit-vr", function () {
      console.log(
        "ViZzo // Saliendo de Realidad Virtual (VR). Ocultando panel de muñeca."
      );
      menuEl.setAttribute("visible", "false");
    });
  }
}
