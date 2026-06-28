# security.py
# ───────────
# Lógica de seguridad, control de acceso a repositorios privados y
# validación de tokens OAuth para GitHub y GitLab.

from .git_remote import _get_remote_head


def verify_and_build_clone_url(url: str, is_private: bool, user) -> tuple[str, str | None, str | None]:
    """
    Verifica las credenciales del usuario, previene la fuga accidental de privacidad
    (PermissionError si un repositorio es privado pero no se activa el escudo)
    y retorna la URL de clonado autenticada junto con el token y el proveedor.
    """
    token = None
    provider = None
    
    # 1. Recuperar token y proveedor si el usuario está autenticado
    if user and user.is_authenticated:
        try:
            profile = user.profile
            if "github.com" in url:
                provider = "github"
                token = profile.github_token
            elif "gitlab.com" in url:
                provider = "gitlab"
                token = profile.gitlab_token
        except Exception:
            pass

    # 2. Evitar analizar repos privados como públicos (Escudo Proactivo)
    if not is_private and token and provider:
        public_head = _get_remote_head(url, disable_helpers=True)
        if public_head is None:
            if provider == "github":
                auth_url = url.replace("https://github.com/", f"https://{token}@github.com/")
            elif provider == "gitlab":
                auth_url = url.replace("https://gitlab.com/", f"https://oauth2:{token}@gitlab.com/")
            else:
                auth_url = url
            
            private_head = _get_remote_head(auth_url, disable_helpers=True)
            if private_head is not None:
                raise PermissionError("PRIVATE_REPO_WITHOUT_SHIELD")

    # 3. Construir la URL de Git autenticada si corresponde
    clone_url = url
    if is_private and token and provider:
        if provider == "github":
            clone_url = url.replace("https://github.com/", f"https://{token}@github.com/")
        elif provider == "gitlab":
            clone_url = url.replace("https://gitlab.com/", f"https://oauth2:{token}@gitlab.com/")

    return clone_url, token, provider
