import json
import logging
import os
import requests

from django.shortcuts import render, get_object_or_404
from django.views.decorators.csrf import ensure_csrf_cookie
from django.http import JsonResponse, HttpResponse

from analyzer.core.AI.ai import get_ai_explanation
from analyzer.persistence.queries import build_result_from_session
from analyzer.models import AnalysisSession
from analyzer.services.ratelimit import ratelimit

logger = logging.getLogger(__name__)


@ensure_csrf_cookie
def show_visualization(request, session_id):
    """
    Vista permanente (GET) para mostrar la escena 3D de una sesión de análisis previa.
    """
    session = get_object_or_404(AnalysisSession, pk=session_id)
    # Solo recuperamos metadatos mínimos para renderizar el cascarón de la UI
    data = build_result_from_session(session)

    return render(
        request,
        "visualization/index.html",
        {
            "session_id": session.id,
            "repo_name": data["repo_name"],
            "ai_status": data["ai_config"].get("ai_status", "success"),
        },
    )


@ratelimit(rate="20/m")
def api_session_data(request, session_id):
    """
    Endpoint REST que retorna en JSON todos los datasets requeridos
    para inicializar los visualizadores 3D en la página.
    """
    session = get_object_or_404(AnalysisSession, pk=session_id)
    data = build_result_from_session(session)
    return JsonResponse({
        "repo_name": data["repo_name"],
        "repo_summary": data.get("repo_summary", {}),
        "file_metrics": data["file_metrics"],
        "data_by_language": data["data_by_language"],
        "evolution_data": data.get("evolution_data", []),
        "author_activity": data.get("author_activity", []),
        "file_ownership": data.get("file_ownership", []),
        "age_distribution": data.get("age_distribution", []),
        "top_complex_files": data.get("top_complex_files", []),
        "file_network": data.get("file_network", []),
        "pull_requests": data.get("pull_requests", []),
        "issues": data.get("issues", []),
        "ai_config": data["ai_config"],
    })


@ratelimit(rate="15/m")
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
        llm_base_url = request.COOKIES.get("vizzo_llm_base_url", "").strip() or data.get("llm_base_url", "").strip() or None
        llm_api_key = request.COOKIES.get("vizzo_llm_api_key", "").strip() or data.get("llm_api_key", "").strip() or None
        llm_model = request.COOKIES.get("vizzo_llm_model", "").strip() or data.get("llm_model", "").strip() or None

        if not dashboard_type or not repo_name:
            return JsonResponse(
                {"error": "Missing dashboard_type or repo_name"}, status=400
            )

        language = data.get("language", "es").strip()
        if language not in ["es", "en"]:
            language = "es"

        # Generar explicación con el LLM
        from analyzer.core.AI.ai import client, AI_MODEL, parse_explanation_sections

        logger.info(f"Generating explanation ({language}) for dashboard type: {dashboard_type}")
        logger.debug(f"Using AI client base_url: {llm_base_url or client.base_url}, model: {llm_model or AI_MODEL}")
        raw_explanation = get_ai_explanation(
            dashboard_type, json.dumps(dashboard_data), repo_name,
            base_url=llm_base_url,
            api_key=llm_api_key,
            model=llm_model,
            language=language,
        )
        sections = parse_explanation_sections(raw_explanation)
        logger.info("Explanation & Sections: Done")
        return JsonResponse({"explanation": raw_explanation, "sections": sections})

    except Exception as e:
        logger.exception("Error generando explicación de IA")
        return JsonResponse({"error": "Error interno al generar la explicación."}, status=500)


@ratelimit(rate="5/m")
def api_tts(request):
    """
    Endpoint para convertir texto de explicación a audio MP3 utilizando la API TTS de Grok (xAI).
    """
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body)
        text = data.get("text", "").strip()
        voice_id = data.get("voice_id", "eve").strip()
        language = data.get("language", "es").strip()

        if not text:
            return JsonResponse({"error": "Missing text parameter"}, status=400)

        # Truncar el texto a 500 caracteres máximo para proteger el consumo de la API de xAI
        text = text[:500]

        xai_api_key = os.getenv("XAI_API_KEY", "").strip()
        if not xai_api_key:
            return JsonResponse(
                {"error": "XAI_API_KEY no configurada en las variables de entorno (.env)."},
                status=500,
            )

        import requests

        headers = {
            "Authorization": f"Bearer {xai_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "text": text,
            "voice_id": voice_id,
            "language": language,
            "output_format": {
                "codec": "mp3",
                "sample_rate": 24000,
                "bit_rate": 128000,
            },
        }

        response = requests.post(
            "https://api.x.ai/v1/tts",
            headers=headers,
            json=payload,
            timeout=30,
        )
        if response.status_code != 200:
            return JsonResponse(
                {"error": f"Error de API Grok TTS ({response.status_code})"},
                status=response.status_code,
            )

        return HttpResponse(response.content, content_type="audio/mpeg")

    except Exception as e:
        logger.exception("Error generando audio TTS")
        return JsonResponse({"error": "Error interno al generar el audio."}, status=500)


