# cache.py
# ────────
# Gestión de persistencia y caché de base de datos para sesiones de análisis.

import logging
from analyzer.models import Repository
from analyzer.persistence.queries import build_result_from_session, save_session

logger = logging.getLogger(__name__)


def _check_cache(url: str, latest_commit_id: str, analysis_mode: str = "commits") -> dict | None:
    """
    Comprueba si existe en BD una sesión para `url` con el commit `latest_commit_id`.
    Devuelve el resultado cacheado o None si no hay caché válida.
    """
    try:
        repo_obj = Repository.objects.get(url=url)
        latest_session = repo_obj.sessions.first()  # ordering=[-analysis_date]
        if (latest_session 
            and latest_session.last_commit_id == latest_commit_id 
            and getattr(latest_session, 'analysis_mode', 'commits') == analysis_mode):
            logger.info(f"[Cache HIT] Repo '{repo_obj.name}' sin cambios. Usando datos de BD.")
            return build_result_from_session(latest_session)
        else:
            logger.info(f"[Cache MISS] Repo '{repo_obj.name}' tiene nuevos commits. Re-analizando...")
    except Repository.DoesNotExist:
        logger.info(f"[Cache MISS] Repo nuevo: {url}. Analizando por primera vez...")
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
        analysis_result["evolution_data"],
        ai_config,
        analysis_result["repo_summary"],
        analysis_result["author_activity"],
        file_ownership=analysis_result.get("file_ownership", []),
        age_distribution=analysis_result.get("age_distribution", []),
        top_complex_files=analysis_result.get("top_complex_files", []),
        file_network=analysis_result.get("file_network", []),
    )
