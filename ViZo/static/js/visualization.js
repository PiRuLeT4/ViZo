(function () {
  // =============================================================================
  // ViZo // visualization.js  —  Multi-Dashboard Renderer
  //
  // Lee la lista de dashboards que devuelve la IA y monta dinámicamente
  // cada componente BabiaXR con su propio cargador y posición en la sala.
  //
  // Componentes soportados:
  //   - babia-city      (necesita babia-treebuilder)  → dataset: file_metrics
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

  // Fallback: sólo babia-city si la IA falla
  if (
    !aiConfig ||
    !Array.isArray(aiConfig.dashboards) ||
    aiConfig.dashboards.length === 0
  ) {
    console.warn("ViZo // Usando configuración de dashboards por defecto.");
    aiConfig = {
      dashboards: [
        {
          id: "city-complexity",
          component: "babia-city",
          dataset: "file_metrics",
          title: "Code Complexity City",
          mappings: { key: "id", fheight: "height", farea: "area" },
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
    { x: 0, y: 0.1, z: 0 }, // 1 dashboard: centro
    { x: -10, y: 0.1, z: 5 }, // 2 dashboards: izquierda
    { x: 10, y: 0.1, z: 5 }, //               derecha
    { x: 0, y: 0.1, z: 12 }, // 3 dashboards: fondo (bien separado)
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
  // 5b. Función que crea el Pedestal (podio tech)
  // ---------------------------------------------------------------------------
  function buildPedestal(scene, pos, id) {
    const pedestal = document.createElement("a-box");
    pedestal.setAttribute("id", "pedestal-" + id);
    // Altura 0.6 -> centro en 0.3 relativo a la base
    const centerY = pos.y + 0.3;
    pedestal.setAttribute("position", pos.x + " " + centerY + " " + pos.z);
    pedestal.setAttribute("width", "6");
    pedestal.setAttribute("height", "0.3");
    pedestal.setAttribute("depth", "6");
    pedestal.setAttribute("color", "#111827");
    pedestal.setAttribute("roughness", "0.2");
    pedestal.setAttribute("metalness", "0.7");

    // // Añadir colisión física para el jugador
    // pedestal.setAttribute("solid-box", {
    //   cx: pos.x,
    //   cy: centerY,
    //   cz: pos.z,
    //   halfW: 3,
    //   halfH: 0.3,
    //   halfD: 3,
    // });

    scene.appendChild(pedestal);
  }

  // ---------------------------------------------------------------------------
  // 6. Builders por tipo de componente
  // ---------------------------------------------------------------------------

  /**
   * babia-city: necesita un babia-treebuilder intermedio.
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
    // Situar justo encima del pedestal (pos.y 0.1 + altura 0.6 = 0.70) + 0.01 de margen
    vizEl.setAttribute("position", pos.x + " 0.71 " + pos.z);
    vizEl.setAttribute("scale", "0.2 0.2 0.2");
    vizEl.setAttribute(
      "babia-city",
      [
        "from: " + treebuilderId,
        "width: 20",
        "depth: 20",
        "fheight: " + (m.fheight || "height"),
        "farea: " + (m.farea || "area"),
        "fmaxarea: " + (m.farea || "area"),
        "streets: true",
        "base_thick: 0.2",
        "extra: 1.5",
        "split: pivot",
        "base_color: #0a1a3a",
        "building_color: #0a1a3a",
        "unicolor: false",
        "titles: true",
      ].join("; "),
    );

    scene.appendChild(vizEl);
    console.log("ViZo // babia-city creado sobre pedestal");
  }

  /**
   * babia-cyls: cilindros, altura = nloc, radio = count (archivos por lenguaje).
   */
  function buildCyls(scene, dash, loaderId, pos) {
    const m = dash.mappings;
    const vizEl = document.createElement("a-entity");
    vizEl.setAttribute("id", "vizo-viz-" + dash.id);
    vizEl.setAttribute("position", pos.x + " 0.71 " + pos.z);
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
    // Mantener altura de flotación (0.71 + 1.09 = 1.8)
    vizEl.setAttribute("position", pos.x + " 1.8 " + pos.z);
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
    vizEl.setAttribute("position", pos.x + " 0.71 " + pos.z);
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
  console.log("ViZo // Dashboards a renderizar:", dashboards);
  const total = dashboards.length;

  // Calcular posiciones: 1 → centro, 2 → izq+der, 3 → izq+der+fondo
  const positionSlots =
    total === 1
      ? [POSITIONS[0]]
      : total === 2
        ? [POSITIONS[1], POSITIONS[2]]
        : [POSITIONS[1], POSITIONS[2], POSITIONS[3]];

  dashboards.forEach(function (dash, idx) {
    const loaderId = ensureLoader(scene, dash.dataset);
    if (!loaderId) return;

    const pos = positionSlots[idx] || POSITIONS[0];

    // 1. Crear el pedestal físico
    buildPedestal(scene, pos, dash.id);

    // 2. Crear el componente visual
    switch (dash.component) {
      case "babia-city":
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
