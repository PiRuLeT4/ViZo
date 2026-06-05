(function () {
  // =============================================================================
  // ViZo // visualization.js  —  Multi-Dashboard Renderer
  //
  // Lee la lista de dashboards que devuelve la IA y monta dinámicamente
  // cada componente BabiaXR con su propio cargador y posición en la sala.
  //
  // Componentes soportados:
  //   - babia-boats    (necesita babia-treebuilder)  → dataset: file_metrics
  //   - babia-cyls                                    → dataset: data_by_language
  //   - babia-doughnut                                → dataset: data_by_language
  //   - babia-barsmap                                 → dataset: data_by_language
  //
  // Los datasets disponibles ya están en el HTML inyectados por Django:
  //   #vizo-data-json       → file_metrics       (archivo por archivo)
  //   #vizo-language-json   → data_by_language   (agrupado por lenguaje)
  // =============================================================================

  // ---------------------------------------------------------------------------
  // 1. Parsear datasets desde el HTML
  // ---------------------------------------------------------------------------
  function parseJson(elementId) {
    const el = document.getElementById(elementId);
    if (!el || !el.textContent.trim()) return null;
    try {
      return JSON.parse(el.textContent);
    } catch (e) {
      console.error("ViZo // Error parsing #" + elementId + ":", e);
      return null;
    }
  }

  const fileMetrics = parseJson("vizo-data-json");
  const dataByLanguage = parseJson("vizo-language-json");
  const evolutionData = parseJson("vizo-evolution-json");
  const authorActivity = parseJson("vizo-activity-json");
  const fileOwnership = parseJson("vizo-ownership-json");
  const ageDistribution = parseJson("vizo-age-json");
  const topComplexFiles = parseJson("vizo-complex-json");

  // Redondear CCN a un máximo de 2 decimales para leyendas y visualización limpia
  if (fileMetrics) {
    fileMetrics.forEach(function (fm) {
      if (typeof fm.ccn === "number") {
        fm.ccn = Math.round(fm.ccn * 100) / 100;
      }
    });
  }
  if (dataByLanguage) {
    dataByLanguage.forEach(function (lm) {
      if (typeof lm.ccn === "number") {
        lm.ccn = Math.round(lm.ccn * 100) / 100;
      }
    });
  }

  // DEBUG: estado de cada dataset parseado
  console.log(
    "ViZo // [DEBUG] fileMetrics:",
    fileMetrics ? fileMetrics.length + " items" : "NULL",
  );
  console.log(
    "ViZo // [DEBUG] dataByLanguage:",
    dataByLanguage ? dataByLanguage.length + " items" : "NULL",
  );
  console.log(
    "ViZo // [DEBUG] evolutionData:",
    evolutionData ? evolutionData.length + " items" : "NULL",
  );
  console.log(
    "ViZo // [DEBUG] authorActivity:",
    authorActivity ? authorActivity.length + " items" : "NULL",
  );
  console.log(
    "ViZo // [DEBUG] fileOwnership:",
    fileOwnership ? fileOwnership.length + " items" : "NULL",
  );
  console.log(
    "ViZo // [DEBUG] ageDistribution:",
    ageDistribution ? ageDistribution.length + " items" : "NULL",
  );
  console.log(
    "ViZo // [DEBUG] topComplexFiles:",
    topComplexFiles ? topComplexFiles.length + " items" : "NULL",
  );
  if (authorActivity && authorActivity.length > 0) {
    console.log(
      "ViZo // [DEBUG] authorActivity[0]:",
      JSON.stringify(authorActivity[0]),
    );
  }

  if (!fileMetrics) {
    console.error("ViZo // No se encontró file_metrics en #vizo-data-json");
    return;
  }

  // ---------------------------------------------------------------------------
  // 2. Parsear la configuración de dashboards de la IA
  // ---------------------------------------------------------------------------
  const rawAIConfig = document.getElementById("vizo-ai-config").textContent;
  let aiConfig = null;

  try {
    aiConfig =
      rawAIConfig && rawAIConfig.trim() ? JSON.parse(rawAIConfig) : null;
  } catch (e) {
    console.error("ViZo // Error parsing AI config:", e);
  }

  // Fallback: sólo babia-boats si la IA falla
  if (
    !aiConfig ||
    !Array.isArray(aiConfig.dashboards) ||
    aiConfig.dashboards.length === 0
  ) {
    console.warn("ViZo // Usando configuración de dashboards por defecto.");
    aiConfig = {
      dashboards: [
        {
          id: "boats-complexity",
          component: "babia-boats",
          dataset: "file_metrics",
          title: "Code Complexity Boats",
          mappings: { key: "id", height: "nloc", area: "ccn" },
        },
      ],
    };
  }

  console.log(
    "ViZo // Dashboards a renderizar:",
    aiConfig.dashboards.map((d) => d.component),
  );

  // ---------------------------------------------------------------------------
  // 3. Mapa de datasets → Blob URLs (se crean una sola vez y se reutilizan)
  // ---------------------------------------------------------------------------
  const dataMap = {
    file_metrics: fileMetrics,
    data_by_language: dataByLanguage,
    evolution_data: evolutionData,
    author_activity: authorActivity,
    file_ownership: fileOwnership,
    age_distribution: ageDistribution,
    top_complex_files: topComplexFiles,
  };

  // Pregenerar Blob URLs
  const blobUrls = {};
  for (const [key, data] of Object.entries(dataMap)) {
    if (data) {
      const blob = new Blob([JSON.stringify(data)], {
        type: "application/json",
      });
      blobUrls[key] = URL.createObjectURL(blob);
      console.log("ViZo // Blob creado para '" + key + "':", blobUrls[key]);
    } else {
      console.warn(
        "ViZo // [DEBUG] Dataset '" +
          key +
          "' es null/undefined, NO se creó blob.",
      );
    }
  }
  console.log("ViZo // [DEBUG] Blob URLs disponibles:", Object.keys(blobUrls));

  // ---------------------------------------------------------------------------
  // 4. Importar constructores y posiciones desde builders.js
  // ---------------------------------------------------------------------------
  const { POSITIONS, calculateSatellitePosition, buildCity, buildCyls, buildDoughnut, buildBarsmap } = window.ViZoBuilders;

  // ---------------------------------------------------------------------------
  // 5. Función que crea un cargador (babia-queryjson) compartido por dataset
  // ---------------------------------------------------------------------------
  const loaders = {}; // { dataset_key: element_id }

  function ensureLoader(scene, datasetKey) {
    if (loaders[datasetKey]) return loaders[datasetKey];

    const blobUrl = blobUrls[datasetKey];
    if (!blobUrl) {
      console.warn(
        "ViZo // Dataset '" +
          datasetKey +
          "' no disponible, saltando dashboard.",
      );
      return null;
    }

    const loaderId = "vizo-loader-" + datasetKey;
    const loaderEl = document.createElement("a-entity");
    loaderEl.setAttribute("id", loaderId);
    loaderEl.setAttribute("babia-queryjson", "url: " + blobUrl);
    scene.appendChild(loaderEl);
    loaders[datasetKey] = loaderId;
    console.log("ViZo // Cargador creado:", loaderId);
    return loaderId;
  }

  // ---------------------------------------------------------------------------
  // 7. Montar todos los dashboards
  // ---------------------------------------------------------------------------
  const scene = document.querySelector("a-scene");
  if (!scene) {
    console.error("ViZo // No se encontró a-scene en el DOM.");
    return;
  }

  const dashboards = aiConfig.dashboards;

  // Ordenar para asegurar que babia-boats sea siempre el primero (Hero)
  dashboards.sort((a, b) => {
    if (a.component === "babia-boats") return -1;
    if (b.component === "babia-boats") return 1;
    return 0;
  });

  console.log("ViZo // Dashboards ordenados (Hero primero):", dashboards);
  
  // Calcular satélites (todos los que no son babia-boats)
  const satellites = dashboards.filter(d => d.component !== "babia-boats");
  const totalSatellites = satellites.length;
  let satelliteIdx = 0;

  dashboards.forEach(function (dash, idx) {
    console.log(
      "ViZo // [DEBUG] Procesando dashboard[" + idx + "]:",
      dash.component,
      "dataset:",
      dash.dataset,
      "mappings:",
      JSON.stringify(dash.mappings),
    );
    const loaderId = ensureLoader(scene, dash.dataset);
    if (!loaderId) {
      console.error(
        "ViZo // [DEBUG] ❌ ensureLoader devolvió null para dataset '" +
          dash.dataset +
          "' → dashboard '" +
          dash.component +
          "' SALTADO",
      );
      return;
    }
    console.log(
      "ViZo // [DEBUG] ✅ Loader OK para '" + dash.dataset + "':",
      loaderId,
    );

    let pos;
    if (dash.component === "babia-boats") {
      // El visualizador Hero (Boats) siempre se coloca en el centro
      pos = POSITIONS[0] || { x: 0, y: 0.1, z: 20 };
      pos.rotY = 0; // Mirando al norte
    } else {
      // Los satélites se calculan en un arco semicircular dinámico
      pos = calculateSatellitePosition(satelliteIdx, totalSatellites);
      satelliteIdx++;
    }

    // Crear el componente visual
    switch (dash.component) {
      case "babia-boats":
        buildCity(scene, dash, loaderId, pos);
        break;
      case "babia-cyls":
        buildCyls(scene, dash, loaderId, pos);
        break;
      case "babia-doughnut":
        buildDoughnut(scene, dash, loaderId, pos);
        break;
      case "babia-barsmap":
        console.log(
          "ViZo // [DEBUG] → Entrando en buildBarsmap con loaderId:",
          loaderId,
        );
        buildBarsmap(scene, dash, loaderId, pos);
        break;
      default:
        console.warn("ViZo // Componente desconocido:", dash.component);
    }
  });

  // ---------------------------------------------------------------------------
  // 8. Actualizar HUD
  // ---------------------------------------------------------------------------
  const statusEl = document.querySelector(".vizo-status");
  if (statusEl) {
    const repoName = statusEl.getAttribute("data-repo");
    if (repoName && repoName !== "LIVE_DATA") {
      statusEl.textContent = repoName.toUpperCase();
    } else {
      const names = dashboards.map((d) =>
        d.component.replace("babia-", "").toUpperCase(),
      );
      statusEl.textContent = "LIVE_DATA // " + names.join(" + ");
    }
  }

  // ---------------------------------------------------------------------------
  // 9. AI Explanation & Typewriter System
  // ---------------------------------------------------------------------------
  let typewriterInterval = null;

  // Caché de explicaciones ya obtenidas
  const explanationCache = {
    boats: null,
    cyls: null,
    doughnut: null,
    barsmap: null
  };

  function updateButtonLabels(dashboardType) {
    // 1. Actualizar botón del HUD 2D
    const hudBtn = document.querySelector(`[data-hud-btn="${dashboardType}"]`);
    if (hudBtn) {
      const cleanType = dashboardType.toUpperCase();
      const shortType = cleanType === 'BARSMAP' ? 'BARS' : cleanType === 'DOUGHNUT' ? 'DONUT' : cleanType;
      hudBtn.textContent = `VER EXP. ${shortType}`;
      hudBtn.style.borderColor = "#4af7a0"; // Borde verde neón
      hudBtn.style.color = "#4af7a0";
      hudBtn.style.textShadow = "0 0 8px rgba(74, 247, 160, 0.4)";
    }

    // 2. Actualizar botones 3D de A-Frame (Pedestales y Menú de Muñeca)
    const scene3dBtns = document.querySelectorAll('[vizo-control-btn]');
    scene3dBtns.forEach(btnEl => {
      const comp = btnEl.getAttribute('vizo-control-btn');
      if (comp) {
        let isMatch = false;
        if (typeof comp === 'string') {
          isMatch = comp.indexOf('action: explain-ai') !== -1 && comp.indexOf('vizType: ' + dashboardType) !== -1;
        } else if (typeof comp === 'object') {
          isMatch = comp.action === 'explain-ai' && comp.vizType === dashboardType;
        }

        if (isMatch) {
          const textEl = btnEl.querySelector("a-text");
          if (textEl) {
            const isWrist = btnEl.parentNode.id === "vr-wrist-menu";
            if (isWrist) {
              const cleanType = dashboardType.toUpperCase();
              const shortType = cleanType === 'BARSMAP' ? 'BARS' : cleanType === 'DOUGHNUT' ? 'DONUT' : cleanType;
              textEl.setAttribute("value", `VER ${shortType}`);
            } else {
              textEl.setAttribute("value", "VER EXPLICACION");
            }
            textEl.setAttribute("color", "#4af7a0");
            textEl.setAttribute("emissive", "#4af7a0");
          }
          
          const baseEl = btnEl.querySelector(".vizo-btn-base");
          if (baseEl) {
            baseEl.setAttribute("color", "#003b21");
            baseEl.setAttribute("emissive", "#4af7a0");
            baseEl.setAttribute("emissive-intensity", "0.8");
          }
          const borderEl = btnEl.querySelector(".vizo-btn-border");
          if (borderEl) {
            borderEl.setAttribute("color", "#4af7a0");
            borderEl.setAttribute("emissive", "#4af7a0");
            borderEl.setAttribute("emissive-intensity", "2.0");
          }
        }
      }
    });
  }

  function showExplanation(dashboardType, targetEl) {
    console.log("ViZo // Solicitando explicación IA para:", dashboardType);

    const modal = document.getElementById("vizo-terminal-modal");
    const contentEl = document.getElementById("terminal-content");

    if (!modal || !contentEl) {
      console.error("ViZo // Modal o terminal content no encontrado en el DOM.");
      return;
    }

    // Limpiar intervalo anterior si existe
    if (typewriterInterval) {
      clearInterval(typewriterInterval);
      typewriterInterval = null;
    }

    // Si ya existe en caché, mostrar inmediatamente sin fetch
    if (explanationCache[dashboardType]) {
      console.log("ViZo // Obteniendo explicación desde caché para:", dashboardType);
      modal.classList.add("active");
      typewriterEffect(contentEl, explanationCache[dashboardType]);
      return;
    }

    // Mostrar modal con efecto de carga/transición
    contentEl.innerHTML = "<span class='blink'>[CONECTANDO CON EL NÚCLEO DE LA IA...]</span>";
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
        } else if (boatsAttr && typeof boatsAttr === "object" && boatsAttr.from) {
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
            } else if (treeAttr && typeof treeAttr === "object" && treeAttr.from) {
              treeFrom = treeAttr.from;
            }
            if (treeFrom) {
              fromStr = treeFrom;
            }
          }
        }
      } else {
        const componentAttrs = ["babia-cyls", "babia-doughnut", "babia-barsmap"];
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

      if (fromStr && fromStr.startsWith("vizo-loader-")) {
        datasetKey = fromStr.replace("vizo-loader-", "");
      }
    }

    if (!datasetKey) {
      if (dashboardType === "boats") datasetKey = "file_metrics";
      else if (dashboardType === "cyls" || dashboardType === "doughnut") datasetKey = "data_by_language";
      else if (dashboardType === "barsmap") datasetKey = "author_activity";
    }

    dashboardData = dataMap[datasetKey] || {};

    // Obtener el nombre del repositorio
    const repoName = statusEl ? statusEl.getAttribute("data-repo") : "LIVE_DATA";

    // Petición AJAX al backend
    fetch("/api/explain/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dashboard_type: datasetKey || dashboardType,
        dashboard_data: dashboardData || {},
        repo_name: repoName,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Server returned status " + res.status);
        return res.json();
      })
      .then((data) => {
        const text = data.explanation || "No se pudo obtener explicación de la IA.";
        explanationCache[dashboardType] = text;
        updateButtonLabels(dashboardType);
        typewriterEffect(contentEl, text);
      })
      .catch((err) => {
        console.error("ViZo // Error al obtener la explicación de la IA:", err);
        contentEl.textContent = ">>> ERROR: ERROR DE CONEXIÓN CON EL SERVIDOR DE IA.\n" + err.message;
      });
  }

  function closeExplanation() {
    const modal = document.getElementById("vizo-terminal-modal");
    if (modal) {
      modal.classList.remove("active");
    }
    if (typewriterInterval) {
      clearInterval(typewriterInterval);
      typewriterInterval = null;
    }
  }

  function typewriterEffect(element, text) {
    // Renderizado instantáneo
    element.innerHTML = text.replace(/\n/g, "<br>");
    
    // Auto-scroll al final de la terminal
    const body = document.querySelector(".terminal-body");
    if (body) {
      body.scrollTop = body.scrollHeight;
    }
  }

  // Registrar en el espacio de nombres global
  window.ViZo = {
    ui: {
      showExplanation: showExplanation,
      closeExplanation: closeExplanation,
    },
  };

  // Implementar disparador global para clicks desde el HUD 2D
  window.ViZoTrigger = function (action, vizType) {
    console.log("ViZoTrigger // Acción:", action, "Visualizador:", vizType);
    let targetEl = null;
    if (vizType === "boats") targetEl = document.querySelector("[babia-boats]");
    else if (vizType === "cyls") targetEl = document.querySelector("[babia-cyls]");
    else if (vizType === "doughnut") targetEl = document.querySelector("[babia-doughnut]");
    else if (vizType === "barsmap") targetEl = document.querySelector("[babia-barsmap]");

    if (!targetEl) {
      console.warn("ViZoTrigger // No se encontró el componente visualizador de tipo:", vizType);
      return;
    }

    if (action === "wireframe") {
      if (typeof toggleWireframe === "function") {
        toggleWireframe(targetEl, vizType);
      }
    } else if (action === "swap-mappings") {
      if (typeof swapMappings === "function") {
        swapMappings(targetEl, vizType);
      }
    } else if (action === "cycle-height") {
      if (typeof cycleHeight === "function") {
        cycleHeight(targetEl, vizType);
      }
    } else if (action === "explain-ai") {
      showExplanation(vizType, targetEl);
    }
  };

  // ---------------------------------------------------------------------------
  // 10. Construir Menú de Muñeca VR holográfico al conectar el mando
  // ---------------------------------------------------------------------------
  const leftController = document.getElementById("left-controller");
  const menuEl = document.getElementById("vr-wrist-menu");

  // Pre-construir el menú inmediatamente para evitar race conditions
  if (menuEl && window.ViZoBuilders && typeof window.ViZoBuilders.buildVRWristMenu === "function") {
    menuEl.innerHTML = "";
    window.ViZoBuilders.buildVRWristMenu(menuEl);
    console.log("ViZo // Menú de Muñeca VR pre-construido en la inicialización.");
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
      console.log("ViZo // Entrando en Realidad Virtual (VR). Activando panel de muñeca.");
      showWristMenu();
    });
    scene.addEventListener("exit-vr", function () {
      console.log("ViZo // Saliendo de Realidad Virtual (VR). Ocultando panel de muñeca.");
      menuEl.setAttribute("visible", "false");
    });
  }
})();
