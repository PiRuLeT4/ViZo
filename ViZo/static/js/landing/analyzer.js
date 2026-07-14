// Simple form validation and visual feedback
const form = document.getElementById("analyzerForm");
const input = document.getElementById("repoUrl");
const helperText = document.getElementById("helperText");

input.addEventListener("input", function () {
  const value = this.value.trim();

  if (value === "") {
    this.classList.remove("valid", "invalid");
    helperText.classList.remove("success", "error");
    helperText.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            ${t("analyzer.form.helper_default")}
          `;
  } else if (
    this.validity.valid &&
    (value.includes("github.com") ||
      value.includes("gitlab.com") ||
      value.includes("bitbucket.org"))
  ) {
    this.classList.remove("invalid");
    this.classList.add("valid");
    helperText.classList.remove("error");
    helperText.classList.add("success");
    helperText.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            ${t("analyzer.form.helper_valid")}
          `;
  } else {
    this.classList.remove("valid");
    this.classList.add("invalid");
    helperText.classList.remove("success");
    helperText.classList.add("error");
    helperText.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            ${t("analyzer.form.helper_invalid")}
          `;
  }
});

// ── Floating HUD & Polling Logic (Step 2 NEW with self-healing cache) ──
const hud = document.getElementById("vizo-progress-hud");
const closeHudBtn = document.getElementById("closeHudBtn");
const hudRepoName = document.getElementById("hudRepoName");
const hudStatusText = document.getElementById("hudStatusText");
const hudBar = document.getElementById("hudBar");
const hudTerminal = document.getElementById("hudTerminal");
const hudActions = document.getElementById("hudActions");
const enterRoomBtn = document.getElementById("enterRoomBtn");
const hudCancelContainer = document.getElementById("hudCancelContainer");
const cancelAnalysisBtn = document.getElementById("cancelAnalysisBtn");

// Botón flotante para reabrir el HUD
const reopenHudBtn = document.getElementById("vizo-reopen-hud-btn");

let pollingInterval = null;
let messageTimer = null;
let currentSessionId = null; // Guardamos el ID de la sesión activa en memoria JavaScript

if (closeHudBtn) {
  closeHudBtn.addEventListener("click", () => {
    hud.classList.remove("active");
    
    // Si hay una sesión activa registrada en memoria, mostramos el botón de reapertura flotante
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
          txt.textContent = t("hud.room_ready");
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
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
      if (messageTimer) {
        clearInterval(messageTimer);
        messageTimer = null;
      }
    }
  });
}

if (reopenHudBtn) {
  reopenHudBtn.addEventListener("click", () => {
    reopenHudBtn.classList.remove("active");
    hud.classList.add("active");
  });
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
        "X-Requested-With": "XMLHttpRequest"
      }
    })
      .then(res => {
        if (res.status === 404) {
          if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
          }
          if (messageTimer) {
            clearInterval(messageTimer);
            messageTimer = null;
          }
          clearActiveSessionStorage();
          resetReopenBtn();
          hud.className = "vizo-progress-hud active status-failed";
          hudStatusText.textContent = "Sesión no encontrada";
          appendTerminalLog("ERROR: No se pudo cancelar porque la sesión no existe en el servidor.");
          if (hudCancelContainer) hudCancelContainer.style.display = "none";
          throw new Error("Session not found (HTTP 404)");
        }
        if (!res.ok) throw new Error("Cancel API returned HTTP " + res.status);
        return res.json();
      })
      .then(data => {
        if (data.status === "success") {
          appendTerminalLog("ESTADO: ABORTADO POR EL USUARIO.");
          hudStatusText.textContent = "Análisis Cancelado";
          hud.className = "vizo-progress-hud active status-failed";
          hudBar.style.width = "100%";

          if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
          }
          if (messageTimer) {
            clearInterval(messageTimer);
            messageTimer = null;
          }
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
        cancelAnalysisBtn.textContent = t("hud.cancel");
      });
  });
}

function clearActiveSessionStorage() {
  localStorage.removeItem("vizo_active_session_id");
  localStorage.removeItem("vizo_active_session_name");
}

function resetReopenBtn() {
  if (reopenHudBtn) {
    reopenHudBtn.classList.remove("active");
    const dot = reopenHudBtn.querySelector(".pulse-dot");
    if (dot) {
      dot.style.backgroundColor = "var(--accent-text)";
      dot.style.boxShadow = "0 0 8px var(--accent-glow)";
    }
    const txt = reopenHudBtn.querySelector(".btn-text");
    if (txt) {
      txt.textContent = t("hud.reopen");
      txt.style.color = "var(--text-secondary)";
    }
  }
}

function appendTerminalLog(message) {
  const line = document.createElement("div");
  line.className = "terminal-line";
  line.textContent = `> ${message}`;
  hudTerminal.appendChild(line);
  // Auto-scroll terminal
  hudTerminal.scrollTop = hudTerminal.scrollHeight;
}

function pollSessionStatus(sessionId) {
  if (pollingInterval) clearInterval(pollingInterval);
  if (messageTimer) clearInterval(messageTimer);

  let step = 0;
  const loadingMessages = [
    "CLONANDO REPOSITORIO DESDE EL ORIGEN...",
    "EXTRAYENDO ÁRBOL DE ARCHIVOS...",
    "EJECUTANDO PARSER DE LIZARD METRICS...",
    "CALCULANDO COMPLEJIDAD CICLOMÁTICA...",
    "PROCESANDO HISTORIAL DE COMMITS CON PYDRILLER...",
    "ENVIANDO RESUMEN A LA IA DE VIZO...",
    "ESPERANDO RESPUESTA DEL LLM LOCAL..."
  ];

  // Simulación de logs de carga en la mini terminal mientras hace short polling
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
          if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
          }
          if (messageTimer) {
            clearInterval(messageTimer);
            messageTimer = null;
          }
          clearActiveSessionStorage();
          resetReopenBtn();
          hud.className = "vizo-progress-hud active status-failed";
          hudStatusText.textContent = "Sesión no encontrada";
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
          hudStatusText.textContent = "En cola de espera...";
          if (!reopenHudBtn.classList.contains("active")) {
            hud.className = "vizo-progress-hud active status-pending";
          } else {
            hud.className = "vizo-progress-hud status-pending";
          }
          hudBar.style.width = "15%";
          if (hudCancelContainer) hudCancelContainer.style.display = "block";
        } else if (data.status === "processing") {
          hudStatusText.textContent = "Procesando código fuente...";
          if (!reopenHudBtn.classList.contains("active")) {
            hud.className = "vizo-progress-hud active status-processing";
          } else {
            hud.className = "vizo-progress-hud status-processing";
          }
          hudBar.style.width = "50%";
          if (hudCancelContainer) hudCancelContainer.style.display = "block";
        } else if (data.status === "completed") {
          clearInterval(pollingInterval);
          clearInterval(messageTimer);
          pollingInterval = null;
          messageTimer = null;

          clearActiveSessionStorage(); // Limpiar el almacenamiento local asíncrono
          if (hudCancelContainer) hudCancelContainer.style.display = "none";

          hudStatusText.textContent = t("hud.completed");
          hud.className = "vizo-progress-hud active status-completed";
          hudBar.style.width = "100%";
          
          appendTerminalLog("ESTADO: ÉXITO. ANÁLISIS FINALIZADO.");
          appendTerminalLog("DISPOSITIVOS LISTOS. ENTRADA A SALA DISPONIBLE.");
          
          // Mostrar botón de entrada
          hudActions.style.display = "block";
          enterRoomBtn.href = `/visualization/${sessionId}/`;
          enterRoomBtn.classList.add("pulse-neon");

          // Si el HUD estaba cerrado, notificar de manera premium en el botón de reapertura flotante
          if (!hud.classList.contains("active") && reopenHudBtn) {
            reopenHudBtn.classList.add("active");
            const dot = reopenHudBtn.querySelector(".pulse-dot");
            if (dot) {
              dot.style.backgroundColor = "var(--success)";
              dot.style.boxShadow = "0 0 10px var(--success-soft)";
            }
            const txt = reopenHudBtn.querySelector(".btn-text");
            if (txt) {
              txt.textContent = t("hud.room_ready");
              txt.style.color = "var(--success)";
            }
          } else {
            resetReopenBtn();
          }
        } else if (data.status === "failed") {
          clearInterval(pollingInterval);
          clearInterval(messageTimer);
          pollingInterval = null;
          messageTimer = null;

          clearActiveSessionStorage(); // Limpiar el almacenamiento local
          if (hudCancelContainer) hudCancelContainer.style.display = "none";

          const errMsg = data.error_message || "Error desconocido durante el escaneo.";
          hudStatusText.textContent = "FAILED";
          hud.className = "vizo-progress-hud active status-failed";
          hudBar.style.width = "100%";
          
          appendTerminalLog("ESTADO: ERROR CRÍTICO.");
          appendTerminalLog(`DETALLE: ${errMsg}`);
          
          hudActions.style.display = "none";

          // Si el HUD estaba cerrado, notificar de manera premium en el botón de reapertura flotante
          if (!hud.classList.contains("active") && reopenHudBtn) {
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

form.addEventListener("submit", function (e) {
  e.preventDefault();
  
  if (hud.classList.contains("active") && hud.className.includes("status-processing")) {
    appendTerminalLog("HAY UN ANÁLISIS EN CURSO. POR FAVOR ESPERE.");
    return;
  }

  // Ocultar botón flotante de reabrir previo
  resetReopenBtn();
  currentSessionId = null; // Reseteamos la sesión activa en memoria

  // Capturar datos del formulario
  const formData = new FormData(form);
  const repoUrlVal = input.value.trim();
  const friendlyName = repoUrlVal.split("/").pop().replace(".git", "");
  
  hudRepoName.textContent = friendlyName;
  hudStatusText.textContent = "Registrando repositorio...";
  hudBar.style.width = "5%";
  hudTerminal.innerHTML = "";
  hudActions.style.display = "none";
  if (hudCancelContainer) hudCancelContainer.style.display = "block";
  
  // Limpiar estados CSS previos e iniciar HUD activo
  hud.className = "vizo-progress-hud active";
  
  appendTerminalLog(`INICIANDO ANÁLISIS DE ${repoUrlVal}`);
  appendTerminalLog("CONECTANDO AL SERVIDOR PRINCIPAL DE VIZO...");

  // Guardar estado inicial en localStorage por si el usuario navega a otro lado
  localStorage.setItem("vizo_active_session_id", "pending");
  localStorage.setItem("vizo_active_session_name", friendlyName);

  // Enviar formulario de forma asíncrona mediante AJAX
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
          // Registrar la sesión en memoria para habilitar la reapertura
          currentSessionId = data.session_id;

          appendTerminalLog(`SALA CACHEADA ENCONTRADA. ID: ${data.session_id}`);
          appendTerminalLog("ESTADO: ÉXITO. CARGANDO MÉTRICAS INSTANTÁNEAMENTE...");
          
          hudStatusText.textContent = "¡Análisis Recuperado (Caché)!";
          hud.className = "vizo-progress-hud active status-completed";
          hudBar.style.width = "100%";
          
          // Mostrar botón de entrada de inmediato
          hudActions.style.display = "block";
          enterRoomBtn.href = `/visualization/${data.session_id}/`;
          enterRoomBtn.classList.add("pulse-neon");
          
          clearActiveSessionStorage();
        } else {
          appendTerminalLog(`SESIÓN ASÍNCRONA REGISTRADA. ID: ${data.session_id}`);
          appendTerminalLog("ARRANCANDO WORKER SECUNDARIO EN EL BACKEND...");
          
          // Guardar la sesión activa
          currentSessionId = data.session_id;
          localStorage.setItem("vizo_active_session_id", data.session_id);
          
          // Empezar el sondeo
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
      hud.className = "vizo-progress-hud active status-failed";
      hudStatusText.textContent = "Error al Enviar";
      hudBar.style.width = "100%";
      appendTerminalLog(`ERROR DE ENVÍO: ${err.message}`);
    });
});

// ── Feature Selector logic & Session Recovery on Page Load ──
document.addEventListener("DOMContentLoaded", function () {
  const depthInput = document.getElementById("depthInput");
  const analysisModeInput = document.getElementById("analysisModeInput");
  const depthLabel = document.getElementById("depthLabel");
  const modeTabs = document.querySelectorAll(".mode-tab");
  const features = document.querySelectorAll(".features .feature");

  // Feature cards data definition
  const featureConfigs = {
    commits: [
      { depth: "50", desc: "50 COMMITS" },
      { depth: "150", desc: "150 COMMITS" },
      { depth: "300", desc: "300 COMMITS" },
      { depth: "all", desc: "TODOS LOS COMMITS" }
    ],
    releases: [
      { depth: "5", desc: "5 RELEASES" },
      { depth: "10", desc: "10 RELEASES" },
      { depth: "20", desc: "20 RELEASES" },
      { depth: "all", desc: "TODOS LOS RELEASES" }
    ]
  };

  // Tabs click handler
  modeTabs.forEach((tab) => {
    tab.addEventListener("click", function () {
      modeTabs.forEach(t => t.classList.remove("active"));
      this.classList.add("active");

      const mode = this.getAttribute("data-mode");
      if (analysisModeInput) {
        analysisModeInput.value = mode;
      }

      if (depthLabel) {
        const key = mode === "releases" ? "analyzer.depth.label_releases" : "analyzer.depth.label_commits";
        depthLabel.setAttribute("data-i18n", key);
        depthLabel.textContent = typeof t === "function" ? t(key) : (mode === "releases" ? "Profundidad de Análisis (Últimas Releases)" : "Profundidad de Análisis (Historial de Commits)");
      }

      // Update features content dynamically based on selected mode
      const configs = featureConfigs[mode];
      const cardIds = ["featureFast", "featureBalanced", "featureDeep", "featureAll"];
      const descIds = ["descFast", "descBalanced", "descDeep", "descAll"];

      cardIds.forEach((id, index) => {
        const card = document.getElementById(id);
        const desc = document.getElementById(descIds[index]);
        if (card && configs[index]) {
          card.setAttribute("data-depth", configs[index].depth);
          if (desc) {
            if (configs[index].depth === "all") {
              const key = mode === "commits" ? "analyzer.depth.all_commits" : "analyzer.depth.all_releases";
              desc.setAttribute("data-i18n", key);
              desc.textContent = typeof t === "function" ? t(key) : configs[index].desc;
            } else {
              desc.removeAttribute("data-i18n");
              desc.textContent = configs[index].desc;
            }
          }
        }
      });

      // Force select the middle card (Balanced) by default when switching modes
      features.forEach((f) => {
        f.classList.remove("active");
        const desc = f.querySelector(".feature-desc");
        if (desc) {
          desc.style.color = "var(--text-muted)";
        }
      });

      const defaultBalancedCard = document.getElementById("featureBalanced");
      if (defaultBalancedCard) {
        defaultBalancedCard.classList.add("active");
        const desc = defaultBalancedCard.querySelector(".feature-desc");
        if (desc) {
          desc.style.color = "var(--accent-text)";
        }
        if (depthInput) {
          depthInput.value = defaultBalancedCard.getAttribute("data-depth");
        }
      }
      console.log("Switched analysis mode to:", mode, "Default depth:", depthInput ? depthInput.value : "");
    });
  });

  features.forEach((feature) => {
    feature.addEventListener("click", function () {
      features.forEach((f) => {
        f.classList.remove("active");
        const desc = f.querySelector(".feature-desc");
        if (desc) {
          desc.style.color = "var(--text-muted)";
        }
      });
      
      this.classList.add("active");
      const activeDesc = this.querySelector(".feature-desc");
      if (activeDesc) {
        activeDesc.style.color = "var(--accent-text)";
      }
      
      const val = this.getAttribute("data-depth");
      if (depthInput) {
        depthInput.value = val;
      }
      console.log("Selected depth:", val);
    });
  });

  // ── Auto-Recuperación de Sesión Asíncrona (Self-Healing) ──
  const cachedSessionId = localStorage.getItem("vizo_active_session_id");
  const cachedSessionName = localStorage.getItem("vizo_active_session_name");

  if (cachedSessionId && cachedSessionId !== "pending") {
    console.log("[Self-Healing] Sesión activa detectada en caché local:", cachedSessionId);
    
    currentSessionId = parseInt(cachedSessionId, 10); // Cargamos en memoria
    
    hudRepoName.textContent = cachedSessionName || "Repositorio";
    hudTerminal.innerHTML = "";
    hudActions.style.display = "none";
    hud.className = "vizo-progress-hud active status-processing";
    if (hudCancelContainer) hudCancelContainer.style.display = "block";
    
    appendTerminalLog("RECUPERANDO FLUJO DE MONITOREO DE LA SESIÓN...");
    appendTerminalLog(`RECONECTANDO A SESIÓN ID: ${cachedSessionId}`);
    
    // Lanzar el sondeo
    pollSessionStatus(currentSessionId);
  } else if (cachedSessionId === "pending") {
    // Si quedó colgado en pending antes del fetch exitoso, limpiamos
    clearActiveSessionStorage();
  }

  // ── Manejador de cerrado para mensajes flash de Django ──
  const closeButtons = document.querySelectorAll(".close-msg-btn");
  closeButtons.forEach(btn => {
    btn.addEventListener("click", function() {
      const messageCard = this.parentElement;
      messageCard.style.opacity = "0";
      messageCard.style.transform = "translateY(-10px)";
      setTimeout(() => {
        messageCard.remove();
        const container = document.querySelector(".messages-container");
        if (container && container.children.length === 0) {
          container.remove();
        }
      }, 300);
    });
  });

  // ── Manejador de modal de inicio de sesión multiproveedor ──
  const loginModal = document.getElementById("vizoLoginModal");
  const openLoginModalBtn = document.getElementById("openLoginModalBtn");
  const closeLoginModalBtn = document.getElementById("closeLoginModalBtn");

  if (loginModal && openLoginModalBtn) {
    openLoginModalBtn.addEventListener("click", function(e) {
      e.preventDefault();
      loginModal.classList.add("active");
    });
  }

  if (loginModal && closeLoginModalBtn) {
    closeLoginModalBtn.addEventListener("click", function() {
      loginModal.classList.remove("active");
    });

    // Cerrar al pulsar fuera del contenedor de contenido del modal
    loginModal.addEventListener("click", function(e) {
      if (e.target === loginModal) {
        loginModal.classList.remove("active");
      }
    });
  }
});
