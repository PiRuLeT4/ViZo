/**
 * ViZzo // podio.js  —  Interactive 3D Pedestals
 */

// Crea un podio dinámico usando un componente de A-Frame seguro
AFRAME.registerComponent("vizzo-podio", {
  init: function () {
    try {
      this.podiumEl = document.createElement("a-entity");
      this.podiumEl.setAttribute("id", "podio-for-" + this.el.id);

      this.base = document.createElement("a-box");
      this.base.setAttribute("src", "#wood-texture");

      this.light = document.createElement("a-light");
      this.light.setAttribute("type", "point");
      this.light.setAttribute("color", "#8B0A2E");
      this.light.setAttribute("intensity", "0");

      this.podiumEl.appendChild(this.base);
      this.podiumEl.appendChild(this.light);

      // Aseguramos que la escena exista usando querySelector
      const scene = document.querySelector("a-scene") || this.el.sceneEl;
      if (scene) {
        scene.appendChild(this.podiumEl);
      }

      this.lastWidth = 0;
      this.lastDepth = 0;
      this.lastCheckTime = 0;
    } catch (e) {
      console.error("Error en vizzo-podio init:", e);
    }
  },

  tick: function (time, timeDelta) {
    try {
      // Throttle manual (1 vez por segundo) para evitar problemas de contexto en AFRAME
      if (time - this.lastCheckTime < 1000) return;
      this.lastCheckTime = time;

      const obj3D = this.el.object3D;
      if (!obj3D || obj3D.children.length === 0) return;

      const box = new THREE.Box3().setFromObject(obj3D);
      if (box.isEmpty()) return;

      const size = box.getSize(new THREE.Vector3());

      // Evitar cajas infinitas o corruptas que crashean A-Frame
      if (!isFinite(box.min.y) || !isFinite(size.x) || !isFinite(size.z))
        return;
      if (size.x < 0.1 && size.z < 0.1) return;

      if (
        Math.abs(size.x - this.lastWidth) > 0.05 ||
        Math.abs(size.z - this.lastDepth) > 0.05
      ) {
        this.lastWidth = size.x;
        this.lastDepth = size.z;

        const margin = 1.5;
        const MAX_PODIUM_SIZE = 13.0;
        const MIN_PODIUM_SIZE = 3.0;
        const w = Math.min(MAX_PODIUM_SIZE, Math.max(MIN_PODIUM_SIZE, size.x + margin));
        const d = Math.min(MAX_PODIUM_SIZE, Math.max(MIN_PODIUM_SIZE, size.z + margin));

        let center = box.getCenter(new THREE.Vector3());

        const height = 0.4;
        const yPos = height / 2;

        this.podiumEl.setAttribute(
          "position",
          `${center.x} ${yPos} ${center.z}`,
        );

        this.base.setAttribute("width", w);
        this.base.setAttribute("depth", d);
        this.base.setAttribute("height", height);

        // Reposicionar dinámicamente el panel de control asociado fuera del podio
        const dashId = this.el.id.replace("vizzo-viz-", "");
        let panels = document.querySelectorAll(`[data-dash-id='${dashId}']`);
        if (panels.length === 0) {
          panels = document.querySelectorAll(`[id*='vizzo-panel-'][id*='${dashId}']`);
        }
        if (panels.length > 0) {
          var rotY = (this.el.getAttribute("rotation") && this.el.getAttribute("rotation").y) || 0;
          var yawRad = (rotY * Math.PI) / 180;

          // Colocar el panel de control en la esquina derecha del podio (vista cámara hacia el gráfico) sin solaparse con la madera
          var forwardDist = (d / 2) + 0.45;
          var baseRightDist = (w / 2) + 0.2;

          panels.forEach((panelEl, pIdx) => {
            var rightDist = baseRightDist;
            if (panels.length > 1) {
              // Separar paneles dobles en la zona derecha si existen (ej. boats_metrics y boats_ai)
              rightDist = baseRightDist + (pIdx === 0 ? -0.4 : 0.6);
            }

            var panelX = center.x + forwardDist * Math.sin(yawRad) + rightDist * Math.cos(yawRad);
            var panelZ = center.z + forwardDist * Math.cos(yawRad) - rightDist * Math.sin(yawRad);

            if (!isNaN(panelX) && !isNaN(panelZ)) {
              var currentPos = panelEl.getAttribute("position");
              var currentRot = panelEl.getAttribute("rotation");

              var targetY = (currentPos && !isNaN(currentPos.y) && currentPos.y > 0) ? currentPos.y : 0.45;

              // Actualizar posición y rotación solo si varían para optimizar rendimiento
              if (currentPos) {
                if (Math.abs(currentPos.x - panelX) > 0.02 || Math.abs(currentPos.z - panelZ) > 0.02) {
                  panelEl.setAttribute("position", `${panelX} ${targetY} ${panelZ}`);
                }
              } else {
                panelEl.setAttribute("position", `${panelX} ${targetY} ${panelZ}`);
              }
              if (currentRot) {
                if (Math.abs(currentRot.y - rotY) > 0.5) {
                  panelEl.setAttribute("rotation", `0 ${rotY} 0`);
                }
              } else {
                panelEl.setAttribute("rotation", `0 ${rotY} 0`);
              }
            }
          });
        }

        this.light.setAttribute("distance", 0);
        this.light.setAttribute("position", `0 0 0`);
      }
    } catch (e) {
      // Ignorar errores en tick para no bloquear el render loop de A-Frame
    }
  },

  remove: function () {
    if (this.podiumEl) {
      this.podiumEl.remove();
    }
  },
});
