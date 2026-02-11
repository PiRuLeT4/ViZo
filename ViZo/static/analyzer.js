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

form.addEventListener("submit", function (e) {
  e.preventDefault();
  // Aquí iría la lógica de envío del formulario
  console.log("Form submitted with URL:", input.value);
});
