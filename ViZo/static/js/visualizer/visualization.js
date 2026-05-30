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
  const { POSITIONS, buildCity, buildCyls, buildDoughnut, buildBarsmap } = window.ViZoBuilders;

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
  const total = dashboards.length;

  // Las posiciones se asignan en orden: 0=Centro, 1=Izquierda, 2=Derecha, 3=Fondo
  const positionSlots = [
    POSITIONS[0],
    POSITIONS[1],
    POSITIONS[2],
    POSITIONS[3],
  ];

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

    const pos = positionSlots[idx] || POSITIONS[0];

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
          
          const baseEl = btnEl.querySelector("a-box, a-cylinder");
          if (baseEl) {
            baseEl.setAttribute("color", "#003d1c"); // Cambiar a verde oscuro
            baseEl.setAttribute("emissive", "#4af7a0");
            baseEl.setAttribute("emissive-intensity", "1.2");
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

    // Obtener los datos correctos
    let dashboardData = null;
    if (dashboardType === "boats") {
      dashboardData = fileMetrics;
    } else if (dashboardType === "cyls" || dashboardType === "doughnut") {
      dashboardData = dataByLanguage;
    } else if (dashboardType === "barsmap") {
      dashboardData = authorActivity;
    }

    // Obtener el nombre del repositorio
    const repoName = statusEl ? statusEl.getAttribute("data-repo") : "LIVE_DATA";

    // Petición AJAX al backend
    fetch("/api/explain/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dashboard_type: dashboardType,
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
  const leftController = document.querySelector('[oculus-touch-controls="hand: left"]');
  const menuEl = document.getElementById("vr-wrist-menu");

  if (menuEl) {
    menuEl.setAttribute("visible", "false");
  }

  if (leftController && menuEl) {
    leftController.addEventListener("controllerconnected", function (evt) {
      console.log("ViZo // Mando izquierdo conectado. Generando Menú de Muñeca VR...");
      menuEl.setAttribute("visible", "true");
      menuEl.innerHTML = "";
      if (window.ViZoBuilders && typeof window.ViZoBuilders.buildVRWristMenu === "function") {
        window.ViZoBuilders.buildVRWristMenu(menuEl);
      }
    });

    leftController.addEventListener("controllerdisconnected", function (evt) {
      console.log("ViZo // Mando izquierdo desconectado. Ocultando Menú de Muñeca VR...");
      menuEl.setAttribute("visible", "false");
    });
  }
})();
