import urllib.request
import json
import re
from datetime import datetime, timedelta
from colorama import Fore

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

def _parse_date(date_str: str) -> datetime:
    """Parsea fecha ISO a datetime de Python."""
    if not date_str:
        return None
    try:
        # Remover Z para compatibilidad con versiones previas de Python
        clean_str = date_str.replace("Z", "").split(".")[0]
        return datetime.strptime(clean_str, "%Y-%m-%dT%H:%M:%S")
    except Exception:
        return None

def fetch_private_metadata(repo_url: str, token: str) -> dict:
    """
    Descarga metadatos enriquecidos de la API usando el token OAuth.
    Optimiza el consumo del Rate Limit haciendo consultas masivas en lote.
    """
    result = {
        "pull_requests": [],
        "issues": [],
        "stars": 0,
        "forks": 0,
        "code_reviews": {"nodes": [], "links": []},
        "issues_health": [],
        "releases_health": [],
        "community_activity": []
    }

    if not token:
        print(Fore.YELLOW + "ViZzo // [Warning] private_provider invocado sin token. Retornando vacío.")
        return result

    platform, owner, repo = parse_repo_url(repo_url)
    if not platform:
        return result

    print(Fore.CYAN + f"ViZzo // Iniciando extracción autenticada ({platform.upper()}) para {owner}/{repo}...")

    # Helper HTTP GET con token inyectado
    def _http_get_auth(url: str):
        headers = {"User-Agent": "ViZzo-Analysis-Suite"}
        if platform == "github":
            headers["Authorization"] = f"token {token}"
            headers["Accept"] = "application/vnd.github.v3+json"
        elif platform == "gitlab":
            headers["Authorization"] = f"Bearer {token}"
            
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=12) as response:
                if response.status == 200:
                    return json.loads(response.read().decode("utf-8"))
        except Exception as e:
            print(Fore.RED + f"ViZzo // Error en llamada autenticada ({url}): {e}")
        return None

    if platform == "github":
        # 1. Detalles del Repositorio (Stars & Forks)
        repo_url_api = f"https://api.github.com/repos/{owner}/{repo}"
        repo_details = _http_get_auth(repo_url_api)
        if isinstance(repo_details, dict):
            result["stars"] = repo_details.get("stargazers_count", 0)
            result["forks"] = repo_details.get("forks_count", 0)

        # Mapeos locales
        review_matrix = {}
        user_reviews = {}
        community_stats = {}
        pr_creators = {}
        comments_map = {}

        # 2. Issues (Últimos 100 de cualquier estado para agrupar salud)
        issues_url = f"https://api.github.com/repos/{owner}/{repo}/issues?state=all&per_page=100"
        raw_issues = _http_get_auth(issues_url) or []
        
        if isinstance(raw_issues, list):
            health_categories = {}
            for item in raw_issues:
                is_pr = "pull_request" in item
                num = item.get("number")
                comments_map[num] = item.get("comments", 0)
                creator = item.get("user", {}).get("login", "Unknown") if item.get("user") else "Unknown"
                
                # Inicializar estadísticas del colaborador
                if creator != "Unknown":
                    if creator not in community_stats:
                        community_stats[creator] = {"issues": 0, "prs": 0}
                
                if is_pr:
                    pr_creators[num] = creator
                    if creator != "Unknown":
                        community_stats[creator]["prs"] += 1
                        
                    # Relaciones de asignación de PR
                    assignees = item.get("assignees", []) or []
                    if item.get("assignee"):
                        assignees.append(item.get("assignee"))
                    for ass in assignees:
                        ass_name = ass.get("login") if isinstance(ass, dict) else None
                        if ass_name and ass_name != creator:
                            key = (creator, ass_name)
                            review_matrix[key] = review_matrix.get(key, 0) + 1
                            user_reviews[ass_name] = user_reviews.get(ass_name, 0) + 1
                    continue
                    
                # Si es un issue real:
                if creator != "Unknown":
                    community_stats[creator]["issues"] += 1
                
                # Clasificación de etiquetas de salud
                labels = item.get("labels", [])
                label_names = [l.get("name") for l in labels if l.get("name")] if isinstance(labels, list) else []
                
                category = "general"
                joined_labels = "".join(label_names).lower()
                if any(x in joined_labels for x in ["bug", "error", "defect"]):
                    category = "bug"
                elif any(x in joined_labels for x in ["feature", "enhancement"]):
                    category = "feature"
                elif "doc" in joined_labels:
                    category = "documentation"
                elif "refactor" in joined_labels:
                    category = "refactor"
                elif label_names:
                    category = label_names[0][:15]

                health_categories[category] = health_categories.get(category, 0) + 1

                # Relaciones de asignación de Issue
                assignees = item.get("assignees", []) or []
                if item.get("assignee"):
                    assignees.append(item.get("assignee"))
                for ass in assignees:
                    ass_name = ass.get("login") if isinstance(ass, dict) else None
                    if ass_name and ass_name != creator:
                        key = (creator, ass_name)
                        review_matrix[key] = review_matrix.get(key, 0) + 1
                        user_reviews[ass_name] = user_reviews.get(ass_name, 0) + 1

                result["issues"].append({
                    "id": num,
                    "title": item.get("title", ""),
                    "state": item.get("state", "open"),
                    "created_at": item.get("created_at", ""),
                    "user": creator,
                    "comments": item.get("comments", 0),
                    "labels": label_names
                })
            
            result["issues_health"] = [{"label": cat, "count": cnt} for cat, cnt in health_categories.items()]

        # 3. Pull Requests (Últimos 100 de cualquier estado para latencia de merge)
        pulls_url = f"https://api.github.com/repos/{owner}/{repo}/pulls?state=all&per_page=100"
        raw_pulls = _http_get_auth(pulls_url) or []
        if isinstance(raw_pulls, list):
            for pr in raw_pulls:
                num = pr.get("number")
                creator = pr.get("user", {}).get("login", "Unknown") if pr.get("user") else "Unknown"
                
                # Revisor solicitado de PR
                revs = pr.get("requested_reviewers", []) or []
                for rev in revs:
                    rev_name = rev.get("login") if isinstance(rev, dict) else None
                    if rev_name and rev_name != creator:
                        key = (creator, rev_name)
                        review_matrix[key] = review_matrix.get(key, 0) + 1
                        user_reviews[rev_name] = user_reviews.get(rev_name, 0) + 1
                
                # Asignado de PR
                assignees = pr.get("assignees", []) or []
                for ass in assignees:
                    ass_name = ass.get("login") if isinstance(ass, dict) else None
                    if ass_name and ass_name != creator:
                        key = (creator, ass_name)
                        review_matrix[key] = review_matrix.get(key, 0) + 1
                        user_reviews[ass_name] = user_reviews.get(ass_name, 0) + 1
                
                latency_hours = 0.0
                c_date = _parse_date(pr.get("created_at"))
                m_date = _parse_date(pr.get("merged_at"))
                if c_date and m_date:
                    latency_hours = round((m_date - c_date).total_seconds() / 3600, 1)

                result["pull_requests"].append({
                    "id": num,
                    "title": pr.get("title", ""),
                    "state": pr.get("state", "open"),
                    "created_at": pr.get("created_at", ""),
                    "user": creator,
                    "comments": comments_map.get(num, 0),
                    "merge_latency_hours": latency_hours
                })

        # 4. Code Reviews (Matriz de revisiones en una sola llamada por lote + comentarios)
        comments_url = f"https://api.github.com/repos/{owner}/{repo}/pulls/comments?per_page=100"
        raw_comments = _http_get_auth(comments_url) or []
        
        if isinstance(raw_comments, list):
            for comment in raw_comments:
                revisor = comment.get("user", {}).get("login", "Unknown") if comment.get("user") else "Unknown"
                pr_url = comment.get("pull_request_url", "")
                
                try:
                    pr_num = int(pr_url.split("/")[-1])
                except Exception:
                    continue
                
                creador = pr_creators.get(pr_num)
                if creador and creador != revisor:
                    key = (creador, revisor)
                    review_matrix[key] = review_matrix.get(key, 0) + 1
                    user_reviews[revisor] = user_reviews.get(revisor, 0) + 1

        # Construir nodos de red
        nodes = []
        for usr, count in user_reviews.items():
            nodes.append({
                "id": usr,
                "name": usr,
                "total_reviews_given": count
            })
        all_creators = set(pr_creators.values())
        for cr in all_creators:
            if cr not in user_reviews and cr != "Unknown":
                nodes.append({
                    "id": cr,
                    "name": cr,
                    "total_reviews_given": 0
                })
        links = []
        for (src, tgt), cnt in review_matrix.items():
            links.append({
                "source": src,
                "target": tgt,
                "review_count": cnt
            })
        result["code_reviews"] = {"nodes": nodes, "links": links}

        # 5. Releases y Bugs (Lanzamientos vs Estabilidad)
        releases_url = f"https://api.github.com/repos/{owner}/{repo}/releases?per_page=10"
        raw_releases = _http_get_auth(releases_url) or []
        if isinstance(raw_releases, list):
            for rel in raw_releases:
                tag = rel.get("tag_name", "vUnknown")
                rel_date = _parse_date(rel.get("created_at"))
                
                bugs_count = 0
                if rel_date:
                    limit_date = rel_date + timedelta(days=7)
                    for issue in result["issues"]:
                        iss_date = _parse_date(issue.get("created_at"))
                        if iss_date and rel_date <= iss_date <= limit_date:
                            labels_str = "".join(issue.get("labels", [])).lower()
                            if "bug" in labels_str or "error" in labels_str:
                                bugs_count += 1
                                
                result["releases_health"].append({
                    "release_version": tag,
                    "release_month": rel_date.strftime("%b %Y") if rel_date else "Unknown",
                    "bugs_count": bugs_count,
                    "stability_index": 100 - min(100, bugs_count * 15)
                })

        # 6. Actividad de la comunidad
        result["community_activity"] = []
        for user, stats in community_stats.items():
            total = stats["issues"] + stats["prs"]
            if total > 0:
                result["community_activity"].append({
                    "user": user,
                    "issues_count": stats["issues"],
                    "prs_count": stats["prs"],
                    "total_contributions": total
                })
        result["community_activity"].sort(key=lambda x: x["total_contributions"], reverse=True)
        result["community_activity"] = result["community_activity"][:15]

    elif platform == "gitlab":
        repo_url_api = f"https://gitlab.com/api/v4/projects/{owner}%2F{repo}"
        repo_details = _http_get_auth(repo_url_api)
        if isinstance(repo_details, dict):
            result["stars"] = repo_details.get("star_count", 0)
            result["forks"] = repo_details.get("forks_count", 0)

        # Mapeos locales
        review_matrix = {}
        user_reviews = {}
        community_stats = {}
        pr_creators = {}

        # Merge Requests
        pulls_url = f"https://gitlab.com/api/v4/projects/{owner}%2F{repo}/merge_requests?per_page=100"
        raw_pulls = _http_get_auth(pulls_url) or []
        if isinstance(raw_pulls, list):
            for pr in raw_pulls:
                num = pr.get("iid")
                creator = pr.get("author", {}).get("username", "Unknown") if pr.get("author") else "Unknown"
                pr_creators[num] = creator
                
                if creator != "Unknown":
                    if creator not in community_stats:
                        community_stats[creator] = {"issues": 0, "prs": 0}
                    community_stats[creator]["prs"] += 1
                
                # Asignados de la MR
                assignees = pr.get("assignees", []) or []
                if pr.get("assignee"):
                    assignees.append(pr.get("assignee"))
                for ass in assignees:
                    ass_name = ass.get("username") if isinstance(ass, dict) else None
                    if ass_name and ass_name != creator:
                        key = (creator, ass_name)
                        review_matrix[key] = review_matrix.get(key, 0) + 1
                        user_reviews[ass_name] = user_reviews.get(ass_name, 0) + 1
                
                # Reviewers de la MR
                revs = pr.get("reviewers", []) or []
                for rev in revs:
                    rev_name = rev.get("username") if isinstance(rev, dict) else None
                    if rev_name and rev_name != creator:
                        key = (creator, rev_name)
                        review_matrix[key] = review_matrix.get(key, 0) + 1
                        user_reviews[rev_name] = user_reviews.get(rev_name, 0) + 1

                latency_hours = 0.0
                c_date = _parse_date(pr.get("created_at"))
                m_date = _parse_date(pr.get("merged_at"))
                if c_date and m_date:
                    latency_hours = round((m_date - c_date).total_seconds() / 3600, 1)

                result["pull_requests"].append({
                    "id": num,
                    "title": pr.get("title", ""),
                    "state": "closed" if pr.get("state") in ["merged", "closed"] else "open",
                    "created_at": pr.get("created_at", ""),
                    "user": creator,
                    "comments": pr.get("user_notes_count", 0),
                    "merge_latency_hours": latency_hours
                })

        # Issues
        issues_url = f"https://gitlab.com/api/v4/projects/{owner}%2F{repo}/issues?per_page=100"
        raw_issues = _http_get_auth(issues_url) or []
        if isinstance(raw_issues, list):
            health_categories = {}
            for issue in raw_issues:
                num = issue.get("iid")
                creator = issue.get("author", {}).get("username", "Unknown") if issue.get("author") else "Unknown"
                
                if creator != "Unknown":
                    if creator not in community_stats:
                        community_stats[creator] = {"issues": 0, "prs": 0}
                    community_stats[creator]["issues"] += 1
                
                labels = issue.get("labels", [])
                category = "general"
                joined_labels = "".join(labels).lower()
                if any(x in joined_labels for x in ["bug", "error"]):
                    category = "bug"
                elif any(x in joined_labels for x in ["feature", "enhance"]):
                    category = "feature"
                elif "doc" in joined_labels:
                    category = "documentation"
                
                health_categories[category] = health_categories.get(category, 0) + 1

                # Asignados del issue
                assignees = issue.get("assignees", []) or []
                if issue.get("assignee"):
                    assignees.append(issue.get("assignee"))
                for ass in assignees:
                    ass_name = ass.get("username") if isinstance(ass, dict) else None
                    if ass_name and ass_name != creator:
                        key = (creator, ass_name)
                        review_matrix[key] = review_matrix.get(key, 0) + 1
                        user_reviews[ass_name] = user_reviews.get(ass_name, 0) + 1

                result["issues"].append({
                    "id": num,
                    "title": issue.get("title", ""),
                    "state": issue.get("state", "opened") if issue.get("state") != "opened" else "open",
                    "created_at": issue.get("created_at", ""),
                    "user": creator,
                    "comments": issue.get("user_notes_count", 0),
                    "labels": labels
                })
            result["issues_health"] = [{"label": cat, "count": cnt} for cat, cnt in health_categories.items()]

        # Construir nodos de red
        nodes = []
        for usr, count in user_reviews.items():
            nodes.append({
                "id": usr,
                "name": usr,
                "total_reviews_given": count
            })
        all_creators = set(pr_creators.values())
        for cr in all_creators:
            if cr not in user_reviews and cr != "Unknown":
                nodes.append({
                    "id": cr,
                    "name": cr,
                    "total_reviews_given": 0
                })
        links = []
        for (src, tgt), cnt in review_matrix.items():
            links.append({
                "source": src,
                "target": tgt,
                "review_count": cnt
            })
        result["code_reviews"] = {"nodes": nodes, "links": links}

        # Releases y estabilidad
        releases_url = f"https://gitlab.com/api/v4/projects/{owner}%2F{repo}/releases?per_page=10"
        raw_releases = _http_get_auth(releases_url) or []
        if isinstance(raw_releases, list):
            for rel in raw_releases:
                tag = rel.get("tag_name", "vUnknown")
                rel_date = _parse_date(rel.get("created_at"))
                
                bugs_count = 0
                if rel_date:
                    limit_date = rel_date + timedelta(days=7)
                    for issue in result["issues"]:
                        iss_date = _parse_date(issue.get("created_at"))
                        if iss_date and rel_date <= iss_date <= limit_date:
                            labels_str = "".join(issue.get("labels", [])).lower()
                            if "bug" in labels_str or "error" in labels_str:
                                bugs_count += 1
                                
                result["releases_health"].append({
                    "release_version": tag,
                    "release_month": rel_date.strftime("%b %Y") if rel_date else "Unknown",
                    "bugs_count": bugs_count,
                    "stability_index": 100 - min(100, bugs_count * 15)
                })

        # Community Activity
        result["community_activity"] = []
        for user, stats in community_stats.items():
            total = stats["issues"] + stats["prs"]
            if total > 0:
                result["community_activity"].append({
                    "user": user,
                    "issues_count": stats["issues"],
                    "prs_count": stats["prs"],
                    "total_contributions": total
                })
        result["community_activity"].sort(key=lambda x: x["total_contributions"], reverse=True)
        result["community_activity"] = result["community_activity"][:15]

    print(Fore.CYAN + f"ViZzo // Extracción autenticada finalizada: {len(result['pull_requests'])} PRs, {len(result['issues'])} Issues, {result['stars']} Stars, {len(result['releases_health'])} Releases analizadas.")
    return result
