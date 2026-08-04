/**
 * Módulo de Ajustes de Conexión de IA (Modal de IA)
 */

const globalAiModal = document.getElementById("globalAiModal");
const openAiModalBtn = document.getElementById("openAiModalBtn");
const closeAiModalBtn = document.getElementById("closeAiModalBtn");
const saveAiModalBtn = document.getElementById("saveAiModalBtn");
const resetAiModalBtn = document.getElementById("resetAiModalBtn");

const llmIsLocal = document.getElementById("llmIsLocal");
const llmApiKeyGroup = document.getElementById("llmApiKeyGroup");
const llmBaseUrl = document.getElementById("llmBaseUrl");
const llmApiKey = document.getElementById("llmApiKey");
const llmModel = document.getElementById("llmModel");

const navbarAiModelName = document.getElementById("navbarAiModelName");

export function updateAiStatusIndicator() {
  if (!navbarAiModelName) return;
  
  const customActive = localStorage.getItem("vizzo_custom_llm_active") === "true";
  const modelName = localStorage.getItem("vizzo_llm_model") || "";
  const isLocal = localStorage.getItem("vizzo_llm_is_local") !== "false";
  
  if (customActive) {
    let displayName = modelName;
    if (!displayName) {
      displayName = isLocal ? "Local" : "Custom IA";
    }
    if (displayName.includes("/")) {
      displayName = displayName.split("/").pop();
    }
    navbarAiModelName.textContent = displayName;
    navbarAiModelName.style.display = "inline";
  } else {
    navbarAiModelName.textContent = "";
    navbarAiModelName.style.display = "none";
  }
}

export function openAiModal() {
  if (globalAiModal) {
    globalAiModal.style.display = "flex";
  }
}

export function closeAiModal() {
  if (globalAiModal) {
    globalAiModal.style.display = "none";
  }
}

export function initAiConfig() {
  // Pre-load from localStorage
  if (llmIsLocal && llmApiKeyGroup) {
    const isLocal = localStorage.getItem("vizzo_llm_is_local") !== "false";
    llmIsLocal.checked = isLocal;
    llmApiKeyGroup.style.display = isLocal ? "none" : "block";

    llmIsLocal.addEventListener("change", function () {
      llmApiKeyGroup.style.display = this.checked ? "none" : "block";
    });
  }

  if (llmBaseUrl) {
    llmBaseUrl.value = localStorage.getItem("vizzo_llm_base_url") || "";
  }
  if (llmApiKey) {
    if (localStorage.getItem("vizzo_llm_api_key")) {
      localStorage.removeItem("vizzo_llm_api_key");
    }

    const isKeySaved = localStorage.getItem("vizzo_llm_api_key_saved") === "true";
    llmApiKey.value = isKeySaved ? "••••••••••••••••" : "";
    
    llmApiKey.addEventListener("focus", function() {
      if (this.value === "••••••••••••••••") {
        this.value = "";
      }
    });
    llmApiKey.addEventListener("blur", function() {
      if (this.value === "" && localStorage.getItem("vizzo_llm_api_key_saved") === "true") {
        this.value = "••••••••••••••••";
      }
    });
  }
  if (llmModel) {
    llmModel.value = localStorage.getItem("vizzo_llm_model") || "";
  }

  // Modal open/close hooks
  if (openAiModalBtn) openAiModalBtn.addEventListener("click", openAiModal);
  if (closeAiModalBtn) closeAiModalBtn.addEventListener("click", closeAiModal);
  
  if (globalAiModal) {
    globalAiModal.addEventListener("click", function(e) {
      if (e.target === globalAiModal) {
        closeAiModal();
      }
    });
  }

function getCsrfToken() {
  const cookieValue = document.cookie
    .split("; ")
    .find(row => row.startsWith("csrftoken="))
    ?.split("=")[1];
  return cookieValue || document.querySelector("[name=csrfmiddlewaretoken]")?.value || "";
}

  // Save operation
  if (saveAiModalBtn) {
    saveAiModalBtn.addEventListener("click", function() {
      const payload = {
        llm_base_url: llmBaseUrl ? llmBaseUrl.value.trim() : "",
        llm_api_key: llmApiKey ? llmApiKey.value.trim() : "",
        llm_model: llmModel ? llmModel.value.trim() : "",
        llm_is_local: llmIsLocal ? llmIsLocal.checked : true
      };

      fetch("/api/save-ai-config/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          "X-CSRFToken": getCsrfToken()
        },
        body: JSON.stringify(payload)
      })
      .then(res => {
        if (!res.ok) throw new Error("Error HTTP " + res.status);
        return res.json();
      })
      .then(data => {
        if (data.status === "success") {
          if (llmBaseUrl) {
            localStorage.setItem("vizzo_llm_base_url", payload.llm_base_url);
            localStorage.setItem("vizzo_custom_llm_active", payload.llm_base_url !== "");
          }
          if (llmModel) {
            localStorage.setItem("vizzo_llm_model", payload.llm_model);
          }
          if (llmIsLocal) {
            localStorage.setItem("vizzo_llm_is_local", payload.llm_is_local);
          }
          
          if (payload.llm_api_key && payload.llm_api_key !== "••••••••••••••••") {
            localStorage.setItem("vizzo_llm_api_key_saved", "true");
          } else if (!payload.llm_api_key) {
            localStorage.setItem("vizzo_llm_api_key_saved", "false");
          }
          
          updateAiStatusIndicator();
          closeAiModal();
        } else {
          alert("Error al guardar la configuración de IA: " + data.error);
        }
      })
      .catch(err => {
        console.error("Error saving AI config:", err);
        alert("Error de conexión al guardar la configuración.");
      });
    });
  }

  // Reset operation
  if (resetAiModalBtn) {
    resetAiModalBtn.addEventListener("click", function() {
      const payload = {
        llm_base_url: "",
        llm_api_key: "",
        llm_model: "",
        llm_is_local: true
      };

      fetch("/api/save-ai-config/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          "X-CSRFToken": getCsrfToken()
        },
        body: JSON.stringify(payload)
      })
      .then(res => {
        if (!res.ok) throw new Error("Error HTTP " + res.status);
        return res.json();
      })
      .then(data => {
        if (data.status === "success") {
          if (llmBaseUrl) llmBaseUrl.value = "";
          if (llmApiKey) llmApiKey.value = "";
          if (llmModel) llmModel.value = "";
          if (llmIsLocal) {
            llmIsLocal.checked = true;
            if (llmApiKeyGroup) llmApiKeyGroup.style.display = "none";
          }

          localStorage.removeItem("vizzo_llm_base_url");
          localStorage.removeItem("vizzo_llm_model");
          localStorage.setItem("vizzo_llm_is_local", "true");
          localStorage.setItem("vizzo_llm_api_key_saved", "false");
          localStorage.setItem("vizzo_custom_llm_active", "false");

          updateAiStatusIndicator();
          closeAiModal();
        } else {
          alert("Error al restablecer la configuración de IA: " + data.error);
        }
      })
      .catch(err => {
        console.error("Error resetting AI config:", err);
        alert("Error de conexión al restablecer la configuración.");
      });
    });
  }

  // Run visual check initially
  updateAiStatusIndicator();
}
