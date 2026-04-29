import json

from django.shortcuts import redirect, render

from .services import analyze_repository


def index(request):
    if request.method == "POST":
        url = request.POST.get("repoUrl")
        result = analyze_repository(url)

        if result:
            file_metrics = result.get("file_metrics", [])
            data_by_language = result.get("data_by_language", [])
            evolution_data = result.get("evolution_data", [])

            # Generar author_activity agrupando por autor y fecha para el babia-barsmap
            activity_dict = {}
            for commit in evolution_data:
                author = commit.get("author", "Unknown")
                date = commit.get("date", "")
                insertions = commit.get("insertions", 0)

                key = (author, date)
                if key not in activity_dict:
                    activity_dict[key] = {
                        "author": author,
                        "date": date,
                        "commits": 0,
                        "insertions": 0,
                    }

                activity_dict[key]["commits"] += 1
                activity_dict[key]["insertions"] += insertions

            author_activity = list(activity_dict.values())

            # Limitar a las 15 fechas más recientes para evitar que el barsmap sea inmanejable
            all_dates = sorted(
                list(set(item["date"] for item in author_activity if item["date"])),
                reverse=True,
            )
            recent_dates = set(all_dates[:15])
            author_activity = [
                item for item in author_activity if item["date"] in recent_dates
            ]
            # print(f"author_activity: {author_activity}")

            ai_config = result.get("ai_config", {})
            repo_name = result.get("repo_name", "Unknown Repository")
            return render(
                request,
                "visualization/index.html",
                {
                    "repo_name": repo_name,
                    "data_to_display": json.dumps(file_metrics),
                    "data_by_language": json.dumps(data_by_language),
                    "evolution_data": json.dumps(evolution_data),
                    "author_activity": json.dumps(author_activity),
                    "ai_config": json.dumps(ai_config),
                },
            )

        return redirect("index")
    return render(request, "analyzer/index.html")
