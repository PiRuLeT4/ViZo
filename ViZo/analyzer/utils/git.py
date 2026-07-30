"""
git.py
──────
Utilidades compartidas para interacciones con la CLI de Git.
"""
import os


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
