# analysis.py
# ───────────
# Punto de entrada de la orquestación del análisis local del repositorio en ViZzo.

import logging
import os
import shutil
import subprocess
import traceback

logger = logging.getLogger(__name__)

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
from .metrics import _process_metrics, _build_repo_summary, MetricsResult


import threading

def _check_cancelled(session_id: int = None, cancel_event: threading.Event = None):
    """Verifica si la sesión de análisis fue cancelada por el usuario en memoria o en base de datos."""
    if cancel_event and cancel_event.is_set():
        raise RuntimeError("CANCELLED_BY_USER")

    if session_id is not None:
        from analyzer.models import AnalysisSession

        session = AnalysisSession.objects.filter(pk=session_id).first()
        if (
            session
            and session.status == "failed"
            and "cancelado" in str(session.error_message).lower()
        ):
            raise RuntimeError("CANCELLED_BY_USER")


def run_analysis(
    url: str,
    max_commits: int = 150,
    analysis_mode: str = "commits",
    session_id: int = None,
    cancel_event: threading.Event = None,
) -> dict | None:
    """
    Clona el repositorio indicado por `url`, ejecuta el análisis completo
    (Lizard + PyDriller/Git tags) y devuelve un dict con los resultados.
    """
    target_dir = _temp_dir(session_id)

    # Limpieza previa
    if os.path.exists(target_dir):
        shutil.rmtree(target_dir, onerror=_remove_readonly)

    _check_cancelled(session_id, cancel_event)

    try:
        # FASE 1: Clonado y extracción de historial (Git / PyDriller / Lizard)
        repo_name, last_commit_id, evolution_raw, analysis, mode = _phase_clone_and_analyze(
            url, target_dir, max_commits, analysis_mode, session_id, cancel_event
        )

        # FASE 2: Procesar métricas locales con Dataclass
        # FASE 2: Procesar métricas locales con Dataclass
        _check_cancelled(session_id, cancel_event)
        metrics_res = _process_metrics(analysis, evolution_raw, target_dir)
        main_language = next(iter(metrics_res.language_counts), "unknown")
        logger.info(f"Lenguaje principal: {main_language}")

        _check_cancelled(session_id, cancel_event)
        repo_summary = _build_repo_summary(
            analysis,
            evolution_raw,
            metrics_res.filenames,
            metrics_res.language_counts,
            metrics_res.total_nloc,
            metrics_res.total_ccn,
            analysis_mode=mode,
        )

        # FASE 3: Extracción de metadatos de comunidad (API GitHub/GitLab)
        _check_cancelled(session_id, cancel_event)
        pull_requests, issues = _phase_fetch_community_metadata(url, session_id, repo_summary)

        # FASE 4: Unificación de nombres de autores
        _unify_author_names(
            repo_summary=repo_summary,
            file_network=metrics_res.file_network,
            author_activity=evolution_raw["author_activity"],
            file_ownership=metrics_res.file_ownership,
            evolution_commits=evolution_raw["commits"],
        )

        repo_summary["num_pull_requests"] = len(pull_requests)
        repo_summary["num_issues"] = len(issues)
        logger.info(f"Resumen del repositorio: {repo_summary}")

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
            "file_metrics": metrics_res.file_metrics,
            "data_by_language": metrics_res.data_by_language,
            "repo_summary": repo_summary,
            "repo_name": repo_name,
            "last_commit_id": last_commit_id,
            "main_language": main_language,
            "file_ownership": metrics_res.file_ownership,
            "age_distribution": metrics_res.age_distribution,
            "top_complex_files": metrics_res.top_complex_files,
            "file_network": metrics_res.file_network,
            "top_churn_files": metrics_res.top_churn_files,
            "pull_requests": pull_requests,
            "issues": issues,
            "community_activity": repo_summary["community_activity"],
        }

    except RuntimeError as e:
        logger.error(f"Error de clonado/Git: {e}")
        return None
    except Exception as e:
        logger.error(f"Error general en el análisis: {e}")
        logger.debug(traceback.format_exc())
        return None
    finally:
        _cleanup(target_dir)


def _phase_clone_and_analyze(
    url: str, target_dir: str, max_commits: int, analysis_mode: str, session_id: int, cancel_event: threading.Event
) -> tuple:
    """Fase 1: Clonado del repositorio y extracción estática y de evolución."""
    depth = max_commits if analysis_mode == "commits" else None
    _clone_repo(url, target_dir, depth=depth)
    repo_name = url.rstrip("/").split("/")[-1].removesuffix(".git")

    _check_cancelled(session_id, cancel_event)

    if analysis_mode == "releases":
        tags = _get_tags_info(target_dir, max_releases=max_commits)
        if tags:
            last_commit_id = tags[0]["hash"]
            evolution_raw = _run_releases_history(target_dir, tags)
            subprocess.run(
                ["git", "checkout", tags[0]["name"]],
                capture_output=True,
                cwd=target_dir,
                encoding="utf-8",
                errors="replace",
                env=_get_clean_git_env(),
            )
            _check_cancelled(session_id, cancel_event)
            analysis = _run_lizard(target_dir)
            _check_cancelled(session_id, cancel_event)
            return repo_name, last_commit_id, evolution_raw, analysis, "releases"
        else:
            logger.warning("[Releases Mode] No se encontraron tags locales. Fallback a commits.")
            analysis_mode = "commits"

    last_commit_id = _get_head_commit(target_dir)
    _check_cancelled(session_id, cancel_event)
    evolution_raw = _run_git_history(target_dir, max_commits=max_commits)
    _check_cancelled(session_id, cancel_event)
    analysis = _run_lizard(target_dir)
    _check_cancelled(session_id, cancel_event)

    return repo_name, last_commit_id, evolution_raw, analysis, "commits"


def _phase_fetch_community_metadata(url: str, session_id: int, repo_summary: dict) -> tuple:
    """Fase 3: Extracción de metadatos de comunidad utilizando proveedor privado u público."""
    pull_requests = []
    issues = []
    is_private = False
    token = None

    if session_id is not None:
        from analyzer.models import AnalysisSession

        session = AnalysisSession.objects.filter(pk=session_id).first()
        if session:
            is_private = session.repo.is_private
            repo_user = session.repo.user
            if repo_user and hasattr(repo_user, "profile"):
                token = repo_user.profile.gitlab_token if "gitlab" in url.lower() else repo_user.profile.github_token

    repo_summary["stars"] = 0
    repo_summary["forks"] = 0
    repo_summary["code_reviews"] = {"nodes": [], "links": []}
    repo_summary["issues_health"] = []
    repo_summary["releases_health"] = []
    repo_summary["community_activity"] = []

    extracted = False
    if token:
        try:
            from .private_provider import fetch_private_metadata

            meta = fetch_private_metadata(url, token)
            if meta:
                pull_requests = meta.get("pull_requests", [])
                issues = meta.get("issues", [])
                repo_summary["stars"] = meta.get("stars", 0)
                repo_summary["forks"] = meta.get("forks", 0)
                repo_summary["code_reviews"] = meta.get("code_reviews", {"nodes": [], "links": []})
                repo_summary["issues_health"] = meta.get("issues_health", [])
                repo_summary["releases_health"] = meta.get("releases_health", [])
                repo_summary["community_activity"] = meta.get("community_activity", [])
                extracted = True
                logger.info("ViZzo // Extracción enriquecida OAuth completada exitosamente.")
        except Exception as e:
            logger.error(f"ViZzo // Error en extracción OAuth privada: {e}. Degradando...")

    if not extracted and not is_private:
        try:
            from .public_provider import fetch_public_metadata

            meta = fetch_public_metadata(url)
            if meta:
                pull_requests = meta.get("pull_requests", [])
                issues = meta.get("issues", [])
                repo_summary["stars"] = meta.get("stars", 0)
                repo_summary["forks"] = meta.get("forks", 0)
                repo_summary["code_reviews"] = meta.get("code_reviews", {"nodes": [], "links": []})
                repo_summary["issues_health"] = meta.get("issues_health", [])
                repo_summary["releases_health"] = meta.get("releases_health", [])
                repo_summary["community_activity"] = meta.get("community_activity", [])
                logger.info("ViZzo // Extracción pública sin token completada (degradada).")
        except Exception as e:
            logger.error(f"ViZzo // Error en extracción pública: {e}")

    return pull_requests, issues


def _unify_author_names(
    repo_summary: dict,
    file_network: list,
    author_activity: list,
    file_ownership: list,
    evolution_commits: list,
):
    """
    Combina y unifica los nombres de autores de Git (John Doe) con los usuarios de GitHub/GitLab (johndoe99).
    Añade en el título/etiqueta el formato 'NombrePrincipal (NombreSecundario)' cuando ambos estén disponibles.
    """
    git_authors = set(repo_summary.get("authors", []))
    for c in evolution_commits:
        auth = c.get("author")
        if auth and auth not in ("Unknown", "Release"):
            git_authors.add(auth)

    gh_logins = set()
    for user_item in repo_summary.get("community_activity", []):
        u = user_item.get("user")
        if u and u != "Unknown":
            gh_logins.add(u)

    code_reviews = repo_summary.get("code_reviews", {})
    for node in code_reviews.get("nodes", []):
        u = node.get("id")
        if u and u != "Unknown":
            gh_logins.add(u)

    mapping = {}
    for login in list(gh_logins):
        clean_login = login.lower().replace("-", "").replace("_", "").replace(".", "")
        matched_git = None
        for g_auth in git_authors:
            clean_git = g_auth.lower().replace(" ", "").replace("-", "").replace("_", "").replace(".", "")
            if clean_login == clean_git or clean_login in clean_git or clean_git in clean_login:
                matched_git = g_auth
                break
        if matched_git:
            mapping[login] = matched_git
            mapping[matched_git] = login

    def format_name(name):
        if not name or name in ("Unknown", "Release"):
            return name
        other = mapping.get(name)
        if other and other != name and other.lower() != name.lower():
            if " " in name:
                return f"{name} ({other})"
            elif " " in other:
                return f"{other} ({name})"
            else:
                return f"{name} ({other})"
        return name

    # 1. Actualizar code_reviews nodes
    for node in code_reviews.get("nodes", []):
        raw_id = node.get("id")
        node["name"] = format_name(raw_id)

    # 2. Actualizar file_network
    for item in file_network:
        raw_auth = item.get("author")
        item["author"] = format_name(raw_auth)

    # 3. Actualizar author_activity
    for item in author_activity:
        raw_auth = item.get("author")
        item["author"] = format_name(raw_auth)

    # 4. Actualizar file_ownership
    for item in file_ownership:
        raw_auth = item.get("author")
        item["author"] = format_name(raw_auth)

    # 5. Actualizar community_activity
    for item in repo_summary.get("community_activity", []):
        raw_u = item.get("user")
        item["user"] = format_name(raw_u)
