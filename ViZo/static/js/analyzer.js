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
            Ingresa la URL completa del repositorio (GitHub, GitLab, etc.)
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
            URL válida detectada
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
            Por favor, ingresa una URL válida de repositorio
          `;
  }
});

// ── Loading Sequence Logic ──
const loadingOverlay = document.getElementById("loadingOverlay");
const loadingMessage = document.getElementById("loadingMessage");

const messages = [
  "Clonando repositorio remoto...",
  "Analizando estructura de archivos...",
  "Este proceso puede tardar unos minutos...",
  "Calculando métricas de nloc y complejidad...",
  "Generando resumen estadístico...",
  "Solicitando arquitectura a la IA de ViZo...",
  "Ya casi está todo listo...",
  "Preparando motor de visualización XR...",
];

form.addEventListener("submit", function (e) {
  // Evitar envíos múltiples
  if (loadingOverlay.classList.contains("active")) {
    e.preventDefault();
    return;
  }

  // Activar overlay
  loadingOverlay.classList.add("active");

  // Ciclo de mensajes cada 4.5 segundos
  let msgIdx = 0;
  setInterval(() => {
    msgIdx = (msgIdx + 1) % messages.length;

    // Efecto de fade
    loadingMessage.style.opacity = 0;
    setTimeout(() => {
      loadingMessage.textContent = messages[msgIdx];
      loadingMessage.style.opacity = 1;
    }, 700);
  }, 7500);
});
