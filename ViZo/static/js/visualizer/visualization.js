(function () {
  // =============================================================================
  // ViZo // visualization.js  —  Visualizer Entrypoint & Orchestrator
  //
  // Punto de entrada asíncrono que descarga los datos de la base de datos,
  // inicializa el estado global compartido y orquesta el renderizado dinámico
  // de los dashboards 3D delegando en los constructores correspondientes.
  // =============================================================================

  // Inicializar estado global compartido
  window.ViZoState = window.ViZoState || {
    loaders: {},
    dataMap: {},
    blobUrls: {}
  };

  let fileMetrics = null;
  let dataByLanguage = null;
  let evolutionData = null;
  let authorActivity = null;
  let fileOwnership = null;
  let ageDistribution = null;
  let topComplexFiles = null;
  let fileNetwork = null;
  let pullRequests = null;
  let issues = null;
  let aiConfig = null;

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
      .then((response) => {
        if (!response.ok) {
          throw new Error("HTTP error " + response.status);
        }
        return response.json();
      })
      .then((data) => {
        if (statusEl) {
          statusEl.textContent =
            (data.repo_name || "LIVE_DATA").toUpperCase() +
            " // CONSTRUYENDO ESCENA 3D...";
        }
        initVisualizer(data);
        if (statusEl) {
          statusEl.textContent =
            (data.repo_name || "LIVE_DATA").toUpperCase() +
            " // LABORATORIO ONLINE";
        }
      })
      .catch((err) => {
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
    pullRequests = apiData.pull_requests;
    issues = apiData.issues;
    aiConfig = apiData.ai_config;

    // Si el dataset es "issues" y contiene la lista raw de issues,
    // pre-agrupamos por 'state' para babia-doughnut (open vs closed).
    let processedIssues = issues;
    if (
      Array.isArray(issues) &&
      issues.length > 0 &&
      !issues[0].hasOwnProperty("count")
    ) {
      const counts = {};
      issues.forEach((issue) => {
        const state = issue.state || "open";
        counts[state] = (counts[state] || 0) + 1;
      });
      processedIssues = Object.keys(counts).map((state) => ({
        state: state,
        count: counts[state],
      }));
    }

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

    // Guardar los datos en el mapa de estado global
    window.ViZoState.repoSummary = apiData.repo_summary || { stars: 0, forks: 0 };
    window.ViZoState.dataMap = {
      file_metrics: fileMetrics,
      data_by_language: dataByLanguage,
      evolution_data: evolutionData,
      author_activity: authorActivity,
      file_ownership: fileOwnership,
      age_distribution: ageDistribution,
      top_complex_files: topComplexFiles,
      file_network: fileNetwork,
      pull_requests: pullRequests,
      issues: processedIssues,
    };

    // Pregenerar Blob URLs
    for (const [key, data] of Object.entries(window.ViZoState.dataMap)) {
      if (data) {
        const blob = new Blob([JSON.stringify(data)], {
          type: "application/json",
        });
        window.ViZoState.blobUrls[key] = URL.createObjectURL(blob);
        console.log("ViZo // Blob creado para '" + key + "':", window.ViZoState.blobUrls[key]);
      } else {
        console.warn(
          "ViZo // [DEBUG] Dataset '" +
            key +
            "' es null/undefined, NO se creó blob.",
        );
      }
    }

    // Lanzar el renderizado
    buildVisualization();
  }

  // Desestructuración de helpers geométricos del archivo builders.js
  const {
    POSITIONS,
    calculateSatellitePosition,
    buildCity,
    buildCyls,
    buildDoughnut,
    buildBarsmap,
    buildNetwork,
    buildBars,
  } = window.ViZoBuilders;

  /**
   * Renderiza todos los dashboards configurados por la IA en la sala 3D
   */
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
      if (
        dash.component === "babia-barsmap" ||
        dash.component === "babia-bars"
      ) {
        loaderId = window.ViZoHelpers.ensureLimitedLoader(scene, dash);
      } else if (dash.component === "babia-network") {
        loaderId = "network-special-flag";
      } else {
        loaderId = window.ViZoHelpers.ensureLoader(scene, dash.dataset);
      }
      
      if (!loaderId) {
        console.error(
          "ViZo // [DEBUG] ❌ Loader devuelto nulo para dataset '" +
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
        pos = POSITIONS[0] || { x: 0, y: 0.1, z: 20 };
        pos.rotY = 0; // Mirando al norte
      } else {
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
          buildBarsmap(scene, dash, loaderId, pos);
          break;
        case "babia-bars":
          buildBars(scene, dash, loaderId, pos);
          break;
        case "babia-network":
          const loadersObj = window.ViZoHelpers.ensureNetworkLoaders(scene, fileNetwork);
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

    // Actualizar HUD
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
    // Renderizar trofeos de Stars y Forks si están disponibles
    if (window.ViZoBuilders.buildStatsTrophies) {
      window.ViZoBuilders.buildStatsTrophies(scene, window.ViZoState.repoSummary);
    }
  }
})();
