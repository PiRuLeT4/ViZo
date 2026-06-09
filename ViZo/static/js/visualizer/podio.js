// podio.js - Crea un podio dinámico usando un componente de A-Frame seguro
AFRAME.registerComponent("vizo-podio", {
  init: function () {
    try {
      this.podiumEl = document.createElement("a-entity");
      this.podiumEl.setAttribute("id", "podio-for-" + this.el.id);

      this.base = document.createElement("a-box");
      this.base.setAttribute("color", "#081329");
      this.base.setAttribute("material", "metalness: 0.8; roughness: 0.2");

      this.border = document.createElement("a-plane");
      this.border.setAttribute("rotation", "-90 0 0");
      this.border.setAttribute("color", "#00d4ff");
      this.border.setAttribute(
        "material",
        "shader: flat; transparent: true; opacity: 0.8",
      );

      this.light = document.createElement("a-light");
      this.light.setAttribute("type", "point");
      this.light.setAttribute("color", "#00d4ff");
      this.light.setAttribute("intensity", "0.3");

      this.podiumEl.appendChild(this.base);
      this.podiumEl.appendChild(this.border);
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
      console.error("Error en vizo-podio init:", e);
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

        const margin = 1.0;
        const w = size.x + margin;
        const d = size.z + margin;

        const center = box.getCenter(new THREE.Vector3());
        const height = 0.4;
        const yPos = box.min.y - height / 2;

        this.podiumEl.setAttribute(
          "position",
          `${center.x} ${yPos} ${center.z}`,
        );

        this.base.setAttribute("width", w);
        this.base.setAttribute("depth", d);
        this.base.setAttribute("height", height);

        this.border.setAttribute("width", w + 0.2);
        this.border.setAttribute("height", d + 0.2);
        this.border.setAttribute("position", `0 ${height / 2 - 0.01} 0`);

        this.light.setAttribute("distance", Math.max(w, d) * 1.5);
        this.light.setAttribute("position", `0 ${height / 2 + 0.5} 0`);

        // Reposicionamiento dinámico del panel de control
        const dashId = this.el.id.replace("vizo-viz-", "");
        const panelEl = document.getElementById("vizo-panel-" + dashId);
        if (panelEl) {
          const vizType = panelEl.getAttribute("data-viz-type");
          if (vizType && vizType !== "boats") {
            const panelX = center.x - w / 2 + 0.3;
            const panelZ = center.z + d / 2 + 0.6;
            
            let panelY = 0.45;
            const currentPos = panelEl.getAttribute("position");
            if (currentPos && typeof currentPos === "object" && currentPos.y !== undefined) {
              panelY = currentPos.y;
            } else if (currentPos && typeof currentPos === "string") {
              const parts = currentPos.split(" ");
              if (parts.length >= 2) {
                const parsedY = parseFloat(parts[1]);
                if (!isNaN(parsedY)) panelY = parsedY;
              }
            }
            
            panelEl.setAttribute("position", `${panelX} ${panelY} ${panelZ}`);
          }
        }
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
