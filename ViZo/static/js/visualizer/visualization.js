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
  // 1. Declaración de variables y carga asíncrona por API (fetch)
  // ---------------------------------------------------------------------------
  let fileMetrics = null;
  let dataByLanguage = null;
  let evolutionData = null;
  let authorActivity = null;
  let fileOwnership = null;
  let ageDistribution = null;
  let topComplexFiles = null;
  let fileNetwork = null;
  let aiConfig = null;
  let dataMap = {};
  let blobUrls = {};
  const loaders = {}; // { dataset_key: element_id }

  document.addEventListener("DOMContentLoaded", function () {
    const sessionId = window.ViZoSessionId;
    if (!sessionId) {
      console.error("ViZo // No session ID found in window.ViZoSessionId");
      return;
    }

    const statusEl = document.querySelector(".vizo-status");
    if (statusEl) {
      statusEl.textContent = "CONECTANDO CON LA BASE DE DATOS...";
    }

    fetch(`/visualization/${sessionId}/api/data/`)
      .then(response => {
        if (!response.ok) {
          throw new Error("HTTP error " + response.status);
        }
        return response.json();
      })
      .then(data => {
        if (statusEl) {
          statusEl.textContent = (data.repo_name || "LIVE_DATA").toUpperCase() + " // CONSTRUYENDO ESCENA 3D...";
        }
        initVisualizer(data);
        if (statusEl) {
          statusEl.textContent = (data.repo_name || "LIVE_DATA").toUpperCase() + " // LABORATORIO ONLINE";
        }
      })
      .catch(err => {
        console.error("ViZo // Error fetching visualization data:", err);
        if (statusEl) {
          statusEl.textContent = "ERROR AL CARGAR DATOS DEL REPOSITORIO";
        }
      });
  });

  function initVisualizer(apiData) {
    fileMetrics = apiData.file_metrics;
    dataByLanguage = apiData.data_by_language;
    evolutionData = apiData.evolution_data;
    authorActivity = apiData.author_activity;
    fileOwnership = apiData.file_ownership;
    ageDistribution = apiData.age_distribution;
    topComplexFiles = apiData.top_complex_files;
    fileNetwork = apiData.file_network;
    aiConfig = apiData.ai_config;

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
    console.log(
      "ViZo // [DEBUG] fileNetwork:",
      fileNetwork
        ? Array.isArray(fileNetwork)
          ? fileNetwork.length + " rows"
          : "invalid"
        : "NULL",
    );

    if (!fileMetrics) {
      console.error("ViZo // No se encontró file_metrics en la respuesta de la API");
      return;
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

    // Mapa de datasets
    dataMap = {
      file_metrics: fileMetrics,
      data_by_language: dataByLanguage,
      evolution_data: evolutionData,
      author_activity: authorActivity,
      file_ownership: fileOwnership,
      age_distribution: ageDistribution,
      top_complex_files: topComplexFiles,
      file_network: fileNetwork,
    };

    // Pregenerar Blob URLs
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

    // Lanzar el renderizado
    buildVisualization();
  }

  // ---------------------------------------------------------------------------
  // 4. Importar constructores y posiciones desde builders.js
  // ---------------------------------------------------------------------------
  const {
    POSITIONS,
    calculateSatellitePosition,
    buildCity,
    buildCyls,
    buildDoughnut,
    buildBarsmap,
    buildNetwork,
  } = window.ViZoBuilders;

  // ---------------------------------------------------------------------------
  // 5. Función que crea un cargador (babia-queryjson) compartido por dataset
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Helper to split flat fileNetwork into nodes and links for babia-network
  // ---------------------------------------------------------------------------
  function generateNetworkNodesAndLinks(fileNetworkData) {
    const nodesMap = {};
    const linksSet = new Set();
    const filesMap = {};

    const dataArray = Array.isArray(fileNetworkData) ? fileNetworkData : [];

    dataArray.forEach((item) => {
      const author = item.author;
      const file = item.file;

      if (!nodesMap[author]) {
        const realCommits = item.commits || item.size || 1;
        nodesMap[author] = {
          id: author,
          name: author + " (" + realCommits + " commits)",
          val: realCommits,
          commits: realCommits,
        };
      }

      if (!filesMap[file]) {
        filesMap[file] = [];
      }
      filesMap[file].push(author);
    });

    Object.keys(filesMap).forEach((file) => {
      const authors = [...new Set(filesMap[file])];
      for (let i = 0; i < authors.length; i++) {
        for (let j = i + 1; j < authors.length; j++) {
          const a1 = authors[i];
          const a2 = authors[j];
          const first = a1 < a2 ? a1 : a2;
          const second = a1 < a2 ? a2 : a1;
          linksSet.add(first + "||" + second);
        }
      }
    });

    const nodes = Object.values(nodesMap);
    const links = Array.from(linksSet).map((key) => {
      const parts = key.split("||");
      return { source: parts[0], target: parts[1] };
    });

    // Filtrar nodos huérfanos (sin conexiones) para mantener el grafo compacto
    const connectedNodeIds = new Set();
    links.forEach((link) => {
      connectedNodeIds.add(link.source);
      connectedNodeIds.add(link.target);
    });

    const filteredNodes = nodes.filter((node) => connectedNodeIds.has(node.id));
    const finalNodes = filteredNodes.length > 0 ? filteredNodes : nodes;

    return { nodes: finalNodes, links: links };
  }

  function ensureNetworkLoaders(scene, fileNetworkData) {
    if (loaders["network-nodes"] && loaders["network-links"]) {
      return {
        nodesLoaderId: loaders["network-nodes"],
        linksLoaderId: loaders["network-links"],
      };
    }

    const { nodes, links } = generateNetworkNodesAndLinks(
      fileNetworkData || [],
    );

    // Create Nodes Loader
    const nodesBlob = new Blob([JSON.stringify(nodes)], {
      type: "application/json",
    });
    const nodesBlobUrl = URL.createObjectURL(nodesBlob);
    const nodesLoaderId = "vizo-loader-network-nodes";
    const nodesLoaderEl = document.createElement("a-entity");
    nodesLoaderEl.setAttribute("id", nodesLoaderId);
    nodesLoaderEl.setAttribute("babia-queryjson", "url: " + nodesBlobUrl);
    scene.appendChild(nodesLoaderEl);
    loaders["network-nodes"] = nodesLoaderId;

    // Create Links Loader
    const linksBlob = new Blob([JSON.stringify(links)], {
      type: "application/json",
    });
    const linksBlobUrl = URL.createObjectURL(linksBlob);
    const linksLoaderId = "vizo-loader-network-links";
    const linksLoaderEl = document.createElement("a-entity");
    linksLoaderEl.setAttribute("id", linksLoaderId);
    linksLoaderEl.setAttribute("babia-queryjson", "url: " + linksBlobUrl);
    scene.appendChild(linksLoaderEl);
    loaders["network-links"] = linksLoaderId;

    console.log(
      "ViZo // Cargadores de red creados:",
      nodesLoaderId,
      linksLoaderId,
    );
    return { nodesLoaderId, linksLoaderId };
  }

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

  // Helper function to limit dataset to maximum 15 items for barsmap dashboards
  function ensureLimitedLoader(scene, dash) {
    const datasetKey = dash.dataset;
    const originalData = dataMap[datasetKey];
    if (!originalData) {
      console.warn(
        "ViZo // Dataset '" + datasetKey + "' no disponible para barsmap.",
      );
      return null;
    }

    const loaderId = "vizo-loader-limited-" + dash.id;
    if (loaders[loaderId]) return loaders[loaderId];

    // Limit dataset to maximum 15 elements based on the mapped height metric
    const heightField = (dash.mappings && dash.mappings.height) || "commits";
    let limitedData = Array.isArray(originalData) ? [...originalData] : [];

    // Sort descending by height field
    limitedData.sort((a, b) => {
      const valA = parseFloat(a[heightField]) || 0;
      const valB = parseFloat(b[heightField]) || 0;
      return valB - valA;
    });

    // Take top 15 elements
    limitedData = limitedData.slice(0, 15);

    const blob = new Blob([JSON.stringify(limitedData)], {
      type: "application/json",
    });
    const blobUrl = URL.createObjectURL(blob);

    const loaderEl = document.createElement("a-entity");
    loaderEl.setAttribute("id", loaderId);
    loaderEl.setAttribute("babia-queryjson", "url: " + blobUrl);
    scene.appendChild(loaderEl);

    loaders[loaderId] = loaderId;
    console.log(
      "ViZo // Cargador limitado creado:",
      loaderId,
      "con",
      limitedData.length,
      "elementos",
    );
    return loaderId;
  }

  // ---------------------------------------------------------------------------
  // 7. Montar todos los dashboards
  // ---------------------------------------------------------------------------
  function buildVisualization() {
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
    const satellites = dashboards.filter((d) => d.component !== "babia-boats");
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
      let loaderId = null;
      if (dash.component === "babia-barsmap") {
        loaderId = ensureLimitedLoader(scene, dash);
      } else if (dash.component === "babia-network") {
        loaderId = "network-special-flag";
      } else {
        loaderId = ensureLoader(scene, dash.dataset);
      }
      if (!loaderId) {
        console.error(
          "ViZo // [DEBUG] ❌ ensureLoader/ensureLimitedLoader devolvió null para dataset '" +
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
        case "babia-network":
          const loadersObj = ensureNetworkLoaders(scene, fileNetwork);
          buildNetwork(
            scene,
            dash,
            loadersObj.nodesLoaderId,
            loadersObj.linksLoaderId,
            pos,
          );
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
    barsmap: null,
  };

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
            : cleanType;
      hudBtn.textContent = `VER EXP. ${shortType}`;
      hudBtn.style.borderColor = "#4af7a0"; // Borde verde neón
      hudBtn.style.color = "#4af7a0";
      hudBtn.style.textShadow = "0 0 8px rgba(74, 247, 160, 0.4)";
    }

    // 2. Actualizar botones 3D de A-Frame (Pedestales y Menú de Muñeca)
    const scene3dBtns = document.querySelectorAll("[vizo-control-btn]");
    scene3dBtns.forEach((btnEl) => {
      const comp = btnEl.getAttribute("vizo-control-btn");
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
      console.error(
        "ViZo // Modal o terminal content no encontrado en el DOM.",
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
        "ViZo // Obteniendo explicación desde caché para:",
        dashboardType,
      );
      modal.classList.add("active");
      typewriterEffect(contentEl, explanationCache[dashboardType]);
      return;
    }

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

      if (fromStr && fromStr.startsWith("vizo-loader-")) {
        datasetKey = fromStr.replace("vizo-loader-", "");
      }
    }

    if (!datasetKey) {
      if (dashboardType === "boats") datasetKey = "file_metrics";
      else if (dashboardType === "cyls" || dashboardType === "doughnut")
        datasetKey = "data_by_language";
      else if (dashboardType === "barsmap") datasetKey = "author_activity";
      else if (dashboardType === "network") datasetKey = "file_network";
    }

    dashboardData = dataMap[datasetKey] || {};

    // Obtener el nombre del repositorio
    const repoName = statusEl
      ? statusEl.getAttribute("data-repo")
      : "LIVE_DATA";

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
        const text =
          data.explanation || "No se pudo obtener explicación de la IA.";
        explanationCache[dashboardType] = text;
        updateButtonLabels(dashboardType);
        typewriterEffect(contentEl, text);
      })
      .catch((err) => {
        console.error("ViZo // Error al obtener la explicación de la IA:", err);
        contentEl.textContent =
          ">>> ERROR: ERROR DE CONEXIÓN CON EL SERVIDOR DE IA.\n" + err.message;
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
    else if (vizType === "cyls")
      targetEl = document.querySelector("[babia-cyls]");
    else if (vizType === "doughnut")
      targetEl = document.querySelector("[babia-doughnut]");
    else if (vizType === "barsmap")
      targetEl = document.querySelector("[babia-barsmap]");

    if (!targetEl) {
      console.warn(
        "ViZoTrigger // No se encontró el componente visualizador de tipo:",
        vizType,
      );
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
  if (
    menuEl &&
    window.ViZoBuilders &&
    typeof window.ViZoBuilders.buildVRWristMenu === "function"
  ) {
    menuEl.innerHTML = "";
    window.ViZoBuilders.buildVRWristMenu(menuEl);
    console.log(
      "ViZo // Menú de Muñeca VR pre-construido en la inicialización.",
    );
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
      console.log(
        "ViZo // Entrando en Realidad Virtual (VR). Activando panel de muñeca.",
      );
      showWristMenu();
    });
    scene.addEventListener("exit-vr", function () {
      console.log(
        "ViZo // Saliendo de Realidad Virtual (VR). Ocultando panel de muñeca.",
      );
      menuEl.setAttribute("visible", "false");
    });
  }
})();
