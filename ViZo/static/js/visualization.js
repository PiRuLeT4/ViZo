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
  // 9. Lógica del Chat 2D -> 3D
  // ---------------------------------------------------------------------------
  const chatInput = document.getElementById("ai-chat-input");
  const chatSubmit = document.getElementById("ai-chat-submit");
  const chat3dText = document.getElementById("vizo-chat-3d-text");
  
  if (chatInput && chatSubmit && chat3dText) {
    let chatHistory = "ViZo AI Terminal v1.0\n========================================\nSistema iniciado. Esperando ordenes...\n";
    
    function sendChatMessage() {
      const msg = chatInput.value.trim();
      if (!msg) return;
      
      // Añadir mensaje del usuario al log
      chatHistory += "\n> USER: " + msg + "\n";
      chatHistory += "> AI: Procesando solicitud...\n";
      
      // Mantener solo las últimas líneas para no desbordar el panel 3D
      const lines = chatHistory.split("\n");
      if (lines.length > 25) {
        chatHistory = lines.slice(lines.length - 25).join("\n");
      }
      
      // Actualizar el texto en 3D
      chat3dText.setAttribute("value", chatHistory);
      chatInput.value = "";
      
      // TODO: Aquí irá el fetch() real a Django (/api/ask_ai/)
      // Simulamos respuesta para que veas el efecto de la pared 3D
      setTimeout(() => {
        chatHistory = chatHistory.replace("> AI: Procesando solicitud...\n", "> AI: Mensaje recibido. \n> AI: Todavía no estoy conectado al backend de Django.\n");
        chat3dText.setAttribute("value", chatHistory);
      }, 1500);
    }
    
    chatSubmit.addEventListener("click", sendChatMessage);
    chatInput.addEventListener("keypress", function(e) {
      if (e.key === "Enter") sendChatMessage();
    });
  }
})();
