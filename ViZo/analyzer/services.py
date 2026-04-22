"""
services.py
───────────
Orquestador principal del flujo de análisis de ViZo.

Responsabilidades:
  1. Obtener el HEAD remoto sin clonar (ls-remote) para decidir si usar caché.
  2. Si hay caché válida → devolver datos de BD directamente.
  3. Si no hay caché → delegar el análisis a analyzer_core, obtener la config
     de la IA desde ai_engine y persistir los resultados en BD con db_helpers.

Este módulo NO contiene lógica de análisis, persistence ni IA: solo coordinación.
"""

import json
import os
import subprocess

from colorama import Fore, init

from .ai_engine import get_ai_config
from .analyzer_core import run_analysis
from .db_helpers import build_result_from_session, save_session
from .models import Repository

init(autoreset=True)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers privados
# ─────────────────────────────────────────────────────────────────────────────


def _get_remote_head(url: str) -> str | None:
    """
    Obtiene el hash del commit HEAD del repo remoto usando git ls-remote,
    sin necesidad de clonar. Devuelve None si falla.
    """
    try:
        result = subprocess.run(
            ["git", "ls-remote", "--quiet", "--exit-code", url, "HEAD"],
            capture_output=True,
            text=True,
            timeout=15,
            env={**os.environ, "GIT_TERMINAL_PROMPT": "0"},
        )
        if result.returncode == 0 and result.stdout:
            # Formato de salida: "<hash>\tHEAD"
            return result.stdout.split()[0]
    except Exception as e:
        print(Fore.YELLOW + f"[Git ls-remote] No disponible: {e}")
    return None


def _check_cache(url: str, latest_commit_id: str) -> dict | None:
    """
    Comprueba si existe en BD una sesión para `url` con el commit `latest_commit_id`.
    Devuelve el resultado cacheado o None si no hay caché válida.
    """
    try:
        repo_obj = Repository.objects.get(url=url)
        latest_session = repo_obj.sessions.first()  # ordering=[-analysis_date]
        if latest_session and latest_session.last_commit_id == latest_commit_id:
            print(
                Fore.GREEN
                + f"[Cache HIT] Repo '{repo_obj.name}' sin cambios. Usando datos de BD."
            )
            return build_result_from_session(latest_session)
        else:
            print(
                Fore.YELLOW
                + f"[Cache MISS] Repo '{repo_obj.name}' tiene nuevos commits. Re-analizando..."
            )
    except Repository.DoesNotExist:
        print(
            Fore.YELLOW
            + f"[Cache MISS] Repo nuevo: {url}. Analizando por primera vez..."
        )
    return None


def _persist_results(
    url: str,
    analysis_result: dict,
    ai_config: dict,
) -> None:
    """
    Crea o actualiza el objeto Repository y persiste la nueva AnalysisSession en BD.
    """
    repo_name = analysis_result["repo_name"]
    main_language = analysis_result["main_language"]
    last_commit_id = analysis_result["last_commit_id"]

    repo_obj, created = Repository.objects.get_or_create(
        url=url,
        defaults={"name": repo_name, "main_language": main_language},
    )
    if not created and repo_obj.main_language != main_language:
        repo_obj.main_language = main_language
        repo_obj.save(update_fields=["main_language"])

    save_session(
        repo_obj,
        last_commit_id,
        analysis_result["file_metrics"],
        analysis_result["data_by_language"],
        ai_config,
        analysis_result["repo_summary"],
    )


# ─────────────────────────────────────────────────────────────────────────────
# Función pública principal
# ─────────────────────────────────────────────────────────────────────────────


def analyze_repository(url: str) -> dict | None:
    """
    Punto de entrada principal que la vista llama directamente.

    Flujo:
      1. Obtiene el HEAD remoto (sin clonar) para determinar el commit actual.
      2. Si el commit coincide con la sesión más reciente en BD → caché HIT.
      3. Si no → análisis completo (clonado, Lizard, GitPython, IA) + guardado en BD.

    Devuelve un dict con:
        - file_metrics      : métricas por archivo (para BabiaXR)
        - data_by_language  : métricas por lenguaje (para BabiaXR)
        - ai_config         : configuración visual elegida por la IA
        - metrics           : lista raw de Lizard
        - evolution_data    : historial de commits
        - from_cache        : bool

    O None si ocurre un error irrecuperable.
    """
    # ── Paso 1: Intentar obtener HEAD sin clonar ──────────────────────────────
    latest_commit_id = _get_remote_head(url)

    if latest_commit_id:
        cached = _check_cache(url, latest_commit_id)
        if cached:
            return cached
    else:
        print(
            Fore.YELLOW
            + "[Git] No se pudo obtener HEAD remoto. Se procederá con análisis completo."
        )

    # ── Paso 2: Análisis completo ─────────────────────────────────────────────
    analysis_result = run_analysis(url)
    if analysis_result is None:
        return None

    # ── Paso 3: Obtener configuración de la IA ─────────────────────────────────
    print(Fore.MAGENTA + "Enviando resumen a la IA (LM Studio)...")
    ai_config = get_ai_config(json.dumps(analysis_result["repo_summary"]))

    # ── Paso 4: Persistir en BD ───────────────────────────────────────────────
    _persist_results(url, analysis_result, ai_config)

    # ── Paso 5: Componer y devolver resultado ─────────────────────────────────
    return {
        "metrics": analysis_result["metrics"],
        "evolution_data": analysis_result["evolution_data"],
        "file_metrics": analysis_result["file_metrics"],
        "data_by_language": analysis_result["data_by_language"],
        "ai_config": ai_config,
        "from_cache": False,
    }
