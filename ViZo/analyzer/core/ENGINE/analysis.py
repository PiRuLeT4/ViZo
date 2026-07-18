# analysis.py
# ───────────
# Punto de entrada de la orquestación del análisis local del repositorio en ViZzo.

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


def _check_cancelled(session_id: int):
    """Verifica si la sesión de análisis fue cancelada por el usuario en base de datos."""
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
) -> dict | None:
    """
    Clona el repositorio indicado por `url`, ejecuta el análisis completo
    (Lizard + PyDriller/Git tags) y devuelve un dict con los resultados.
    """
    target_dir = _temp_dir(session_id)

    # Limpieza previa
    if os.path.exists(target_dir):
        shutil.rmtree(target_dir, onerror=_remove_readonly)

    _check_cancelled(session_id)

    try:
        # Optimización para repositorios grandes: usamos shallow clone para descargar
        # únicamente el historial necesario para el análisis en modo 'commits'.
        # En modo 'releases', desactivamos el clonado superficial (depth=None) para
        # garantizar la correcta descarga de todos los tags históricos del repositorio.
        if analysis_mode == "commits":
            depth = max_commits
        else:
            depth = None

        _clone_repo(url, target_dir, depth=depth)
        repo_name = url.rstrip("/").split("/")[-1].removesuffix(".git")

        _check_cancelled(session_id)

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
                    env=_get_clean_git_env(),
                )
                _check_cancelled(session_id)
                analysis = _run_lizard(target_dir)
                _check_cancelled(session_id)
            else:
                print(
                    Fore.YELLOW
                    + "[Releases Mode] No se encontraron tags locales. Fallback a commits."
                )
                analysis_mode = "commits"

        if analysis_mode == "commits":
            last_commit_id = _get_head_commit(target_dir)
            _check_cancelled(session_id)
            evolution_raw = _run_git_history(target_dir, max_commits=max_commits)
            _check_cancelled(session_id)
            analysis = _run_lizard(target_dir)
            _check_cancelled(session_id)

        # PASADA ÚNICA: Procesar métricas y lenguajes
        _check_cancelled(session_id)
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
            top_churn_files,
        ) = _process_metrics(analysis, evolution_raw, target_dir)

        main_language = next(iter(language_counts), "unknown")
        print(Fore.CYAN + f"Lenguaje principal: {main_language}")

        _check_cancelled(session_id)
        repo_summary = _build_repo_summary(
            analysis,
            evolution_raw,
            filenames,
            language_counts,
            total_nloc,
            total_ccn,
            analysis_mode=analysis_mode,
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

        # Descarga de Pull Requests e Issues (públicos o privados con token)
        pull_requests = []
        issues = []
        is_private = False
        token = None
        repo_user = None

        if session_id is not None:
            from analyzer.models import AnalysisSession

            session = AnalysisSession.objects.filter(pk=session_id).first()
            if session:
                is_private = session.repo.is_private
                repo_user = session.repo.user
                if repo_user and hasattr(repo_user, "profile"):
                    if "gitlab" in url.lower():
                        token = repo_user.profile.gitlab_token
                    else:
                        token = repo_user.profile.github_token

        # Inicializar métricas vacías por defecto
        repo_summary["stars"] = 0
        repo_summary["forks"] = 0
        repo_summary["code_reviews"] = {"nodes": [], "links": []}
        repo_summary["issues_health"] = []
        repo_summary["releases_health"] = []
        repo_summary["community_activity"] = []

        # Intentar extracción enriquecida si hay token
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
                    repo_summary["code_reviews"] = meta.get(
                        "code_reviews", {"nodes": [], "links": []}
                    )
                    repo_summary["issues_health"] = meta.get("issues_health", [])
                    repo_summary["releases_health"] = meta.get("releases_health", [])
                    repo_summary["community_activity"] = meta.get(
                        "community_activity", []
                    )
                    extracted = True
                    print(
                        Fore.GREEN
                        + "ViZzo // Extracción enriquecida OAuth completada exitosamente."
                    )
            except Exception as e:
                print(
                    Fore.RED
                    + f"ViZzo // Error en extracción OAuth privada: {e}. Degradando..."
                )

        # Degradación elegante a pública (solo si no es privado el repo)
        if not extracted and not is_private:
            try:
                from .public_provider import fetch_public_metadata

                meta = fetch_public_metadata(url)
                if meta:
                    pull_requests = meta.get("pull_requests", [])
                    issues = meta.get("issues", [])
                    repo_summary["stars"] = meta.get("stars", 0)
                    repo_summary["forks"] = meta.get("forks", 0)
                    repo_summary["code_reviews"] = meta.get(
                        "code_reviews", {"nodes": [], "links": []}
                    )
                    repo_summary["issues_health"] = meta.get("issues_health", [])
                    repo_summary["releases_health"] = meta.get("releases_health", [])
                    repo_summary["community_activity"] = meta.get(
                        "community_activity", []
                    )
                    print(
                        Fore.YELLOW
                        + "ViZzo // Extracción pública sin token completada (degradada)."
                    )
            except Exception as e:
                print(Fore.RED + f"ViZzo // Error en extracción pública: {e}")

        # Enriquecer el resumen con los contadores de PRs e Issues
        # para que la IA pueda decidir si instanciar los dashboards de comunidad
        repo_summary["num_pull_requests"] = len(pull_requests)
        repo_summary["num_issues"] = len(issues)
        # print del resumen para ver en desarrollo
        print(Fore.YELLOW + f"Resumen del repositorio: {repo_summary}")

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
            "top_churn_files": top_churn_files,
            "pull_requests": pull_requests,
            "issues": issues,
            "community_activity": repo_summary["community_activity"],
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
