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
            ai_config = result.get("ai_config", {})
            return render(
                request,
                "visualization/index.html",
                {
                    "data_to_display": json.dumps(file_metrics),
                    "data_by_language": json.dumps(data_by_language),
                    "evolution_data": json.dumps(evolution_data),
                    "ai_config": json.dumps(ai_config),
                },
            )

        return redirect("index")
    return render(request, "analyzer/index.html")
