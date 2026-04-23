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
    var defaultEmissive = "#00d4ff";
    var hoverEmissive = "#ffffff";

    el.addEventListener("mouseenter", function () {
      el.querySelectorAll("[data-nav-panel]").forEach(function (child) {
        child.setAttribute("emissive", hoverEmissive);
        child.setAttribute("emissive-intensity", "3");
      });
      el.setAttribute("scale", "1.04 1.04 1.04");
    });

    el.addEventListener("mouseleave", function () {
      el.querySelectorAll("[data-nav-panel]").forEach(function (child) {
        child.setAttribute("emissive", defaultEmissive);
        child.setAttribute("emissive-intensity", "2");
      });
      el.setAttribute("scale", "1 1 1");
    });

    el.addEventListener("click", function () {
      window.location.href = data.href;
    });
  },
});
