(function () {
  // =============================================================================
  // ViZo // helpers.js  —  Utility Functions & Asset Loaders
  // =============================================================================

  // Inicializar estado global compartido si no existe
  window.ViZoState = window.ViZoState || {
    loaders: {},
    dataMap: {},
    blobUrls: {}
  };

  /**
   * Helper para dividir fileNetwork plano en nodos y enlaces para babia-network
   */
  function generateNetworkNodesAndLinks(fileNetworkData) {
    const nodesMap = {};
    const linksMap = {};
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
          const key = first + "||" + second;
          if (!linksMap[key]) {
            linksMap[key] = [];
          }
          linksMap[key].push(file);
        }
      }
    });

    const nodes = Object.values(nodesMap);
    const links = Object.keys(linksMap).map((key) => {
      const parts = key.split("||");
      const files = linksMap[key];
      let fileLabel = "";
      if (files.length <= 3) {
        fileLabel = files.join(", ");
      } else {
        fileLabel =
          files.slice(0, 3).join(", ") + " y " + (files.length - 3) + " más";
      }
      return { source: parts[0], target: parts[1], fileLabel: fileLabel };
    });

    // Filtrar nodos huérfanos (sin conexiones) para mantener el grafo compacto
    const connectedNodeIds = new Set();
    links.forEach((link) => {
      connectedNodeIds.add(link.source);
      connectedNodeIds.add(link.target);
    });

    const filteredNodes = nodes.filter((node) => connectedNodeIds.has(node.id));
    const finalNodes = filteredNodes.length > 0 ? filteredNodes : nodes;

    // Normalizar val (radio de las esferas) en un rango de 0.5 a 2.0
    if (finalNodes.length > 0) {
      const commitCounts = finalNodes.map((n) => n.commits);
      const maxCommits = Math.max(...commitCounts);
      const minCommits = Math.min(...commitCounts);

      const minSize = 0.0;
      const maxSize = 100.0;

      finalNodes.forEach((node) => {
        if (maxCommits === minCommits) {
          node.val = 1.0;
        } else {
          node.val =
            minSize +
            ((node.commits - minCommits) / (maxCommits - minCommits)) *
              (maxSize - minSize);
        }
      });
    }

    return { nodes: finalNodes, links: links };
  }

  /**
   * Garantiza la existencia de cargadores para grafos de red (babia-network)
   */
  function ensureNetworkLoaders(scene, fileNetworkData) {
    const state = window.ViZoState;
    if (state.loaders["network-nodes"] && state.loaders["network-links"]) {
      return {
        nodesLoaderId: state.loaders["network-nodes"],
        linksLoaderId: state.loaders["network-links"],
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
    state.loaders["network-nodes"] = nodesLoaderId;

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
    state.loaders["network-links"] = linksLoaderId;

    console.log(
      "ViZo // Cargadores de red creados:",
      nodesLoaderId,
      linksLoaderId,
    );
    return { nodesLoaderId, linksLoaderId };
  }

  /**
   * Garantiza cargadores genéricos de datos basados en Blob URLs
   */
  function ensureLoader(scene, datasetKey) {
    const state = window.ViZoState;
    if (state.loaders[datasetKey]) return state.loaders[datasetKey];

    const blobUrl = state.blobUrls[datasetKey];
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
    state.loaders[datasetKey] = loaderId;
    console.log("ViZo // Cargador creado:", loaderId);
    return loaderId;
  }

  /**
   * Creador de cargadores limitados a 15 elementos para optimizar gráficos bars/barsmap
   */
  function ensureLimitedLoader(scene, dash) {
    const state = window.ViZoState;
    const datasetKey = dash.dataset;
    const originalData = state.dataMap[datasetKey];
    if (!originalData) {
      console.warn(
        "ViZo // Dataset '" + datasetKey + "' no disponible para barsmap.",
      );
      return null;
    }

    const loaderId = "vizo-loader-limited-" + dash.id;
    if (state.loaders[loaderId]) return state.loaders[loaderId];

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

    state.loaders[loaderId] = loaderId;
    console.log(
      "ViZo // Cargador limitado creado:",
      loaderId,
      "con",
      limitedData.length,
      "elementos",
    );
    return loaderId;
  }

  /**
   * Renderizado typewriter instantáneo con autoscroll
   */
  function typewriterEffect(element, text) {
    element.innerHTML = text.replace(/\n/g, "<br>");
    const body = document.querySelector(".terminal-body");
    if (body) {
      body.scrollTop = body.scrollHeight;
    }
  }

  /* ───────────────────────────────────────────────────────────────────────────
     MÉTODOS DE MANIPULACIÓN A-FRAME Y COMPONENTES
     ─────────────────────────────────────────────────────────────────────────── */

  /**
   * Alternar modo wireframe en la ciudad (boats)
   */
  function toggleWireframe(targetEl, type) {
    if (type === "boats") {
      var config = targetEl.getAttribute("babia-boats") || {};
      var currentVal = config.wireframeByRepeatedField || "";

      var newVal = "";
      if (currentVal === "") {
        newVal = "nloc";
      } else if (currentVal === "nloc") {
        newVal = "ccn";
      } else {
        newVal = "";
      }

      targetEl.setAttribute("babia-boats", "wireframeByRepeatedField", newVal);
      console.log("ViZo // Toggled wireframeByRepeatedField to: " + newVal);

      var obj3D = targetEl.object3D;
      obj3D.traverse(function (node) {
        if (node.isMesh && node.name !== "street" && node.name !== "ground") {
          if (newVal === "nloc") {
            var isTall = node.scale.y > 1.8;
            node.material.wireframe = isTall;
            node.material.emissive = isTall
              ? new THREE.Color("#00d4ff")
              : new THREE.Color("#000000");
            node.material.emissiveIntensity = isTall ? 0.6 : 0;
          } else if (newVal === "ccn") {
            var isWide = node.scale.x * node.scale.z > 1.4;
            node.material.wireframe = isWide;
            node.material.emissive = isWide
              ? new THREE.Color("#00ff88")
              : new THREE.Color("#000000");
            node.material.emissiveIntensity = isWide ? 0.6 : 0;
          } else {
            node.material.wireframe = false;
            node.material.emissive = new THREE.Color("#000000");
            node.material.emissiveIntensity = 0;
          }
        }
      });
    }
  }

  /**
   * Alternar mappings del eje Y y área en la ciudad (boats)
   */
  function swapMappings(targetEl, type) {
    if (type === "boats") {
      var config = targetEl.getAttribute("babia-boats") || {};
      var currentHeight = config.height || "nloc";
      var currentArea = config.area || "ccn";

      var nextHeight = currentArea;
      var nextArea = currentHeight;

      if (nextHeight === nextArea) {
        nextHeight = "ccn";
        nextArea = "nloc";
      }

      targetEl.setAttribute("babia-boats", {
        height: nextHeight,
        area: nextArea,
        color: nextHeight,
      });

      targetEl.setAttribute(
        "babia-boats",
        "legend_text",
        "{name}\\nNLOC: {nloc} | CCN: {ccn}\\nCommits: {commits} | Funcs: {num_functions}\\nEdad: {age_days}d | Owner: {owner_name} ({ownership}%)",
      );
      console.log(
        "ViZo // Swapped boats mappings: Height=" +
          nextHeight +
          ", Area=" +
          nextArea,
      );
    }
  }

  /**
   * Rotar métrica del eje Y (altura)
   */
  function cycleHeight(targetEl, type) {
    if (type === "boats") {
      var config = targetEl.getAttribute("babia-boats") || {};
      var current = config.height || "nloc";
      var fields = ["nloc", "ccn"];
      var nextIdx = (fields.indexOf(current) + 1) % fields.length;
      var nextField = fields[nextIdx];

      targetEl.setAttribute("babia-boats", "height", nextField);
      targetEl.setAttribute("babia-boats", "color", nextField);
      targetEl.setAttribute(
        "babia-boats",
        "legend_text",
        "{name}\\nNLOC: {nloc} | CCN: {ccn}\\nCommits: {commits} | Funcs: {num_functions}\\nEdad: {age_days}d | Owner: {owner_name} ({ownership}%)",
      );
      console.log("ViZo // Cycled boats height to: " + nextField);
    } else if (type === "cyls") {
      var config = targetEl.getAttribute("babia-cyls") || {};
      var current = config.height || "nloc";
      var fields = ["nloc", "count", "commits"];
      var nextIdx = (fields.indexOf(current) + 1) % fields.length;
      var nextField = fields[nextIdx];

      targetEl.setAttribute("babia-cyls", "height", nextField);
      console.log("ViZo // Cycled cyls height to: " + nextField);
    } else if (type === "barsmap") {
      var config = targetEl.getAttribute("babia-barsmap") || {};
      var current = config.height || "commits";
      var fields = ["commits", "insertions"];
      var nextIdx = (fields.indexOf(current) + 1) % fields.length;
      var nextField = fields[nextIdx];

      targetEl.setAttribute("babia-barsmap", "height", nextField);
      console.log("ViZo // Cycled barsmap height to: " + nextField);
    }
  }

  /**
   * Asignar altura de edificios manualmente
   */
  function setHeight(targetEl, type, field) {
    if (type === "boats") {
      targetEl.setAttribute("babia-boats", "height", field);
      console.log("ViZo // Set boats height to: " + field);
    }
  }

  /**
   * Asignar color de edificios manualmente
   */
  function setColor(targetEl, type, field) {
    if (type === "boats") {
      targetEl.setAttribute("babia-boats", "color", field);
      console.log("ViZo // Set boats color to: " + field);
    }
  }

  /**
   * Actualizar estados y colores activos de los botones 3D
   */
  function updateButtonStates(panelEl, targetEl, type) {
    if (!panelEl || !targetEl) return;

    var currentHeight = "";
    var currentColor = "";

    if (type === "boats") {
      var config = targetEl.getAttribute("babia-boats") || {};
      currentHeight = config.height || "nloc";
      currentColor = config.color || "nloc";
    }

    var buttons = panelEl.querySelectorAll("[vizo-control-btn]");
    buttons.forEach(function (btnEl) {
      var component = btnEl.components
        ? btnEl.components["vizo-control-btn"]
        : null;
      if (!component) return;

      var action = component.data.action;
      var value = component.data.value;

      var base = btnEl.querySelector(".vizo-btn-base");
      var border = btnEl.querySelector(".vizo-btn-border");
      var text = btnEl.querySelector("a-text");
      if (!base) return;

      var isActive = false;
      if (action === "set-height" && value === currentHeight) {
        isActive = true;
      } else if (action === "set-color" && value === currentColor) {
        isActive = true;
      }

      if (isActive) {
        // Emerald Green Active State
        base.setAttribute("color", "#00aa5d");
        base.setAttribute("emissive", "#00aa5d");
        base.setAttribute("emissive-intensity", "0.8");
        if (border) {
          border.setAttribute("color", "#00ff66");
          border.setAttribute("emissive", "#00ff66");
          border.setAttribute("emissive-intensity", "1.5");
        }
        if (text) {
          text.setAttribute("color", "#ffffff");
          text.setAttribute("emissive", "#ffffff");
          text.setAttribute("emissive-intensity", "1.5");
        }
      } else {
        // Sleek Inactive Cyber Blue State
        if (action === "set-height" || action === "set-color") {
          base.setAttribute("color", "#002a5a");
          base.setAttribute("emissive", "#002a5a");
          base.setAttribute("emissive-intensity", "0.5");
          if (border) {
            border.setAttribute("color", "#00d4ff");
            border.setAttribute("emissive", "#00d4ff");
            border.setAttribute("emissive-intensity", "1.2");
          }
          if (text) {
            text.setAttribute("color", "#00d4ff");
            text.setAttribute("emissive", "#00d4ff");
            text.setAttribute("emissive-intensity", "1.5");
          }
        }
      }
    });
  }

  // Exportar al namespace global
  window.ViZoHelpers = {
    generateNetworkNodesAndLinks: generateNetworkNodesAndLinks,
    ensureNetworkLoaders: ensureNetworkLoaders,
    ensureLoader: ensureLoader,
    ensureLimitedLoader: ensureLimitedLoader,
    typewriterEffect: typewriterEffect,
    toggleWireframe: toggleWireframe,
    swapMappings: swapMappings,
    cycleHeight: cycleHeight,
    setHeight: setHeight,
    setColor: setColor,
    updateButtonStates: updateButtonStates
  };
})();
