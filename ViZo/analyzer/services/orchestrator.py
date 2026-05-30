"""
orchestrator.py
───────────────
Orquestador principal del flujo de análisis de ViZo.
Controla el flujo Cache-First, la concurrencia de hilos (ThreadPoolExecutor) y llamadas a la IA.
"""
import json
import os
import subprocess
from concurrent.futures import ThreadPoolExecutor

from colorama import Fore, init

from analyzer.core.ai import get_ai_config
from analyzer.core.engine import run_analysis
from analyzer.persistence.queries import build_result_from_session, save_session
from analyzer.models import Repository, AnalysisSession

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
        analysis_result["evolution_data"],
        ai_config,
        analysis_result["repo_summary"],
        analysis_result["author_activity"],
    )


# ─────────────────────────────────────────────────────────────────────────────
# Función pública principal (Legacy / Sync)
# ─────────────────────────────────────────────────────────────────────────────


def analyze_repository(url: str, max_commits: int = 150) -> dict | None:
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
        - author_activity    : actividad agrupada por autor
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
    analysis_result = run_analysis(url, max_commits=max_commits)
    if analysis_result is None:
        return None

    # ── Paso 3: Obtener configuración de la IA ─────────────────────────────────
    print(Fore.MAGENTA + "Enviando resumen a la IA (LM Studio)...")
    ai_config = get_ai_config(json.dumps(analysis_result["repo_summary"]))

    # ── Paso 4: Persistir en BD ───────────────────────────────────────────────
    _persist_results(url, analysis_result, ai_config)

    # ── Paso 5: Componer y devolver resultado ─────────────────────────────────
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


# Pool de hilos acotado global para limitar tareas concurrentes y proteger el procesador
_ANALYSIS_EXECUTOR = ThreadPoolExecutor(max_workers=3, thread_name_prefix="vizo-task")


def start_async_analysis(url: str, max_commits: int = 150) -> tuple:
    """
    Inicia un flujo de análisis asíncrono optimizado mediante caché previa.
    Retorna: (session_id, is_cache_hit)
    """
    # ── 1. Chequeo de Caché Inteligente (Cache-First) ──
    latest_commit_id = _get_remote_head(url)
    if latest_commit_id:
        cached_data = _check_cache(url, latest_commit_id)
        if cached_data:
            # Obtener el id de la sesión cacheada de forma limpia
            repo_obj = Repository.objects.get(url=url)
            latest_session = repo_obj.sessions.filter(status="completed").first()
            if latest_session:
                return latest_session.id, True

    # ── 2. Cache MISS: Registrar sesión y disparar tarea asíncrona ──
    repo_name = url.strip("/").split("/")[-1].replace(".git", "")
    url_parts = url.strip("/").split("/")
    if len(url_parts) > 1:
        repo_name = "/".join(url_parts[-2:]).replace(".git", "")

    repo_obj, _ = Repository.objects.get_or_create(
        url=url,
        defaults={"name": repo_name, "main_language": ""}
    )

    session = AnalysisSession.objects.create(
        repo=repo_obj,
        last_commit_id="",
        status="pending",
        ai_config={},
        repo_summary={},
        evolution_data=[],
        author_activity=[]
    )

    # Enviamos la tarea al ThreadPoolExecutor controlado
    _ANALYSIS_EXECUTOR.submit(async_analysis_worker, session.id, url, max_commits)
    
    return session.id, False


def async_analysis_worker(session_id: int, url: str, max_commits: int):
    """
    Worker asíncrono que procesa el análisis y utiliza SSOT para guardar en BD.
    """
    import traceback
    from django.db import connection

    try:
        session = AnalysisSession.objects.get(pk=session_id)
        session.status = "processing"
        session.save(update_fields=["status"])

        # Pasar session_id para aislar el directorio temporal
        analysis_result = run_analysis(url, max_commits=max_commits, session_id=session_id)
        if not analysis_result:
            raise Exception("El análisis del motor analyzer_core ha fallado.")

        # Obtener configuración del dashboard con la IA
        ai_config = get_ai_config(json.dumps(analysis_result["repo_summary"]))
        if not ai_config:
            raise Exception("No se pudo obtener una configuración visual de la IA válida.")

        # Actualizar lenguaje principal si es necesario
        repo_obj = session.repo
        main_lang = analysis_result["main_language"]
        if repo_obj.main_language != main_lang:
            repo_obj.main_language = main_lang
            repo_obj.save(update_fields=["main_language"])

        # SSOT: Invocar a la capa de persistencia única
        save_session(
            repo_obj=session.repo,
            last_commit_id=analysis_result["last_commit_id"],
            file_metrics=analysis_result["file_metrics"],
            data_by_language=analysis_result["data_by_language"],
            evolution_data=analysis_result["evolution_data"],
            ai_config=ai_config,
            repo_summary=analysis_result["repo_summary"],
            author_activity=analysis_result["author_activity"],
            session_obj=session
        )
        print(f"[Async Worker Success] Sesión {session_id} completada exitosamente.")

    except Exception as e:
        traceback.print_exc()
        try:
            session = AnalysisSession.objects.get(pk=session_id)
            session.status = "failed"
            session.error_message = str(e)
            session.save(update_fields=["status", "error_message"])
            print(f"[Async Worker Failed] Sesión {session_id} marcada como fallida. Motivo: {e}")
        except Exception as inner_ex:
            print(f"[Async Worker Inner Error] Error al marcar sesión fallida: {inner_ex}")
    finally:
        # Liberar la conexión en el hilo secundario
        connection.close()
