import logging
from .base_provider import parse_repo_url
from .github_provider import GitHubMetadataProvider
from .gitlab_provider import GitLabMetadataProvider

logger = logging.getLogger(__name__)


def fetch_private_metadata(repo_url: str, token: str) -> dict:
    """
    Descarga metadatos enriquecidos de la API usando el token OAuth.
    Optimiza el consumo del Rate Limit haciendo consultas masivas en lote.
    """
    empty_result = {
        "pull_requests": [],
        "issues": [],
        "stars": 0,
        "forks": 0,
        "code_reviews": {"nodes": [], "links": []},
        "issues_health": [],
        "releases_health": [],
        "community_activity": [],
    }

    if not token:
        logger.warning("ViZzo // private_provider invocado sin token. Retornando vacío.")
        return empty_result

    platform, owner, repo = parse_repo_url(repo_url)
    if not platform:
        return empty_result

    logger.info(f"ViZzo // Iniciando extracción autenticada ({platform.upper()}) para {owner}/{repo}...")

    if platform == "github":
        provider = GitHubMetadataProvider(owner, repo, token=token)
    else:
        provider = GitLabMetadataProvider(owner, repo, token=token)

    return provider.fetch_metadata()

