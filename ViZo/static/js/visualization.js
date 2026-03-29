(function () {
  // =============================================================================
  // ViZo // visualization.js
  // Siempre genera un babia-city.
  //
  // La IA devuelve:
  //   - color_mode: "folder" → babia-city usa split_by="/" en treebuilder,
  //                            así cada carpeta es una zona con unicolor distinto.
  //   - color_mode: "ccn"    → color de edificio según complejidad (gradiente).
  //
  // Los campos "height" y "area" ya están normalizados [0.5, 9] en el backend.
  // El campo "id" es el path relativo (ej: "src/utils/helpers.py").
  // =============================================================================

  // ---------------------------------------------------------------------------
  // 1. Parsear la configuración de la IA
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

  // Fallback
  if (!aiConfig) {
    aiConfig = {
      component: "babia-city",
      mappings: { key: "id", fheight: "height", farea: "area" },
      visuals: {
        color_mode: "folder",
        color_palette: {},
        base_color: "#1a1a1a",
        extra: 1.5,
      },
    };
    console.warn("ViZo // Using default AI config (fallback).");
  }

  const visuals      = aiConfig.visuals || {};
  const colorMode    = visuals.color_mode || "folder";
  const colorPalette = visuals.color_palette || {};   // { folder_name: "#hexcolor" }
  const baseColor    = visuals.base_color || "#1a1a1a";
  const extraVal     = visuals.extra || 1.5;

  // ---------------------------------------------------------------------------
  // 2. Parsear el dataset por archivo
  // ---------------------------------------------------------------------------
  const rawData = document.getElementById("vizo-data-json").textContent;

  if (!rawData) {
    console.error("ViZo // No data found in #vizo-data-json");
    return;
  }

  let repoData;
  try {
    repoData = JSON.parse(rawData);
  } catch (e) {
    console.error("ViZo // Error parsing repo data:", e);
    return;
  }

  // ---------------------------------------------------------------------------
  // 3. Si color_mode = "ccn", sobreescribir "height" con el gradiente de color
  //    embebido como un campo numérico extra "ccn_norm" (para visualización).
  //    Para el color real usaremos building_color fijo en "ccn" mode y
  //    unicolor=false para zonas en "folder" mode.
  // ---------------------------------------------------------------------------

  // En modo CCN: elegimos un color de edificio único basado en la CCN media del repo
  // (babia-city no soporta color por fila, pero sí por la estructura de zones)
  // Usamos una paleta de colores según CCN media del repo.
  function avgCcnColor(data) {
    const avgCcn = data.reduce((s, d) => s + (d.area || d.ccn || 1), 0) / Math.max(data.length, 1);
    // avgCcn normalizado en [0.5, 9]
    const t = Math.min(Math.max((avgCcn - 0.5) / (9 - 0.5), 0), 1);
    if (t < 0.33) return "#00ff88";      // verde: baja complejidad
    if (t < 0.66) return "#ffdd00";      // amarillo: complejidad media
    return "#ff3c00";                     // rojo: alta complejidad
  }

  // Inyectar dataset en el cargador BabiaXR
  try {
    const blob = new Blob([JSON.stringify(repoData)], { type: "application/json" });
    const blobUrl = URL.createObjectURL(blob);
    const cargador = document.querySelector("#cargador");
    if (cargador) {
      cargador.setAttribute("babia-queryjson", { url: blobUrl });
      console.log("ViZo // Data Stream Injected:", blobUrl);
      console.log("ViZo // Sample data:", repoData.slice(0, 3));
    }
  } catch (e) {
    console.error("ViZo // Error injecting data stream:", e);
    return;
  }

  // ---------------------------------------------------------------------------
  // 4. Crear el babia-treebuilder
  //    - En modo "folder": split_by="/" para que cada carpeta sea una zona
  //    - En modo "ccn": sin split (árbol plano, un solo nivel)
  // ---------------------------------------------------------------------------
  const scene = document.querySelector("a-scene");

  const arbol = document.createElement("a-entity");
  arbol.setAttribute("id", "arbol");

  if (colorMode === "folder") {
    // El field "id" es el path relativo → split_by "/" crea zonas por carpeta
    arbol.setAttribute("babia-treebuilder", "from: cargador; field: id; split_by: /");
    console.log("ViZo // babia-treebuilder con split_by='/' (modo folder)");
  } else {
    // Árbol plano: id es el path pero no dividimos por carpeta
    arbol.setAttribute("babia-treebuilder", "from: cargador; field: id");
    console.log("ViZo // babia-treebuilder sin split_by (modo ccn)");
  }

  if (scene) scene.appendChild(arbol);

  // ---------------------------------------------------------------------------
  // 5. Crear el componente babia-city
  // ---------------------------------------------------------------------------
  const vizEntity = document.createElement("a-entity");
  vizEntity.setAttribute("id", "vizo-visualization");
  vizEntity.setAttribute("position", "0 0.1 0");
  vizEntity.setAttribute("scale", "0.3 0.3 0.3");

  // Color de edificio según modo
  let buildingColor;
  if (colorMode === "ccn") {
    buildingColor = avgCcnColor(repoData);
    console.log("ViZo // CCN mode → building_color:", buildingColor);
  } else {
    // En modo folder, babia-city coloreará cada zona automáticamente con unicolor=false
    // Usamos el primer color de la paleta de la IA (o cian) como base
    const paletteColors = Object.values(colorPalette);
    buildingColor = paletteColors.length > 0 ? paletteColors[0] : "#00fbff";
    console.log("ViZo // Folder mode → base building_color:", buildingColor, "| Zonas coloreadas automáticamente por babia-city");
  }

  const cityAttr = {
    from: "arbol",
    width: 20,
    depth: 20,
    fheight: "height",
    farea: "area",
    fmaxarea: "area",
    streets: true,
    base_thick: 0.2,
    extra: extraVal,
    split: "pivot",
    base_color: baseColor,
    building_color: buildingColor,
    // unicolor: false → cada "zona" (carpeta) tendrá un color distinto
    unicolor: colorMode === "folder" ? false : false,
    titles: true,
  };

  vizEntity.setAttribute("babia-city", cityAttr);

  if (scene) {
    scene.appendChild(vizEntity);
    console.log("ViZo // babia-city created:", cityAttr);
  }

  // ---------------------------------------------------------------------------
  // 6. Leyenda de colores de carpeta (HTML overlay)
  //    Muestra qué color corresponde a cada carpeta según la paleta de la IA
  // ---------------------------------------------------------------------------
  if (colorMode === "folder" && Object.keys(colorPalette).length > 0) {
    const legend = document.createElement("div");
    legend.id = "vizo-folder-legend";
    legend.style.cssText = `
      position: absolute; bottom: 20px; left: 20px;
      color: #fff; font-family: 'Outfit', sans-serif; font-size: 12px;
      background: rgba(0,0,0,0.6); padding: 10px 14px; border-radius: 8px;
      border: 1px solid rgba(0,251,255,0.3); pointer-events: none; z-index: 10;
      max-width: 220px;
    `;
    legend.innerHTML = `<div style="color:#00fbff;font-weight:bold;margin-bottom:6px;letter-spacing:1px;">CARPETAS //</div>` +
      Object.entries(colorPalette).map(([folder, color]) =>
        `<div style="display:flex;align-items:center;gap:6px;margin:2px 0;">
           <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${color};"></span>
           <span style="opacity:0.9;">${folder}</span>
         </div>`
      ).join("");
    document.body.appendChild(legend);
    console.log("ViZo // Folder legend rendered:", colorPalette);
  }

  // ---------------------------------------------------------------------------
  // 7. Actualizar HUD
  // ---------------------------------------------------------------------------
  const statusEl = document.querySelector(".vizo-status");
  if (statusEl) {
    const modeLabel = colorMode === "ccn" ? "CCN_GRADIENT" : "FOLDER_ZONES";
    statusEl.textContent = `LIVE_DATA_ANALYSIS // CITY [${modeLabel}]`;
  }
})();
