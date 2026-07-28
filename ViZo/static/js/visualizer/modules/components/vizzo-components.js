/**
 * vizzo-components.js
 * -------------------
 * Custom A-Frame components for ViZzo:
 * - room-bounds: keeps player inside the room walls.
 * - solid-box: registers an AABB collider.
 * - object-collide: pushes player out of solids.
 * - nav-button: hover + click logic for UI panels.
 */

import {
  toggleWireframe,
  cycleHeight,
  swapMappings,
  setHeight,
  setColor,
  updateButtonStates,
} from '../helpers.js';

import { getRandomPalette } from '../builders.js';
import { showExplanation, playTtsExplanation, fetchAiInfo } from '../../ai-assistant.js';

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

/* ── vizzo-opacity-control: adjusts material opacity of target elements ── */
AFRAME.registerComponent("vizzo-opacity-control", {
  schema: {
    target: { type: "string" },
    action: { type: "string" },
    valueEl: { type: "string" }
  },
  init: function () {
    this.el.addEventListener("click", () => {
      let targets = [];
      if (this.data.target === "walls") {
        const leftWall = document.querySelector("#left-wall");
        const rightWall = document.querySelector("#right-wall");
        if (leftWall) targets.push(leftWall);
        if (rightWall) targets.push(rightWall);
      } else {
        const singleTarget = document.querySelector(this.data.target);
        if (singleTarget) targets.push(singleTarget);
      }

      if (targets.length === 0) return;

      // Get current opacity from the first target
      const baseEl = targets[0];
      let material = baseEl.getAttribute("material") || {};
      let currentOpacity = parseFloat(material.opacity);
      if (isNaN(currentOpacity)) {
        currentOpacity = parseFloat(baseEl.getAttribute("opacity"));
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

      // Apply to all targets
      targets.forEach((target) => {
        target.setAttribute("material", {
          transparent: true,
          opacity: newOpacity
        });
        target.setAttribute("opacity", newOpacity);
      });

      // Update indicators
      const valueEl = document.querySelector(this.data.valueEl);
      if (valueEl) {
        valueEl.setAttribute("value", newOpacity.toFixed(1));
      }
      if (this.data.target === "walls") {
        const valLeft = document.getElementById("val-left");
        const valRight = document.getElementById("val-right");
        if (valLeft) valLeft.setAttribute("value", newOpacity.toFixed(1));
        if (valRight) valRight.setAttribute("value", newOpacity.toFixed(1));
      }
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

/* ── vizzo-room-toggle: toggles room walls, ceiling, floor opacity and lights visibility ── */
AFRAME.registerComponent("vizzo-room-toggle", {
  init: function () {
    this.roomVisible = true;

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

    // Click toggle action
    this.el.addEventListener("click", () => {
      this.roomVisible = !this.roomVisible;
      const op = this.roomVisible ? 1.0 : 0.0;

      // Define standard visibilities for walls and other elements
      const elements = {
        "#floor-plane": op,
        "#floor-grid": this.roomVisible ? 0.20 : 0.0,
        "#ceiling-plane": op,
        "#left-wall": this.roomVisible ? 0.5 : 0.0,
        "#right-wall": this.roomVisible ? 0.5 : 0.0,
      };

      for (const selector in elements) {
        const targetEl = document.querySelector(selector);
        if (targetEl) {
          targetEl.setAttribute("material", {
            transparent: true,
            opacity: elements[selector],
          });
          targetEl.setAttribute("opacity", elements[selector]);

          // Sync indicator text values on surface opacity controller panel
          if (selector === "#floor-plane") {
            const ind = document.getElementById("val-floor");
            if (ind) ind.setAttribute("value", elements[selector].toFixed(1));
          } else if (selector === "#left-wall") {
            const ind = document.getElementById("val-left");
            if (ind) ind.setAttribute("value", elements[selector].toFixed(1));
          } else if (selector === "#right-wall") {
            const ind = document.getElementById("val-right");
            if (ind) ind.setAttribute("value", elements[selector].toFixed(1));
          }
        }
      }

      // Hide or show ceiling lights
      const lights = document.getElementById("ceiling-lights");
      if (lights) {
        lights.setAttribute("visible", this.roomVisible);
      }

      // Visual feedback on button text
      const text = this.el.querySelector("a-text");
      if (text) {
        text.setAttribute("value", this.roomVisible ? "ROOM: ON" : "ROOM: OFF");
        text.setAttribute("color", this.roomVisible ? "#4af7a0" : "#ff3b30");
      }
    });
  },
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

    // Cache the base scale defined on the HTML attribute
    var baseScale = el.getAttribute("scale") || { x: 1, y: 1, z: 1 };
    if (typeof baseScale === "string") {
      var parts = baseScale.trim().split(/\s+/).map(Number);
      baseScale = { x: parts[0] || 1, y: parts[1] || 1, z: parts[2] || 1 };
    }
    this.baseScale = baseScale;

    el.addEventListener(
      "mouseenter",
      function () {
        el.querySelectorAll("[data-nav-panel]").forEach(function (child) {
          if (!child.dataset.origEmissive) {
            child.dataset.origEmissive =
              child.getAttribute("emissive") || "#000000";
            child.dataset.origEmissiveInt =
              child.getAttribute("emissive-intensity") || "0";
          }
          child.setAttribute("emissive", "#ffffff");
          child.setAttribute("emissive-intensity", "3");
        });
        var bs = this.baseScale || { x: 1, y: 1, z: 1 };
        el.setAttribute(
          "scale",
          `${bs.x * 1.04} ${bs.y * 1.04} ${bs.z * 1.04}`,
        );
      }.bind(this),
    );

    el.addEventListener(
      "mouseleave",
      function () {
        el.querySelectorAll("[data-nav-panel]").forEach(function (child) {
          if (child.dataset.origEmissive) {
            child.setAttribute("emissive", child.dataset.origEmissive);
            child.setAttribute(
              "emissive-intensity",
              child.dataset.origEmissiveInt,
            );
          }
        });
        var bs = this.baseScale || { x: 1, y: 1, z: 1 };
        el.setAttribute("scale", `${bs.x} ${bs.y} ${bs.z}`);
      }.bind(this),
    );

    el.addEventListener("click", function () {
      window.location.href = data.href;
    });
  },
});

/* ── vizzo-control-btn: interactive 3D buttons for custom dashboard configuration ── */
AFRAME.registerComponent("vizzo-control-btn", {
  schema: {
    action: { type: "string" }, // "wireframe", "cycle-height", "cycle-area", "set-height", "set-color"
    targetId: { type: "string" }, // ID of the visualizer (e.g., "vizzo-viz-boats-complexity")
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
        var panelEl = el.closest("[id^='vizzo-panel-']");
        if (panelEl) {
          updateButtonStates(panelEl, targetEl, data.vizType);
        }
      }
    }, 600);

    // Hover effects (clean minimal styling)
    el.addEventListener("mouseenter", function () {
      el.setAttribute("scale", "1.12 1.12 1.12");
      var text = el.querySelector("a-text");
      if (text) {
        text.setAttribute("color", "#0f172a");
        text.removeAttribute("emissive");
        text.removeAttribute("emissive-intensity");
      }
      var base = el.querySelector(".vizzo-btn-base");
      var border = el.querySelector(".vizzo-btn-border");
      if (base) {
        base.setAttribute("color", "#e2e8f0");
        base.removeAttribute("emissive");
        base.removeAttribute("emissive-intensity");
      }
      if (border) {
        border.setAttribute("color", "#94a3b8");
        border.removeAttribute("emissive");
        border.removeAttribute("emissive-intensity");
      }
    });

    el.addEventListener("mouseleave", function () {
      el.setAttribute("scale", "1 1 1");
      var text = el.querySelector("a-text");
      if (text) {
        text.removeAttribute("emissive");
        text.removeAttribute("emissive-intensity");
      }
      var base = el.querySelector(".vizzo-btn-base");
      var border = el.querySelector(".vizzo-btn-border");
      if (base) {
        base.removeAttribute("emissive");
        base.removeAttribute("emissive-intensity");
        if (border) {
          border.removeAttribute("emissive");
          border.removeAttribute("emissive-intensity");
        }

        // Restore standard colors depending on active state
        var panelEl = el.closest("[id^='vizzo-panel-']");
        var targetEl = document.getElementById(data.targetId);
        if (!targetEl && data.vizType === "boats") {
          targetEl = document.querySelector("[babia-boats]");
        }
        if (
          panelEl &&
          targetEl &&
          (data.action === "set-height" || data.action === "set-color")
        ) {
          updateButtonStates(panelEl, targetEl, data.vizType);
        } else {
          // Check if button is active (e.g. text color is white / base is dark slate gray #475569)
          var isActive =
            base &&
            (base.getAttribute("color") === "#475569" ||
              base.getAttribute("color") === "rgb(71, 85, 105)");
          if (isActive) {
            base.setAttribute("color", "#475569");
            if (border) {
              border.setAttribute("color", "#334155");
            }
            if (text) {
              text.setAttribute("color", "#ffffff");
            }
          } else {
            base.setAttribute("color", "#ffffff");
            if (border) {
              border.setAttribute("color", "#cbd5e1");
            }
            if (text) {
              text.setAttribute("color", "#334155");
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
          targetEl = document.querySelector("[babia-doughnut]") || document.querySelector("[babia-pie]");
        else if (data.vizType === "barsmap")
          targetEl = document.querySelector("[babia-barsmap]");
      }

      if (!targetEl) {
        console.error("ViZzo // Target visualizer not found: " + data.targetId);
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
        toggleWireframe(targetEl, data.vizType);
      } else if (data.action === "cycle-height") {
        cycleHeight(targetEl, data.vizType);
      } else if (data.action === "swap-mappings") {
        swapMappings(targetEl, data.vizType);
      } else if (data.action === "set-height") {
        setHeight(targetEl, data.vizType, data.value);
        updateButtonStates(
          el.closest("[id^='vizzo-panel-']"),
          targetEl,
          data.vizType,
        );
      } else if (data.action === "set-color") {
        setColor(targetEl, data.vizType, data.value);
        updateButtonStates(
          el.closest("[id^='vizzo-panel-']"),
          targetEl,
          data.vizType,
        );
      } else if (data.action === "fetch-ai-info") {
        fetchAiInfo(data.vizType, targetEl);
      } else if (data.action === "explain-ai") {
        showExplanation(data.vizType, targetEl, data.value);
      } else if (data.action === "play-tts") {
        playTtsExplanation(data.vizType, targetEl, data.value);
      } else if (data.action === "change-palette") {
        var newPalette = getRandomPalette();
        var compName = "babia-" + data.vizType;
        if (data.vizType === "doughnut" && !targetEl.hasAttribute(compName) && targetEl.hasAttribute("babia-pie")) {
          compName = "babia-pie";
        }
        targetEl.setAttribute(compName, "palette", newPalette);
        console.log("ViZzo // Paleta cambiada a:", newPalette, "en", compName);
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
