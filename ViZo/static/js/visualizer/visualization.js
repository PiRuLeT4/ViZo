/**
 * ViZzo // visualization.js  —  Visualizer Entrypoint & Orchestrator
 */

import { initAiAssistant } from './ai-assistant.js';
import {
  ensureLoader,
  ensureLimitedLoader,
  ensureLimitedReleasesLoader,
  ensureNetworkLoaders,
} from './modules/helpers.js';
import {
  POSITIONS,
  calculateSatellitePosition,
  buildCity,
  buildCyls,
  buildDoughnut,
  buildPie,
  buildBarsmap,
  buildNetwork,
  buildBars,
  buildStatsTrophies,
} from './modules/builders.js';
import { initWallOfFame } from './modules/components/fame.js';
import { initVRInteraction } from './modules/vr/vr-interaction.js';

// Import components to guarantee A-Frame registration
import './modules/components/podio.js';
import './modules/components/control-panel.js';
import './modules/components/vizzo-components.js';
import './modules/components/vizzo-sky-switcher.js';
import './modules/vr/vr-menu.js';

// Inicializar estado global compartido
window.ViZzoState = window.ViZzoState || {
  loaders: {},
  dataMap: {},
  blobUrls: {},
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
  const sessionId = window.ViZzoSessionId;
  if (!sessionId) {
    console.error("ViZzo // No session ID found in window.ViZzoSessionId");
    return;
  }

  const statusEl = document.querySelector(".vizzo-status");
  if (statusEl) {
    statusEl.textContent = "CONECTANDO CON LA BASE DE DATOS...";
  }

  // Inicializar asistentes
  initAiAssistant();
  initVRInteraction();

  // obtener los datos de la sesion accediendo a la API de django de visualization. 
  // concretamente api session data.
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
          (data.repo_name || "LIVE_DATA").toUpperCase();
      }
    })
    .catch((err) => {
      console.error("ViZzo // Error fetching visualization data:", err);
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
    console.warn("ViZzo // Usando configuración de dashboards por defecto.");
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
    "ViZzo // Dashboards a renderizar:",
    aiConfig.dashboards.map((d) => d.component),
  );

  // Guardar los datos en el mapa de estado global
  const repoSummary = apiData.repo_summary || {};
  const codeReviews = repoSummary.code_reviews || { nodes: [], links: [] };
  const issuesHealth = repoSummary.issues_health || [];
  const releasesHealth = repoSummary.releases_health || [];
  const communityActivity = repoSummary.community_activity || [];

  window.ViZzoState.repoSummary = repoSummary;
  window.ViZzoState.dataMap = {
    file_metrics: fileMetrics,
    data_by_language: dataByLanguage,
    evolution_data: evolutionData,
    author_activity: authorActivity,
    file_ownership: fileOwnership,
    age_distribution: ageDistribution,
    top_complex_files: topComplexFiles,
    file_network: fileNetwork,
    pull_requests: pullRequests,
    issues: issues,
    code_reviews: codeReviews,
    issues_health: issuesHealth,
    releases_health: releasesHealth,
    community_activity: communityActivity,
    top_churn_files: apiData.top_churn_files,
  };

  // Pregenerar Blob URLs
  for (const [key, data] of Object.entries(window.ViZzoState.dataMap)) {
    if (data) {
      const blob = new Blob([JSON.stringify(data)], {
        type: "application/json",
      });
      window.ViZzoState.blobUrls[key] = URL.createObjectURL(blob);
      console.log("ViZzo // Blob creado para '" + key + "':", window.ViZzoState.blobUrls[key]);
    } else {
      console.warn(
        "ViZzo // [DEBUG] Dataset '" +
          key +
          "' es null/undefined, NO se creó blob."
      );
    }
  }

  // Lanzar el renderizado
  buildVisualization();
}

/**
 * Renderiza todos los dashboards configurados por la IA en la sala 3D
 */
function buildVisualization() {
  const scene = document.querySelector("a-scene");
  if (!scene) {
    console.error("ViZzo // No se encontró a-scene en el DOM.");
    return;
  }

  const dashboards = aiConfig.dashboards;

  // Ordenar para asegurar que babia-boats sea siempre el primero (Hero)
  dashboards.sort((a, b) => {
    if (a.component === "babia-boats") return -1;
    if (b.component === "babia-boats") return 1;
    return 0;
  });

  console.log("ViZzo // Dashboards ordenados (Hero primero):", dashboards);

  const satellites = dashboards.filter((d) => d.component !== "babia-boats");
  const totalSatellites = satellites.length;
  let satelliteIdx = 0;

  dashboards.forEach(function (dash, idx) {
    console.log(
      "ViZzo // [DEBUG] Procesando dashboard[" + idx + "]:",
      dash.component,
      "dataset:",
      dash.dataset,
      "mappings:",
      JSON.stringify(dash.mappings)
    );

    // Filtro de Autocuración contra datasets vacíos
    const datasetKey = dash.dataset;
    const datasetData = window.ViZzoState.dataMap[datasetKey];
    const isEmpty = !datasetData || 
                    (Array.isArray(datasetData) && datasetData.length === 0) ||
                    (typeof datasetData === 'object' && 
                     (!datasetData.nodes || datasetData.nodes.length === 0) &&
                     (!datasetData.links || datasetData.links.length === 0) &&
                     Object.keys(datasetData).length === 0);

    if (isEmpty) {
      console.warn(`ViZzo // Omitiendo dashboard '${dash.id}' (${dash.component}) porque el dataset '${datasetKey}' está vacío.`);
      return; // Omitimos este dashboard de forma silenciosa
    }
    
    let loaderId = null;
    if (
      dash.component === "babia-barsmap" ||
      dash.component === "babia-bars"
    ) {
      loaderId = ensureLimitedLoader(scene, dash);
    } else if (dash.component === "babia-network") {
      loaderId = "network-special-flag";
    } else if (
      dash.component === "babia-cyls" &&
      dash.dataset === "evolution_data" &&
      window.ViZzoState.repoSummary.analysis_mode === "releases"
    ) {
      loaderId = ensureLimitedReleasesLoader(scene, dash);
    } else {
      loaderId = ensureLoader(scene, dash.dataset);
    }
    
    if (!loaderId) {
      console.error(
        "ViZzo // [DEBUG] ❌ Loader devuelto nulo para dataset '" +
          dash.dataset +
          "' → dashboard '" +
          dash.component +
          "' SALTADO"
      );
      return;
    }
    
    console.log(
      "ViZzo // [DEBUG] ✅ Loader OK para '" + dash.dataset + "':",
      loaderId
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
      case "babia-pie":
        buildPie(scene, dash, loaderId, pos);
        break;
      case "babia-barsmap":
        buildBarsmap(scene, dash, loaderId, pos);
        break;
      case "babia-bars":
        buildBars(scene, dash, loaderId, pos);
        break;
      case "babia-network":
        const loadersObj = ensureNetworkLoaders(scene, fileNetwork);
        buildNetwork(
          scene,
          dash,
          loadersObj.nodesLoaderId,
          loadersObj.linksLoaderId,
          pos
        );
        break;
      default:
        console.warn("ViZzo // Componente desconocido:", dash.component);
    }
  });

  // Actualizar HUD
  const statusEl = document.querySelector(".vizzo-status");
  if (statusEl) {
    const repoName = statusEl.getAttribute("data-repo");
    if (repoName && repoName !== "LIVE_DATA") {
      statusEl.textContent = repoName.toUpperCase();
    } else {
      const names = dashboards.map((d) =>
        d.component.replace("babia-", "").toUpperCase()
      );
      statusEl.textContent = "LIVE_DATA // " + names.join(" + ");
    }
  }

  // Renderizar trofeos de Stars y Forks si están disponibles
  buildStatsTrophies(scene, window.ViZzoState.repoSummary);

  // Renderizar Muro de la Fama de Desarrolladores (Top 3) asíncronamente
  initWallOfFame();
}
