/**
 * vizo-sky-switcher.js
 * --------------------
 * Custom A-Frame component and controllers to swap 3D backgrounds via a 3D wall panel.
 */

(function () {
  const SKIES = [
    {
      id: "office",
      name: "office",
      src: "#office",
      rotation: "0 180 0",
      envActive: false,
    },
    {
      id: "cloud",
      name: "cloud",
      src: "#cloud",
      rotation: "0 0 0",
      envActive: false,
    },
    {
      id: "forest",
      name: "forest",
      src: "#forest",
      rotation: "0 0 0",
      envActive: false,
    },
    {
      id: "island",
      name: "island",
      src: "#island",
      rotation: "0 0 0",
      envActive: false,
    },
    {
      id: "night",
      name: "night",
      src: "#night",
      rotation: "0 0 0",
      envActive: false,
    },
    {
      id: "chinese_garden",
      name: "chinese_garden",
      src: "#chinese_garden",
      rotation: "0 0 0",
      envActive: false,
    },
  ];

  // Initialize namespace
  window.ViZo = window.ViZo || {};
  window.ViZo.sky = {
    currentIndex: 0,

    updateSky: function () {
      const skyEl = document.querySelector("a-sky");
      const labelEl = document.getElementById("switcher-sky-text");
      const current = SKIES[this.currentIndex];

      // Update 3D A-Frame Text Label value
      if (labelEl) {
        labelEl.setAttribute("value", current.name);
      }

      // Update Sky Sphere
      if (skyEl) {
        if (current.src) {
          skyEl.setAttribute("src", current.src);
          skyEl.setAttribute("rotation", current.rotation);
          skyEl.setAttribute("visible", "true");
          // Disabling fog on textured skybox so it's fully visible
          skyEl.setAttribute("material", "fog: false");
        } else {
          // If no texture (starred option), make the sky sphere invisible so the environment shows
          skyEl.setAttribute("visible", "false");
        }
      }
    },

    nextSky: function () {
      this.currentIndex = (this.currentIndex + 1) % SKIES.length;
      this.updateSky();
    },

    prevSky: function () {
      this.currentIndex = (this.currentIndex - 1 + SKIES.length) % SKIES.length;
      this.updateSky();
    },
  };

  // Register 3D sky switcher component for A-Frame
  AFRAME.registerComponent("sky-switcher-3d", {
    init: function () {
      const el = this.el;

      // Locate buttons within panel
      const btnLeft = el.querySelector(".btn-left");
      const btnRight = el.querySelector(".btn-right");

      if (btnLeft) {
        // Handle click
        btnLeft.addEventListener("click", () => {
          window.ViZo.sky.prevSky();
        });

        // Handle hover glow effects for visual feedback
        btnLeft.addEventListener("mouseenter", () => {
          const cylinder = btnLeft.querySelector("a-cylinder.clickable");
          if (cylinder) {
            cylinder.setAttribute("emissive-intensity", "2.5");
            cylinder.setAttribute("color", "#8b0a2d");
          }
        });
        btnLeft.addEventListener("mouseleave", () => {
          const cylinder = btnLeft.querySelector("a-cylinder.clickable");
          if (cylinder) {
            cylinder.setAttribute("emissive-intensity", "0.5");
            cylinder.setAttribute("color", "#2b1016");
          }
        });
      }

      if (btnRight) {
        // Handle click
        btnRight.addEventListener("click", () => {
          window.ViZo.sky.nextSky();
        });

        // Handle hover glow effects for visual feedback
        btnRight.addEventListener("mouseenter", () => {
          const cylinder = btnRight.querySelector("a-cylinder.clickable");
          if (cylinder) {
            cylinder.setAttribute("emissive-intensity", "2.5");
            cylinder.setAttribute("color", "#8b0a2d");
          }
        });
        btnRight.addEventListener("mouseleave", () => {
          const cylinder = btnRight.querySelector("a-cylinder.clickable");
          if (cylinder) {
            cylinder.setAttribute("emissive-intensity", "0.5");
            cylinder.setAttribute("color", "#2b1016");
          }
        });
      }
    },
  });
})();
