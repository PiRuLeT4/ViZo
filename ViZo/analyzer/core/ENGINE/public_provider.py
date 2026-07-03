import re
import urllib.request
import json
from datetime import datetime
from colorama import Fore

def parse_repo_url(url: str) -> tuple:
    """
    Parsea la URL de un repositorio y devuelve (platform, owner, repo_name).
    Soporta GitHub y GitLab.
    """
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

def fetch_public_metadata(repo_url: str) -> dict:
    """
    Descarga los últimos 100 Pull Requests e Issues públicos de un repositorio.
    No requiere tokens de autenticación.
    """
    result = {
        "pull_requests": [],
        "issues": []
    }
    
    platform, owner, repo = parse_repo_url(repo_url)
    if not platform:
        print(Fore.YELLOW + f"ViZo // URL no compatible con API pública de GitHub/GitLab: {repo_url}")
        return result
        
    print(Fore.YELLOW + f"ViZo // Consultando API pública de {platform.upper()} para {owner}/{repo}...")
    
    if platform == "github":
        # 1. Descargar Issues y PRs desde el endpoint de issues para obtener los contadores de comentarios
        issues_url = f"https://api.github.com/repos/{owner}/{repo}/issues?state=all&per_page=100"
        issues = _http_get_json(issues_url)
        
        comments_map = {}
        if isinstance(issues, list):
            for item in issues:
                comments_map[item.get("number")] = item.get("comments", 0)
                
            for issue in issues:
                # La API de GitHub incluye los PRs en el endpoint de issues.
                # Se diferencian porque los PRs tienen una clave 'pull_request'.
                if "pull_request" in issue:
                    continue
                result["issues"].append({
                    "id": issue.get("number"),
                    "title": issue.get("title", ""),
                    "state": issue.get("state", "open"),
                    "created_at": issue.get("created_at", ""),
                    "user": issue.get("user", {}).get("login", "Unknown") if issue.get("user") else "Unknown",
                    "comments": issue.get("comments", 0),
                    "labels": [label.get("name") for label in issue.get("labels", []) if label.get("name")]
                })
                
        # 2. Descargar Pull Requests (últimos 100) y cruzar comentarios correctos
        pulls_url = f"https://api.github.com/repos/{owner}/{repo}/pulls?state=all&per_page=100"
        pulls = _http_get_json(pulls_url)
        if isinstance(pulls, list):
            for pr in pulls:
                pr_number = pr.get("number")
                result["pull_requests"].append({
                    "id": pr_number,
                    "title": pr.get("title", ""),
                    "state": pr.get("state", "open"),
                    "created_at": pr.get("created_at", ""),
                    "user": pr.get("user", {}).get("login", "Unknown") if pr.get("user") else "Unknown",
                    "comments": comments_map.get(pr_number, 0)
                })
                
    elif platform == "gitlab":
        # 1. Descargar Merge Requests (GitLab's PRs)
        pulls_url = f"https://gitlab.com/api/v4/projects/{owner}%2F{repo}/merge_requests?per_page=100"
        pulls = _http_get_json(pulls_url)
        if isinstance(pulls, list):
            for pr in pulls:
                result["pull_requests"].append({
                    "id": pr.get("iid"),
                    "title": pr.get("title", ""),
                    "state": "closed" if pr.get("state") == "merged" or pr.get("state") == "closed" else "open",
                    "created_at": pr.get("created_at", ""),
                    "user": pr.get("author", {}).get("username", "Unknown") if pr.get("author") else "Unknown",
                    "comments": pr.get("user_notes_count", 0)
                })
                
        # 2. Descargar Issues
        issues_url = f"https://gitlab.com/api/v4/projects/{owner}%2F{repo}/issues?per_page=100"
        issues = _http_get_json(issues_url)
        if isinstance(issues, list):
            for issue in issues:
                result["issues"].append({
                    "id": issue.get("iid"),
                    "title": issue.get("title", ""),
                    "state": issue.get("state", "opened") if issue.get("state") != "opened" else "open",
                    "created_at": issue.get("created_at", ""),
                    "user": issue.get("author", {}).get("username", "Unknown") if issue.get("author") else "Unknown",
                    "comments": issue.get("user_notes_count", 0),
                    "labels": issue.get("labels", [])
                })
                
    print(Fore.CYAN + f"ViZo // API Metadata: {len(result['pull_requests'])} PRs, {len(result['issues'])} Issues descargados.")
    return result

def _http_get_json(url: str):
    """Realiza una petición HTTP GET segura y devuelve el JSON parseado."""
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "ViZo-Analysis-Suite"}
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status == 200:
                return json.loads(response.read().decode("utf-8"))
    except Exception as e:
        print(Fore.RED + f"ViZo // Error en petición API pública ({url}): {e}")
    return None
