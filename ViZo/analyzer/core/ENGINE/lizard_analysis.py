# lizard_analysis.py
# ──────────────────
# Lógica dedicada a la ejecución estática de Lizard en ViZo.

import os
import multiprocessing
import lizard
from colorama import Fore


def _run_lizard(target_dir: str) -> list:
    """Ejecuta Lizard sobre target_dir y devuelve la lista de resultados por archivo."""
    print(Fore.YELLOW + "Analizando métricas con Lizard...")
    
    # Exclusión de carpetas de dependencias y temporales ruidosas para optimizar el rendimiento en repos grandes
    exclude_patterns = [
        "*/node_modules/*",
        "*/vendor/*",
        "*/3rdparty/*",
        "*/third_party/*",
        "*/bin/*",
        "*/build/*",
        "*/dist/*",
        "*/target/*",
        "*/.git/*",
        "*/venv/*",
        "*/env/*",
        "*/.venv/*",
        "*/.env/*",
        "*/htmlcov/*",
        "*/out/*",
        "*/media/*",
        "*/regression/*",
        "*/os/*",
        "*/.github/*",
        "*/.gitlab/*",
        "*/cmake/*",
    ]
    
    # Usar hilos paralelos para acelerar la lectura de archivos (E/S)
    try:
        threads_count = multiprocessing.cpu_count()
    except Exception:
        threads_count = 4

    # Filtrar para analizar solo carpetas de código fuente comunes si existen (estrategia de inclusión)
    include_folders = [
        # --- Genéricos y ya existentes ---
        "src", "lib", "app", "source", "core", "components", "pkg", "cmd", "include", "apps", "sources",
        
        # --- Django / Python / Backends Web ---
        "api",          # Muy común para microservicios y endpoints separados
        "modules",      # Arquitecturas modulares
        "services",     # Capas de lógica de negocio aisladas
        "controllers",  # Patrón MVC tradicional (Node/Express, PHP, C#)
        "routes",       # Definición de endpoints en arquitecturas web
        "models",       # Modelos de bases de datos u ORM
        "views",        # Vistas de backend (Django o controladores MVC)
        "backend",      # Proyectos monorepo que dividen backend/frontend
        "server",       # Común en entornos JavaScript/Node
        
        # --- Frontend / Web Apps ---
        "frontend",     # Proyectos monorepo que dividen backend/frontend
        "client",       # Entornos JS/TS fullstack (MERN, MEAN)
        "pages",        # Next.js (antiguo), Nuxt, Gatsby
        "public/js",    # Solo la subcarpeta de scripts si existe en el entorno público
        "assets/js",    # Assets tradicionales que contienen scripts legibles
        "scripts",      # Scripts de automatización, utilidades o builds del proyecto
        
        # --- Lenguajes de Sistemas (Rust, Go, C++, C#) ---
        "internal",     # Estándar estricto en Go (código que no se expone externamente)
        "common",       # Utilidades y código compartido entre subproyectos
        "utils",        # Funciones auxiliares genéricas que suelen acumular mucha lógica
        "plugins",      # Extensiones o módulos inyectables
        "handlers",     # Procesadores de eventos o peticiones (Go, AWS Lambda, Serverless)
    ]
    paths_to_analyze = []
    for folder in include_folders:
        folder_path = os.path.join(target_dir, folder)
        if os.path.isdir(folder_path):
            paths_to_analyze.append(folder_path)

    if not paths_to_analyze:
        paths_to_analyze = [target_dir]
    else:
        print(Fore.CYAN + f"  - Analizando de forma exclusiva directorios seleccionados: {[os.path.basename(p) for p in paths_to_analyze]}")

    # Expandir directorios a archivos individuales para realizar filtros preventivos
    files_to_analyze = []
    has_resolved = False
    for p in paths_to_analyze:
        if os.path.isfile(p):
            files_to_analyze.append(p)
            has_resolved = True
        elif os.path.isdir(p):
            has_resolved = True
            for root, dirs, filenames in os.walk(p):
                # Filtrar dirs IN-PLACE para evitar que os.walk descienda a carpetas excluidas
                dirs[:] = [
                    d for d in dirs 
                    if d not in {
                        "node_modules", "vendor", "3rdparty", "third_party", 
                        "bin", "build", "dist", "target", ".git", "venv", 
                        "env", ".venv", ".env", "htmlcov", "out", ".github", 
                        ".gitlab", "cmake"
                    }
                ]
                for f in filenames:
                    files_to_analyze.append(os.path.join(root, f))

    # Filtrar archivos: omitimos archivos JS/TS muy grandes (>50KB) que pueden causar bucles infinitos en Lizard
    filtered_files = []
    skipped_large_files = []

    if not has_resolved:
        # Si las rutas no existen en disco (caso de pruebas unitarias), pasamos las rutas originales directamente
        filtered_files = paths_to_analyze
    else:
        for f in files_to_analyze:
            if f.endswith((".js", ".ts", ".tsx", ".jsx")):
                try:
                    size_kb = os.path.getsize(f) / 1024.0
                    if size_kb > 50.0:
                        skipped_large_files.append((f, size_kb))
                        continue
                except Exception:
                    pass
            filtered_files.append(f)

    if skipped_large_files:
        print(Fore.RED + f"  - [Advertencia] Omitidos {len(skipped_large_files)} archivos JS/TS grandes (>50KB) para evitar bloqueos del analizador:")
        for lf, size in skipped_large_files:
            print(Fore.RED + f"    * {os.path.basename(lf)} ({size:.1f} KB)")

    analysis = list(
        lizard.analyze(
            filtered_files,
            exclude_pattern=exclude_patterns,
            threads=threads_count
        )
    )
    for file in analysis:
        print(
            Fore.BLUE
            + f"  {os.path.basename(file.filename)} | CCN: {file.average_cyclomatic_complexity:.2f} | NLOC: {file.nloc}"
        )
    return analysis
