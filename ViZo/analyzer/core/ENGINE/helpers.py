# helpers.py
# ----------
# Funciones auxiliares y operaciones del sistema operativo / Git
# utilizadas por el motor de análisis de repositorios en ViZo.

import gc
import os
import shutil
import stat
import subprocess
import time
from datetime import datetime
from colorama import Fore


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
        print(Fore.LIGHTBLACK_EX + "Limpiando archivos temporales...")
        # Forzar recolección de basura para cerrar descriptores de archivos de GitPython/PyDriller
        gc.collect()
        try:
            shutil.rmtree(target_dir, onerror=_remove_readonly)
            print(Fore.LIGHTBLACK_EX + "Carpeta temporal eliminada.")
        except Exception:
            # Reintentar tras una pausa para que el sistema operativo libere bloqueos de archivos
            gc.collect()
            time.sleep(0.5)
            try:
                shutil.rmtree(target_dir, onerror=_remove_readonly)
                print(Fore.LIGHTBLACK_EX + "Carpeta temporal eliminada tras reintento.")
            except Exception as re_err:
                print(Fore.RED + f"No se pudo eliminar la carpeta temporal: {re_err}")


def _get_clean_git_env() -> dict:
    """
    Retorna un diccionario de variables de entorno limpio, de forma que se
    desactiven AskPass de VS Code y otros prompts interactivos de Git.
    """
    env = os.environ.copy()
    # Eliminar cualquier variable de AskPass para evitar que VS Code o Git abran popups
    for key in list(env.keys()):
        if "ASKPASS" in key or key.startswith("VSCODE_GIT"):
            env.pop(key)
    # Forzar no interactivo
    env["GIT_TERMINAL_PROMPT"] = "0"
    env["GIT_ASKPASS"] = "true"  # Evita prompts interactivos
    return env


def _clone_repo(url: str, target_dir: str, depth: int = None) -> str:
    """
    Clona el repositorio remoto en target_dir mediante git clone (subprocess).
    Soporta shallow clone pasándole depth para optimizar repositorios grandes.
    Devuelve target_dir si el clon fue exitoso; lanza RuntimeError si falla.
    """
    print(Fore.GREEN + f"Clonando repositorio para análisis: {url} (depth={depth if depth else 'full'})")
    cmd = ["git", "clone", "-c", "filter.lfs.smudge=", "-c", "filter.lfs.required=false"]
    if depth and depth > 0:
        cmd += ["--depth", str(depth)]
    cmd += [url, target_dir]

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=_get_clean_git_env(),
    )
    if result.returncode != 0:
        raise RuntimeError(f"git clone falló:\n{result.stderr.strip()}")
    print(Fore.GREEN + "Repositorio clonado correctamente.")
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
