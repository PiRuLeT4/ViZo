# git_remote.py
# ─────────────
# Utilidades para realizar consultas y comprobaciones remotas en Git
# sin necesidad de clonar el repositorio localmente.

import os
import subprocess
import hashlib
from colorama import Fore


def _get_clean_git_env() -> dict:
    """
    Retorna un diccionario de variables de entorno limpio, de forma que se
    desactiven AskPass de VS Code y otros prompts interactivos de Git.
    """
    env = os.environ.copy()
    for key in list(env.keys()):
        if "ASKPASS" in key or key.startswith("VSCODE_GIT"):
            env.pop(key)
    env["GIT_TERMINAL_PROMPT"] = "0"
    env["GIT_ASKPASS"] = "true"
    return env


def _get_remote_head(url: str, disable_helpers: bool = False) -> str | None:
    """
    Obtiene el hash del commit HEAD del repo remoto usando git ls-remote.
    """
    try:
        args = ["git"]
        if disable_helpers:
            args.extend(["-c", "credential.helper="])
        args.extend(["ls-remote", "--quiet", "--exit-code", url, "HEAD"])

        result = subprocess.run(
            args,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=15,
            env=_get_clean_git_env(),
        )
        if result.returncode == 0 and result.stdout:
            return result.stdout.split()[0]
    except Exception as e:
        print(Fore.YELLOW + f"[Git ls-remote] No disponible: {e}")
    return None


def _get_remote_tags_hash(url: str) -> str | None:
    """
    Obtiene un hash determinista de las etiquetas (tags) remotas.
    """
    try:
        result = subprocess.run(
            ["git", "ls-remote", "--tags", "--quiet", url],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=15,
            env=_get_clean_git_env()
        )
        if result.returncode == 0 and result.stdout.strip():
            lines = sorted(result.stdout.strip().splitlines())
            m = hashlib.sha256()
            m.update("\n".join(lines).encode("utf-8"))
            return m.hexdigest()
    except Exception as e:
        print(Fore.YELLOW + f"[Git ls-remote tags] No disponible: {e}")
    return None
