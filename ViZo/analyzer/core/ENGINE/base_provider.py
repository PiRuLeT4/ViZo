import json
import re
import urllib.request
from datetime import datetime, timedelta


def parse_repo_url(url: str) -> tuple:
    """Parsea la URL y devuelve (platform, owner, repo_name)."""
    clean_url = url.strip().rstrip("/")
    if clean_url.endswith(".git"):
        clean_url = clean_url[:-4]

    github_match = re.search(r"github\.com/([^/]+)/([^/]+)", clean_url, re.IGNORECASE)
    if github_match:
        return "github", github_match.group(1), github_match.group(2)

    gitlab_match = re.search(r"gitlab\.com/([^/]+)/([^/]+)", clean_url, re.IGNORECASE)
    if gitlab_match:
        return "gitlab", gitlab_match.group(1), gitlab_match.group(2)

    return None, None, None


def parse_iso_date(date_str: str) -> datetime | None:
    """Parsea fecha ISO a datetime de Python."""
    if not date_str:
        return None
    try:
        clean_str = date_str.replace("Z", "").split(".")[0]
        return datetime.strptime(clean_str, "%Y-%m-%dT%H:%M:%S")
    except Exception:
        return None


class BaseMetadataProvider:
    """Clase base abstracta para extracción de metadatos de plataformas de Git."""

    def __init__(self, owner: str, repo: str, token: str = None):
        self.owner = owner
        self.repo = repo
        self.token = token

    def _http_get_json(self, url: str) -> dict | list | None:
        """Realiza una petición HTTP GET segura con soporte opcional de token OAuth."""
        headers = {"User-Agent": "ViZzo-Analysis-Suite"}
        if self.token:
            if "gitlab.com" in url:
                headers["PRIVATE-TOKEN"] = self.token
            else:
                headers["Authorization"] = f"token {self.token}"

        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status == 200:
                    return json.loads(response.read().decode("utf-8"))
        except Exception:
            pass
        return None

    def fetch_metadata(self) -> dict:
        raise NotImplementedError("Subclases deben implementar fetch_metadata()")

    def _build_code_reviews(self, user_reviews: dict, pr_creators: dict, review_matrix: dict) -> dict:
        """Construye los nodos y enlaces para la red de co-revisiones."""
        nodes = []
        for usr, count in user_reviews.items():
            nodes.append({"id": usr, "name": usr, "total_reviews_given": count})
        all_creators = set(pr_creators.values())
        for cr in all_creators:
            if cr not in user_reviews and cr != "Unknown":
                nodes.append({"id": cr, "name": cr, "total_reviews_given": 0})
        links = []
        for (src, tgt), cnt in review_matrix.items():
            links.append({"source": src, "target": tgt, "review_count": cnt})
        return {"nodes": nodes, "links": links}

    def _build_community_activity(self, community_stats: dict) -> list:
        """Construye la lista ordenada de actividad de colaboradores de la comunidad."""
        activity = []
        for user, stats in community_stats.items():
            total = stats.get("issues", 0) + stats.get("prs", 0)
            if total > 0:
                activity.append({
                    "user": user,
                    "issues_count": stats.get("issues", 0),
                    "prs_count": stats.get("prs", 0),
                    "total_contributions": total,
                })
        activity.sort(key=lambda x: x["total_contributions"], reverse=True)
        return activity[:15]

    def _build_releases_health(self, raw_releases: list, issues: list) -> list:
        """Calcula el índice de estabilidad de despliegues relacionando releases con bugs posteriores."""
        releases_health = []
        if isinstance(raw_releases, list):
            for rel in raw_releases:
                tag = rel.get("tag_name", "vUnknown")
                rel_date = parse_iso_date(rel.get("created_at"))

                bugs_count = 0
                if rel_date:
                    limit_date = rel_date + timedelta(days=7)
                    for issue in issues:
                        iss_date = parse_iso_date(issue.get("created_at"))
                        if iss_date and rel_date <= iss_date <= limit_date:
                            labels_str = "".join(issue.get("labels", [])).lower()
                            if "bug" in labels_str or "error" in labels_str:
                                bugs_count += 1

                releases_health.append({
                    "release_version": tag,
                    "release_month": rel_date.strftime("%b %Y") if rel_date else "Unknown",
                    "bugs_count": bugs_count,
                    "stability_index": 100 - min(100, bugs_count * 15),
                })
        return releases_health
