(function () {
  // =============================================================================
  // ViZo // vr-interaction.js  —  VR Hand Controllers & Session Manager
  // =============================================================================

  document.addEventListener("DOMContentLoaded", function () {
    const scene = document.querySelector("a-scene");
    const leftController = document.getElementById("left-controller");
    const menuEl = document.getElementById("vr-wrist-menu");

    // Pre-construir el menú inmediatamente para evitar race conditions
    if (
      menuEl &&
      window.ViZoBuilders &&
      typeof window.ViZoBuilders.buildVRWristMenu === "function"
    ) {
      menuEl.innerHTML = "";
      window.ViZoBuilders.buildVRWristMenu(menuEl);
      console.log(
        "ViZo // Menú de Muñeca VR pre-construido en la inicialización.",
      );
    }

    function showWristMenu() {
      if (menuEl) {
        console.log("ViZo // Mostrando Menú de Muñeca VR...");
        menuEl.setAttribute("visible", "true");
      }
    }

    if (leftController && menuEl) {
      leftController.addEventListener("controllerconnected", function (evt) {
        console.log("ViZo // Evento: controllerconnected en mando izquierdo.");
        showWristMenu();
      });

      leftController.addEventListener("controllerdisconnected", function (evt) {
        console.log("ViZo // Evento: controllerdisconnected en mando izquierdo.");
        menuEl.setAttribute("visible", "false");
      });
    }

    // Fail-safe: Escuchar al evento enter-vr de la escena
    if (scene && menuEl) {
      scene.addEventListener("enter-vr", function () {
        console.log(
          "ViZo // Entrando en Realidad Virtual (VR). Activando panel de muñeca.",
        );
        showWristMenu();
      });
      scene.addEventListener("exit-vr", function () {
        console.log(
          "ViZo // Saliendo de Realidad Virtual (VR). Ocultando panel de muñeca.",
        );
        menuEl.setAttribute("visible", "false");
      });
    }
  });
})();
