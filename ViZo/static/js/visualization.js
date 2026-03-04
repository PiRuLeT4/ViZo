(function () {
  // 1. Inyectar Datos del Repo
  const rawData = document.getElementById("vizo-data-json").textContent;
  if (rawData) {
    try {
      const repoData = JSON.parse(rawData);
      const blob = new Blob([JSON.stringify(repoData)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);

      const cargador = document.querySelector("#cargador");
      if (cargador) {
        cargador.setAttribute("babia-queryjson", { url: url });
        console.log("ViZo // Data Stream Injected:", url);
        console.log("ViZo // Repo Data:", repoData);
      }
    } catch (e) {
      console.error("ViZo // Error parsing data stream:", e);
    }
  }

  // 2. Aplicar Configuración de la IA
  const rawAIConfig = document.getElementById("vizo-ai-config").textContent;
  if (rawAIConfig && rawAIConfig.trim() !== "") {
    try {
      const aiConfig = JSON.parse(rawAIConfig);
      const city = document.querySelector("#babia-city-container");

      if (city) {
        city.setAttribute("babia-city", {
          fheight: aiConfig.fheight || "nloc",
          fmaxarea: aiConfig.farea || "ccn",
          base_color: aiConfig.base_color || "#1a1a1a",
          extra: aiConfig.extra || 1.5,
          color: aiConfig.building_color || "#00fbff",
        });
        console.log("ViZo // AI Config Applied:", aiConfig);
      }
    } catch (e) {
      console.error("ViZo // Error applying AI config:", e);
    }
  }
})();
