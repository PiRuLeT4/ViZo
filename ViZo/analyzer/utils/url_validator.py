import re
from urllib.parse import urlparse

ALLOWED_HOSTS = {"github.com", "gitlab.com", "www.github.com", "www.gitlab.com"}
VALID_PATH_PATTERN = re.compile(r"^/[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+(?:\.git)?$")


def validate_repo_url(url: str) -> str:
    """
    Valida y normaliza la URL del repositorio remoto.
    Permite únicamente URLs HTTPS provenientes de github.com o gitlab.com.
    Lanza ValueError si la URL es inválida o sospechosa.
    """
    if not url or not isinstance(url, str):
        raise ValueError("La URL del repositorio es obligatoria.")

    cleaned_url = url.strip()
    
    # Prevenir espacios internos o caracteres de control
    if any(c.isspace() for c in cleaned_url):
        raise ValueError("La URL del repositorio no debe contener espacios.")

    parsed = urlparse(cleaned_url)

    if parsed.scheme.lower() != "https":
        raise ValueError("Solo se permiten repositorios con protocolo seguro HTTPS (https://).")

    netloc = parsed.netloc.lower().split(":")[0]  # Ignorar puerto si existiese
    if netloc not in ALLOWED_HOSTS:
        raise ValueError(f"El dominio '{netloc}' no está permitido. Solo se aceptan repositorios de GitHub o GitLab.")

    path = parsed.path.rstrip("/")
    if not VALID_PATH_PATTERN.match(path):
        raise ValueError("La estructura de la URL debe ser 'https://github.com/usuario/repositorio'.")

    if ".." in path or "//" in path:
        raise ValueError("La URL contiene caracteres o secuencias no permitidas.")

    # Reconstruir URL limpia
    clean_host = "github.com" if "github.com" in netloc else "gitlab.com"
    return f"https://{clean_host}{path}"
