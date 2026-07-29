from .base_provider import BaseMetadataProvider, parse_iso_date


class GitHubMetadataProvider(BaseMetadataProvider):
    """Proveedor especializado de extracción de metadatos de GitHub API v3."""

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

        # 1. Estadísticas generales
        repo_details = self._http_get_json(f"https://api.github.com/repos/{self.owner}/{self.repo}")
        if isinstance(repo_details, dict):
            result["stars"] = repo_details.get("stargazers_count", 0)
            result["forks"] = repo_details.get("forks_count", 0)

        review_matrix = {}
        user_reviews = {}
        community_stats = {}
        pr_creators = {}
        comments_map = {}

        # 2. Issues y PRs
        issues_data = self._http_get_json(
            f"https://api.github.com/repos/{self.owner}/{self.repo}/issues?state=all&per_page=100"
        )
        if isinstance(issues_data, list):
            health_categories = {}
            for item in issues_data:
                num = item.get("number")
                comments_map[num] = item.get("comments", 0)
                is_pr = "pull_request" in item
                creator = item.get("user", {}).get("login", "Unknown") if item.get("user") else "Unknown"

                if creator != "Unknown":
                    if creator not in community_stats:
                        community_stats[creator] = {"issues": 0, "prs": 0}

                if is_pr:
                    pr_creators[num] = creator
                    if creator != "Unknown":
                        community_stats[creator]["prs"] += 1

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

                if creator != "Unknown":
                    community_stats[creator]["issues"] += 1

                labels = item.get("labels", []) or []
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
                    "labels": label_names,
                })

            result["issues_health"] = [{"label": cat, "count": cnt} for cat, cnt in health_categories.items()]

        # 3. Pull Requests
        pulls_data = self._http_get_json(
            f"https://api.github.com/repos/{self.owner}/{self.repo}/pulls?state=all&per_page=100"
        )
        if isinstance(pulls_data, list):
            for pr in pulls_data:
                pr_number = pr.get("number")
                creator = pr.get("user", {}).get("login", "Unknown") if pr.get("user") else "Unknown"

                for rev in pr.get("requested_reviewers", []) or []:
                    rev_name = rev.get("login") if isinstance(rev, dict) else None
                    if rev_name and rev_name != creator:
                        key = (creator, rev_name)
                        review_matrix[key] = review_matrix.get(key, 0) + 1
                        user_reviews[rev_name] = user_reviews.get(rev_name, 0) + 1

                for ass in pr.get("assignees", []) or []:
                    ass_name = ass.get("login") if isinstance(ass, dict) else None
                    if ass_name and ass_name != creator:
                        key = (creator, ass_name)
                        review_matrix[key] = review_matrix.get(key, 0) + 1
                        user_reviews[ass_name] = user_reviews.get(ass_name, 0) + 1

                latency_hours = 0.0
                c_date = parse_iso_date(pr.get("created_at"))
                m_date = parse_iso_date(pr.get("merged_at"))
                if c_date and m_date:
                    latency_hours = round((m_date - c_date).total_seconds() / 3600, 1)

                result["pull_requests"].append({
                    "id": pr_number,
                    "title": pr.get("title", ""),
                    "state": pr.get("state", "open"),
                    "created_at": pr.get("created_at", ""),
                    "user": creator,
                    "comments": comments_map.get(pr_number, 0),
                    "merge_latency_hours": latency_hours,
                })

        result["code_reviews"] = self._build_code_reviews(user_reviews, pr_creators, review_matrix)

        # 4. Releases
        raw_releases = self._http_get_json(f"https://api.github.com/repos/{self.owner}/{self.repo}/releases?per_page=10")
        result["releases_health"] = self._build_releases_health(raw_releases, result["issues"])

        # 5. Actividad de comunidad
        result["community_activity"] = self._build_community_activity(community_stats)

        return result
