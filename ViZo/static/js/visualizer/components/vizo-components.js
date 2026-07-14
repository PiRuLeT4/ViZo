/**
 * vizo-components.js
 * ------------------
 * Custom A-Frame components for ViZo:
 * - room-bounds: keeps player inside the room walls.
 * - solid-box: registers an AABB collider.
 * - object-collide: pushes player out of solids.
 * - nav-button: hover + click logic for UI panels.
 */

window.SOLID_BOXES = [];

/* ── room-bounds: keeps player inside the room walls ── */
AFRAME.registerComponent("room-bounds", {
  schema: {
    minX: { type: "number", default: -15 },
    maxX: { type: "number", default: 15 },
    minY: { type: "number", default: 1 },
    maxY: { type: "number", default: 8.5 },
    minZ: { type: "number", default: -15 },
  },
  tick: function () {
    var p = this.el.object3D.position;
    var d = this.data;
    if (p.y < d.minY) p.y = d.minY;
    if (p.y > d.maxY) p.y = d.maxY;
    
    // Aplicar límites laterales de la sala solo dentro de ella (Z entre -16 y 20)
    if (p.z >= -16 && p.z <= 20) {
      if (p.x < d.minX) p.x = d.minX;
      if (p.x > d.maxX) p.x = d.maxX;
    }
    
    // Aplicar límite frontal/trasero absoluto de movimiento
    if (p.z < d.minZ) p.z = d.minZ;
  },
});

/* ── vizo-opacity-control: adjusts material opacity of target elements ── */
AFRAME.registerComponent("vizo-opacity-control", {
  schema: {
    target: { type: "string" },
    action: { type: "string" },
    valueEl: { type: "string" }
  },
  init: function () {
    this.el.addEventListener("click", () => {
      const targetEl = document.querySelector(this.data.target);
      const valueEl = document.querySelector(this.data.valueEl);
      if (!targetEl || !valueEl) return;

      // Get current opacity
      let material = targetEl.getAttribute("material") || {};
      let currentOpacity = parseFloat(material.opacity);
      if (isNaN(currentOpacity)) {
        currentOpacity = parseFloat(targetEl.getAttribute("opacity"));
        if (isNaN(currentOpacity)) {
          currentOpacity = 1.0;
        }
      }

      // Calculate new opacity
      let newOpacity = currentOpacity;
      if (this.data.action === "increase") {
        newOpacity = Math.min(1.0, currentOpacity + 0.1);
      } else {
        newOpacity = Math.max(0.0, currentOpacity - 0.1);
      }

      // Clamp to 1 decimal place
      newOpacity = Math.round(newOpacity * 10) / 10;

      // Apply opacity and ensure transparent is true
      targetEl.setAttribute("material", {
        transparent: true,
        opacity: newOpacity
      });
      targetEl.setAttribute("opacity", newOpacity);

      // Update value display text
      valueEl.setAttribute("value", newOpacity.toFixed(1));
    });

    // Hover effects
    this.el.addEventListener("mouseenter", () => {
      this.el.setAttribute("color", "#8b0a2d");
      this.el.setAttribute("emissive", "#8b0a2d");
      this.el.setAttribute("emissive-intensity", "0.8");
    });
    this.el.addEventListener("mouseleave", () => {
      this.el.setAttribute("color", "#1a1a24");
      this.el.setAttribute("emissive", "#1a1a24");
      this.el.setAttribute("emissive-intensity", "0.0");
    });
  }
});

/* ── solid-box: registers an AABB collider (attach to any entity) ── */
AFRAME.registerComponent("solid-box", {
  schema: {
    cx: { default: 0 }, // centre x
    cy: { default: 0 }, // centre y
    cz: { default: 0 }, // centre z
    halfW: { default: 0.5 }, // half-width  (X)
    halfH: { default: 0.5 }, // half-height (Y)
    halfD: { default: 0.5 }, // half-depth  (Z)
  },
  init: function () {
    var d = this.data;
    this._box = {
      minX: d.cx - d.halfW,
      maxX: d.cx + d.halfW,
      minY: d.cy - d.halfH,
      maxY: d.cy + d.halfH,
      minZ: d.cz - d.halfD,
      maxZ: d.cz + d.halfD,
    };
    window.SOLID_BOXES.push(this._box);
  },
  remove: function () {
    var idx = window.SOLID_BOXES.indexOf(this._box);
    if (idx !== -1) window.SOLID_BOXES.splice(idx, 1);
  },
});

/* ── object-collide: on the camera rig — pushes player out of solids ── */
AFRAME.registerComponent("object-collide", {
  /* Player body is approximated as a vertical capsule with this radius */
  schema: { radius: { type: "number", default: 0.35 } },

  init: function () {
    this._prev = new THREE.Vector3();
  },

  tick: function () {
    var p = this.el.object3D.position;
    var r = this.data.radius;
    var boxes = window.SOLID_BOXES;

    for (var i = 0; i < boxes.length; i++) {
      var b = boxes[i];

      /* broad-phase: is the player anywhere near this box? */
      var closestX = Math.max(b.minX, Math.min(p.x, b.maxX));
      var closestZ = Math.max(b.minZ, Math.min(p.z, b.maxZ));
      var dy = Math.max(0, Math.max(b.minY - p.y, p.y - b.maxY));

      /* horizontal penetration distance */
      var dx = p.x - closestX;
      var dz = p.z - closestZ;
      var distH = Math.sqrt(dx * dx + dz * dz);

      /* If the player's feet are below the top of the box and the
         horizontal footprint overlaps, push them out sideways */
      if (p.y > b.minY - 0.1 && p.y < b.maxY + 2.0 && distH < r) {
        /* resolve on the axis of least penetration */
        var penX = r - Math.abs(p.x - closestX);
        var penZ = r - Math.abs(p.z - closestZ);

        if (penX < penZ) {
          p.x += p.x < closestX ? -penX : penX;
        } else {
          p.z += p.z < closestZ ? -penZ : penZ;
        }
      }
    }
  },
});

/* ── Nav-button: hover + click logic ── */
AFRAME.registerComponent("nav-button", {
  schema: { href: { type: "string", default: "/" } },
  init: function () {
    var el = this.el;
    var data = this.data;

    el.addEventListener("mouseenter", function () {
      el.querySelectorAll("[data-nav-panel]").forEach(function (child) {
        // Save original on first hover just in case elements are dynamic
        if (!child.dataset.origEmissive) {
          child.dataset.origEmissive =
            child.getAttribute("emissive") || "#000000";
          child.dataset.origEmissiveInt =
            child.getAttribute("emissive-intensity") || "0";
        }
        child.setAttribute("emissive", "#ffffff");
        child.setAttribute("emissive-intensity", "3");
      });
      el.setAttribute("scale", "1.04 1.04 1.04");
    });

    el.addEventListener("mouseleave", function () {
      el.querySelectorAll("[data-nav-panel]").forEach(function (child) {
        if (child.dataset.origEmissive) {
          child.setAttribute("emissive", child.dataset.origEmissive);
          child.setAttribute(
            "emissive-intensity",
            child.dataset.origEmissiveInt,
          );
        }
      });
      el.setAttribute("scale", "1 1 1");
    });

    el.addEventListener("click", function () {
      window.location.href = data.href;
    });
  },
});

/* ── vizo-control-btn: interactive 3D buttons for custom dashboard configuration ── */
AFRAME.registerComponent("vizo-control-btn", {
  schema: {
    action: { type: "string" }, // "wireframe", "cycle-height", "cycle-area", "set-height", "set-color"
    targetId: { type: "string" }, // ID of the visualizer (e.g., "vizo-viz-boats-complexity")
    vizType: { type: "string" }, // "boats", "cyls", "doughnut", "barsmap"
    value: { type: "string", default: "" }, // mapping field value (e.g., "nloc", "ccn")
  },
  init: function () {
    var el = this.el;
    var data = this.data;

    // Highlight initial active states after the scene is loaded
    setTimeout(function () {
      var targetEl = document.getElementById(data.targetId);
      if (!targetEl && data.vizType === "boats") {
        targetEl = document.querySelector("[babia-boats]");
      }
      if (targetEl) {
        var panelEl = el.closest("[id^='vizo-panel-']");
        if (panelEl) {
          window.ViZoHelpers.updateButtonStates(panelEl, targetEl, data.vizType);
        }
      }
    }, 600);

    // Hover effects (glowing scaling)
    el.addEventListener("mouseenter", function () {
      el.setAttribute("scale", "1.12 1.12 1.12");
      var text = el.querySelector("a-text");
      if (text) {
        text.setAttribute("color", "#ffffff");
        text.setAttribute("emissive-intensity", "2");
      }
      var base = el.querySelector(".vizo-btn-base");
      var border = el.querySelector(".vizo-btn-border");
      if (base) {
        base.setAttribute("emissive", "#8B0A2E");
        base.setAttribute("emissive-intensity", "1.8");
      }
      if (border) {
        border.setAttribute("color", "#ffffff");
        border.setAttribute("emissive", "#8B0A2E");
        border.setAttribute("emissive-intensity", "3.0");
      }
    });

    el.addEventListener("mouseleave", function () {
      el.setAttribute("scale", "1 1 1");
      var text = el.querySelector("a-text");
      if (text) {
        text.setAttribute("color", "#a0aec0");
        text.setAttribute("emissive-intensity", "0.5");
      }
      var base = el.querySelector(".vizo-btn-base");
      var border = el.querySelector(".vizo-btn-border");
      if (base) {
        // Restore standard colors depending on active state
        var panelEl = el.closest("[id^='vizo-panel-']");
        var targetEl = document.getElementById(data.targetId);
        if (!targetEl && data.vizType === "boats") {
          targetEl = document.querySelector("[babia-boats]");
        }
        if (
          panelEl &&
          targetEl &&
          (data.action === "set-height" || data.action === "set-color")
        ) {
          window.ViZoHelpers.updateButtonStates(panelEl, targetEl, data.vizType);
        } else {
          // Check if button text color is white / border is brand rose (meaning it is active/highlighted)
          var isActive =
            border &&
            (border.getAttribute("color") === "#D4364F" ||
              border.getAttribute("color") === "rgb(212, 54, 79)");
          if (isActive) {
            base.setAttribute("color", "#59041A");
            base.setAttribute("emissive", "#59041A");
            base.setAttribute("emissive-intensity", "0.8");
            if (border) {
              border.setAttribute("color", "#D4364F");
              border.setAttribute("emissive", "#D4364F");
              border.setAttribute("emissive-intensity", "1.5");
            }
            if (text) {
              text.setAttribute("color", "#ffffff");
              text.setAttribute("emissive", "#ffffff");
              text.setAttribute("emissive-intensity", "1.5");
            }
          } else {
            base.setAttribute("color", "#1a1a24");
            base.setAttribute("emissive", "#1a1a24");
            base.setAttribute("emissive-intensity", "0.3");
            if (border) {
              border.setAttribute("color", "#8B0A2E");
              border.setAttribute("emissive", "#8B0A2E");
              border.setAttribute("emissive-intensity", "0.8");
            }
          }
        }
      }
    });

    // Click action
    el.addEventListener("click", function () {
      var targetEl = document.getElementById(data.targetId);
      if (!targetEl) {
        // Búsqueda de soporte para el Menú de Muñeca VR
        if (data.vizType === "boats")
          targetEl = document.querySelector("[babia-boats]");
        else if (data.vizType === "cyls")
          targetEl = document.querySelector("[babia-cyls]");
        else if (data.vizType === "doughnut")
          targetEl = document.querySelector("[babia-doughnut]");
        else if (data.vizType === "barsmap")
          targetEl = document.querySelector("[babia-barsmap]");
      }

      if (!targetEl) {
        console.error("ViZo // Target visualizer not found: " + data.targetId);
        return;
      }

      // Click feedback: change color to a darker/shaded one temporarily
      var base = el.querySelector("a-box, a-cylinder");
      if (base) {
        var origColor = base.getAttribute("color") || "#002a5a";
        var origEmissiveInt = base.getAttribute("emissive-intensity") || "0.5";

        base.setAttribute("color", "#001025"); // Darker shaded color
        base.setAttribute("emissive-intensity", "0.1"); // Dim emissive glow

        setTimeout(function () {
          base.setAttribute("color", origColor);
          base.setAttribute("emissive-intensity", origEmissiveInt);
        }, 150);
      }

      // Execute the requested action
      if (data.action === "wireframe") {
        window.ViZoHelpers.toggleWireframe(targetEl, data.vizType);
      } else if (data.action === "cycle-height") {
        window.ViZoHelpers.cycleHeight(targetEl, data.vizType);
      } else if (data.action === "swap-mappings") {
        window.ViZoHelpers.swapMappings(targetEl, data.vizType);
      } else if (data.action === "set-height") {
        window.ViZoHelpers.setHeight(targetEl, data.vizType, data.value);
        window.ViZoHelpers.updateButtonStates(
          el.closest("[id^='vizo-panel-']"),
          targetEl,
          data.vizType,
        );
      } else if (data.action === "set-color") {
        window.ViZoHelpers.setColor(targetEl, data.vizType, data.value);
        window.ViZoHelpers.updateButtonStates(
          el.closest("[id^='vizo-panel-']"),
          targetEl,
          data.vizType,
        );
      } else if (data.action === "explain-ai") {
        if (
          window.ViZo &&
          window.ViZo.ui &&
          typeof window.ViZo.ui.showExplanation === "function"
        ) {
          window.ViZo.ui.showExplanation(data.vizType, targetEl);
        } else {
          console.warn("ViZo // Asistente Holográfico de UI no inicializado.");
        }
      }
    });
  },
});

/* ── Keyboard Camera Acceleration (Shift key to sprint in browser) ── */
(function () {
  let originalSpeed = null;

  window.addEventListener("keydown", function (e) {
    if (e.key === "Shift") {
      const scene = document.querySelector("a-scene");
      if (scene && !scene.is("vr-mode")) {
        const rig = document.getElementById("rig");
        if (rig) {
          // Read current speed if not saved yet
          const mc = rig.getAttribute("movement-controls");
          if (mc) {
            const currentSpeed = typeof mc === "object" ? mc.speed : parseFloat(mc.match(/speed:\s*([0-9.]+)/)?.[1] || 0.3);
            if (originalSpeed === null) {
              originalSpeed = currentSpeed || 0.3;
            }
            // Accelerate speed (2.5x original speed)
            rig.setAttribute("movement-controls", "speed", (originalSpeed * 2.5).toFixed(2));
          }
        }
      }
    }
  });

  window.addEventListener("keyup", function (e) {
    if (e.key === "Shift") {
      const rig = document.getElementById("rig");
      if (rig && originalSpeed !== null) {
        rig.setAttribute("movement-controls", "speed", originalSpeed);
        originalSpeed = null;
      }
    }
  });
})();
