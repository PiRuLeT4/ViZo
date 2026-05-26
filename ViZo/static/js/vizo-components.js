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
    minX: { default: -19 },
    maxX: { default: 19 },
    minY: { default: 1 },
    maxY: { default: 8.5 },
    minZ: { default: -19 },
    maxZ: { default: 19 },
  },
  tick: function () {
    var p = this.el.object3D.position;
    var d = this.data;
    if (p.x < d.minX) p.x = d.minX;
    if (p.x > d.maxX) p.x = d.maxX;
    if (p.y < d.minY) p.y = d.minY;
    if (p.y > d.maxY) p.y = d.maxY;
    if (p.z < d.minZ) p.z = d.minZ;
    if (p.z > d.maxZ) p.z = d.maxZ;
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
  schema: { radius: { default: 0.35 } },

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
          child.dataset.origEmissive = child.getAttribute("emissive") || "#000000";
          child.dataset.origEmissiveInt = child.getAttribute("emissive-intensity") || "0";
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
          child.setAttribute("emissive-intensity", child.dataset.origEmissiveInt);
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
    action: { type: "string" },      // "wireframe", "cycle-height", "cycle-area"
    targetId: { type: "string" },    // ID of the visualizer (e.g., "vizo-viz-boats-complexity")
    vizType: { type: "string" }      // "boats", "cyls", "doughnut", "barsmap"
  },
  init: function () {
    var el = this.el;
    var data = this.data;
    
    // Hover effects (glowing scaling)
    el.addEventListener("mouseenter", function () {
      el.setAttribute("scale", "1.12 1.12 1.12");
      var text = el.querySelector("a-text");
      if (text) {
        text.setAttribute("color", "#ffffff");
        text.setAttribute("emissive-intensity", "2");
      }
      var base = el.querySelector("a-box, a-cylinder");
      if (base) {
        base.setAttribute("emissive", "#00d4ff");
        base.setAttribute("emissive-intensity", "1.8");
      }
    });
    
    el.addEventListener("mouseleave", function () {
      el.setAttribute("scale", "1 1 1");
      var text = el.querySelector("a-text");
      if (text) {
        text.setAttribute("color", "#00d4ff");
        text.setAttribute("emissive-intensity", "1.5");
      }
      var base = el.querySelector("a-box, a-cylinder");
      if (base) {
        base.setAttribute("emissive", "#002a5a");
        base.setAttribute("emissive-intensity", "0.5");
      }
    });
    
    // Click action
    el.addEventListener("click", function () {
      var targetEl = document.getElementById(data.targetId);
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
        toggleWireframe(targetEl, data.vizType);
      } else if (data.action === "cycle-height") {
        cycleHeight(targetEl, data.vizType);
      } else if (data.action === "cycle-area") {
        cycleArea(targetEl, data.vizType);
      } else if (data.action === "swap-mappings") {
        swapMappings(targetEl, data.vizType);
      }
    });
  }
});

// Helper: Toggle wireframe mode for the boats (city) dashboard
function toggleWireframe(targetEl, type) {
  if (type === "boats") {
    var config = targetEl.getAttribute("babia-boats") || {};
    var currentVal = config.wireframeByRepeatedField || "";
    
    // Cyclical wireframe logic: "" (off) -> "nloc" -> "ccn" -> "" (off)
    var newVal = "";
    if (currentVal === "") {
      newVal = "nloc";
    } else if (currentVal === "nloc") {
      newVal = "ccn";
    } else {
      newVal = "";
    }
    
    // Toggle component property
    targetEl.setAttribute("babia-boats", "wireframeByRepeatedField", newVal);
    console.log("ViZo // Toggled wireframeByRepeatedField to: " + newVal);
    
    // Traverse meshes in Three.js and apply real-time wireframe look
    var obj3D = targetEl.object3D;
    obj3D.traverse(function (node) {
      if (node.isMesh && node.name !== "street" && node.name !== "ground") {
        if (newVal === "nloc") {
          // Highlight tall buildings with high lines of code
          var isTall = node.scale.y > 1.8;
          node.material.wireframe = isTall;
          node.material.emissive = isTall ? new THREE.Color("#00d4ff") : new THREE.Color("#000000");
          node.material.emissiveIntensity = isTall ? 0.6 : 0;
        } else if (newVal === "ccn") {
          // Highlight complex buildings with high cyclomatic complexity (larger footprints)
          var isWide = (node.scale.x * node.scale.z) > 1.4;
          node.material.wireframe = isWide;
          node.material.emissive = isWide ? new THREE.Color("#00ff88") : new THREE.Color("#000000");
          node.material.emissiveIntensity = isWide ? 0.6 : 0;
        } else {
          // Turn off wireframes
          node.material.wireframe = false;
          node.material.emissive = new THREE.Color("#000000");
          node.material.emissiveIntensity = 0;
        }
      }
    });
  }
}

// Helper: Swap height (nloc) and area (ccn) mappings on the city
function swapMappings(targetEl, type) {
  if (type === "boats") {
    var config = targetEl.getAttribute("babia-boats") || {};
    var currentHeight = config.height || "nloc";
    var currentArea = config.area || "ccn";
    
    var nextHeight = currentArea;
    var nextArea = currentHeight;
    
    // Ensure they always stay alternated (nloc <-> ccn)
    if (nextHeight === nextArea) {
      nextHeight = "ccn";
      nextArea = "nloc";
    }
    
    targetEl.setAttribute("babia-boats", {
      height: nextHeight,
      area: nextArea,
      color: nextHeight
    });
    
    targetEl.setAttribute("babia-boats", "legend_text", "{name}\\n" + nextHeight.toUpperCase() + "(Altura)x" + nextArea.toUpperCase() + "(Area)");
    console.log("ViZo // Swapped boats mappings: Height=" + nextHeight + ", Area=" + nextArea);
  }
}

// Helper: Cycle height field
function cycleHeight(targetEl, type) {
  if (type === "boats") {
    var config = targetEl.getAttribute("babia-boats") || {};
    var current = config.height || "nloc";
    // Cycle strictly between nloc and ccn (without commits)
    var fields = ["nloc", "ccn"];
    var nextIdx = (fields.indexOf(current) + 1) % fields.length;
    var nextField = fields[nextIdx];
    
    targetEl.setAttribute("babia-boats", "height", nextField);
    targetEl.setAttribute("babia-boats", "color", nextField);
    targetEl.setAttribute("babia-boats", "legend_text", "{name}\\n" + nextField.toUpperCase() + "(Altura)x" + (config.area || "ccn").toUpperCase() + "(Area)");
    console.log("ViZo // Cycled boats height to: " + nextField);
  } else if (type === "cyls") {
    var config = targetEl.getAttribute("babia-cyls") || {};
    var current = config.height || "nloc";
    var fields = ["nloc", "count", "commits"];
    var nextIdx = (fields.indexOf(current) + 1) % fields.length;
    var nextField = fields[nextIdx];
    
    targetEl.setAttribute("babia-cyls", "height", nextField);
    console.log("ViZo // Cycled cyls height to: " + nextField);
  } else if (type === "barsmap") {
    var config = targetEl.getAttribute("babia-barsmap") || {};
    var current = config.height || "commits";
    var fields = ["commits", "insertions"];
    var nextIdx = (fields.indexOf(current) + 1) % fields.length;
    var nextField = fields[nextIdx];
    
    targetEl.setAttribute("babia-barsmap", "height", nextField);
    console.log("ViZo // Cycled barsmap height to: " + nextField);
  }
}

// Helper: Cycle area/radius field
function cycleArea(targetEl, type) {
  if (type === "boats") {
    var config = targetEl.getAttribute("babia-boats") || {};
    var current = config.area || "ccn";
    // Cycle strictly between ccn and nloc (without commits)
    var fields = ["ccn", "nloc"];
    var nextIdx = (fields.indexOf(current) + 1) % fields.length;
    var nextField = fields[nextIdx];
    
    targetEl.setAttribute("babia-boats", "area", nextField);
    targetEl.setAttribute("babia-boats", "legend_text", (config.height || "nloc").toUpperCase() + "(Altura)x" + nextField.toUpperCase() + "(Area)");
    console.log("ViZo // Cycled boats area to: " + nextField);
  } else if (type === "cyls") {
    var config = targetEl.getAttribute("babia-cyls") || {};
    var current = config.radius || "count";
    var fields = ["count", "nloc", "commits"];
    var nextIdx = (fields.indexOf(current) + 1) % fields.length;
    var nextField = fields[nextIdx];
    
    targetEl.setAttribute("babia-cyls", "radius", nextField);
    console.log("ViZo // Cycled cyls radius to: " + nextField);
  }
}

// askAIReconfigure helper removed
