(function () {
  // =============================================================================
  // ViZo // visualization.js
  // Crea dinámicamente el componente BabiaXR correcto según la config de la IA.
  // =============================================================================

  // ---------------------------------------------------------------------------
  // 1. Parsear la configuración de la IA (primero, para saber qué dataset usar)
  // ---------------------------------------------------------------------------
  const rawAIConfig = document.getElementById("vizo-ai-config").textContent;
  let aiConfig = null;

  if (rawAIConfig && rawAIConfig.trim() !== "") {
    try {
      aiConfig = JSON.parse(rawAIConfig);
      console.log("ViZo // AI Config received:", aiConfig);
    } catch (e) {
      console.error("ViZo // Error parsing AI config:", e);
    }
  }

  // Fallback si la IA no respondió o el JSON es inválido
  if (!aiConfig) {
    aiConfig = {
      component: "babia-city",
      mappings: { key: "id", fheight: "nloc", farea: "ccn" },
      visuals: { building_color: "#00fbff", base_color: "#1a1a1a", extra: 1.5 },
    };
    console.warn("ViZo // Using default AI config (fallback).");
  }

  const mappings = aiConfig.mappings || {};
  const dataKey = mappings.key || "id"; // "id" → datos por archivo | "language" → datos por lenguaje

  // ---------------------------------------------------------------------------
  // 2. Seleccionar el dataset correcto e inyectarlo en el cargador (babia-queryjson)
  // ---------------------------------------------------------------------------
  // Si el key es "language", usar el dataset agrupado por lenguaje
  const dataSourceId =
    dataKey === "language" ? "vizo-language-json" : "vizo-data-json";
  const rawData = document.getElementById(dataSourceId).textContent;

  console.log(
    `ViZo // Dataset seleccionado: '${dataSourceId}' (key='${dataKey}')`,
  );

  if (rawData) {
    try {
      const repoData = JSON.parse(rawData);
      const blob = new Blob([JSON.stringify(repoData)], {
        type: "application/json",
      });
      const blobUrl = URL.createObjectURL(blob);

      const cargador = document.querySelector("#cargador");
      if (cargador) {
        cargador.setAttribute("babia-queryjson", { url: blobUrl });
        console.log("ViZo // Data Stream Injected:", blobUrl);
        console.log("ViZo // Repo Data:", repoData);
      }
    } catch (e) {
      console.error("ViZo // Error parsing data stream:", e);
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Crear el componente BabiaXR correcto dinámicamente
  // ---------------------------------------------------------------------------
  const component = (aiConfig.component || "babia-city").toLowerCase();
  const visuals = aiConfig.visuals || {};

  // El contenedor de la escena A-Frame donde insertar el componente
  const scene = document.querySelector("a-scene");

  // Para babia-city necesitamos un babia-treebuilder intermedio
  let dataSource = "cargador";
  if (component === "babia-city") {
    const arbol = document.createElement("a-entity");
    arbol.setAttribute("id", "arbol");
    arbol.setAttribute("babia-treebuilder", "from: cargador; field: id");
    if (scene) scene.appendChild(arbol);
    dataSource = "arbol";
    console.log("ViZo // babia-treebuilder created (required for babia-city)");
  }

  // Función auxiliar: construye el objeto de atributos para el componente
  function buildComponentAttr(component, dataSource, mappings, visuals) {
    switch (component) {
      case "babia-city":
        return {
          from: dataSource,
          width: 20,
          depth: 20,
          fheight: mappings.fheight || "nloc",
          farea: mappings.farea || "ccn",
          fmaxarea: mappings.farea || "ccn",
          streets: true,
          base_thick: 0.2,
          extra: visuals.extra || 1.5,
          split: "pivot",
          base_color: visuals.base_color || "#eee",
          building_color: visuals.building_color || "#22CFD4",
          titles: true,
        };

      case "babia-doughnut":
        return {
          from: dataSource,
          key: dataKey,
          palette: "sunset",
          title: "Distribucion del repositorio",
          legend: true,
          size: mappings.fvalues || "nloc",
          animation: true,
          titlePosition: "0 0 -3",
        };

      case "babia-cyls":
        return {
          from: dataSource,
          key: dataKey,
          fheight: mappings.fheight || "nloc",
          fradius: mappings.fradius || "ccn",
          palette: "sunset",
          titles: true,
        };

      default:
        console.warn(
          "ViZo // Unknown component:",
          component,
          "— falling back to babia-city",
        );
        return {
          from: dataSource,
          width: 20,
          depth: 20,
          fheight: "nloc",
          farea: "ccn",
          fmaxarea: "ccn",
          streets: true,
          base_thick: 0.2,
          extra: 1.5,
          split: "pivot",
          base_color: "#eee",
          building_color: "#22CFD4",
          titles: true,
        };
    }
  }

  // Crear la entidad A-Frame
  const vizEntity = document.createElement("a-entity");
  vizEntity.setAttribute("id", "vizo-visualization");

  // Posición y escala por componente
  if (component === "babia-city") {
    vizEntity.setAttribute("position", "0 0.1 0");
    vizEntity.setAttribute("scale", "0.3 0.3 0.3");
  } else if (component === "babia-doughnut") {
    vizEntity.setAttribute("position", "0 2 0");
    vizEntity.setAttribute("scale", "1 1 1");
    vizEntity.setAttribute("rotation", "90 0 0");
  } else if (component === "babia-cyls") {
    vizEntity.setAttribute("position", "0 0 0");
    vizEntity.setAttribute("scale", "0.5 0.5 0.5");
  }

  // Asignar el componente BabiaXR correcto con sus atributos
  const attrObject = buildComponentAttr(
    component,
    dataSource,
    mappings,
    visuals,
  );
  vizEntity.setAttribute(component, attrObject);

  // Insertar en la escena A-Frame
  if (scene) {
    scene.appendChild(vizEntity);
    console.log(
      `ViZo // Component '${component}' created with config:`,
      attrObject,
    );
  }

  // ---------------------------------------------------------------------------
  // 4. Actualizar el HUD con el componente activo
  // ---------------------------------------------------------------------------
  const statusEl = document.querySelector(".vizo-status");
  if (statusEl) {
    const componentLabel = component.replace("babia-", "").toUpperCase();
    statusEl.textContent = `LIVE_DATA_ANALYSIS // ${componentLabel}`;
  }
})();
