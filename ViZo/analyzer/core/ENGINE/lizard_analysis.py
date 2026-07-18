# lizard_analysis.py
# ──────────────────
# Lógica dedicada a la ejecución estática de Lizard en ViZzo.

import os
import multiprocessing
import queue
import lizard
from colorama import Fore

from .helpers import (
    is_minified_or_obfuscated,
    _lizard_worker_process,
    _LIZARD_EXCLUDE_PATTERNS,
    _LIZARD_INCLUDE_FOLDERS
)


def _run_lizard(target_dir: str) -> list:
    """Ejecuta Lizard sobre target_dir y devuelve la lista de resultados por archivo."""
    print(Fore.YELLOW + "Analizando métricas con Lizard...")
    
    # Exclusión de carpetas de dependencias y temporales ruidosas para optimizar el rendimiento en repos grandes
    exclude_patterns = _LIZARD_EXCLUDE_PATTERNS
    
    # Usar un único hilo dentro del subproceso aislado para evitar la creación de pools
    # de procesos anidados en Windows, previniendo errores de canalización (BrokenPipeError).
    threads_count = 1

    # Filtrar para analizar solo carpetas de código fuente comunes si existen (estrategia de inclusión)
    paths_to_analyze = []
    for folder in _LIZARD_INCLUDE_FOLDERS:
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
    skipped_minified_files = []

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
                
                # Exclusión preventiva de archivos minificados/ofuscados
                if is_minified_or_obfuscated(f):
                    skipped_minified_files.append(f)
                    continue
            filtered_files.append(f)

    if skipped_large_files:
        print(Fore.RED + f"  - [Advertencia] Omitidos {len(skipped_large_files)} archivos JS/TS grandes (>50KB) para evitar bloqueos del analizador:")
        for lf, size in skipped_large_files:
            print(Fore.RED + f"    * {os.path.basename(lf)} ({size:.1f} KB)")

    if skipped_minified_files:
        print(Fore.RED + f"  - [Advertencia] Omitidos {len(skipped_minified_files)} archivos JS/TS minificados/ofuscados preventivamente:")
        for mf in skipped_minified_files:
            print(Fore.RED + f"    * {os.path.basename(mf)}")

    # Ejecutar Lizard
    analysis = []
    import sys
    if "test" in sys.argv:
        # En entorno de pruebas unitarias, corremos en el mismo proceso para que funcionen los mocks
        try:
            analysis = list(
                lizard.analyze(
                    filtered_files,
                    exclude_pattern=exclude_patterns,
                    threads=threads_count
                )
            )
        except Exception as e:
            print(Fore.RED + f"  - [ERROR] Falló Lizard en test: {e}")
    else:
        # Ejecutar Lizard en un subproceso con un límite estricto de tiempo (Timeout de 30 segundos)
        q = multiprocessing.Queue()
        p = multiprocessing.Process(
            target=_lizard_worker_process,
            args=(q, filtered_files, exclude_patterns, threads_count)
        )
        
        try:
            p.start()
            # Esperar un máximo de 30 segundos
            status, result = q.get(timeout=30.0)
            if status == "success":
                analysis = result
            else:
                print(Fore.RED + f"  - [ERROR] Falló el subproceso de Lizard: {result}")
        except queue.Empty:
            print(Fore.RED + "  - [ERROR] Lizard se ha bloqueado (Timeout de 30s excedido). Matando subproceso y continuando con fallback.")
            p.terminate()
            p.join()
        except Exception as e:
            print(Fore.RED + f"  - [ERROR] Ocurrió un error al ejecutar Lizard: {e}")
            p.terminate()
            p.join()
        else:
            p.join()

    for file in analysis:
        print(
            Fore.BLUE
            + f"  {os.path.basename(file.filename)} | CCN: {file.average_cyclomatic_complexity:.2f} | NLOC: {file.nloc}"
        )
    return analysis
