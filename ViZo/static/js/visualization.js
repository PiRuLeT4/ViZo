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
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Posiciones fijas por número de dashboards
  //    La sala tiene profundidad -19..+19 y ancho -19..+19
  //    Posicionamos los dashboards en el centro de la sala mirando al jugador
  // ---------------------------------------------------------------------------
  const POSITIONS = [
    { x: 0, y: 0.1, z: 8 }, // 1 dashboard: centro, cerca del jugador
    { x: -8, y: 0.1, z: 0 }, // 2 dashboards: izquierda, más adentro
    { x: 8, y: 0.1, z: 0 }, //               derecha, más adentro
    { x: -3, y: 0.1, z: 12 }, // 3 dashboards: fondo centro
  ];

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
  // 6. Builders por tipo de componente
  // ---------------------------------------------------------------------------

  /**
   * babia-boats: necesita un babia-treebuilder intermedio.
   * Usa el campo "id" como jerarquía (path del archivo).
   */
  function buildCity(scene, dash, loaderId, pos) {
    const treebuilderId = "vizo-tree-" + dash.id;
    const treeEl = document.createElement("a-entity");
    treeEl.setAttribute("id", treebuilderId);
    treeEl.setAttribute(
      "babia-treebuilder",
      "from: " + loaderId + "; field: id",
    );
    scene.appendChild(treeEl);

    const m = dash.mappings;
    const vizEl = document.createElement("a-entity");
    vizEl.setAttribute("id", "vizo-viz-" + dash.id);
    vizEl.setAttribute("position", pos.x + " 0.1 " + pos.z);
    vizEl.setAttribute("scale", "0.2 0.2 0.2");
    vizEl.setAttribute(
      "babia-boats",
      [
        "from: " + treebuilderId,
        "height: " + (m.height || "nloc"),
        "area: " + (m.area || "ccn"),
        "streets: true",
        "extra: 1.5",
        "split: pivot",
        "base_color: #0d1220",
        "building_color: #0a1a3a",
        "minBuildingHeight: 2",
        "maxBuildingHeight: 10",
        "separation: 0.11",
        "legend_text: {name}\n{height}(NLOC)x{area}(CCN)",
        "color: " + m.area,
      ].join("; "),
    );

    scene.appendChild(vizEl);
    console.log("ViZo // babia-boats creado sobre pedestal");
  }

  /**
   * babia-cyls: cilindros, altura = nloc, radio = count (archivos por lenguaje).
   */
  function buildCyls(scene, dash, loaderId, pos) {
    const m = dash.mappings;
    const vizEl = document.createElement("a-entity");
    vizEl.setAttribute("id", "vizo-viz-" + dash.id);
    vizEl.setAttribute("position", pos.x + " 0.1 " + pos.z);
    vizEl.setAttribute("scale", "0.4 0.4 0.4");
    vizEl.setAttribute(
      "babia-cyls",
      [
        "from: " + loaderId,
        "x_axis: " + (m.x_axis || "language"),
        "height: " + (m.height || "nloc"),
        "radius: " + (m.radius || "count"),
        "legend: true",
        "animation: true",
      ].join("; "),
    );

    scene.appendChild(vizEl);
    console.log("ViZo // babia-cyls creado sobre pedestal");
  }

  /**
   * babia-doughnut: distribución de archivos por lenguaje.
   */
  function buildDoughnut(scene, dash, loaderId, pos) {
    const m = dash.mappings;
    const vizEl = document.createElement("a-entity");
    vizEl.setAttribute("id", "vizo-viz-" + dash.id);
    vizEl.setAttribute("position", pos.x + " 1.2 " + (pos.z - 4));
    vizEl.setAttribute("rotation", "90 0 0");
    vizEl.setAttribute("scale", "0.6 0.6 0.6");
    vizEl.setAttribute(
      "babia-doughnut",
      [
        "from: " + loaderId,
        "key: " + (m.key || "language"),
        "size: " + (m.size || "count"),
        "legend: true",
        "animation: true",
        "title: " + dash.title,
        "titlePosition: 2 0 -3",
      ].join("; "),
    );

    scene.appendChild(vizEl);
    console.log("ViZo // babia-doughnut creado sobre pedestal");
  }

  /**
   * babia-barsmap: mapa de barras 2D por lenguaje/commits.
   */
  function buildBarsmap(scene, dash, loaderId, pos) {
    const m = dash.mappings;
    const vizEl = document.createElement("a-entity");
    vizEl.setAttribute("id", "vizo-viz-" + dash.id);
    vizEl.setAttribute("position", pos.x + " 0.71 " + (pos.z - 8));
    vizEl.setAttribute("scale", "0.2 0.2 0.2");
    vizEl.setAttribute(
      "babia-barsmap",
      [
        "from: " + loaderId,
        "x_axis: " + (m.x_axis || "language"),
        "z_axis: " + (m.z_axis || "language"),
        "height: " + (m.height || "commits"),
        "legend: true",
        "palette: pearl",
        "title: " + dash.title,
        "titlePosition: 0 10 0",
        "axis_name: true",
      ].join("; "),
    );

    scene.appendChild(vizEl);
    console.log("ViZo // babia-barsmap creado sobre pedestal");
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
    const loaderId = ensureLoader(scene, dash.dataset);
    if (!loaderId) return;

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
    const names = dashboards.map((d) =>
      d.component.replace("babia-", "").toUpperCase(),
    );
    statusEl.textContent = "LIVE_DATA // " + names.join(" + ");
  }
})();
