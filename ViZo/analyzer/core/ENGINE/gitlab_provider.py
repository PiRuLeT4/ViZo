from .base_provider import BaseMetadataProvider, parse_iso_date


class GitLabMetadataProvider(BaseMetadataProvider):
    """Proveedor especializado de extracción de metadatos de GitLab API v4."""

    def fetch_metadata(self) -> dict:
        result = {
            "pull_requests": [],
            "issues": [],
            "stars": 0,
            "forks": 0,
            "code_reviews": {"nodes": [], "links": []},
            "issues_health": [],
            "releases_health": [],
            "community_activity": [],
        }

        project_path = f"{self.owner}%2F{self.repo}"

        # 1. Estadísticas generales
        repo_details = self._http_get_json(f"https://gitlab.com/api/v4/projects/{project_path}")
        if isinstance(repo_details, dict):
            result["stars"] = repo_details.get("star_count", 0)
            result["forks"] = repo_details.get("forks_count", 0)

        review_matrix = {}
        user_reviews = {}
        community_stats = {}
        pr_creators = {}

        # 2. Merge Requests (PRs de GitLab)
        pulls_data = self._http_get_json(f"https://gitlab.com/api/v4/projects/{project_path}/merge_requests?per_page=100")
        if isinstance(pulls_data, list):
            for pr in pulls_data:
                num = pr.get("iid")
                creator = pr.get("author", {}).get("username", "Unknown") if pr.get("author") else "Unknown"
                pr_creators[num] = creator

                if creator != "Unknown":
                    if creator not in community_stats:
                        community_stats[creator] = {"issues": 0, "prs": 0}
                    community_stats[creator]["prs"] += 1

                assignees = pr.get("assignees", []) or []
                if pr.get("assignee"):
                    assignees.append(pr.get("assignee"))
                for ass in assignees:
                    ass_name = ass.get("username") if isinstance(ass, dict) else None
                    if ass_name and ass_name != creator:
                        key = (creator, ass_name)
                        review_matrix[key] = review_matrix.get(key, 0) + 1
                        user_reviews[ass_name] = user_reviews.get(ass_name, 0) + 1

                for rev in pr.get("reviewers", []) or []:
                    rev_name = rev.get("username") if isinstance(rev, dict) else None
                    if rev_name and rev_name != creator:
                        key = (creator, rev_name)
                        review_matrix[key] = review_matrix.get(key, 0) + 1
                        user_reviews[rev_name] = user_reviews.get(rev_name, 0) + 1

                latency_hours = 0.0
                c_date = parse_iso_date(pr.get("created_at"))
                m_date = parse_iso_date(pr.get("merged_at"))
                if c_date and m_date:
                    latency_hours = round((m_date - c_date).total_seconds() / 3600, 1)

                result["pull_requests"].append({
                    "id": num,
                    "title": pr.get("title", ""),
                    "state": "closed" if pr.get("state") in ["merged", "closed"] else "open",
                    "created_at": pr.get("created_at", ""),
                    "user": creator,
                    "comments": pr.get("user_notes_count", 0),
                    "merge_latency_hours": latency_hours,
                })

        # 3. Issues
        issues_data = self._http_get_json(f"https://gitlab.com/api/v4/projects/{project_path}/issues?per_page=100")
        if isinstance(issues_data, list):
            health_categories = {}
            for issue in issues_data:
                num = issue.get("iid")
                creator = issue.get("author", {}).get("username", "Unknown") if issue.get("author") else "Unknown"

                if creator != "Unknown":
                    if creator not in community_stats:
                        community_stats[creator] = {"issues": 0, "prs": 0}
                    community_stats[creator]["issues"] += 1

                labels = issue.get("labels", []) or []
                category = "general"
                joined_labels = "".join(labels).lower()
                if any(x in joined_labels for x in ["bug", "error"]):
                    category = "bug"
                elif any(x in joined_labels for x in ["feature", "enhance"]):
                    category = "feature"
                elif "doc" in joined_labels:
                    category = "documentation"

                health_categories[category] = health_categories.get(category, 0) + 1

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
                    "labels": labels,
                })
            result["issues_health"] = [{"label": cat, "count": cnt} for cat, cnt in health_categories.items()]

        result["code_reviews"] = self._build_code_reviews(user_reviews, pr_creators, review_matrix)

        # 4. Releases
        raw_releases = self._http_get_json(f"https://gitlab.com/api/v4/projects/{project_path}/releases?per_page=10")
        result["releases_health"] = self._build_releases_health(raw_releases, result["issues"])

        # 5. Actividad de comunidad
        result["community_activity"] = self._build_community_activity(community_stats)

        return result
