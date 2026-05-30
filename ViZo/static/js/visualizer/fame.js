(function () {
  // =============================================================================
  // ViZo // fame.js  —  Developers Wall of Fame Generator
  //
  // Analiza el historial de commits y crea dinámicamente perfiles
  // holográficos interactivos para los Top 3 desarrolladores del repositorio.
  // =============================================================================

  document.addEventListener("DOMContentLoaded", function () {
    // Esperar a que A-Frame se inicialice completamente
    const scene = document.querySelector("a-scene");
    if (scene) {
      if (scene.hasLoaded) {
        initWallOfFame();
      } else {
        scene.addEventListener("loaded", initWallOfFame);
      }
    }
  });

  function initWallOfFame() {
    console.log("ViZo // Inicializando Muro de la Fama de Desarrolladores...");
    const container = document.getElementById("fame-profiles-container");
    if (!container) {
      console.warn("ViZo // No se encontró el contenedor #fame-profiles-container en la escena.");
      return;
    }

    // Parsear historial de commits desde el HTML
    const evolutionJsonEl = document.getElementById("vizo-evolution-json");
    if (!evolutionJsonEl || !evolutionJsonEl.textContent.trim()) {
      renderFallback(container, "Sin datos de commits.");
      return;
    }

    let commits = [];
    try {
      commits = JSON.parse(evolutionJsonEl.textContent);
    } catch (e) {
      console.error("ViZo // Error parseando historial de commits:", e);
      renderFallback(container, "Error de datos.");
      return;
    }

    if (!Array.isArray(commits) || commits.length === 0) {
      renderFallback(container, "No hay commits registrados.");
      return;
    }

    // 1. Agrupar métricas por desarrollador (autor)
    const authorsMap = {};
    let totalCommitsCount = 0;

    commits.forEach(function (commit) {
      const author = commit.author || "Unknown";
      const added = parseInt(commit.insertions) || 0;
      const deleted = parseInt(commit.deletions) || 0;

      if (!authorsMap[author]) {
        authorsMap[author] = {
          name: author,
          commits: 0,
          added: 0,
          deleted: 0
        };
      }

      authorsMap[author].commits += 1;
      authorsMap[author].added += added;
      authorsMap[author].deleted += deleted;
      totalCommitsCount += 1;
    });

    // 2. Convertir a array y ordenar por volumen de commits (descendente)
    const sortedProfiles = [];
    for (const authorName in authorsMap) {
      sortedProfiles.push(authorsMap[authorName]);
    }
    sortedProfiles.sort((a, b) => b.commits - a.commits);

    console.log("ViZo // Desarrolladores clasificados:", sortedProfiles);

    // 3. Tomar el Top 3 para el podio de honor
    const top3 = sortedProfiles.slice(0, 3);
    const ranks = [
      {
        badge: "ORO #1",
        color: "#ffd700", // Oro
        emissive: "#ffd700",
        posX: 0,
        posY: 0,
        width: 2.7,
        height: 3.7,
        scale: 1
      },
      {
        badge: "PLATA #2",
        color: "#b0c4de", // Plata brillante (azul-acero)
        emissive: "#b0c4de",
        posX: -3.3,
        posY: -0.2,
        width: 2.5,
        height: 3.3,
        scale: 0.9
      },
      {
        badge: "BRONCE #3",
        color: "#cd7f32", // Bronce
        emissive: "#cd7f32",
        posX: 3.3,
        posY: -0.4,
        width: 2.5,
        height: 3.1,
        scale: 0.85
      }
    ];

    // Mapear el orden de visualización en el podio (Plata, Oro, Bronce)
    // Para que quede simétrico en pantalla, el orden de render es:
    // Izquierda (Plata #2), Centro (Oro #1), Derecha (Bronce #3)
    const podioOrder = [];
    if (top3[1]) podioOrder.push({ profile: top3[1], rank: ranks[1] }); // #2 Plata
    if (top3[0]) podioOrder.push({ profile: top3[0], rank: ranks[0] }); // #1 Oro
    if (top3[2]) podioOrder.push({ profile: top3[2], rank: ranks[2] }); // #3 Bronce

    // Renderizar cada perfil
    podioOrder.forEach(function (slot) {
      const p = slot.profile;
      const r = slot.rank;
      const pct = ((p.commits / totalCommitsCount) * 100).toFixed(1);

      // Entidad de la tarjeta flotante
      const cardEl = document.createElement("a-entity");
      cardEl.setAttribute("position", `${r.posX} ${r.posY} 0.02`);
      cardEl.setAttribute("id", `fame-card-${p.name.replace(/\s+/g, "-")}`);

      // Placa base translúcida
      const plate = document.createElement("a-plane");
      plate.setAttribute("width", r.width);
      plate.setAttribute("height", r.height);
      plate.setAttribute("color", "#031737");
      plate.setAttribute("material", "opacity: 0.82; transparent: true; roughness: 0.2; metalness: 0.8");
      plate.setAttribute("class", "clickable");
      cardEl.appendChild(plate);

      // Bordes neón del color del rango (usando a-box para evitar líneas de triangulación)
      const borderTop = document.createElement("a-box");
      borderTop.setAttribute("position", `0 ${r.height / 2} 0.01`);
      borderTop.setAttribute("width", r.width + 0.04);
      borderTop.setAttribute("height", "0.04");
      borderTop.setAttribute("depth", "0.02");
      borderTop.setAttribute("color", r.color);
      borderTop.setAttribute("emissive", r.emissive);
      borderTop.setAttribute("emissive-intensity", "0.8");
      cardEl.appendChild(borderTop);

      const borderBottom = document.createElement("a-box");
      borderBottom.setAttribute("position", `0 ${-r.height / 2} 0.01`);
      borderBottom.setAttribute("width", r.width + 0.04);
      borderBottom.setAttribute("height", "0.04");
      borderBottom.setAttribute("depth", "0.02");
      borderBottom.setAttribute("color", r.color);
      borderBottom.setAttribute("emissive", r.emissive);
      borderBottom.setAttribute("emissive-intensity", "0.8");
      cardEl.appendChild(borderBottom);

      const borderLeft = document.createElement("a-box");
      borderLeft.setAttribute("position", `${-r.width / 2} 0 0.01`);
      borderLeft.setAttribute("width", "0.04");
      borderLeft.setAttribute("height", r.height + 0.04);
      borderLeft.setAttribute("depth", "0.02");
      borderLeft.setAttribute("color", r.color);
      borderLeft.setAttribute("emissive", r.emissive);
      borderLeft.setAttribute("emissive-intensity", "0.8");
      cardEl.appendChild(borderLeft);

      const borderRight = document.createElement("a-box");
      borderRight.setAttribute("position", `${r.width / 2} 0 0.01`);
      borderRight.setAttribute("width", "0.04");
      borderRight.setAttribute("height", r.height + 0.04);
      borderRight.setAttribute("depth", "0.02");
      borderRight.setAttribute("color", r.color);
      borderRight.setAttribute("emissive", r.emissive);
      borderRight.setAttribute("emissive-intensity", "0.8");
      cardEl.appendChild(borderRight);

      // Insignia del rango
      const badgeText = document.createElement("a-text");
      badgeText.setAttribute("value", r.badge);
      badgeText.setAttribute("position", `0 ${r.height / 2 - 0.3} 0.02`);
      badgeText.setAttribute("align", "center");
      badgeText.setAttribute("color", r.color);
      badgeText.setAttribute("emissive", r.color);
      badgeText.setAttribute("emissive-intensity", "1.0");
      badgeText.setAttribute("width", "3.8");
      badgeText.setAttribute("font", "https://cdn.aframe.io/fonts/Exo2Bold.fnt");
      cardEl.appendChild(badgeText);

      // Nombre del desarrollador (ajustado al ancho real de la tarjeta para evitar desbordamientos)
      const nameText = document.createElement("a-text");
      nameText.setAttribute("value", p.name.toUpperCase());
      nameText.setAttribute("position", `0 ${r.height / 2 - 0.75} 0.02`);
      nameText.setAttribute("align", "center");
      nameText.setAttribute("color", "#ffffff");
      nameText.setAttribute("width", (r.width - 0.3).toString());
      nameText.setAttribute("wrap-count", "24");
      nameText.setAttribute("font", "https://cdn.aframe.io/fonts/Exo2Bold.fnt");
      cardEl.appendChild(nameText);

      // Línea divisoria decorativa
      const line = document.createElement("a-box");
      line.setAttribute("position", `0 ${r.height / 2 - 1.1} 0.02`);
      line.setAttribute("width", r.width - 0.4);
      line.setAttribute("height", "0.015");
      line.setAttribute("depth", "0.01");
      line.setAttribute("color", "#00a8cc");
      line.setAttribute("emissive", "#00a8cc");
      line.setAttribute("emissive-intensity", "0.5");
      cardEl.appendChild(line);

      // Bloque de Estadísticas
      const statsYStart = r.height / 2 - 1.5;

      // 1. Commits
      const commitsLabel = document.createElement("a-text");
      commitsLabel.setAttribute("value", "COMMITS");
      commitsLabel.setAttribute("position", `${-r.width / 2 + 0.35} ${statsYStart} 0.02`);
      commitsLabel.setAttribute("color", "#a0aec0");
      commitsLabel.setAttribute("width", "3.0");
      commitsLabel.setAttribute("font", "https://cdn.aframe.io/fonts/Exo2Bold.fnt");
      cardEl.appendChild(commitsLabel);

      const commitsVal = document.createElement("a-text");
      commitsVal.setAttribute("value", `${p.commits} (${pct}%)`);
      commitsVal.setAttribute("position", `${r.width / 2 - 0.35} ${statsYStart} 0.02`);
      commitsVal.setAttribute("align", "right");
      commitsVal.setAttribute("color", "#4af7a0");
      commitsVal.setAttribute("width", "3.0");
      commitsVal.setAttribute("font", "https://cdn.aframe.io/fonts/Exo2Bold.fnt");
      cardEl.appendChild(commitsVal);

      // 2. Líneas Añadidas
      const addedLabel = document.createElement("a-text");
      addedLabel.setAttribute("value", "LINEAS +");
      addedLabel.setAttribute("position", `${-r.width / 2 + 0.35} ${statsYStart - 0.45} 0.02`);
      addedLabel.setAttribute("color", "#a0aec0");
      addedLabel.setAttribute("width", "3.0");
      addedLabel.setAttribute("font", "https://cdn.aframe.io/fonts/Exo2Bold.fnt");
      cardEl.appendChild(addedLabel);

      const addedVal = document.createElement("a-text");
      addedVal.setAttribute("value", `+${p.added.toLocaleString()}`);
      addedVal.setAttribute("position", `${r.width / 2 - 0.35} ${statsYStart - 0.45} 0.02`);
      addedVal.setAttribute("align", "right");
      addedVal.setAttribute("color", "#ffd700");
      addedVal.setAttribute("width", "3.0");
      addedVal.setAttribute("font", "https://cdn.aframe.io/fonts/Exo2Bold.fnt");
      cardEl.appendChild(addedVal);

      // 3. Líneas Borradas
      const deletedLabel = document.createElement("a-text");
      deletedLabel.setAttribute("value", "LINEAS -");
      deletedLabel.setAttribute("position", `${-r.width / 2 + 0.35} ${statsYStart - 0.9} 0.02`);
      deletedLabel.setAttribute("color", "#a0aec0");
      deletedLabel.setAttribute("width", "3.0");
      deletedLabel.setAttribute("font", "https://cdn.aframe.io/fonts/Exo2Bold.fnt");
      cardEl.appendChild(deletedLabel);

      const deletedVal = document.createElement("a-text");
      deletedVal.setAttribute("value", `-${p.deleted.toLocaleString()}`);
      deletedVal.setAttribute("position", `${r.width / 2 - 0.35} ${statsYStart - 0.9} 0.02`);
      deletedVal.setAttribute("align", "right");
      deletedVal.setAttribute("color", "#ff6b6b");
      deletedVal.setAttribute("width", "3.0");
      deletedVal.setAttribute("font", "https://cdn.aframe.io/fonts/Exo2Bold.fnt");
      cardEl.appendChild(deletedVal);

      // Interactividad (Hover + Click)
      plate.addEventListener("mouseenter", function () {
        cardEl.setAttribute("scale", "1.06 1.06 1.06");
        badgeText.setAttribute("emissive-intensity", "1.8");
        [borderTop, borderBottom, borderLeft, borderRight].forEach(function (b) {
          b.setAttribute("emissive-intensity", "1.6");
        });
      });

      plate.addEventListener("mouseleave", function () {
        cardEl.setAttribute("scale", "1 1 1");
        badgeText.setAttribute("emissive-intensity", "1.0");
        [borderTop, borderBottom, borderLeft, borderRight].forEach(function (b) {
          b.setAttribute("emissive-intensity", "0.8");
        });
      });

      plate.addEventListener("click", function () {
        // Feedback de click
        const originalColor = plate.getAttribute("color");
        plate.setAttribute("color", "#001025");
        setTimeout(function () {
          plate.setAttribute("color", originalColor);
        }, 120);

        console.log(`ViZo // Desarrollador seleccionado: ${p.name}`);
      });

      container.appendChild(cardEl);
    });
  }

  function renderFallback(container, message) {
    const textEl = document.createElement("a-text");
    textEl.setAttribute("value", message);
    textEl.setAttribute("align", "center");
    textEl.setAttribute("position", "0 0 0.05");
    textEl.setAttribute("color", "#ff6b6b");
    textEl.setAttribute("width", "6.0");
    textEl.setAttribute("font", "https://cdn.aframe.io/fonts/Exo2Bold.fnt");
    container.appendChild(textEl);
  }
})();
