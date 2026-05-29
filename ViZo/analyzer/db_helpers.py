"""
db_helpers.py
─────────────
Funciones auxiliares para leer y escribir sesiones de análisis en la BD.
Están separadas aquí para mantener services.py limpio y orientado a orquestación.
"""

from colorama import Fore

from .models import AnalysisSession, FileMetric, LanguageMetric, Repository


def build_result_from_session(session: AnalysisSession) -> dict:
    """Reconstruye el dict de resultado a partir de una AnalysisSession ya guardada en BD."""
    file_metrics = [fm.to_dict() for fm in session.file_metrics.all()]
    data_by_language = [lm.to_dict() for lm in session.language_metrics.all()]
    print(
        Fore.CYAN
        + f"[Cache] Datos cargados desde BD (session id={session.pk}, commit={session.last_commit_id[:8]})"
    )
    
    author_activity = session.author_activity
    # Lógica de autocuración para sesiones antiguas donde author_activity no estaba persistido
    if not author_activity and session.evolution_data:
        print(Fore.YELLOW + "[Cache Warning] 'author_activity' vacío en base de datos. Reconstruyendo retroactivamente...")
        activity_dict = {}
        for commit in session.evolution_data:
            author = commit.get("author", "Unknown")
            date = commit.get("date", "")
            insertions = commit.get("insertions", 0)

            key = (author, date)
            if key not in activity_dict:
                activity_dict[key] = {
                    "author": author,
                    "date": date,
                    "commits": 0,
                    "insertions": 0,
                }
            activity_dict[key]["commits"] += 1
            activity_dict[key]["insertions"] += insertions

        author_activity = list(activity_dict.values())
        all_dates = sorted(
            list(set(item["date"] for item in author_activity if item["date"])),
            reverse=True,
        )
        recent_dates = set(all_dates[:15])
        author_activity = [
            item for item in author_activity if item["date"] in recent_dates
        ]
        
        # Persistimos la autocuración para evitar futuros recálculos
        session.author_activity = author_activity
        session.save(update_fields=["author_activity"])
        print(Fore.GREEN + "[Cache Success] 'author_activity' reconstruido y persistido.")

    return {
        "repo_name": session.repo.name,
        "metrics": file_metrics,
        "evolution_data": session.evolution_data,
        "author_activity": author_activity,
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
    evolution_data: list,
    ai_config: dict,
    repo_summary: dict,
    author_activity: list,
) -> AnalysisSession:
    """Persiste una nueva AnalysisSession con todas sus métricas en la BD."""
    session = AnalysisSession.objects.create(
        repo=repo_obj,
        last_commit_id=last_commit_id,
        ai_config=ai_config,
        repo_summary=repo_summary,
        evolution_data=evolution_data,
        author_activity=author_activity,
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
