/**
 * translations.js — ViZzo i18n System (ES/EN)
 * Client-side translation with data-i18n attributes.
 */

const TRANSLATIONS = {
  es: {
    // ── Navbar ──
    "nav.home": "Inicio",
    "nav.analyzer": "Analizador",
    "nav.connect": "Conectar Cuenta",
    "nav.logout_title": "Cerrar sesión",

    // ── Home Page ──
    "home.badge": "Plataforma de Análisis de Código",
    "home.title_1": "Análisis Inteligente",
    "home.title_2": "de Repositorios",
    "home.subtitle": "Visualización Inmersiva 3D / VR",
    "home.desc": "Introduce cualquier repositorio Git público o privado y obtén un análisis profundo de complejidad, evolución y calidad del código, representado automáticamente en una escena 3D interactiva impulsada por IA.",
    "home.cta": "Analizar Repositorio",
    "home.cta_arrow": "→",
    "home.cta_secondary": "Saber más",

    // How it works
    "home.how.label": "Cómo funciona",
    "home.how.title": "Tres pasos para visualizar tu código",
    "home.how.desc": "De la URL del repositorio a una sala 3D interactiva en minutos.",
    "home.step1.title": "Introduce la URL",
    "home.step1.desc": "Pega la URL de cualquier repositorio público de GitHub o GitLab. Para repositorios privados, conecta tu cuenta OAuth.",
    "home.step2.title": "La IA Analiza",
    "home.step2.desc": "Nuestro motor extrae métricas de complejidad (Lizard), evolución (PyDriller) y la IA decide los dashboards óptimos.",
    "home.step3.title": "Explora en 3D",
    "home.step3.desc": "Accede a una sala VR con dashboards interactivos: ciudades de código, redes de colaboración, gráficos de barras 3D y más.",

    // Features
    "home.features.label": "Características",
    "home.features.title": "Todo lo que necesitas para entender tu código",

    "home.feat1.title": "Análisis de Complejidad",
    "home.feat1.desc": "Complejidad ciclomática, NLOC, funciones y peak CCN por archivo con Lizard.",
    "home.feat2.title": "Evolución del Código",
    "home.feat2.desc": "Historial de commits o releases, actividad por autor y churn de archivos con PyDriller.",
    "home.feat3.title": "IA Integrada",
    "home.feat3.desc": "Un LLM local decide qué dashboards instanciar y explica los datos en tiempo real.",
    "home.feat4.title": "Visualización 3D / VR",
    "home.feat4.desc": "Escenas inmersivas con A-Frame y BabiaXR: ciudades de código, cilindros, barras 3D y redes.",
    "home.feat5.title": "Repositorios Privados",
    "home.feat5.desc": "Conecta GitHub o GitLab mediante OAuth para analizar repos privados de forma segura.",
    "home.feat6.title": "Análisis de Comunidad",
    "home.feat6.desc": "Pull Requests, Issues, Code Reviews y estabilidad de releases con datos enriquecidos de API.",

    // Footer
    "home.footer": "ViZzo — Plataforma de Análisis Inteligente de Repositorios. Proyecto de TFG.",

    // ── Analyzer Page ──
    "analyzer.panel.public": "Archivo Público",
    "analyzer.panel.private": "Archivo Privado",
    "analyzer.panel.analysis": "Nuevo Análisis",
    "analyzer.form.url_label": "URL del Repositorio",
    "analyzer.form.url_placeholder": "https://github.com/... o https://gitlab.com/...",
    "analyzer.form.submit": "Iniciar Análisis",
    "analyzer.form.helper_default": "Introduce la URL completa del repositorio (GitHub, GitLab, etc.)",
    "analyzer.form.helper_valid": "URL válida detectada",
    "analyzer.form.helper_invalid": "Por favor, introduce una URL válida de repositorio",
    "analyzer.depth.label_commits": "Profundidad de Análisis (Historial de Commits)",
    "analyzer.depth.label_releases": "Profundidad de Análisis (Últimas Releases)",
    "analyzer.depth.all_commits": "TODOS LOS COMMITS",
    "analyzer.depth.all_releases": "TODOS LOS RELEASES",
    "analyzer.mode.commits": "Analizar por Commits",
    "analyzer.mode.releases": "Analizar por Releases",
    "analyzer.depth.fast": "Rápido",
    "analyzer.depth.balanced": "Equilibrado",
    "analyzer.depth.deep": "Profundo",
    "analyzer.depth.all": "Completo",
    "analyzer.private.label": "Analizar repositorio como privado",
    "analyzer.private.hint": "(Inicia sesion para activar)",
    "analyzer.custom_llm.toggle": "Personalizar conexión de IA (Opcional)",
    "analyzer.custom_llm.is_local": "Modelo Local (Sin API Key)",
    "analyzer.custom_llm.url_label": "API Base URL del LLM",
    "analyzer.custom_llm.url_placeholder": "Ej: http://localhost:11434/v1 para Ollama",
    "analyzer.custom_llm.key_label": "API Key",
    "analyzer.custom_llm.key_placeholder": "Clave opcional (Ej: lm-studio u ollama)",
    "analyzer.custom_llm.model_label": "Nombre del Modelo",
    "analyzer.custom_llm.model_placeholder": "Ej: llama3 o qwen2.5-coder",
    "analyzer.custom_llm.modal_title": "Configuración de IA",
    "analyzer.custom_llm.btn_reset": "Restablecer Defecto",
    "analyzer.custom_llm.btn_save": "Guardar y Cerrar",
    "analyzer.custom_llm.title_hint": "Configurar Motor de IA",
    "analyzer.empty.public": "Sin repositorios analizados. Inicie un análisis para inaugurar el portal.",
    "analyzer.empty.private": "Archivo privado sin registros. Analice un repositorio propio configurado como privado.",
    "analyzer.card.enter": "Sala 3D",
    "analyzer.card.enter_tag": "[ENTER]",
    "analyzer.card.secure": "SEGURO",

    // HUD
    "hud.title": "Monitor de Proceso",
    "hud.init": "Inicializando secuencia de análisis...",
    "hud.target": "OBJETIVO:",
    "hud.none": "Ninguno",
    "hud.terminal_init_1": "> INICIANDO SISTEMA VIZZO...",
    "hud.terminal_init_2": "> ESCUCHANDO FLUJO DE DATOS...",
    "hud.cancel": "Cancelar Análisis",
    "hud.room_ready": "Sala 3D Preparada — Entrar",
    "hud.reopen": "Monitor",

    // Login Modal
    "modal.title": "Seleccionar Proveedor",
    "modal.desc": "Selecciona tu proveedor de control de versiones:",
    "modal.github": "Continuar con GitHub",
    "modal.gitlab": "Continuar con GitLab",

    // ── 3D Scene & VR ──
    "scene.status_loading": "ANÁLISIS DE DATOS EN VIVO // CARGANDO...",
    "scene.ai_offline": "[IA_OFFLINE] Servidor de IA local no detectado. Visualización estándar activada.",
    "scene.nav_title": "VOLVER AL ANALIZADOR",
    "scene.nav_sub": "PULSA PARA INICIAR\nOTRO ANÁLISIS",
    "scene.nav_btn": "INICIO",
    "scene.btn_explain": "EXPLICAR",
    "scene.btn_summary": "RESUMEN",
    "scene.btn_problems": "PROBLEMAS",
    "scene.btn_recs": "MEJORAS",
    "scene.btn_show": "MOSTRAR",
    "scene.btn_listen": "ESCUCHAR",
    "scene.vr_assistant_title": "ASISTENTE IA — REPORTE",
    "scene.vr_loading": "Cargando reporte...",
    "scene.vr_close": "CERRAR",
    "scene.vr_prompt_explain": "Pulse el botón 'EXPLICAR' primero para generar la explicación del dashboard.",
    "scene.legend.opacity": "OPACIDAD SUPERFICIE",
    "scene.legend.height": "ALTURA PEDESTAL",
    "scene.legend.scale": "ESCALA PREDETERMINADA",
  },

  en: {
    // ── Navbar ──
    "nav.home": "Home",
    "nav.analyzer": "Analyzer",
    "nav.connect": "Connect Account",
    "nav.logout_title": "Sign out",

    // ── Home Page ──
    "home.badge": "Code Analysis Platform",
    "home.title_1": "Intelligent Analysis",
    "home.title_2": "of Repositories",
    "home.subtitle": "Immersive 3D / VR Visualization",
    "home.desc": "Enter any public or private Git repository and get a deep analysis of complexity, evolution and code quality, automatically rendered in an interactive AI-powered 3D scene.",
    "home.cta": "Analyze Repository",
    "home.cta_arrow": "→",
    "home.cta_secondary": "Learn more",

    // How it works
    "home.how.label": "How it works",
    "home.how.title": "Three steps to visualize your code",
    "home.how.desc": "From repository URL to interactive 3D room in minutes.",
    "home.step1.title": "Enter the URL",
    "home.step1.desc": "Paste the URL of any public GitHub or GitLab repository. For private repos, connect your OAuth account.",
    "home.step2.title": "AI Analyzes",
    "home.step2.desc": "Our engine extracts complexity metrics (Lizard), evolution (PyDriller) and the AI decides the optimal dashboards.",
    "home.step3.title": "Explore in 3D",
    "home.step3.desc": "Access a VR room with interactive dashboards: code cities, collaboration networks, 3D bar charts and more.",

    // Features
    "home.features.label": "Features",
    "home.features.title": "Everything you need to understand your code",

    "home.feat1.title": "Complexity Analysis",
    "home.feat1.desc": "Cyclomatic complexity, NLOC, functions and peak CCN per file with Lizard.",
    "home.feat2.title": "Code Evolution",
    "home.feat2.desc": "Commit or release history, author activity and file churn with PyDriller.",
    "home.feat3.title": "Integrated AI",
    "home.feat3.desc": "A local LLM decides which dashboards to create and explains the data in real time.",
    "home.feat4.title": "3D / VR Visualization",
    "home.feat4.desc": "Immersive scenes with A-Frame and BabiaXR: code cities, cylinders, 3D bars and networks.",
    "home.feat5.title": "Private Repositories",
    "home.feat5.desc": "Connect GitHub or GitLab via OAuth to securely analyze private repos.",
    "home.feat6.title": "Community Analysis",
    "home.feat6.desc": "Pull Requests, Issues, Code Reviews and release stability with enriched API data.",

    // Footer
    "home.footer": "ViZzo — Intelligent Repository Analysis Platform. BSc Thesis Project.",

    // ── Analyzer Page ──
    "analyzer.panel.public": "Public Archive",
    "analyzer.panel.private": "Private Archive",
    "analyzer.panel.analysis": "New Analysis",
    "analyzer.form.url_label": "Repository URL",
    "analyzer.form.url_placeholder": "https://github.com/... or https://gitlab.com/...",
    "analyzer.form.submit": "Start Analysis",
    "analyzer.form.helper_default": "Enter the full repository URL (GitHub, GitLab, etc.)",
    "analyzer.form.helper_valid": "Valid URL detected",
    "analyzer.form.helper_invalid": "Please enter a valid repository URL",
    "analyzer.depth.label_commits": "Analysis Depth (Commit History)",
    "analyzer.depth.label_releases": "Analysis Depth (Latest Releases)",
    "analyzer.depth.all_commits": "ALL COMMITS",
    "analyzer.depth.all_releases": "ALL RELEASES",
    "analyzer.mode.commits": "Analyze by Commits",
    "analyzer.mode.releases": "Analyze by Releases",
    "analyzer.depth.fast": "Fast",
    "analyzer.depth.balanced": "Balanced",
    "analyzer.depth.deep": "Deep",
    "analyzer.depth.all": "Full",
    "analyzer.private.label": "Analyze repository as private",
    "analyzer.private.hint": "(Connect account to enable)",
    "analyzer.custom_llm.toggle": "Customize AI Connection (Optional)",
    "analyzer.custom_llm.is_local": "Local Model (No API Key)",
    "analyzer.custom_llm.url_label": "LLM API Base URL",
    "analyzer.custom_llm.url_placeholder": "e.g. http://localhost:11434/v1 for Ollama",
    "analyzer.custom_llm.key_label": "API Key",
    "analyzer.custom_llm.key_placeholder": "Optional Key (e.g. lm-studio or ollama)",
    "analyzer.custom_llm.model_label": "Model Name",
    "analyzer.custom_llm.model_placeholder": "e.g. llama3 or qwen2.5-coder",
    "analyzer.custom_llm.modal_title": "AI Configuration",
    "analyzer.custom_llm.btn_reset": "Reset Default",
    "analyzer.custom_llm.btn_save": "Save & Close",
    "analyzer.custom_llm.title_hint": "Configure AI Engine",
    "analyzer.empty.public": "No analyzed repositories. Start an analysis to begin.",
    "analyzer.empty.private": "Private archive empty. Analyze a private repository to begin.",
    "analyzer.card.enter": "3D Room",
    "analyzer.card.enter_tag": "[ENTER]",
    "analyzer.card.secure": "SECURE",

    // HUD
    "hud.title": "Process Monitor",
    "hud.init": "Initializing analysis sequence...",
    "hud.target": "TARGET:",
    "hud.none": "None",
    "hud.terminal_init_1": "> STARTING VIZZO SYSTEM...",
    "hud.terminal_init_2": "> LISTENING FOR DATA STREAM...",
    "hud.cancel": "Cancel Analysis",
    "hud.room_ready": "3D Room Ready — Enter",
    "hud.reopen": "Monitor",

    // Login Modal
    "modal.title": "Select Provider",
    "modal.desc": "Select your version control provider:",
    "modal.github": "Continue with GitHub",
    "modal.gitlab": "Continue with GitLab",

    // ── 3D Scene & VR ──
    "scene.status_loading": "LIVE DATA ANALYSIS // LOADING...",
    "scene.ai_offline": "[AI_OFFLINE] Local AI server not detected. Standard visualization active.",
    "scene.nav_title": "BACK TO ANALYZER",
    "scene.nav_sub": "CLICK TO START\nANOTHER ANALYSIS",
    "scene.nav_btn": "HOME",
    "scene.btn_explain": "EXPLAIN",
    "scene.btn_summary": "SUMMARY",
    "scene.btn_problems": "PROBLEMS",
    "scene.btn_recs": "RECOMMENDATIONS",
    "scene.btn_show": "SHOW",
    "scene.btn_listen": "LISTEN",
    "scene.vr_assistant_title": "AI ASSISTANT — REPORT",
    "scene.vr_loading": "Loading report...",
    "scene.vr_close": "CLOSE",
    "scene.vr_prompt_explain": "Click the 'EXPLAIN' button first to generate the dashboard explanation.",
    "scene.legend.opacity": "SURFACE OPACITY",
    "scene.legend.height": "PEDESTAL HEIGHT",
    "scene.legend.scale": "DEFAULT SCALE",
  }
};

/**
 * Apply translations to all elements with data-i18n attribute.
 * @param {string} lang - Language code ('es' or 'en')
 */
function setLanguage(lang) {
  if (!TRANSLATIONS[lang]) lang = 'es';
  
  localStorage.setItem('vizzo_lang', lang);
  document.documentElement.lang = lang;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const translation = TRANSLATIONS[lang][key];
    if (translation !== undefined) {
      if (el.tagName === 'INPUT' && el.type !== 'submit') {
        el.placeholder = translation;
      } else {
        el.textContent = translation;
      }
    }
  });

  // Translate tooltips and titles
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    const translation = TRANSLATIONS[lang][key];
    if (translation !== undefined) {
      el.title = translation;
    }
  });

  // Update the active indicator in language dropdown
  document.querySelectorAll('.lang-option').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.lang === lang);
  });

  // Update the language code display in the toggle button
  const langCodeEl = document.querySelector('.lang-code');
  if (langCodeEl) {
    langCodeEl.textContent = lang.toUpperCase();
  }
}

/**
 * Get current active language code ('es' or 'en').
 * @returns {string}
 */
function getLang() {
  return localStorage.getItem('vizzo_lang') || 'es';
}

/**
 * Get a single translation string by key.
 * @param {string} key
 * @returns {string}
 */
function t(key) {
  const lang = getLang();
  return TRANSLATIONS[lang]?.[key] || TRANSLATIONS['es']?.[key] || key;
}

// Expose i18n utilities globally on window object
window.getLang = getLang;
window.setLanguage = setLanguage;
window.t = t;

/**
 * Initialize i18n system on DOMContentLoaded.
 */
document.addEventListener('DOMContentLoaded', () => {
  const savedLang = localStorage.getItem('vizzo_lang') || 'es';
  setLanguage(savedLang);

  // ── Language dropdown toggle ──
  const langToggle = document.querySelector('.lang-selector .lang-toggle-btn');
  const langDropdown = document.querySelector('.lang-dropdown');

  if (langToggle && langDropdown) {
    langToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      langDropdown.classList.toggle('open');
    });

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.lang-selector')) {
        langDropdown.classList.remove('open');
      }
    });

    // Language option click
    document.querySelectorAll('.lang-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const lang = opt.dataset.lang;
        setLanguage(lang);
        langDropdown.classList.remove('open');
      });
    });
  }

  // ── Login modal handlers (global) ──
  const loginModal = document.getElementById('vizzoLoginModal');
  const openLoginModalBtn = document.getElementById('openLoginModalBtn');
  const closeLoginModalBtn = document.getElementById('closeLoginModalBtn');

  if (loginModal && openLoginModalBtn) {
    openLoginModalBtn.addEventListener('click', (e) => {
      e.preventDefault();
      loginModal.classList.add('active');
    });
  }

  if (loginModal && closeLoginModalBtn) {
    closeLoginModalBtn.addEventListener('click', () => {
      loginModal.classList.remove('active');
    });

    loginModal.addEventListener('click', (e) => {
      if (e.target === loginModal) {
        loginModal.classList.remove('active');
      }
    });
  }

  // ── Django flash messages close buttons ──
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

  // ── Navbar scroll effect ──
  const navbar = document.querySelector('.vizzo-navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 10);
    });
  }
});
