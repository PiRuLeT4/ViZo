from .base_provider import parse_repo_url
from .github_provider import GitHubMetadataProvider
from .gitlab_provider import GitLabMetadataProvider


def fetch_public_metadata(repo_url: str) -> dict:
    """
    Descarga metadatos públicos de un repositorio e implementa la estructuración
    completa de los 4 datasets de comunidad para análisis de ViZzo.
    """
    platform, owner, repo = parse_repo_url(repo_url)
    if not platform:
        print(f"ViZzo // URL no compatible con API pública de GitHub/GitLab: {repo_url}")
        return {
            "pull_requests": [],
            "issues": [],
            "stars": 0,
            "forks": 0,
            "code_reviews": {"nodes": [], "links": []},
            "issues_health": [],
            "releases_health": [],
            "community_activity": [],
        }

    print(f"ViZzo // Consultando API pública de {platform.upper()} para {owner}/{repo}...")

    if platform == "github":
        provider = GitHubMetadataProvider(owner, repo)
    else:
        provider = GitLabMetadataProvider(owner, repo)

    return provider.fetch_metadata()
