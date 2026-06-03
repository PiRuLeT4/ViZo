"""
api.py
──────
Endpoints de la API para registrar, arrancar asíncronamente y sondear estados de análisis.
"""
from django.shortcuts import get_object_or_404
from django.http import JsonResponse

from analyzer.services.orchestrator import start_async_analysis
from analyzer.models import AnalysisSession


def api_analyze(request):
    """
    Endpoint POST AJAX de análisis asíncrono de alto rendimiento.
    """
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    url = request.POST.get("repoUrl")
    depth = request.POST.get("depth")

    if not url:
        return JsonResponse({"error": "La URL del repositorio es obligatoria."}, status=400)

    try:
        max_commits = int(depth) if depth else 150
    except ValueError:
        max_commits = 150

    is_private = request.POST.get("isPrivate") in ["true", "on", "1"] or request.POST.get("is_private") in ["true", "on", "1"]
    if is_private and not request.user.is_authenticated:
        return JsonResponse(
            {"error": "Debes iniciar sesión con GitHub para poder analizar repositorios privados."},
            status=401
        )

    try:
        # Iniciar flujo asíncrono con control de hilos, usuario, privacidad y caché inteligente
        session_id, is_cache_hit = start_async_analysis(
            url,
            max_commits=max_commits,
            user=request.user,
            is_private=is_private
        )
    except PermissionError as e:
        if str(e) == "PRIVATE_REPO_WITHOUT_SHIELD":
            return JsonResponse({
                "error": "El repositorio es privado. Debes activar la opción 'Analizar como Privado' para poder proceder de forma segura y confidencial."
            }, status=403)
        raise e

    return JsonResponse({
        "status": "success",
        "session_id": session_id,
        "is_cache_hit": is_cache_hit,
    })


def api_session_status(request, session_id):
    """
    Endpoint GET de sondeo para consultar el estado de una sesión de análisis.
    """
    session = get_object_or_404(AnalysisSession, pk=session_id)
    return JsonResponse({
        "session_id": session.id,
        "status": session.status,
        "error_message": session.error_message
    })
