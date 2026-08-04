/**
 * Módulo de HUD y Sondeo (Polling) del Proceso de Análisis
 */

const hud = document.getElementById("vizzo-progress-hud");
const closeHudBtn = document.getElementById("closeHudBtn");
const hudRepoName = document.getElementById("hudRepoName");
const hudStatusText = document.getElementById("hudStatusText");
const hudBar = document.getElementById("hudBar");
const hudTerminal = document.getElementById("hudTerminal");
const hudActions = document.getElementById("hudActions");
const enterRoomBtn = document.getElementById("enterRoomBtn");
const hudCancelContainer = document.getElementById("hudCancelContainer");
const cancelAnalysisBtn = document.getElementById("cancelAnalysisBtn");
const reopenHudBtn = document.getElementById("vizzo-reopen-hud-btn");

let pollingInterval = null;
let messageTimer = null;
let currentSessionId = null;

const translate = window.t || ((key) => key);

export function isAnalysisProcessing() {
  return hud && hud.classList.contains("active") && hud.className.includes("status-processing");
}

export function appendTerminalLog(message) {
  if (!hudTerminal) return;
  const line = document.createElement("div");
  line.className = "terminal-line";
  line.textContent = `> ${message}`;
  hudTerminal.appendChild(line);
  hudTerminal.scrollTop = hudTerminal.scrollHeight;
}

export function clearActiveSessionStorage() {
  localStorage.removeItem("vizzo_active_session_id");
  localStorage.removeItem("vizzo_active_session_name");
}

export function resetReopenBtn() {
  if (reopenHudBtn) {
    reopenHudBtn.classList.remove("active");
    const dot = reopenHudBtn.querySelector(".pulse-dot");
    if (dot) {
      dot.style.backgroundColor = "var(--accent-text)";
      dot.style.boxShadow = "0 0 8px var(--accent-glow)";
    }
    const txt = reopenHudBtn.querySelector(".btn-text");
    if (txt) {
      txt.textContent = translate("hud.reopen");
      txt.style.color = "var(--text-secondary)";
    }
  }
}

export function pollSessionStatus(sessionId) {
  if (pollingInterval) clearInterval(pollingInterval);
  if (messageTimer) clearInterval(messageTimer);

  let step = 0;
  const loadingMessages = [
    "CLONANDO REPOSITORIO DESDE EL ORIGEN...",
    "EXTRAYENDO ÁRBOL DE ARCHIVOS...",
    "EJECUTANDO PARSER DE LIZARD METRICS...",
    "CALCULANDO COMPLEJIDAD CICLOMÁTICA...",
    "PROCESANDO HISTORIAL DE COMMITS CON PYDRILLER...",
    "ENVIANDO RESUMEN A LA IA DE VIZZO...",
    "ESPERANDO RESPUESTA DEL LLM LOCAL..."
  ];

  messageTimer = setInterval(() => {
    if (step < loadingMessages.length) {
      appendTerminalLog(loadingMessages[step]);
      step++;
    }
  }, 4000);

  pollingInterval = setInterval(() => {
    fetch(`/api/session/${sessionId}/status/`)
      .then(res => {
        if (res.status === 404) {
          stopPolling();
          clearActiveSessionStorage();
          resetReopenBtn();
          if (hud) {
            hud.className = "vizzo-progress-hud active status-failed";
          }
          if (hudStatusText) hudStatusText.textContent = "Sesión no encontrada";
          appendTerminalLog("ESTADO: ERROR CRÍTICO. La sesión de análisis especificada no existe en el servidor.");
          if (hudCancelContainer) hudCancelContainer.style.display = "none";
          throw new Error("Session not found (HTTP 404)");
        }
        if (!res.ok) throw new Error("Status API returned HTTP " + res.status);
        return res.json();
      })
      .then(data => {
        console.log("[Polling] Session status:", data);
        
        if (data.status === "pending") {
          if (hudStatusText) hudStatusText.textContent = "En cola de espera...";
          if (hud && reopenHudBtn) {
            hud.className = reopenHudBtn.classList.contains("active") 
              ? "vizzo-progress-hud status-pending" 
              : "vizzo-progress-hud active status-pending";
          }
          if (hudBar) hudBar.style.width = "15%";
          if (hudCancelContainer) hudCancelContainer.style.display = "block";
        } else if (data.status === "processing") {
          if (hudStatusText) hudStatusText.textContent = "Procesando código fuente...";
          if (hud && reopenHudBtn) {
            hud.className = reopenHudBtn.classList.contains("active") 
              ? "vizzo-progress-hud status-processing" 
              : "vizzo-progress-hud active status-processing";
          }
          if (hudBar) hudBar.style.width = "50%";
          if (hudCancelContainer) hudCancelContainer.style.display = "block";
        } else if (data.status === "completed") {
          stopPolling();
          clearActiveSessionStorage();
          if (hudCancelContainer) hudCancelContainer.style.display = "none";

          if (hudStatusText) hudStatusText.textContent = translate("hud.completed");
          if (hud) hud.className = "vizzo-progress-hud active status-completed";
          if (hudBar) hudBar.style.width = "100%";
          
          appendTerminalLog("ESTADO: ÉXITO. ANÁLISIS FINALIZADO.");
          appendTerminalLog("DISPOSITIVOS LISTOS. ENTRADA A SALA DISPONIBLE.");
          
          if (hudActions) hudActions.style.display = "block";
          if (enterRoomBtn) {
            enterRoomBtn.href = `/visualization/${sessionId}/`;
            enterRoomBtn.classList.add("pulse-neon");
          }

          if (hud && !hud.classList.contains("active") && reopenHudBtn) {
            reopenHudBtn.classList.add("active");
            const dot = reopenHudBtn.querySelector(".pulse-dot");
            if (dot) {
              dot.style.backgroundColor = "var(--success)";
              dot.style.boxShadow = "0 0 10px var(--success-soft)";
            }
            const txt = reopenHudBtn.querySelector(".btn-text");
            if (txt) {
              txt.textContent = translate("hud.room_ready");
              txt.style.color = "var(--success)";
            }
          } else {
            resetReopenBtn();
          }
        } else if (data.status === "failed") {
          stopPolling();
          clearActiveSessionStorage();
          if (hudCancelContainer) hudCancelContainer.style.display = "none";

          const errMsg = data.error_message || "Error desconocido durante el escaneo.";
          if (hudStatusText) hudStatusText.textContent = "FAILED";
          if (hud) hud.className = "vizzo-progress-hud active status-failed";
          if (hudBar) hudBar.style.width = "100%";
          
          appendTerminalLog("ESTADO: ERROR CRÍTICO.");
          appendTerminalLog(`DETALLE: ${errMsg}`);
          
          if (hudActions) hudActions.style.display = "none";

          if (hud && !hud.classList.contains("active") && reopenHudBtn) {
            reopenHudBtn.classList.add("active");
            const dot = reopenHudBtn.querySelector(".pulse-dot");
            if (dot) {
              dot.style.backgroundColor = "var(--error)";
              dot.style.boxShadow = "0 0 10px var(--error-soft)";
            }
            const txt = reopenHudBtn.querySelector(".btn-text");
            if (txt) {
              txt.textContent = "FAILED";
              txt.style.color = "var(--error)";
            }
          } else {
            resetReopenBtn();
          }
        }
      })
      .catch(err => {
        console.error("[Polling Error]", err);
        appendTerminalLog(`CONEXIÓN INTERRUMPIDA: ${err.message}`);
      });
  }, 2000);
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  if (messageTimer) {
    clearInterval(messageTimer);
    messageTimer = null;
  }
}

export function startAnalysis(repoUrlVal, friendlyName, formData) {
  resetReopenBtn();
  currentSessionId = null;

  if (hudRepoName) hudRepoName.textContent = friendlyName;
  if (hudStatusText) hudStatusText.textContent = "Registrando repositorio...";
  if (hudBar) hudBar.style.width = "5%";
  if (hudTerminal) hudTerminal.innerHTML = "";
  if (hudActions) hudActions.style.display = "none";
  if (hudCancelContainer) hudCancelContainer.style.display = "block";
  if (hud) hud.className = "vizzo-progress-hud active";

  appendTerminalLog(`INICIANDO ANÁLISIS DE ${repoUrlVal}`);
  appendTerminalLog("CONECTANDO AL SERVIDOR PRINCIPAL DE VIZZO...");

  localStorage.setItem("vizzo_active_session_id", "pending");
  localStorage.setItem("vizzo_active_session_name", friendlyName);

  fetch("/api/analyze/", {
    method: "POST",
    body: formData,
    headers: {
      "X-Requested-With": "XMLHttpRequest"
    }
  })
    .then(res => {
      return res.json().then(data => {
        if (!res.ok) {
          throw new Error(data.error || "API returned HTTP " + res.status);
        }
        return data;
      });
    })
    .then(data => {
      if (data.status === "success") {
        if (data.is_cache_hit) {
          currentSessionId = data.session_id;

          appendTerminalLog(`SALA CACHEADA ENCONTRADA. ID: ${data.session_id}`);
          appendTerminalLog("ESTADO: ÉXITO. CARGANDO MÉTRICAS INSTANTÁNEAMENTE...");
          
          if (hudStatusText) hudStatusText.textContent = "¡Análisis Recuperado (Caché)!";
          if (hud) hud.className = "vizzo-progress-hud active status-completed";
          if (hudBar) hudBar.style.width = "100%";
          
          if (hudActions) hudActions.style.display = "block";
          if (enterRoomBtn) {
            enterRoomBtn.href = `/visualization/${data.session_id}/`;
            enterRoomBtn.classList.add("pulse-neon");
          }
          
          clearActiveSessionStorage();
        } else {
          appendTerminalLog(`SESIÓN ASÍNCRONA REGISTRADA. ID: ${data.session_id}`);
          appendTerminalLog("ARRANCANDO WORKER SECUNDARIO EN EL BACKEND...");
          
          currentSessionId = data.session_id;
          localStorage.setItem("vizzo_active_session_id", data.session_id);
          pollSessionStatus(data.session_id);
        }
      } else {
        throw new Error(data.error || "No se pudo registrar la sesión.");
      }
    })
    .catch(err => {
      console.error("[Submission Error]", err);
      clearActiveSessionStorage();
      currentSessionId = null;
      if (hud) hud.className = "vizzo-progress-hud active status-failed";
      if (hudStatusText) hudStatusText.textContent = "Error al Enviar";
      if (hudBar) hudBar.style.width = "100%";
      appendTerminalLog(`ERROR DE ENVÍO: ${err.message}`);
    });
}

export function initHUD() {
  if (closeHudBtn && hud) {
    closeHudBtn.addEventListener("click", () => {
      hud.classList.remove("active");
      if (currentSessionId && reopenHudBtn) {
        reopenHudBtn.classList.add("active");
        
        const dot = reopenHudBtn.querySelector(".pulse-dot");
        const txt = reopenHudBtn.querySelector(".btn-text");
        
        if (hud.className.includes("status-completed")) {
          if (dot) {
            dot.style.backgroundColor = "var(--success)";
            dot.style.boxShadow = "0 0 10px var(--success-soft)";
          }
          if (txt) {
            txt.textContent = translate("hud.room_ready");
            txt.style.color = "var(--success)";
          }
        } else if (hud.className.includes("status-failed")) {
          if (dot) {
            dot.style.backgroundColor = "var(--error)";
            dot.style.boxShadow = "0 0 10px var(--error-soft)";
          }
          if (txt) {
            txt.textContent = "FAILED";
            txt.style.color = "var(--error)";
          }
        }
      }

      const isFinished = hud.className.includes("status-completed") || hud.className.includes("status-failed");
      if (isFinished) {
        clearActiveSessionStorage();
        stopPolling();
      }
    });
  }

  if (reopenHudBtn && hud) {
    reopenHudBtn.addEventListener("click", () => {
      reopenHudBtn.classList.remove("active");
      hud.classList.add("active");
    });
  }

function getCsrfToken() {
  const cookieValue = document.cookie
    .split("; ")
    .find(row => row.startsWith("csrftoken="))
    ?.split("=")[1];
  return cookieValue || document.querySelector("[name=csrfmiddlewaretoken]")?.value || "";
}

  if (cancelAnalysisBtn) {
    cancelAnalysisBtn.addEventListener("click", () => {
      if (!currentSessionId) return;

      appendTerminalLog("SOLICITANDO CANCELACIÓN DEL PROCESO...");
      cancelAnalysisBtn.disabled = true;
      cancelAnalysisBtn.textContent = "CANCELANDO...";

      fetch(`/api/session/${currentSessionId}/cancel/`, {
        method: "POST",
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          "X-CSRFToken": getCsrfToken()
        }
      })
        .then(async res => {
          if (res.status === 404) {
            stopPolling();
            clearActiveSessionStorage();
            resetReopenBtn();
            if (hud) hud.className = "vizzo-progress-hud active status-failed";
            if (hudStatusText) hudStatusText.textContent = "Sesión no encontrada";
            appendTerminalLog("ERROR: No se pudo cancelar porque la sesión no existe en el servidor.");
            if (hudCancelContainer) hudCancelContainer.style.display = "none";
            throw new Error("Session not found (HTTP 404)");
          }
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || ("Cancel API returned HTTP " + res.status));
          }
          return res.json();
        })
        .then(data => {
          if (data.status === "success") {
            appendTerminalLog("ESTADO: ABORTADO POR EL USUARIO.");
            if (hudStatusText) hudStatusText.textContent = "Análisis Cancelado";
            if (hud) hud.className = "vizzo-progress-hud active status-failed";
            if (hudBar) hudBar.style.width = "100%";

            stopPolling();
            clearActiveSessionStorage();
            resetReopenBtn();
            if (hudCancelContainer) hudCancelContainer.style.display = "none";
          } else {
            throw new Error(data.error || "No se pudo cancelar el análisis.");
          }
        })
        .catch(err => {
          appendTerminalLog(`ERROR AL CANCELAR: ${err.message}`);
        })
        .finally(() => {
          cancelAnalysisBtn.disabled = false;
          cancelAnalysisBtn.textContent = translate("hud.cancel");
        });
    });
  }

  // --- Auto-Recuperación de Sesión Asíncrona (Self-Healing) ---
  const cachedSessionId = localStorage.getItem("vizzo_active_session_id");
  const cachedSessionName = localStorage.getItem("vizzo_active_session_name");

  if (cachedSessionId && cachedSessionId !== "pending") {
    console.log("[Self-Healing] Sesión activa detectada en caché local:", cachedSessionId);
    currentSessionId = parseInt(cachedSessionId, 10);
    
    if (hudRepoName) hudRepoName.textContent = cachedSessionName || "Repositorio";
    if (hudTerminal) hudTerminal.innerHTML = "";
    if (hudActions) hudActions.style.display = "none";
    if (hud) hud.className = "vizzo-progress-hud active status-processing";
    if (hudCancelContainer) hudCancelContainer.style.display = "block";
    
    appendTerminalLog("RECUPERANDO FLUJO DE MONITOREO DE LA SESIÓN...");
    appendTerminalLog(`RECONECTANDO A SESIÓN ID: ${cachedSessionId}`);
    
    pollSessionStatus(currentSessionId);
  } else if (cachedSessionId === "pending") {
    clearActiveSessionStorage();
  }
}
