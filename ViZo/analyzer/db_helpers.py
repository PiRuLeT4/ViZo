"""
db_helpers.py
─────────────
Funciones auxiliares para leer y escribir sesiones de análisis en la BD.
Están separadas aquí para mantener services.py limpio y orientado a orquestación.
"""

from colorama import Fore

from .ai_engine import normalize_data
from .models import AnalysisSession, FileMetric, LanguageMetric, Repository


def build_result_from_session(session: AnalysisSession) -> dict:
    """Reconstruye el dict de resultado a partir de una AnalysisSession ya guardada en BD."""
    file_metrics_raw = [fm.to_dict() for fm in session.file_metrics.all()]
    file_metrics = normalize_data(file_metrics_raw)  # añade height/area
    data_by_language = [lm.to_dict() for lm in session.language_metrics.all()]
    print(
        Fore.CYAN
        + f"[Cache] Datos cargados desde BD (session id={session.pk}, commit={session.last_commit_id[:8]})"
    )
    return {
        "metrics": file_metrics,
        "evolution_data": {},
        "file_metrics": file_metrics,
        "data_by_language": data_by_language,
        "ai_config": session.ai_config,
        "from_cache": True,
    }


def save_session(
    repo_obj: Repository,
    last_commit_id: str,
    file_metrics: list,
    data_by_language: list,
    ai_config: dict,
    repo_summary: dict,
) -> AnalysisSession:
    """Persiste una nueva AnalysisSession con todas sus métricas en la BD."""
    session = AnalysisSession.objects.create(
        repo=repo_obj,
        last_commit_id=last_commit_id,
        ai_config=ai_config,
        repo_summary=repo_summary,
    )

    # Métricas por archivo
    file_metric_objs = [
        FileMetric(
            session=session,
            file_name=entry["id"],
            language=entry.get("language", ""),
            nloc=entry.get("nloc", 0),
            ccn=entry.get("ccn", 0.0),
            commits=entry.get("commits", 0),
        )
        for entry in file_metrics
    ]
    FileMetric.objects.bulk_create(file_metric_objs)

    # Métricas por lenguaje
    lang_metrics = [
        LanguageMetric(
            session=session,
            language=entry["language"],
            nloc=entry.get("nloc", 0),
            ccn=entry.get("ccn", 0.0),
            commits=entry.get("commits", 0),
            count=entry.get("count", 0),
        )
        for entry in data_by_language
    ]
    LanguageMetric.objects.bulk_create(lang_metrics)

    print(
        Fore.GREEN
        + f"[DB] Sesión guardada (id={session.pk}) con {len(file_metric_objs)} archivos y {len(lang_metrics)} lenguajes."
    )
    return session
