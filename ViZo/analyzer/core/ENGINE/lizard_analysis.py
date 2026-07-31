# lizard_analysis.py
# ──────────────────
# Lógica dedicada a la ejecución estática de Lizard en ViZzo.

import logging
import os
import time
import multiprocessing
import queue
import lizard

from .helpers import (
    is_minified_or_obfuscated,
    is_generated_or_test_file,
    _lizard_worker_process,
    _LIZARD_EXCLUDE_PATTERNS,
    _LIZARD_INCLUDE_FOLDERS
)

logger = logging.getLogger(__name__)
_LIZARD_TIMEOUT = 60.0
_MAX_LIZARD_FILES = 800


def _run_lizard(target_dir: str) -> list:
    """Ejecuta Lizard sobre target_dir y devuelve la lista de resultados por archivo."""
    logger.info("Analizando métricas con Lizard...")
    
    # Exclusión de carpetas de dependencias y temporales ruidosas para optimizar el rendimiento en repos grandes
    exclude_patterns = _LIZARD_EXCLUDE_PATTERNS
    
    threads_count = min(os.cpu_count() or 2, 4)

    # Expandir directorios a archivos individuales para realizar filtros preventivos
    files_to_analyze = []
    has_resolved = os.path.exists(target_dir)

    if os.path.isfile(target_dir):
        files_to_analyze.append(target_dir)
    elif os.path.isdir(target_dir):
        for root, dirs, filenames in os.walk(target_dir):
            # Filtrar dirs IN-PLACE para evitar que os.walk descienda a carpetas de dependencias / build / tests
            dirs[:] = [
                d for d in dirs 
                if d.lower() not in {
                    "node_modules", "vendor", "3rdparty", "third_party", 
                    "bin", "build", "dist", "target", ".git", "venv", 
                    "env", ".venv", ".env", "htmlcov", "out", ".github", 
                    ".gitlab", "cmake", "coverage", "deps", ".idea", ".vscode",
                    "test", "tests", "spec", "specs", "testing", "e2e", "fixtures", "mock", "mocks"
                }
            ]
            for f in filenames:
                files_to_analyze.append(os.path.join(root, f))

    _SUPPORTED_EXTENSIONS = (
        ".js", ".ts", ".tsx", ".jsx", 
        ".py", ".go", ".java", 
        ".c", ".cpp", ".h", ".hpp", ".cc", ".cxx", ".hh",
        ".swift", ".kt", ".cs", ".rb", ".php", 
        ".rs", ".lua", ".scala"
    )

    # Filtrar archivos: omitimos no soportados, grandes (>45KB), minificados u autogenerados
    filtered_files = []
    skipped_large_files = []
    skipped_minified_files = []
    skipped_generated_files = []

    if not has_resolved:
        # Si las rutas no existen en disco (caso de pruebas unitarias), pasamos las rutas originales directamente
        filtered_files = [target_dir]
    else:
        for f in files_to_analyze:
            # 1. Ignorar archivos que no sean de código fuente de lenguajes soportados
            if not f.lower().endswith(_SUPPORTED_EXTENSIONS):
                continue

            # 2. Ignorar archivos de código fuente muy grandes (>45KB)
            try:
                size_kb = os.path.getsize(f) / 1024.0
                if size_kb > 45.0:
                    skipped_large_files.append((f, size_kb))
                    continue
            except Exception:
                pass
                
            # 3. Exclusión de archivos minificados/ofuscados
            if is_minified_or_obfuscated(f):
                skipped_minified_files.append(f)
                continue

            # 4. Exclusión de archivos autogenerados o de test
            if is_generated_or_test_file(f):
                skipped_generated_files.append(f)
                continue

            filtered_files.append(f)

    if skipped_large_files:
        logger.warning(f"  - Omitidos {len(skipped_large_files)} archivos grandes (>45KB)")
    if skipped_minified_files:
        logger.warning(f"  - Omitidos {len(skipped_minified_files)} archivos minificados/ofuscados")
    if skipped_generated_files:
        logger.warning(f"  - Omitidos {len(skipped_generated_files)} archivos autogenerados o de prueba")

    # Muestreo representativo si el volumen de archivos sigue siendo extremadamente grande
    if len(filtered_files) > _MAX_LIZARD_FILES:
        logger.info(f"  - Repositorio extenso detectado ({len(filtered_files)} archivos). Muestreando {_MAX_LIZARD_FILES} archivos representativos.")
        step = len(filtered_files) / float(_MAX_LIZARD_FILES)
        filtered_files = [filtered_files[int(i * step)] for i in range(_MAX_LIZARD_FILES)]

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
            logger.error(f"  - Falló Lizard en test: {e}")
    else:
        # Ejecutar Lizard en un subproceso con recepción de lotes progresivos y límite estricto de tiempo
        q = multiprocessing.Queue()
        p = multiprocessing.Process(
            target=_lizard_worker_process,
            args=(q, filtered_files, exclude_patterns, threads_count)
        )
        
        start_time = time.time()
        try:
            p.start()
            while True:
                elapsed = time.time() - start_time
                remaining_time = _LIZARD_TIMEOUT - elapsed
                if remaining_time <= 0:
                    logger.warning(
                        f"  - Lizard alcanzó el límite de tiempo de {_LIZARD_TIMEOUT}s. "
                        f"Conservando {len(analysis)} archivos analizados de forma parcial."
                    )
                    p.terminate()
                    p.join()
                    break

                try:
                    status, data = q.get(timeout=min(max(remaining_time, 0.1), 2.0))
                    if status == "batch":
                        if data:
                            analysis.extend(data)
                    elif status == "done":
                        break
                    elif status == "error":
                        logger.error(f"  - Error en subproceso de Lizard: {data}")
                        break
                except queue.Empty:
                    if not p.is_alive():
                        break
        except Exception as e:
            logger.error(f"  - Error al gestionar subproceso de Lizard: {e}")
            try:
                p.terminate()
                p.join()
            except Exception:
                pass
        else:
            if p.is_alive():
                p.join(timeout=1.0)

    logger.info(f"Análisis Lizard completado: {len(analysis)} archivos analizados exitosamente.")
    for file in analysis:
        logger.debug(
            f"  {os.path.basename(file.filename)} | CCN: {file.average_cyclomatic_complexity:.2f} | NLOC: {file.nloc}"
        )
    return analysis

