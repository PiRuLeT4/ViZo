/**
 * Módulo de Efectos de UI, Pestañas, Modales y Tarjetas
 */

export function initUiEffects() {
  const depthInput = document.getElementById("depthInput");
  const analysisModeInput = document.getElementById("analysisModeInput");
  const depthLabel = document.getElementById("depthLabel");
  const modeTabs = document.querySelectorAll(".mode-tab");
  const features = document.querySelectorAll(".features .feature");

  const translate = window.t || ((key) => key);

  const featureConfigs = {
    commits: [
      { depth: "50", desc: "50 COMMITS" },
      { depth: "150", desc: "150 COMMITS" },
      { depth: "300", desc: "300 COMMITS" },
      { depth: "all", desc: "TODOS LOS COMMITS" }
    ],
    releases: [
      { depth: "5", desc: "5 RELEASES" },
      { depth: "10", desc: "10 RELEASES" },
      { depth: "20", desc: "20 RELEASES" },
      { depth: "all", desc: "TODOS LOS RELEASES" }
    ]
  };

  // Tabs click handler
  modeTabs.forEach((tab) => {
    tab.addEventListener("click", function () {
      modeTabs.forEach(t => t.classList.remove("active"));
      this.classList.add("active");

      const mode = this.getAttribute("data-mode");
      if (analysisModeInput) {
        analysisModeInput.value = mode;
      }

      if (depthLabel) {
        const key = mode === "releases" ? "analyzer.depth.label_releases" : "analyzer.depth.label_commits";
        depthLabel.setAttribute("data-i18n", key);
        depthLabel.textContent = translate(key);
      }

      // Update features content dynamically based on selected mode
      const configs = featureConfigs[mode];
      const cardIds = ["featureFast", "featureBalanced", "featureDeep", "featureAll"];
      const descIds = ["descFast", "descBalanced", "descDeep", "descAll"];

      cardIds.forEach((id, index) => {
        const card = document.getElementById(id);
        const desc = document.getElementById(descIds[index]);
        if (card && configs[index]) {
          card.setAttribute("data-depth", configs[index].depth);
          if (desc) {
            if (configs[index].depth === "all") {
              const key = mode === "commits" ? "analyzer.depth.all_commits" : "analyzer.depth.all_releases";
              desc.setAttribute("data-i18n", key);
              desc.textContent = translate(key);
            } else {
              desc.removeAttribute("data-i18n");
              desc.textContent = configs[index].desc;
            }
          }
        }
      });

      // Force select the middle card (Balanced) by default when switching modes
      features.forEach((f) => {
        f.classList.remove("active");
        const desc = f.querySelector(".feature-desc");
        if (desc) {
          desc.style.color = "var(--text-muted)";
        }
      });

      const defaultBalancedCard = document.getElementById("featureBalanced");
      if (defaultBalancedCard) {
        defaultBalancedCard.classList.add("active");
        const desc = defaultBalancedCard.querySelector(".feature-desc");
        if (desc) {
          desc.style.color = "var(--accent-text)";
        }
        if (depthInput) {
          depthInput.value = defaultBalancedCard.getAttribute("data-depth");
        }
      }
      console.log("Switched analysis mode to:", mode, "Default depth:", depthInput ? depthInput.value : "");
    });
  });

  features.forEach((feature) => {
    feature.addEventListener("click", function () {
      features.forEach((f) => {
        f.classList.remove("active");
        const desc = f.querySelector(".feature-desc");
        if (desc) {
          desc.style.color = "var(--text-muted)";
        }
      });
      
      this.classList.add("active");
      const activeDesc = this.querySelector(".feature-desc");
      if (activeDesc) {
        activeDesc.style.color = "var(--accent-text)";
      }
      
      const val = this.getAttribute("data-depth");
      if (depthInput) {
        depthInput.value = val;
      }
      console.log("Selected depth:", val);
    });
  });

  // ── Login modal handlers (global) ──
  const loginModal = document.getElementById("vizzoLoginModal");
  const openLoginModalBtn = document.getElementById("openLoginModalBtn");
  const closeLoginModalBtn = document.getElementById("closeLoginModalBtn");

  if (loginModal && openLoginModalBtn) {
    openLoginModalBtn.addEventListener("click", function(e) {
      e.preventDefault();
      loginModal.classList.add("active");
    });
  }

  if (loginModal && closeLoginModalBtn) {
    closeLoginModalBtn.addEventListener("click", function() {
      loginModal.classList.remove("active");
    });

    loginModal.addEventListener("click", function(e) {
      if (e.target === loginModal) {
        loginModal.classList.remove("active");
      }
    });
  }
}
