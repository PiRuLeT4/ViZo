import { csrfHeaders } from '../csrf.js';
import {
  toggleWireframe,
  swapMappings,
  cycleHeight,
} from './modules/helpers.js';

// Caché de explicaciones ya obtenidas para evitar peticiones repetidas
const explanationCache = {
  boats: null,
  cyls: null,
  doughnut: null,
  barsmap: null,
  network: null,
  bars: null,
};

// Caché de objetos de Audio precargados desde la API de Grok TTS
const audioCache = {
  boats: null,
  cyls: null,
  doughnut: null,
  barsmap: null,
  network: null,
  bars: null,
};

// Puntero para cancelar el timeout o efecto de máquina de escribir anterior
let typewriterInterval = null;

// Estado de scroll para el panel VR
const VR_LINES_PER_PAGE = 14;
const VR_MAX_CHARS_PER_LINE = 58;
let vrFullText = '';
let vrScrollOffset = 0;
let vrTotalLines = 0;

/**
 * Pre-procesa el texto para que cada línea lógica encaje en una línea visual
 * de A-Frame (wrap-count: 60). Divide líneas largas respetando los saltos existentes.
 */
function wrapTextForVR(text, maxChars) {
  const raw = text.split('\n');
  const wrapped = [];
  for (const line of raw) {
    if (line.length <= maxChars) {
      wrapped.push(line);
    } else {
      // Partir por palabras para no cortar a mitad de palabra
      const words = line.split(' ');
      let current = '';
      for (const word of words) {
        if ((current + ' ' + word).trim().length > maxChars) {
          if (current) wrapped.push(current);
          current = word;
        } else {
          current = current ? current + ' ' + word : word;
        }
      }
      if (current) wrapped.push(current);
    }
  }
  return wrapped.join('\n');
}

function getVisibleVRText() {
  const lines = vrFullText.split('\n');
  vrTotalLines = lines.length;
  const visible = lines.slice(vrScrollOffset, vrScrollOffset + VR_LINES_PER_PAGE);
  return visible.join('\n');
}

function updateVRScroll() {
  const vrTextEl = document.getElementById('vr-terminal-text');
  if (vrTextEl) {
    vrTextEl.setAttribute('value', getVisibleVRText());
  }
}

/**
 * Parsea el atributo vizzo-control-btn (sea string, objeto o componente A-Frame) para extraer action, targetId, vizType y value.
 */
function parseControlBtnComp(btnEl) {
  if (!btnEl) return null;

  // 1. Intentar desde A-Frame components data
  if (
    btnEl.components &&
    btnEl.components["vizzo-control-btn"] &&
    btnEl.components["vizzo-control-btn"].data
  ) {
    const d = btnEl.components["vizzo-control-btn"].data;
    if (typeof d === "object" && d !== null) {
      return {
        action: d.action || "",
        targetId: d.targetId || "",
        vizType: d.vizType || "",
        value: d.value || "",
      };
    }
  }

  // 2. Intentar getAttribute
  const comp = btnEl.getAttribute("vizzo-control-btn");
  if (!comp) return null;

  if (typeof comp === "object") {
    return {
      action: comp.action || "",
      targetId: comp.targetId || "",
      vizType: comp.vizType || "",
      value: comp.value || "",
    };
  }

  if (typeof comp === "string") {
    const actionMatch = comp.match(/action:\s*([^;]+)/);
    const targetIdMatch = comp.match(/targetId:\s*([^;]+)/);
    const vizTypeMatch = comp.match(/vizType:\s*([^;]+)/);
    const valueMatch = comp.match(/value:\s*([^;]+)/);
    return {
      action: actionMatch ? actionMatch[1].trim() : "",
      targetId: targetIdMatch ? targetIdMatch[1].trim() : "",
      vizType: vizTypeMatch ? vizTypeMatch[1].trim() : "",
      value: valueMatch ? valueMatch[1].trim() : "",
    };
  }

  return null;
}

/**
 * Actualiza las etiquetas de los botones HUD 2D y 3D una vez que hay explicación disponible
 */
function updateButtonLabels(dashboardType, targetEl, sectionKey = "summary") {
  const targetKey = targetEl ? targetEl.id : null;

  // 1. Actualizar botón del HUD 2D
  const hudBtn = document.querySelector(`[data-hud-btn="${dashboardType}"]`);
  if (hudBtn) {
    const cleanType = dashboardType.toUpperCase();
    const shortType =
      cleanType === "BARSMAP"
        ? "BARS"
        : cleanType === "DOUGHNUT"
          ? "DONUT"
          : cleanType === "BARS"
            ? "PR"
            : cleanType;
    hudBtn.textContent = `VER EXP. ${shortType}`;
    hudBtn.style.borderColor = "#4af7a0"; // Borde verde neón
    hudBtn.style.color = "#4af7a0";
    hudBtn.style.textShadow = "0 0 8px rgba(74, 247, 160, 0.4)";
  }

  // 2. Actualizar botones 3D de A-Frame (Pedestales y Menú de Muñeca)
  const scene3dBtns = document.querySelectorAll("[vizzo-control-btn]");
  scene3dBtns.forEach((btnEl) => {
    const compData = parseControlBtnComp(btnEl);
    if (compData && compData.action === "explain-ai") {
      const isTargetMatch = targetKey
        ? compData.targetId === targetKey
        : compData.vizType === dashboardType;
      const isSecMatch = !sectionKey || compData.value === sectionKey;

      if (isTargetMatch && isSecMatch) {
        const textEl = btnEl.querySelector("a-text");
        if (textEl) {
          textEl.setAttribute("color", "#4af7a0");
          textEl.setAttribute("emissive", "#4af7a0");
        }

        const baseEl = btnEl.querySelector(".vizzo-btn-base");
        if (baseEl) {
          baseEl.setAttribute("color", "#003b21");
          baseEl.setAttribute("emissive", "#4af7a0");
          baseEl.setAttribute("emissive-intensity", "0.8");
        }
        const borderEl = btnEl.querySelector(".vizzo-btn-border");
        if (borderEl) {
          borderEl.setAttribute("color", "#4af7a0");
          borderEl.setAttribute("emissive", "#4af7a0");
          borderEl.setAttribute("emissive-intensity", "2.0");
        }
      }
    }
  });
}

/**
 * Cambia el estado del botón a CARGANDO...
 */
function setButtonLoading(dashboardType, targetEl, sectionKey = "summary") {
  const targetKey = targetEl ? targetEl.id : null;
  const scene3dBtns = document.querySelectorAll("[vizzo-control-btn]");
  scene3dBtns.forEach((btnEl) => {
    const compData = parseControlBtnComp(btnEl);
    if (compData && compData.action === "explain-ai") {
      const isTargetMatch = targetKey
        ? compData.targetId === targetKey
        : compData.vizType === dashboardType;
      const isSecMatch = !sectionKey || compData.value === sectionKey;

      if (isTargetMatch && isSecMatch) {
        const textEl = btnEl.querySelector("a-text");
        if (textEl) {
          textEl.setAttribute("value", "CARGANDO...");
          textEl.setAttribute("color", "#ffaa00");
          textEl.setAttribute("emissive", "#ffaa00");
        }

        const baseEl = btnEl.querySelector(".vizzo-btn-base");
        if (baseEl) {
          baseEl.setAttribute("color", "#4a2a00");
          baseEl.setAttribute("emissive", "#ffaa00");
          baseEl.setAttribute("emissive-intensity", "0.8");
        }
        const borderEl = btnEl.querySelector(".vizzo-btn-border");
        if (borderEl) {
          borderEl.setAttribute("color", "#ffaa00");
          borderEl.setAttribute("emissive", "#ffaa00");
          borderEl.setAttribute("emissive-intensity", "2.0");
        }
      }
    }
  });
}

/**
 * Resetea el botón de la IA a su estado original
 */
function resetButtonToExplain(dashboardType, targetEl, sectionKey = "summary") {
  const targetKey = targetEl ? targetEl.id : null;
  const scene3dBtns = document.querySelectorAll("[vizzo-control-btn]");
  scene3dBtns.forEach((btnEl) => {
    const compData = parseControlBtnComp(btnEl);
    if (compData && compData.action === "explain-ai") {
      const isTargetMatch = targetKey
        ? compData.targetId === targetKey
        : compData.vizType === dashboardType;
      const isSecMatch = !sectionKey || compData.value === sectionKey;

      if (isTargetMatch && isSecMatch) {
        const textEl = btnEl.querySelector("a-text");
        if (textEl) {
          const defaultLabel = compData.value ? compData.value.toUpperCase() : "EXPLICAR";
          textEl.setAttribute("value", defaultLabel);
          textEl.setAttribute("color", "#00d4ff");
          textEl.setAttribute("emissive", "#00d4ff");
        }

        const baseEl = btnEl.querySelector(".vizzo-btn-base");
        if (baseEl) {
          baseEl.setAttribute("color", "#002a5a");
          baseEl.setAttribute("emissive", "#002a5a");
          baseEl.setAttribute("emissive-intensity", "0.5");
        }
        const borderEl = btnEl.querySelector(".vizzo-btn-border");
        if (borderEl) {
          borderEl.setAttribute("color", "#00d4ff");
          borderEl.setAttribute("emissive", "#00d4ff");
          borderEl.setAttribute("emissive-intensity", "1.2");
        }
      }
    }
  });
}

/**
 * Helper para extraer el texto de la sección requerida desde el objeto de explicación
 */
function getSectionText(dataObj, sectionKey = "summary") {
  if (!dataObj) return "Sin información disponible.";
  if (typeof dataObj === "object") {
    if (dataObj[sectionKey]) return dataObj[sectionKey];
    if (dataObj.summary) return dataObj.summary;
    if (dataObj.explanation) return dataObj.explanation;
  }
  if (typeof dataObj === "string") return dataObj;
  return "Sin información disponible para esta sección.";
}

/**
 * Helper para actualizar la apariencia del botón OBTENER INFO
 */
function setFetchBtnState(dashboardType, targetEl, state) {
  const targetKey = targetEl ? targetEl.id : null;
  const scene3dBtns = document.querySelectorAll("[vizzo-control-btn]");
  scene3dBtns.forEach((btnEl) => {
    const compData = parseControlBtnComp(btnEl);
    if (compData && compData.action === "fetch-ai-info") {
      const isMatch = targetKey
        ? compData.targetId === targetKey
        : compData.vizType === dashboardType;

      if (isMatch) {
        const textEl = btnEl.querySelector("a-text");
        const baseEl = btnEl.querySelector(".vizzo-btn-base");
        const borderEl = btnEl.querySelector(".vizzo-btn-border");

        if (state === "loading") {
          if (textEl) {
            const isEn = localStorage.getItem("vizzo_lang") === "en";
            textEl.setAttribute("value", isEn ? "LOADING..." : "CARGANDO...");
            textEl.setAttribute("color", "#ffaa00");
            textEl.setAttribute("emissive", "#ffaa00");
          }
          if (baseEl) {
            baseEl.setAttribute("color", "#4a2a00");
            baseEl.setAttribute("emissive", "#ffaa00");
            baseEl.setAttribute("emissive-intensity", "0.8");
          }
          if (borderEl) {
            borderEl.setAttribute("color", "#ffaa00");
            borderEl.setAttribute("emissive", "#ffaa00");
            borderEl.setAttribute("emissive-intensity", "2.0");
          }
        } else if (state === "ready") {
          if (textEl) {
            const isEn = localStorage.getItem("vizzo_lang") === "en";
            textEl.setAttribute("value", isEn ? "INFO READY" : "INFO LISTA");
            textEl.setAttribute("color", "#4af7a0");
            textEl.setAttribute("emissive", "#4af7a0");
          }
          if (baseEl) {
            baseEl.setAttribute("color", "#003b21");
            baseEl.setAttribute("emissive", "#4af7a0");
            baseEl.setAttribute("emissive-intensity", "0.8");
          }
          if (borderEl) {
            borderEl.setAttribute("color", "#4af7a0");
            borderEl.setAttribute("emissive", "#4af7a0");
            borderEl.setAttribute("emissive-intensity", "2.0");
          }
        } else {
          // default / idle
          if (textEl) {
            const isEn = localStorage.getItem("vizzo_lang") === "en";
            textEl.setAttribute("value", isEn ? "EXPLAIN" : "EXPLICAR");
            textEl.setAttribute("color", "#00d4ff");
            textEl.setAttribute("emissive", "#00d4ff");
          }
          if (baseEl) {
            baseEl.setAttribute("color", "#002a5a");
            baseEl.setAttribute("emissive", "#002a5a");
            baseEl.setAttribute("emissive-intensity", "0.5");
          }
          if (borderEl) {
            borderEl.setAttribute("color", "#00d4ff");
            borderEl.setAttribute("emissive", "#00d4ff");
            borderEl.setAttribute("emissive-intensity", "1.2");
          }
        }
      }
    }
  });
}

/**
 * Función principal desencadenada al pulsar el botón 'OBTENER INFO'
 */
export function fetchAiInfo(dashboardType, targetEl) {
  const targetKey = (targetEl && targetEl.id) ? targetEl.id : dashboardType;
  console.log("ViZzo // Petición de obtención de info IA para:", targetKey);

  const vrPanelEl = document.getElementById("vr-explanation-panel");
  const vrTextEl = document.getElementById("vr-terminal-text");

  const positionVRPanel = () => {
    const cameraEl = document.querySelector("[camera]");
    if (cameraEl && vrPanelEl) {
      const camRot = cameraEl.getAttribute("rotation") || { y: 0 };
      vrPanelEl.setAttribute("rotation", `0 ${camRot.y} 0`);
      const angleRad = (camRot.y * Math.PI) / 180;
      const posX = -3.0 * Math.sin(angleRad);
      const posZ = -3.0 * Math.cos(angleRad);
      vrPanelEl.setAttribute("position", `${posX} 1.5 ${posZ}`);
    }
  };

  const showInVR = (text) => {
    if (vrPanelEl && vrTextEl) {
      vrFullText = wrapTextForVR(text, VR_MAX_CHARS_PER_LINE);
      vrScrollOffset = 0;
      vrTextEl.setAttribute("value", getVisibleVRText());
      vrPanelEl.setAttribute("visible", "true");
      positionVRPanel();
    }
  };

  const showLoadingInVR = () => {
    if (vrPanelEl && vrTextEl) {
      vrFullText = "Conectando con el asistente IA...";
      vrScrollOffset = 0;
      vrTextEl.setAttribute("value", vrFullText);
      vrPanelEl.setAttribute("visible", "true");
      positionVRPanel();
    }
  };

  const showErrorInVR = (errMessage) => {
    if (vrPanelEl && vrTextEl) {
      vrFullText = wrapTextForVR("Error: No se pudo conectar con el servidor de IA.\n" + errMessage, VR_MAX_CHARS_PER_LINE);
      vrScrollOffset = 0;
      vrTextEl.setAttribute("value", getVisibleVRText());
      vrPanelEl.setAttribute("visible", "true");
      positionVRPanel();
    }
  };

  // Si ya existe en caché, volver a mostrar el resumen
  if (explanationCache[targetKey]) {
    setFetchBtnState(dashboardType, targetEl, "ready");
    updateButtonLabels(dashboardType, targetEl, "summary");
    showInVR(getSectionText(explanationCache[targetKey], "summary"));
    return;
  }

  setFetchBtnState(dashboardType, targetEl, "loading");
  showLoadingInVR();

  // Obtener los datos correctos dinámicamente según el cargador asociado
  let dashboardData = null;
  let datasetKey = null;

  if (targetEl) {
    if (targetEl.hasAttribute("data-dataset")) {
      datasetKey = targetEl.getAttribute("data-dataset");
    } else {
      let fromStr = "";
      if (targetEl.hasAttribute("babia-boats")) {
        const boatsAttr = targetEl.getAttribute("babia-boats");
        let boatsFrom = "";
        if (typeof boatsAttr === "string") {
          const treeMatch = boatsAttr.match(/from:\s*([^;]+)/);
          if (treeMatch) boatsFrom = treeMatch[1].trim();
        } else if (
          boatsAttr &&
          typeof boatsAttr === "object" &&
          boatsAttr.from
        ) {
          boatsFrom = boatsAttr.from;
        }

        if (boatsFrom) {
          const treeEl = document.getElementById(boatsFrom);
          if (treeEl && treeEl.hasAttribute("babia-treebuilder")) {
            const treeAttr = treeEl.getAttribute("babia-treebuilder");
            let treeFrom = "";
            if (typeof treeAttr === "string") {
              const loaderMatch = treeAttr.match(/from:\s*([^;]+)/);
              if (loaderMatch) treeFrom = loaderMatch[1].trim();
            } else if (
              treeAttr &&
              typeof treeAttr === "object" &&
              treeAttr.from
            ) {
              treeFrom = treeAttr.from;
            }
            if (treeFrom) {
              fromStr = treeFrom;
            }
          }
        }
      } else {
        const componentAttrs = [
          "babia-cyls",
          "babia-doughnut",
          "babia-pie",
          "babia-barsmap",
          "babia-network",
          "babia-bars",
        ];
        for (let i = 0; i < componentAttrs.length; i++) {
          const attrName = componentAttrs[i];
          if (targetEl.hasAttribute(attrName)) {
            const attrVal = targetEl.getAttribute(attrName);
            let valFrom = "";
            if (typeof attrVal === "string") {
              const loaderMatch = attrVal.match(/from:\s*([^;]+)/);
              if (loaderMatch) valFrom = loaderMatch[1].trim();
            } else if (attrVal && typeof attrVal === "object" && attrVal.from) {
              valFrom = attrVal.from;
            }
            if (valFrom) {
              fromStr = valFrom;
              break;
            }
          }
        }
      }

      if (fromStr && fromStr.startsWith("vizzo-loader-")) {
        datasetKey = fromStr.replace("vizzo-loader-", "");
      }
    }
  }

  if (!datasetKey) {
    if (dashboardType === "boats") datasetKey = "file_metrics";
    else if (dashboardType === "cyls" || dashboardType === "doughnut" || dashboardType === "pie")
      datasetKey = "data_by_language";
    else if (dashboardType === "barsmap") datasetKey = "author_activity";
    else if (dashboardType === "network") datasetKey = "file_network";
    else if (dashboardType === "bars") datasetKey = "pull_requests";
  }

  const state = window.ViZzoState;
  dashboardData = state.dataMap[datasetKey] || {};

  // Obtener el nombre del repositorio
  const statusEl = document.querySelector(".vizzo-status");
  const repoName = statusEl
    ? statusEl.getAttribute("data-repo")
    : "LIVE_DATA";

  const lang = window.getLang ? window.getLang() : (localStorage.getItem("vizzo_lang") || "es");
  const payload = {
    dashboard_type: datasetKey || dashboardType,
    dashboard_data: dashboardData || {},
    repo_name: repoName,
    language: lang,
  };

  fetch("/api/explain/", {
    method: "POST",
    headers: csrfHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  })
    .then((res) => {
      if (!res.ok) throw new Error("Server returned status " + res.status);
      return res.json();
    })
    .then((data) => {
      const sections = data.sections || {
        summary: data.explanation || "No se pudo obtener explicación de la IA.",
        problems: "No se detectaron problemas críticos adicionales.",
        recommendations: "No se generaron recomendaciones específicas adicionales.",
      };
      explanationCache[targetKey] = sections;

      setFetchBtnState(dashboardType, targetEl, "ready");
      updateButtonLabels(dashboardType, targetEl, "summary");
      showInVR(getSectionText(sections, "summary"));

      // Precargar audios de voz en segundo plano para las 3 secciones
      preloadAllSectionsTts(dashboardType, sections, targetEl);
    })
    .catch((err) => {
      console.error("ViZzo // Error al obtener la explicación de la IA:", err);
      setFetchBtnState(dashboardType, targetEl, "idle");
      showErrorInVR(err.message);
    });
}

/**
 * Muestra el texto determinado de la sección seleccionada (RESUMEN, PROBLEMAS, MEJORAS)
 */
export function showExplanation(dashboardType, targetEl, sectionKey = "summary") {
  const targetKey = (targetEl && targetEl.id) ? targetEl.id : dashboardType;
  const secKey = sectionKey || "summary";

  const vrPanelEl = document.getElementById("vr-explanation-panel");
  const vrTextEl = document.getElementById("vr-terminal-text");

  if (!vrPanelEl || !vrTextEl) return;

  const positionVRPanel = () => {
    const cameraEl = document.querySelector("[camera]");
    if (cameraEl && vrPanelEl) {
      const camRot = cameraEl.getAttribute("rotation") || { y: 0 };
      vrPanelEl.setAttribute("rotation", `0 ${camRot.y} 0`);
      const angleRad = (camRot.y * Math.PI) / 180;
      const posX = -3.0 * Math.sin(angleRad);
      const posZ = -3.0 * Math.cos(angleRad);
      vrPanelEl.setAttribute("position", `${posX} 1.5 ${posZ}`);
    }
  };

  const showInVR = (text) => {
    vrFullText = wrapTextForVR(text, VR_MAX_CHARS_PER_LINE);
    vrScrollOffset = 0;
    vrTextEl.setAttribute("value", getVisibleVRText());
    vrPanelEl.setAttribute("visible", "true");
    positionVRPanel();
  };

  // Si aún no se ha obtenido la info, mostrar aviso indicando que debe pulsarse EXPLICAR primero
  if (!explanationCache[targetKey]) {
    const promptMsg = (window.t ? window.t("scene.vr_prompt_explain") : null) ||
      (localStorage.getItem("vizzo_lang") === "en"
        ? "Click the 'EXPLAIN' button first to generate the dashboard explanation."
        : "Pulse el botón 'EXPLICAR' primero para generar la explicación del dashboard.");
    showInVR(promptMsg);
    return;
  }

  // Si ya existe en caché, proyectar la sección solicitada
  const textToDisplay = getSectionText(explanationCache[targetKey], secKey);
  updateButtonLabels(dashboardType, targetEl, secKey);
  showInVR(textToDisplay);
}

let currentAudio = null;
let currentAudioDashboard = null;

function setTtsButtonState(dashboardType, state, targetEl, sectionKey = "summary") {
  const targetKey = targetEl ? targetEl.id : null;
  const scene3dBtns = document.querySelectorAll("[vizzo-control-btn]");
  scene3dBtns.forEach((btnEl) => {
    const compData = parseControlBtnComp(btnEl);
    if (compData && compData.action === "play-tts") {
      const isTargetMatch = targetKey
        ? compData.targetId === targetKey
        : compData.vizType === dashboardType;
      const isSecMatch = !sectionKey || compData.value === sectionKey;

      if (isTargetMatch && isSecMatch) {
        const baseEl = btnEl.querySelector(".vizzo-btn-base");
        const borderEl = btnEl.querySelector(".vizzo-btn-border");
        const strikeEl = btnEl.querySelector(".vizzo-btn-strike");
        const iconParts = btnEl.querySelectorAll(
          ".vizzo-btn-icon a-box, .vizzo-btn-icon a-cone, .vizzo-btn-icon a-ring",
        );

        if (state === "loading") {
          if (strikeEl) strikeEl.setAttribute("visible", "true");
          if (baseEl) {
            baseEl.setAttribute("color", "#4a2a00");
            baseEl.setAttribute("emissive", "#ffaa00");
            baseEl.setAttribute("emissive-intensity", "0.8");
          }
          if (borderEl) {
            borderEl.setAttribute("color", "#ffaa00");
            borderEl.setAttribute("emissive", "#ffaa00");
            borderEl.setAttribute("emissive-intensity", "2.0");
          }
          iconParts.forEach((el) => {
            if (!el.classList.contains("vizzo-btn-strike")) {
              el.setAttribute("color", "#ffaa00");
              el.setAttribute("emissive", "#ffaa00");
              el.setAttribute("emissive-intensity", "1.0");
            }
          });
        } else if (state === "playing") {
          if (strikeEl) strikeEl.setAttribute("visible", "false");
          if (baseEl) {
            baseEl.setAttribute("color", "#003b21");
            baseEl.setAttribute("emissive", "#4af7a0");
            baseEl.setAttribute("emissive-intensity", "0.8");
          }
          if (borderEl) {
            borderEl.setAttribute("color", "#4af7a0");
            borderEl.setAttribute("emissive", "#4af7a0");
            borderEl.setAttribute("emissive-intensity", "2.0");
          }
          iconParts.forEach((el) => {
            if (!el.classList.contains("vizzo-btn-strike")) {
              el.setAttribute("color", "#4af7a0");
              el.setAttribute("emissive", "#4af7a0");
              el.setAttribute("emissive-intensity", "1.0");
            }
          });
        } else if (state === "paused") {
          if (strikeEl) strikeEl.setAttribute("visible", "false");
          if (baseEl) {
            baseEl.setAttribute("color", "#3b2e00");
            baseEl.setAttribute("emissive", "#ffd700");
            baseEl.setAttribute("emissive-intensity", "0.8");
          }
          if (borderEl) {
            borderEl.setAttribute("color", "#ffd700");
            borderEl.setAttribute("emissive", "#ffd700");
            borderEl.setAttribute("emissive-intensity", "2.0");
          }
          iconParts.forEach((el) => {
            if (!el.classList.contains("vizzo-btn-strike")) {
              el.setAttribute("color", "#ffd700");
              el.setAttribute("emissive", "#ffd700");
              el.setAttribute("emissive-intensity", "1.0");
            }
          });
        } else if (state === "idle") {
          // Audio cargado / listo: Ocultar tachado y mostrar icono limpio
          if (strikeEl) strikeEl.setAttribute("visible", "false");
          if (baseEl) {
            baseEl.setAttribute("color", "#ffffff");
            baseEl.removeAttribute("emissive");
            baseEl.removeAttribute("emissive-intensity");
          }
          if (borderEl) {
            borderEl.setAttribute("color", "#cbd5e1");
            borderEl.removeAttribute("emissive");
            borderEl.removeAttribute("emissive-intensity");
          }
          iconParts.forEach((el) => {
            if (!el.classList.contains("vizzo-btn-strike")) {
              el.setAttribute("color", "#334155");
              el.removeAttribute("emissive");
              el.removeAttribute("emissive-intensity");
            }
          });
        } else {
          // Unloaded / default: Mostrar tachado
          if (strikeEl) strikeEl.setAttribute("visible", "true");
          if (baseEl) {
            baseEl.setAttribute("color", "#ffffff");
            baseEl.removeAttribute("emissive");
            baseEl.removeAttribute("emissive-intensity");
          }
          if (borderEl) {
            borderEl.setAttribute("color", "#cbd5e1");
            borderEl.removeAttribute("emissive");
            borderEl.removeAttribute("emissive-intensity");
          }
          iconParts.forEach((el) => {
            if (!el.classList.contains("vizzo-btn-strike")) {
              el.setAttribute("color", "#94a3b8");
              el.removeAttribute("emissive");
              el.removeAttribute("emissive-intensity");
            }
          });
        }
      }
    }
  });
}

/**
 * Cambia la visibilidad del tachado del botón de voz 🔊 exclusivamente para el dashboard especificado
 */
export function setTtsButtonVisibility(dashboardType, isVisible, targetEl, sectionKey = "summary") {
  setTtsButtonState(dashboardType, isVisible ? "idle" : "unloaded", targetEl, sectionKey);
}

/**
 * Precarga los audios de voz TTS en segundo plano para las 3 secciones
 */
function preloadAllSectionsTts(dashboardType, sections, targetEl) {
  const targetKey = (targetEl && targetEl.id) ? targetEl.id : dashboardType;
  const secKeys = ["summary", "problems", "recommendations"];

  secKeys.forEach((secKey) => {
    const text = sections[secKey];
    if (!text) return;

    const audioKey = targetKey + "_" + secKey;
    if (audioCache[audioKey]) {
      setTtsButtonState(dashboardType, "idle", targetEl, secKey);
      return;
    }

    console.log(
      `ViZzo // Precargando audio TTS para sección '${secKey}' en:`,
      targetKey,
    );

    const lang = window.getLang ? window.getLang() : (localStorage.getItem("vizzo_lang") || "es");
    fetch("/api/tts/", {
      method: "POST",
      headers: csrfHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        text: text,
        voice_id: "kepler",
        language: lang,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Error HTTP " + res.status);
        return res.blob();
      })
      .then((blob) => {
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audioCache[audioKey] = audio;
        setTtsButtonState(dashboardType, "idle", targetEl, secKey);
        console.log(
          `ViZzo // Audio precargado con éxito para '${secKey}' en:`,
          targetKey,
        );
      })
      .catch((err) => {
        console.error(`ViZzo // Error al precargar voz TTS para '${secKey}':`, err);
      });
  });
}

/**
 * Mantener retrocompatibilidad de preloadTtsAudio
 */
export function preloadTtsAudio(dashboardType, text, targetEl) {
  if (typeof text === "object") {
    preloadAllSectionsTts(dashboardType, text, targetEl);
  } else {
    preloadAllSectionsTts(dashboardType, { summary: text }, targetEl);
  }
}

/**
 * Reproduce el audio precargado de la sección seleccionada con soporte Play/Pause
 */
export function playTtsExplanation(dashboardType, targetEl, sectionKey = "summary") {
  const targetKey = (targetEl && targetEl.id) ? targetEl.id : dashboardType;
  const secKey = sectionKey || "summary";
  const audioKey = targetKey + "_" + secKey;

  console.log(`ViZzo // Petición de reproducción TTS ('${secKey}') para:`, targetKey);

  const audio = audioCache[audioKey];

  if (!audio) {
    console.warn(
      `ViZzo // El audio de '${secKey}' aún no se ha cargado para este panel:`,
      targetKey,
    );
    return;
  }

  // Si ya hay un audio activo para esta misma sección en este panel, alternar Play/Pause
  if (currentAudio && currentAudioDashboard === audioKey) {
    if (currentAudio.paused) {
      currentAudio.play();
      setTtsButtonState(dashboardType, "playing", targetEl, secKey);
      console.log(`ViZzo // Audio reanudado ('${secKey}') para:`, targetKey);
    } else {
      currentAudio.pause();
      setTtsButtonState(dashboardType, "paused", targetEl, secKey);
      console.log(`ViZzo // Audio pausado ('${secKey}') para:`, targetKey);
    }
    return;
  }

  // Detener audio anterior si pertenecía a otra sección u otro panel
  if (currentAudio) {
    currentAudio.pause();
    if (currentAudioDashboard) {
      const parts = currentAudioDashboard.split("_");
      const prevTargetId = parts[0];
      const prevSecKey = parts[1] || "summary";
      const prevEl = document.getElementById(prevTargetId);
      setTtsButtonState(dashboardType, "idle", prevEl, prevSecKey);
    }
    currentAudio = null;
    currentAudioDashboard = null;
  }

  currentAudio = audio;
  currentAudioDashboard = audioKey;

  setTtsButtonState(dashboardType, "playing", targetEl, secKey);

  currentAudio.onended = () => {
    setTtsButtonState(dashboardType, "idle", targetEl, secKey);
    currentAudio = null;
    currentAudioDashboard = null;
    console.log(`ViZzo // Audio finalizado ('${secKey}') para:`, targetKey);
  };

  currentAudio.currentTime = 0;
  currentAudio.play();
}

/**
 * Cierra el panel de la escena
 */
export function closeExplanation() {
  if (typewriterInterval) {
    clearInterval(typewriterInterval);
    typewriterInterval = null;
  }

  if (currentAudio) {
    currentAudio.pause();
    if (currentAudioDashboard) {
      setTtsButtonState(currentAudioDashboard, "idle");
    }
    currentAudio = null;
    currentAudioDashboard = null;
  }

  const vrPanelEl = document.getElementById("vr-explanation-panel");
  if (vrPanelEl) {
    vrPanelEl.setAttribute("visible", "false");
  }
}

// Inicializar y registrar en el espacio de nombres global para compatibilidad con onclick HTML
export function initAiAssistant() {
  window.ViZzo = window.ViZzo || {};
  window.ViZzo.ui = {
    showExplanation: showExplanation,
    closeExplanation: closeExplanation,
    playTtsExplanation: playTtsExplanation,
  };

  // Helper para aplicar hover adaptado a la escena (burdeos oscuro)
  const applySceneHover = (btnEl) => {
    if (!btnEl) return;
    btnEl.addEventListener("mouseenter", () => {
      const box = btnEl.querySelector("a-box");
      if (box) {
        box.setAttribute("color", "#2b1016");
        box.setAttribute("emissive", "#2b1016");
        box.setAttribute("emissive-intensity", "0.5");
      }
    });
    btnEl.addEventListener("mouseleave", () => {
      const box = btnEl.querySelector("a-box");
      if (box) {
        box.setAttribute("color", "#1a1a24");
        box.removeAttribute("emissive");
        box.removeAttribute("emissive-intensity");
      }
    });
  };

  // Enlazar evento click del botón de cierre 3D
  const vrCloseBtn = document.getElementById("vr-terminal-close-btn");
  if (vrCloseBtn) {
    vrCloseBtn.addEventListener("click", () => {
      closeExplanation();
    });
    applySceneHover(vrCloseBtn);
  }

  // Scroll up
  const vrScrollUpBtn = document.getElementById("vr-scroll-up-btn");
  if (vrScrollUpBtn) {
    vrScrollUpBtn.addEventListener("click", () => {
      if (vrScrollOffset > 0) {
        vrScrollOffset = Math.max(0, vrScrollOffset - 4);
        updateVRScroll();
      }
    });
    applySceneHover(vrScrollUpBtn);
  }

  // Scroll down
  const vrScrollDownBtn = document.getElementById("vr-scroll-down-btn");
  if (vrScrollDownBtn) {
    vrScrollDownBtn.addEventListener("click", () => {
      const maxOffset = Math.max(0, vrTotalLines - VR_LINES_PER_PAGE);
      if (vrScrollOffset < maxOffset) {
        vrScrollOffset = Math.min(maxOffset, vrScrollOffset + 4);
        updateVRScroll();
      }
    });
    applySceneHover(vrScrollDownBtn);
  }

  window.ViZzoTrigger = function (action, vizType) {
    console.log("ViZzoTrigger // Acción:", action, "Visualizador:", vizType);

    let targetEl = null;
    if (vizType === "boats") targetEl = document.querySelector("[babia-boats]");
    else if (vizType === "cyls")
      targetEl = document.querySelector("[babia-cyls]");
    else if (vizType === "doughnut")
      targetEl = document.querySelector("[babia-doughnut]") || document.querySelector("[babia-pie]");
    else if (vizType === "barsmap")
      targetEl = document.querySelector("[babia-barsmap]");

    if (!targetEl) {
      if (action !== "explain-ai") {
        console.warn(
          "ViZzoTrigger // No se encontró el componente visualizador de tipo:",
          vizType,
        );
      }
      return;
    }

    if (action === "wireframe") {
      toggleWireframe(targetEl, vizType);
    } else if (action === "swap-mappings") {
      swapMappings(targetEl, vizType);
    } else if (action === "cycle-height") {
      cycleHeight(targetEl, vizType);
    } else if (action === "explain-ai") {
      showExplanation(vizType, targetEl);
    } else if (action === "play-tts") {
      playTtsExplanation(vizType, targetEl);
    }
  };
}
