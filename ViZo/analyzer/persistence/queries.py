"""
queries.py
──────────
Funciones de persistencia y consultas para la base de datos de ViZzo.
SSOT (Single Source of Truth) para la persistencia del análisis.
"""
import logging
from analyzer.models import AnalysisSession, FileMetric, LanguageMetric, Repository

logger = logging.getLogger(__name__)


def build_result_from_session(session: AnalysisSession) -> dict:
    """Reconstruye el dict de resultado a partir de una AnalysisSession ya guardada en BD."""
    file_metrics = [fm.to_dict() for fm in session.file_metrics.all()]
    data_by_language = [lm.to_dict() for lm in session.language_metrics.all()]
    logger.debug(f"[Cache] Datos cargados desde BD (session id={session.pk}, commit={session.last_commit_id[:8]})")
    
    author_activity = session.author_activity
    # Lógica de autocuración para sesiones antiguas donde author_activity no estaba persistido
    if not author_activity and session.evolution_data:
        logger.warning("[Cache Warning] 'author_activity' vacío en base de datos. Reconstruyendo retroactivamente...")
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
        logger.info("[Cache Success] 'author_activity' reconstruido y persistido.")

    top_churn_files = session.repo_summary.get("top_churn_files") if isinstance(session.repo_summary, dict) else None
    if not top_churn_files and file_metrics:
        sorted_by_churn = sorted(file_metrics, key=lambda x: x.get("commits", 0), reverse=True)
        top_churn_files = [
            {
                "name": f["name"] if "name" in f else (f["id"].split("/")[-1] if "id" in f else "unknown"),
                "commits": f["commits"],
                "nloc": f["nloc"]
            }
            for f in sorted_by_churn[:10]
        ]

    return {
        "repo_name": session.repo.name,
        "metrics": file_metrics,
        "evolution_data": session.evolution_data,
        "author_activity": author_activity,
        "file_metrics": file_metrics,
        "data_by_language": data_by_language,
        "ai_config": session.ai_config,
        "repo_summary": session.repo_summary or {},
        "file_ownership": session.file_ownership or [],
        "age_distribution": session.age_distribution or [],
        "top_complex_files": session.top_complex_files or [],
        "file_network": session.file_network or [],
        "top_churn_files": top_churn_files or [],
        "analysis_mode": getattr(session, "analysis_mode", "commits"),
        "pull_requests": getattr(session, "pull_requests", []),
        "issues": getattr(session, "issues", []),
        "from_cache": True,
    }


def get_latest_active_sessions(limit: int = 10) -> list:
    """
    Selector centralizado de persistencia. Recupera las últimas sesiones
    públicas completadas agrupadas por repositorio único.
    """
    sessions = AnalysisSession.objects.filter(status="completed", repo__is_private=False).select_related("repo").order_by("-analysis_date")
    unique_sessions = []
    seen_repos = set()
    for s in sessions:
        if s.repo_id not in seen_repos:
            unique_sessions.append(s)
            seen_repos.add(s.repo_id)
            if len(unique_sessions) >= limit:
                break
    return unique_sessions


def get_user_active_sessions(user, limit: int = 5) -> list:
    """
    Recupera el historial de repositorios privados analizados del usuario autenticado.
    """
    if not user or not user.is_authenticated:
        return []
        
    sessions = AnalysisSession.objects.filter(
        status="completed", 
        repo__is_private=True,
        repo__user=user
    ).select_related("repo").order_by("-analysis_date")
    
    unique_sessions = []
    seen_repos = set()
    for s in sessions:
        if s.repo_id not in seen_repos:
            unique_sessions.append(s)
            seen_repos.add(s.repo_id)
            if len(unique_sessions) >= limit:
                break
    return unique_sessions


def save_session(
    repo_obj: Repository,
    last_commit_id: str,
    file_metrics: list,
    data_by_language: list,
    evolution_data: list,
    ai_config: dict,
    repo_summary: dict,
    author_activity: list,
    file_ownership: list = None,
    age_distribution: list = None,
    top_complex_files: list = None,
    file_network: list = None,
    analysis_mode: str = "commits",
    session_obj: AnalysisSession = None,
    pull_requests: list = None,
    issues: list = None,
    top_churn_files: list = None,
) -> AnalysisSession:
    """
    Persiste o actualiza una AnalysisSession con todas sus métricas asociadas.
    SSOT (Single Source of Truth) para la persistencia del análisis.
    """
    if top_churn_files is not None and isinstance(repo_summary, dict):
        repo_summary["top_churn_files"] = top_churn_files

    if session_obj:
        # Modo actualización (para flujos asíncronos que pre-crearon la sesión en 'pending')
        session = session_obj
        session.last_commit_id = last_commit_id
        session.ai_config = ai_config
        session.repo_summary = repo_summary
        session.evolution_data = evolution_data
        session.author_activity = author_activity
        session.analysis_mode = analysis_mode
        if file_ownership is not None:
            session.file_ownership = file_ownership
        if age_distribution is not None:
            session.age_distribution = age_distribution
        if top_complex_files is not None:
            session.top_complex_files = top_complex_files
        if file_network is not None:
            session.file_network = file_network
        if pull_requests is not None:
            session.pull_requests = pull_requests
        if issues is not None:
            session.issues = issues
        session.status = "completed"
        session.save()
    else:
        # Modo creación clásico (síncrono / legacy)
        session = AnalysisSession.objects.create(
            repo=repo_obj,
            last_commit_id=last_commit_id,
            analysis_mode=analysis_mode,
            ai_config=ai_config,
            repo_summary=repo_summary,
            evolution_data=evolution_data,
            author_activity=author_activity,
            file_ownership=file_ownership or [],
            age_distribution=age_distribution or [],
            top_complex_files=top_complex_files or [],
            file_network=file_network or [],
            pull_requests=pull_requests or [],
            issues=issues or [],
            status="completed",
        )

    # 1. Guardar métricas por archivo en bulk
    file_metric_objs = [
        FileMetric(
            session=session,
            file_name=entry["id"],
            language=entry.get("language", ""),
            nloc=entry.get("nloc", 0),
            ccn=entry.get("ccn", 0.0),
            commits=entry.get("commits", 0),
            num_functions=entry.get("num_functions", 0),
            peak_ccn=entry.get("peak_ccn", 0.0),
            ownership=entry.get("ownership", 0.0),
            owner_name=entry.get("owner_name", "N/A"),
            age_days=entry.get("age_days", 0),
        )
        for entry in file_metrics
    ]
    # Borrar posibles métricas previas si es una actualización para evitar duplicados
    if session_obj:
        session.file_metrics.all().delete()
    FileMetric.objects.bulk_create(file_metric_objs)

    # 2. Guardar métricas por lenguaje en bulk
    lang_metric_objs = [
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
    if session_obj:
        session.language_metrics.all().delete()
    LanguageMetric.objects.bulk_create(lang_metric_objs)

    logger.info(
        f"[DB] Sesión guardada con éxito (id={session.pk}) con {len(file_metric_objs)} archivos y {len(lang_metric_objs)} lenguajes."
    )
    return session
