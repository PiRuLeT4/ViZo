# analysis.py
# ───────────
# Punto de entrada de la orquestación del análisis local del repositorio en ViZo.

import os
import shutil
import subprocess
import traceback
from colorama import Fore

from .helpers import (
    _temp_dir,
    _cleanup,
    _clone_repo,
    _get_tags_info,
    _get_clean_git_env,
    _get_head_commit,
    _remove_readonly,
)
from .lizard_analysis import _run_lizard
from .evolution_analysis import _run_releases_history, _run_git_history
from .metrics import _process_metrics, _build_repo_summary


def run_analysis(url: str, max_commits: int = 150, analysis_mode: str = "commits", session_id: int = None) -> dict | None:
    """
    Clona el repositorio indicado por `url`, ejecuta el análisis completo
    (Lizard + PyDriller/Git tags) y devuelve un dict con los resultados.
    """
    target_dir = _temp_dir(session_id)

    # Limpieza previa
    if os.path.exists(target_dir):
        shutil.rmtree(target_dir, onerror=_remove_readonly)

    try:
        _clone_repo(url, target_dir)
        repo_name = url.rstrip("/").split("/")[-1].removesuffix(".git")

        if analysis_mode == "releases":
            tags = _get_tags_info(target_dir, max_releases=max_commits)
            if tags:
                last_commit_id = tags[0]["hash"]
                evolution_raw = _run_releases_history(target_dir, tags)
                
                # Checkout al tag más reciente para el análisis estático
                subprocess.run(
                    ["git", "checkout", tags[0]["name"]],
                    capture_output=True,
                    cwd=target_dir,
                    encoding="utf-8",
                    errors="replace",
                    env=_get_clean_git_env()
                )
                analysis = _run_lizard(target_dir)
            else:
                print(Fore.YELLOW + "[Releases Mode] No se encontraron tags locales. Fallback a commits.")
                analysis_mode = "commits"

        if analysis_mode == "commits":
            last_commit_id = _get_head_commit(target_dir)
            analysis = _run_lizard(target_dir)
            evolution_raw = _run_git_history(target_dir, max_commits=max_commits)

        # PASADA ÚNICA: Procesar métricas y lenguajes
        (
            file_metrics,
            data_by_language,
            filenames,
            total_nloc,
            total_ccn,
            language_counts,
            file_ownership,
            age_distribution,
            top_complex_files,
            file_network,
        ) = _process_metrics(analysis, evolution_raw, target_dir)

        main_language = next(iter(language_counts), "unknown")
        print(Fore.CYAN + f"Lenguaje principal: {main_language}")

        repo_summary = _build_repo_summary(
            analysis,
            evolution_raw,
            filenames,
            language_counts,
            total_nloc,
            total_ccn,
        )

        # Lista raw de Lizard (compatibilidad legacy)
        metrics_list = [
            {
                "filename": os.path.basename(f.filename),
                "ccn": f.average_cyclomatic_complexity,
                "nloc": f.nloc,
                "functions": f.function_list,
            }
            for f in analysis
        ]

        return {
            "metrics": metrics_list,
            "evolution_data": evolution_raw["commits"],
            "author_activity": evolution_raw["author_activity"],
            "file_metrics": file_metrics,
            "data_by_language": data_by_language,
            "repo_summary": repo_summary,
            "repo_name": repo_name,
            "last_commit_id": last_commit_id,
            "main_language": main_language,
            "file_ownership": file_ownership,
            "age_distribution": age_distribution,
            "top_complex_files": top_complex_files,
            "file_network": file_network,
        }

    except RuntimeError as e:
        print(Fore.RED + f"Error de clonado/Git: {e}")
        return None
    except Exception as e:
        print(Fore.RED + f"Error general en el análisis: {e}")
        traceback.print_exc()
        return None
    finally:
        _cleanup(target_dir)
