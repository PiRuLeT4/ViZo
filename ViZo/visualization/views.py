"""
views.py
────────
Vistas y endpoints correspondientes a la experiencia visual 3D/VR de ViZo.
"""

import json

from django.shortcuts import render, get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse

from analyzer.core.ai import get_ai_explanation
from analyzer.persistence.queries import build_result_from_session
from analyzer.models import AnalysisSession


def show_visualization(request, session_id):
    """
    Vista permanente (GET) para mostrar la escena 3D de una sesión de análisis previa.
    """
    session = get_object_or_404(AnalysisSession, pk=session_id)
    data = build_result_from_session(session)

    return render(
        request,
        "visualization/index.html",
        {
            "repo_name": data["repo_name"],
            "data_to_display": json.dumps(data["file_metrics"]),
            "data_by_language": json.dumps(data["data_by_language"]),
            "evolution_data": json.dumps(data.get("evolution_data", [])),
            "author_activity": json.dumps(data.get("author_activity", [])),
            "file_ownership": json.dumps(data.get("file_ownership", [])),
            "age_distribution": json.dumps(data.get("age_distribution", [])),
            "top_complex_files": json.dumps(data.get("top_complex_files", [])),
            "ai_config": json.dumps(data["ai_config"]),
            "ai_status": data["ai_config"].get("ai_status", "success"),
        },
    )


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
            return JsonResponse(
                {"error": "Missing dashboard_type or repo_name"}, status=400
            )

        # Generar explicación con el LLM
        from analyzer.core.ai import client, AI_MODEL

        print(f"Generating explanation for dashboard type: {dashboard_type}")
        print(f"Using AI client base_url: {client.base_url}, model: {AI_MODEL}")
        explanation = get_ai_explanation(
            dashboard_type, json.dumps(dashboard_data), repo_name
        )
        print("Explanation: Done")
        return JsonResponse({"explanation": explanation})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
