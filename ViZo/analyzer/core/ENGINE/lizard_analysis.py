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
    ]
    
    # Usar hilos paralelos para acelerar la lectura de archivos (E/S)
    try:
        threads_count = multiprocessing.cpu_count()
    except Exception:
        threads_count = 4

    analysis = list(
        lizard.analyze(
            [target_dir],
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
