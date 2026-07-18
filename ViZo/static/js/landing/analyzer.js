import { initValidation } from './modules/validation.js';
import { initHUD, startAnalysis, isAnalysisProcessing, appendTerminalLog } from './modules/hud.js';
import { initAiConfig } from './modules/ai-config.js';
import { initUiEffects } from './modules/ui-effects.js';

document.addEventListener("DOMContentLoaded", () => {
  // Initialize all modular components
  initValidation();
  initHUD();
  initAiConfig();
  initUiEffects();

  const form = document.getElementById("analyzerForm");
  const input = document.getElementById("repoUrl");

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      
      if (isAnalysisProcessing()) {
        appendTerminalLog("HAY UN ANÁLISIS EN CURSO. POR FAVOR ESPERE.");
        return;
      }

      if (!input) return;
      const repoUrlVal = input.value.trim();
      if (!repoUrlVal) return;

      const friendlyName = repoUrlVal.split("/").pop().replace(".git", "");
      const formData = new FormData(form);

      // Start the analysis workflow
      startAnalysis(repoUrlVal, friendlyName, formData);
    });
  }

  // Handle Django flash messages close buttons
  document.querySelectorAll('.close-msg-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const messageCard = this.parentElement;
      messageCard.style.opacity = '0';
      messageCard.style.transform = 'translateY(-10px)';
      setTimeout(() => {
        messageCard.remove();
        const container = document.querySelector('.messages-container');
        if (container && container.children.length === 0) {
          container.remove();
        }
      }, 300);
    });
  });
});
