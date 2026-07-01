# orchestrator.py
# ───────────────
# Orquestador principal del flujo de análisis de ViZo.
# Controla la ejecución Cache-First, la concurrencia de hilos y llamadas al core de análisis e IA.

import json
from concurrent.futures import ThreadPoolExecutor
from colorama import Fore, init

from analyzer.core.AI.ai import get_ai_config
from analyzer.core.ENGINE.analysis import run_analysis
from analyzer.persistence.queries import save_session

from analyzer.models import Repository, AnalysisSession
from .git_remote import _get_remote_head, _get_remote_tags_hash
from .cache import _check_cache, _persist_results
from .security import verify_and_build_clone_url

init(autoreset=True)

# Pool de hilos acotado global para limitar tareas concurrentes y proteger el procesador
_ANALYSIS_EXECUTOR = ThreadPoolExecutor(max_workers=3, thread_name_prefix="vizo-task")


def analyze_repository(url: str, max_commits: int = 150) -> dict | None:
    """
    Punto de entrada principal síncrono (Legacy / Fallback).
    """
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

    analysis_result = run_analysis(url, max_commits=max_commits)
    if analysis_result is None:
        return None

    print(Fore.MAGENTA + "Enviando resumen a la IA (LM Studio)...")
    ai_config = get_ai_config(json.dumps(analysis_result["repo_summary"]))

    _persist_results(url, analysis_result, ai_config)

    return {
        "repo_name": analysis_result["repo_name"],
        "metrics": analysis_result["metrics"],
        "evolution_data": analysis_result["evolution_data"],
        "author_activity": analysis_result["author_activity"],
        "file_metrics": analysis_result["file_metrics"],
        "data_by_language": analysis_result["data_by_language"],
        "ai_config": ai_config,
        "from_cache": False,
    }


def start_async_analysis(
    url: str, max_commits: int = 150, analysis_mode: str = "commits", user=None, is_private=False
) -> tuple:
    """
    Inicia un flujo de análisis asíncrono optimizado mediante caché previa.
    Retorna: (session_id, is_cache_hit)
    """
    # 1. Resolver token, proveedor y URL de clonado autenticada de forma segura
    clone_url, token, provider = verify_and_build_clone_url(url, is_private, user)

    # 2. Chequeo de Caché Inteligente (Cache-First)
    if analysis_mode == "releases":
        latest_commit_id = _get_remote_tags_hash(clone_url)
        if not latest_commit_id:
            print(Fore.YELLOW + "[Releases Mode] No se encontraron tags remotos. Bajando a modo commits.")
            analysis_mode = "commits"
            latest_commit_id = _get_remote_head(clone_url)
    else:
        latest_commit_id = _get_remote_head(clone_url)

    if latest_commit_id:
        cached_data = _check_cache(url, latest_commit_id, analysis_mode)
        if cached_data:
            # Obtener el id de la sesión cacheada de forma limpia y sincronizar privacidad si cambió
            try:
                repo_obj = Repository.objects.get(url=url)

                # Sincronizar privacidad y propietario
                has_changed = False
                if repo_obj.is_private != is_private:
                    repo_obj.is_private = is_private
                    has_changed = True
                if is_private and repo_obj.user != user:
                    repo_obj.user = user
                    has_changed = True
                elif not is_private and repo_obj.user is not None:
                    repo_obj.user = None
                    has_changed = True

                if has_changed:
                    repo_obj.save(update_fields=["is_private", "user"])

                latest_session = repo_obj.sessions.filter(status="completed", analysis_mode=analysis_mode).first()
                if latest_session:
                    return latest_session.id, True
            except Repository.DoesNotExist:
                pass

    # 3. Cache MISS: Registrar sesión y disparar tarea asíncrona
    repo_name = url.strip("/").split("/")[-1].replace(".git", "")
    url_parts = url.strip("/").split("/")
    if len(url_parts) > 1:
        repo_name = "/".join(url_parts[-2:]).replace(".git", "")

    repo_obj, created = Repository.objects.get_or_create(
        url=url,
        defaults={
            "name": repo_name,
            "main_language": "",
            "is_private": is_private,
            "user": user if is_private else None,
        },
    )
    # Sincronizar estado de privacidad si ya existía pero cambió
    if not created:
        has_changed = False
        if repo_obj.is_private != is_private:
            repo_obj.is_private = is_private
            has_changed = True
        if repo_obj.user != user and is_private:
            repo_obj.user = user
            has_changed = True
        if has_changed:
            repo_obj.save(update_fields=["is_private", "user"])

    session = AnalysisSession.objects.create(
        repo=repo_obj,
        last_commit_id="",
        status="pending",
        analysis_mode=analysis_mode,
        ai_config={},
        repo_summary={},
        evolution_data=[],
        author_activity=[],
    )

    # Enviamos la tarea al ThreadPoolExecutor controlado
    _ANALYSIS_EXECUTOR.submit(async_analysis_worker, session.id, clone_url, max_commits, analysis_mode)

    return session.id, False


def async_analysis_worker(session_id: int, url: str, max_commits: int, analysis_mode: str = "commits"):
    """
    Worker asíncrono que procesa el análisis y utiliza la persistencia de Django.
    """
    import traceback
    from django.db import connection

    try:
        session = AnalysisSession.objects.get(pk=session_id)
        session.status = "processing"
        session.save(update_fields=["status"])

        # Analizar
        analysis_result = run_analysis(
            url, max_commits=max_commits, analysis_mode=analysis_mode, session_id=session_id
        )
        if not analysis_result:
            raise Exception("El análisis del motor analyzer_core ha fallado.")

        # Obtener configuración del dashboard con la IA
        ai_config = get_ai_config(json.dumps(analysis_result["repo_summary"]))
        if not ai_config:
            raise Exception(
                "No se pudo obtener una configuración visual de la IA válida."
            )

        # Actualizar lenguaje principal si es necesario
        repo_obj = session.repo
        main_lang = analysis_result["main_language"]
        if repo_obj.main_language != main_lang:
            repo_obj.main_language = main_lang
            repo_obj.save(update_fields=["main_language"])

        # Persistir resultados utilizandoqueries.save_session
        save_session(
            repo_obj=session.repo,
            last_commit_id=analysis_result["last_commit_id"],
            file_metrics=analysis_result["file_metrics"],
            data_by_language=analysis_result["data_by_language"],
            evolution_data=analysis_result["evolution_data"],
            ai_config=ai_config,
            repo_summary=analysis_result["repo_summary"],
            author_activity=analysis_result["author_activity"],
            file_ownership=analysis_result.get("file_ownership", []),
            age_distribution=analysis_result.get("age_distribution", []),
            top_complex_files=analysis_result.get("top_complex_files", []),
            file_network=analysis_result.get("file_network", []),
            analysis_mode=analysis_mode,
            session_obj=session,
        )
        print(f"[Async Worker Success] Sesión {session_id} completada exitosamente.")

    except Exception as e:
        traceback.print_exc()
        try:
            session = AnalysisSession.objects.get(pk=session_id)
            if "cancelado" not in str(session.error_message).lower():
                session.status = "failed"
                session.error_message = str(e)
                session.save(update_fields=["status", "error_message"])
                print(
                    f"[Async Worker Failed] Sesión {session_id} marcada como fallida. Motivo: {e}"
                )
            else:
                print(f"[Async Worker Cancelled] Sesión {session_id} fue cancelada por el usuario.")
        except Exception as inner_ex:
            print(
                f"[Async Worker Inner Error] Error al marcar sesión fallida: {inner_ex}"
            )
    finally:
        # Liberar la conexión en el hilo secundario
        connection.close()
