(function () {
  // =============================================================================
  // ViZzo // ai-assistant.js  —  AI Explanation & Terminal Manager
  // =============================================================================

  // Caché de explicaciones ya obtenidas para evitar peticiones repetidas
  const explanationCache = {
    boats: null,
    cyls: null,
    doughnut: null,
    barsmap: null,
    network: null,
    bars: null,
  };

  /**
   * Actualiza las etiquetas de los botones HUD 2D y 3D una vez que hay explicación disponible
   */
  function updateButtonLabels(dashboardType) {
    // 1. Actualizar botón del HUD 2D
    const hudBtn = document.querySelector(`[data-hud-btn="${dashboardType}"]`);
    if (hudBtn) {
      const cleanType = dashboardType.toUpperCase();
      const shortType =
        cleanType === "BARSMAP"
          ? "BARS"
          : cleanType === "DOUGHNUT"
            ? "DONUT"
            : cleanType === "BARS"
              ? "PR"
              : cleanType;
      hudBtn.textContent = `VER EXP. ${shortType}`;
      hudBtn.style.borderColor = "#4af7a0"; // Borde verde neón
      hudBtn.style.color = "#4af7a0";
      hudBtn.style.textShadow = "0 0 8px rgba(74, 247, 160, 0.4)";
    }

    // 2. Actualizar botones 3D de A-Frame (Pedestales y Menú de Muñeca)
    const scene3dBtns = document.querySelectorAll("[vizzo-control-btn]");
    scene3dBtns.forEach((btnEl) => {
      const comp = btnEl.getAttribute("vizzo-control-btn");
      if (comp) {
        let isMatch = false;
        if (typeof comp === "string") {
          isMatch =
            comp.indexOf("action: explain-ai") !== -1 &&
            comp.indexOf("vizType: " + dashboardType) !== -1;
        } else if (typeof comp === "object") {
          isMatch =
            comp.action === "explain-ai" && comp.vizType === dashboardType;
        }

        if (isMatch) {
          const textEl = btnEl.querySelector("a-text");
          if (textEl) {
            const isWrist = btnEl.parentNode.id === "vr-wrist-menu";
            if (isWrist) {
              const cleanType = dashboardType.toUpperCase();
              const shortType =
                cleanType === "BARSMAP"
                  ? "BARS"
                  : cleanType === "DOUGHNUT"
                    ? "DONUT"
                    : cleanType;
              textEl.setAttribute("value", `VER ${shortType}`);
            } else {
              textEl.setAttribute("value", "VER EXPLICACION");
            }
            textEl.setAttribute("color", "#4af7a0");
            textEl.setAttribute("emissive", "#4af7a0");
          }

          const baseEl = btnEl.querySelector(".vizzo-btn-base");
          if (baseEl) {
            baseEl.setAttribute("color", "#003b21");
            baseEl.setAttribute("emissive", "#4af7a0");
            baseEl.setAttribute("emissive-intensity", "0.8");
          }
          const borderEl = btnEl.querySelector(".vizzo-btn-border");
          if (borderEl) {
            borderEl.setAttribute("color", "#4af7a0");
            borderEl.setAttribute("emissive", "#4af7a0");
            borderEl.setAttribute("emissive-intensity", "2.0");
          }
        }
      }
    });
  }

  /**
   * Cambia el estado del botón a CARGANDO...
   */
  function setButtonLoading(dashboardType) {
    const scene3dBtns = document.querySelectorAll("[vizzo-control-btn]");
    scene3dBtns.forEach((btnEl) => {
      const comp = btnEl.getAttribute("vizzo-control-btn");
      if (comp) {
        let isMatch = false;
        if (typeof comp === "string") {
          isMatch =
            comp.indexOf("action: explain-ai") !== -1 &&
            comp.indexOf("vizType: " + dashboardType) !== -1;
        } else if (typeof comp === "object") {
          isMatch =
            comp.action === "explain-ai" && comp.vizType === dashboardType;
        }

        if (isMatch) {
          const textEl = btnEl.querySelector("a-text");
          if (textEl) {
            textEl.setAttribute("value", "CARGANDO...");
            textEl.setAttribute("color", "#ffaa00");
            textEl.setAttribute("emissive", "#ffaa00");
          }

          const baseEl = btnEl.querySelector(".vizzo-btn-base");
          if (baseEl) {
            baseEl.setAttribute("color", "#4a2a00");
            baseEl.setAttribute("emissive", "#ffaa00");
            baseEl.setAttribute("emissive-intensity", "0.8");
          }
          const borderEl = btnEl.querySelector(".vizzo-btn-border");
          if (borderEl) {
            borderEl.setAttribute("color", "#ffaa00");
            borderEl.setAttribute("emissive", "#ffaa00");
            borderEl.setAttribute("emissive-intensity", "2.0");
          }
        }
      }
    });
  }

  /**
   * Resetea el botón de la IA a su estado original "EXPLICAR"
   */
  function resetButtonToExplain(dashboardType) {
    const scene3dBtns = document.querySelectorAll("[vizzo-control-btn]");
    scene3dBtns.forEach((btnEl) => {
      const comp = btnEl.getAttribute("vizzo-control-btn");
      if (comp) {
        let isMatch = false;
        if (typeof comp === "string") {
          isMatch =
            comp.indexOf("action: explain-ai") !== -1 &&
            comp.indexOf("vizType: " + dashboardType) !== -1;
        } else if (typeof comp === "object") {
          isMatch =
            comp.action === "explain-ai" && comp.vizType === dashboardType;
        }

        if (isMatch) {
          const textEl = btnEl.querySelector("a-text");
          if (textEl) {
            textEl.setAttribute("value", "EXPLICAR");
            textEl.setAttribute("color", "#00d4ff");
            textEl.setAttribute("emissive", "#00d4ff");
          }

          const baseEl = btnEl.querySelector(".vizzo-btn-base");
          if (baseEl) {
            baseEl.setAttribute("color", "#002a5a");
            baseEl.setAttribute("emissive", "#002a5a");
            baseEl.setAttribute("emissive-intensity", "0.5");
          }
          const borderEl = btnEl.querySelector(".vizzo-btn-border");
          if (borderEl) {
            borderEl.setAttribute("color", "#00d4ff");
            borderEl.setAttribute("emissive", "#00d4ff");
            borderEl.setAttribute("emissive-intensity", "1.2");
          }
        }
      }
    });
  }

  // Puntero para cancelar el timeout o efecto de máquina de escribir anterior
  let typewriterInterval = null;

  /**
   * Solicita y muestra la explicación de la IA en la terminal holográfica
   */
  function showExplanation(dashboardType, targetEl) {
    console.log("ViZzo // Solicitando explicación IA para:", dashboardType);

    const modal = document.getElementById("vizzo-terminal-modal");
    const contentEl = document.getElementById("terminal-content");

    if (!modal || !contentEl) {
      console.error(
        "ViZzo // Modal o terminal content no encontrado en el DOM.",
      );
      return;
    }

    // Limpiar intervalo anterior si existe
    if (typewriterInterval) {
      clearInterval(typewriterInterval);
      typewriterInterval = null;
    }

    // Si ya existe en caché, mostrar inmediatamente sin fetch
    if (explanationCache[dashboardType]) {
      console.log(
        "ViZzo // Obteniendo explicación desde caché para:",
        dashboardType,
      );
      modal.classList.add("active");
      updateButtonLabels(dashboardType);
      window.ViZzoHelpers.typewriterEffect(contentEl, explanationCache[dashboardType]);
      return;
    }

    // Poner los botones en estado de carga (CARGANDO...)
    setButtonLoading(dashboardType);

    // Mostrar modal con efecto de carga/transición
    contentEl.innerHTML =
      "<span class='blink'>[CONECTANDO CON EL NÚCLEO DE LA IA...]</span>";
    modal.classList.add("active");

    // Obtener los datos correctos dinámicamente según el cargador asociado
    let dashboardData = null;
    let datasetKey = null;

    if (targetEl) {
      let fromStr = "";
      if (targetEl.hasAttribute("babia-boats")) {
        const boatsAttr = targetEl.getAttribute("babia-boats");
        let boatsFrom = "";
        if (typeof boatsAttr === "string") {
          const treeMatch = boatsAttr.match(/from:\s*([^;]+)/);
          if (treeMatch) boatsFrom = treeMatch[1].trim();
        } else if (
          boatsAttr &&
          typeof boatsAttr === "object" &&
          boatsAttr.from
        ) {
          boatsFrom = boatsAttr.from;
        }

        if (boatsFrom) {
          const treeEl = document.getElementById(boatsFrom);
          if (treeEl && treeEl.hasAttribute("babia-treebuilder")) {
            const treeAttr = treeEl.getAttribute("babia-treebuilder");
            let treeFrom = "";
            if (typeof treeAttr === "string") {
              const loaderMatch = treeAttr.match(/from:\s*([^;]+)/);
              if (loaderMatch) treeFrom = loaderMatch[1].trim();
            } else if (
              treeAttr &&
              typeof treeAttr === "object" &&
              treeAttr.from
            ) {
              treeFrom = treeAttr.from;
            }
            if (treeFrom) {
              fromStr = treeFrom;
            }
          }
        }
      } else {
        const componentAttrs = [
          "babia-cyls",
          "babia-doughnut",
          "babia-barsmap",
          "babia-network",
          "babia-bars",
        ];
        for (let i = 0; i < componentAttrs.length; i++) {
          const attrName = componentAttrs[i];
          if (targetEl.hasAttribute(attrName)) {
            const attrVal = targetEl.getAttribute(attrName);
            let valFrom = "";
            if (typeof attrVal === "string") {
              const loaderMatch = attrVal.match(/from:\s*([^;]+)/);
              if (loaderMatch) valFrom = loaderMatch[1].trim();
            } else if (attrVal && typeof attrVal === "object" && attrVal.from) {
              valFrom = attrVal.from;
            }
            if (valFrom) {
              fromStr = valFrom;
              break;
            }
          }
        }
      }

      if (fromStr && fromStr.startsWith("vizzo-loader-")) {
        datasetKey = fromStr.replace("vizzo-loader-", "");
      }
    }

    if (!datasetKey) {
      if (dashboardType === "boats") datasetKey = "file_metrics";
      else if (dashboardType === "cyls" || dashboardType === "doughnut")
        datasetKey = "data_by_language";
      else if (dashboardType === "barsmap") datasetKey = "author_activity";
      else if (dashboardType === "network") datasetKey = "file_network";
      else if (dashboardType === "bars") datasetKey = "pull_requests";
    }

    const state = window.ViZzoState;
    dashboardData = state.dataMap[datasetKey] || {};

    // Obtener el nombre del repositorio
    const statusEl = document.querySelector(".vizzo-status");
    const repoName = statusEl
      ? statusEl.getAttribute("data-repo")
      : "LIVE_DATA";

    // Las credenciales de IA viajan automáticamente en cookies seguras HttpOnly
    const payload = {
      dashboard_type: datasetKey || dashboardType,
      dashboard_data: dashboardData || {},
      repo_name: repoName,
    };

    fetch("/api/explain/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Server returned status " + res.status);
        return res.json();
      })
      .then((data) => {
        const text =
          data.explanation || "No se pudo obtener explicación de la IA.";
        explanationCache[dashboardType] = text;
        updateButtonLabels(dashboardType);
        window.ViZzoHelpers.typewriterEffect(contentEl, text);
      })
      .catch((err) => {
        console.error("ViZzo // Error al obtener la explicación de la IA:", err);
        resetButtonToExplain(dashboardType);
        contentEl.textContent =
          ">>> ERROR: ERROR DE CONEXIÓN CON EL SERVIDOR DE IA.\n" + err.message;
      });
  }

  /**
   * Cierra el modal de la terminal
   */
  function closeExplanation() {
    const modal = document.getElementById("vizzo-terminal-modal");
    if (modal) {
      modal.classList.remove("active");
    }
    if (typewriterInterval) {
      clearInterval(typewriterInterval);
      typewriterInterval = null;
    }
  }

  // Registrar en el espacio de nombres global
  window.ViZzo = window.ViZzo || {};
  window.ViZzo.ui = {
    showExplanation: showExplanation,
    closeExplanation: closeExplanation,
  };

  // Implementar disparador global para clicks desde el HUD 2D
  window.ViZzoTrigger = function (action, vizType) {
    console.log("ViZzoTrigger // Acción:", action, "Visualizador:", vizType);

    let targetEl = null;
    if (vizType === "boats") targetEl = document.querySelector("[babia-boats]");
    else if (vizType === "cyls")
      targetEl = document.querySelector("[babia-cyls]");
    else if (vizType === "doughnut")
      targetEl = document.querySelector("[babia-doughnut]");
    else if (vizType === "barsmap")
      targetEl = document.querySelector("[babia-barsmap]");

    if (!targetEl) {
      if (action !== "explain-ai") {
        console.warn(
          "ViZzoTrigger // No se encontró el componente visualizador de tipo:",
          vizType,
        );
      }
      return;
    }

    if (action === "wireframe") {
      window.ViZzoHelpers.toggleWireframe(targetEl, vizType);
    } else if (action === "swap-mappings") {
      window.ViZzoHelpers.swapMappings(targetEl, vizType);
    } else if (action === "cycle-height") {
      window.ViZzoHelpers.cycleHeight(targetEl, vizType);
    } else if (action === "explain-ai") {
      showExplanation(vizType, targetEl);
    }
  };
})();
