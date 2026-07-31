# helpers.py
# ----------
# Funciones auxiliares y operaciones del sistema operativo / Git
# utilizadas por el motor de análisis de repositorios en ViZzo.

import gc
import logging
import os
import shutil
import stat
import subprocess
import time
import queue
import multiprocessing
import lizard
from datetime import datetime

logger = logging.getLogger(__name__)


def _remove_readonly(func, path, excinfo):
    """Callback para shutil.rmtree: elimina el flag de solo lectura antes de borrar (necesario en Windows)."""
    os.chmod(path, stat.S_IWRITE)
    func(path)


def _temp_dir(session_id: int = None) -> str:
    """Devuelve la ruta absoluta del directorio temporal, aislado por sesión si se provee."""
    suffix = f"_{session_id}" if session_id else ""
    return os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "..", f"temp_repo_analysis{suffix}")
    )


def _cleanup(target_dir: str) -> None:
    """Elimina el directorio temporal si existe."""
    if os.path.exists(target_dir):
        logger.debug("Limpiando archivos temporales...")
        # Forzar recolección de basura para cerrar descriptores de archivos de GitPython/PyDriller
        gc.collect()
        try:
            shutil.rmtree(target_dir, onerror=_remove_readonly)
            logger.debug("Carpeta temporal eliminada.")
        except Exception:
            # Reintentar tras una pausa para que el sistema operativo libere bloqueos de archivos
            gc.collect()
            time.sleep(0.5)
            try:
                shutil.rmtree(target_dir, onerror=_remove_readonly)
                logger.debug("Carpeta temporal eliminada tras reintento.")
            except Exception as re_err:
                logger.error(f"No se pudo eliminar la carpeta temporal: {re_err}")


from analyzer.utils.git import _get_clean_git_env


def _clone_repo(url: str, target_dir: str, depth: int = None) -> str:
    """
    Clona el repositorio remoto en target_dir mediante git clone (subprocess).
    Soporta shallow clone pasándole depth para optimizar repositorios grandes.
    Devuelve target_dir si el clon fue exitoso; lanza RuntimeError si falla.
    """
    logger.info(f"Clonando repositorio para análisis: {url} (depth={depth if depth else 'full'})")
    cmd = [
        "git",
        "clone",
        "-c",
        "core.longpaths=true",
        "-c",
        "filter.lfs.smudge=",
        "-c",
        "filter.lfs.required=false",
    ]
    if depth and depth > 0:
        cmd += ["--depth", str(depth)]
    cmd += [url, target_dir]

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=300,
        env=_get_clean_git_env(),
    )
    if result.returncode != 0:
        raise RuntimeError(f"git clone falló:\n{result.stderr.strip()}")
    logger.info("Repositorio clonado correctamente.")
    return target_dir


def _get_head_commit(target_dir: str) -> str:
    """Obtiene el hash SHA del commit HEAD del clon local via git rev-parse."""
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        cwd=target_dir,
        timeout=30,
        env=_get_clean_git_env(),
    )
    if result.returncode != 0:
        raise RuntimeError(f"No se pudo obtener HEAD: {result.stderr.strip()}")
    return result.stdout.strip()


def _get_total_commits(target_dir: str) -> int:
    """Obtiene el número total de commits en el repositorio de forma rápida via git rev-list."""
    result = subprocess.run(
        ["git", "rev-list", "--count", "HEAD"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        cwd=target_dir,
        timeout=30,
        env=_get_clean_git_env(),
    )
    if result.returncode != 0:
        return 0
    try:
        return int(result.stdout.strip())
    except ValueError:
        return 0


def _clean_git_path(path: str) -> str:
    """Limpia formatos de renombrado en rutas de Git como 'src/{old => new}/file.py'."""
    if " => " not in path:
        return path
    if "{" in path and "}" in path:
        left = path.split("{")[0]
        right = path.split("}")[1]
        center = path.split("{")[1].split("}")[0]
        new_part = center.split(" => ")[1]
        return f"{left}{new_part}{right}".replace("//", "/")
    else:
        return path.split(" => ")[1]


def _parse_git_date(date_str: str) -> datetime:
    """Parsea fechas de Git de forma robusta."""
    if not date_str:
        return datetime.now()
    try:
        clean = date_str.strip().replace(" ", "T", 1)
        if " " in clean:
            clean = clean.replace(" ", "")
        if "+" in clean and ":" not in clean.split("+")[-1]:
            tz_part = clean.split("+")[-1]
            if len(tz_part) == 4:
                clean = clean[:-4] + tz_part[:2] + ":" + tz_part[2:]
        elif "-" in clean and ":" not in clean.split("-")[-1]:
            parts = clean.rsplit("-", 1)
            if len(parts) == 2 and len(parts[1]) == 4:
                clean = parts[0] + "-" + parts[1][:2] + ":" + parts[1][2:]
        return datetime.fromisoformat(clean)
    except Exception:
        try:
            return datetime.strptime(date_str.split()[0], "%Y-%m-%d")
        except Exception:
            return datetime.now()


def _get_tags_info(target_dir: str, max_releases: int = 10) -> list:
    """Retorna información de las últimas max_releases etiquetas (tags/releases) del clon local."""
    result = subprocess.run(
        ["git", "for-each-ref", "--sort=-creatordate", "--format=%(refname:short)|%(objectname)|%(creatordate:iso)", "refs/tags"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        cwd=target_dir,
        timeout=30,
        env=_get_clean_git_env()
    )
    tags = []
    if result.returncode == 0 and result.stdout.strip():
        lines = result.stdout.strip().splitlines()
        seen = set()
        for line in lines:
            if not line:
                continue
            parts = line.split("|")
            if len(parts) >= 2:
                tag_name = parts[0]
                commit_hash = parts[1]
                date_str = parts[2] if len(parts) > 2 else ""
                if tag_name not in seen:
                    seen.add(tag_name)
                    
                    if not date_str or "%(" in date_str:
                        date_res = subprocess.run(
                            ["git", "log", "-1", "--format=%cI", tag_name],
                            capture_output=True,
                            text=True,
                            encoding="utf-8",
                            errors="replace",
                            cwd=target_dir,
                            timeout=30,
                            env=_get_clean_git_env()
                        )
                        if date_res.returncode == 0 and date_res.stdout:
                            date_str = date_res.stdout.strip()
                    
                    date_obj = _parse_git_date(date_str)
                    tags.append({
                        "name": tag_name,
                        "hash": commit_hash,
                        "date": date_str,
                        "date_obj": date_obj
                    })
                    if max_releases is not None and max_releases > 0 and len(tags) >= max_releases:
                        break
    return tags


def _get_diff_stats(target_dir: str, rev_prev: str, rev_curr: str) -> tuple:
    """Retorna (insertions, deletions) entre dos revisiones usando git diff --shortstat."""
    try:
        result = subprocess.run(
            ["git", "diff", "--shortstat", f"{rev_prev}..{rev_curr}"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            cwd=target_dir,
            timeout=30,
            env=_get_clean_git_env()
        )
        if result.returncode == 0 and result.stdout.strip():
            parts = result.stdout.strip().split(",")
            insertions = 0
            deletions = 0
            for part in parts:
                if "insertion" in part:
                    insertions = int("".join(filter(str.isdigit, part)))
                elif "deletion" in part:
                    deletions = int("".join(filter(str.isdigit, part)))
            return insertions, deletions
    except Exception:
        pass
    return 0, 0


# ── Variables y helpers para el análisis con Lizard ──

_LIZARD_EXCLUDE_PATTERNS = [
    "*/node_modules/*",
    "*/vendor/*",
    "*/3rdparty/*",
    "*/third_party/*",
    "*/bin/*",
    "*/build/*",
    "*/dist/*",
    "*/target/*",
    "*/.git/*",
    "*/venv/*",
    "*/env/*",
    "*/.venv/*",
    "*/.env/*",
    "*/htmlcov/*",
    "*/out/*",
    "*/media/*",
    "*/regression/*",
    "*/os/*",
    "*/.github/*",
    "*/.gitlab/*",
    "*/cmake/*",
    "*/test/*",
    "*/tests/*",
    "*/spec/*",
    "*/specs/*",
    "*/testing/*",
    "*/e2e/*",
    "*/fixtures/*",
    "*/mock/*",
    "*/mocks/*",
    "*/__tests__/*",
    "*/__mocks__/*",
]

_LIZARD_INCLUDE_FOLDERS = [
    # --- Genéricos y ya existentes ---
    "src", "lib", "app", "source", "core", "components", "pkg", "cmd", "include", "apps", 
    "sources", "build", "tools", "android", "ios", "macos", "apple", "game", "engine",
    
    # --- Django / Python / Backends Web ---
    "api",
    "modules",
    "services",
    "controllers",
    "routes",
    "models",
    "views",
    "backend",
    "server",
    
    # --- Frontend / Web Apps ---
    "frontend",
    "client",
    "pages",
    "public/js",
    "assets/js",
    "scripts",
    
    # --- Lenguajes de Sistemas (Rust, Go, C++, C#) ---
    "internal",
    "common",
    "utils",
    "plugins",
    "handlers",
]


def is_minified_or_obfuscated(filepath: str) -> bool:
    """
    Comprueba si un archivo es código minificado, empaquetado u ofuscado
    basándose en patrones de nombre y la longitud máxima de línea.
    """
    basename = os.path.basename(filepath).lower()
    
    # 1. Patrones comunes de compresión en nombres
    if any(pat in basename for pat in [".min.", ".bundle.", ".prod.", "-min.", ".esm."]):
        return True
        
    # 2. Heurístico de longitud de línea (primeras 20 líneas)
    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            for _ in range(20):
                line = f.readline()
                if not line:
                    break
                if len(line) > 1000:
                    return True
    except Exception:
        pass
        
    return False


def is_generated_or_test_file(filepath: str) -> bool:
    """
    Comprueba si un archivo es código fuente generado automáticamente (ObjectFactory, DTOs, parsers XML)
    o archivos de pruebas ruidosos que bloquean el análisis estático de Lizard.
    """
    basename = os.path.basename(filepath).lower()

    # Patrones de pruebas / unit tests
    if any(pat in basename for pat in [".spec.", ".test.", "_test.", "test_", "testcase"]):
        return True

    # Patrones de código autogenerado común (Java, C#, Go, C++)
    if any(pat in basename for pat in [
        "objectfactory", "crossversionmodeltool", "dto", "dao", "vo",
        ".pb.", ".generated.", ".designer.", "antlr", "g4"
    ]):
        return True

    return False


def _lizard_worker_process(queue_out, files: list, exclude_patterns: list, threads_count: int, chunk_size: int = 50):
    """
    Función de ejecución en subproceso aislado. Procesa la lista de archivos en lotes (chunks)
    y envía los resultados de forma progresiva a la cola, permitiendo recuperar métricas parciales si ocurre timeout.
    """
    try:
        for i in range(0, len(files), chunk_size):
            chunk = files[i:i + chunk_size]
            try:
                res = list(
                    lizard.analyze(
                        chunk,
                        exclude_pattern=exclude_patterns,
                        threads=threads_count
                    )
                )
                queue_out.put(("batch", res))
            except Exception as batch_err:
                logger.warning(f"[Lizard Worker] Error en lote de archivos: {batch_err}")
        queue_out.put(("done", None))
    except Exception as e:
        queue_out.put(("error", str(e)))
    finally:
        try:
            queue_out.close()
            queue_out.join_thread()
        except Exception:
            pass
