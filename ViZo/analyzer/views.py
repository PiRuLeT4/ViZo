import json

from django.contrib import messages
from django.shortcuts import redirect, render
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse

from .services import analyze_repository
from .ai_engine import get_ai_explanation


def index(request):
    if request.method == "POST":
        url = request.POST.get("repoUrl")
        depth = request.POST.get("depth")
        
        try:
            max_commits = int(depth) if depth else 150
        except ValueError:
            max_commits = 150

        result = analyze_repository(url, max_commits=max_commits)

        if result:
            file_metrics = result.get("file_metrics", [])
            data_by_language = result.get("data_by_language", [])
            evolution_data = result.get("evolution_data", [])
            author_activity = result.get("author_activity", [])
            ai_config = result.get("ai_config", {})
            repo_name = result.get("repo_name", "Unknown Repository")
            ai_status = ai_config.get("ai_status", "success")

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
                    "ai_status": ai_status,
                },
            )

        messages.error(
            request, 
            "Error: No se pudo clonar o analizar el repositorio. Verifica la URL e inténtalo de nuevo."
        )
        return redirect("index")
        
    return render(request, "analyzer/index.html")


@csrf_exempt
def api_explain(request):
    """
    Endpoint para solicitar una explicación analítica de calidad/refactorización.
    """
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body)
        dashboard_type = data.get("dashboard_type", "")
        dashboard_data = data.get("dashboard_data", {})
        repo_name = data.get("repo_name", "")

        if not dashboard_type or not repo_name:
            return JsonResponse({"error": "Missing dashboard_type or repo_name"}, status=400)

        # Generar explicación con el LLM
        explanation = get_ai_explanation(dashboard_type, json.dumps(dashboard_data), repo_name)
        return JsonResponse({"explanation": explanation})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)



