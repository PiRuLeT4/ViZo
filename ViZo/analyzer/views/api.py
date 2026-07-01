"""
api.py
──────
Endpoints de la API para registrar, arrancar asíncronamente y sondear estados de análisis.
"""
from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

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
    analysis_mode = request.POST.get("analysis_mode", "commits")
    if analysis_mode not in ["commits", "releases"]:
        analysis_mode = "commits"

    if not url:
        return JsonResponse({"error": "La URL del repositorio es obligatoria."}, status=400)

    if depth == "all":
        max_commits = 0
    else:
        try:
            max_commits = int(depth) if depth else (150 if analysis_mode == "commits" else 10)
        except ValueError:
            max_commits = 150 if analysis_mode == "commits" else 10

    is_private = request.POST.get("isPrivate") in ["true", "on", "1"] or request.POST.get("is_private") in ["true", "on", "1"]
    if is_private:
        if not request.user.is_authenticated:
            return JsonResponse(
                {"error": "Debes iniciar sesión para poder analizar repositorios privados."},
                status=401
            )
        
        # Determinar el proveedor basado en el dominio de la URL del repositorio
        provider = "github" if "github.com" in url else "gitlab" if "gitlab.com" in url else None
        
        # Comprobar si el usuario tiene el token correspondiente guardado en su perfil
        has_token = False
        try:
            profile = request.user.profile
            if provider == "github" and profile.github_token:
                has_token = True
            elif provider == "gitlab" and profile.gitlab_token:
                has_token = True
        except Exception:
            pass

        if not has_token:
            provider_name = "GitLab" if provider == "gitlab" else "GitHub" if provider == "github" else "el proveedor"
            return JsonResponse(
                {"error": f"Para analizar este repositorio privado, debes iniciar sesión usando {provider_name}."},
                status=401
            )

    try:
        # Iniciar flujo asíncrono con control de hilos, usuario, privacidad y caché inteligente
        session_id, is_cache_hit = start_async_analysis(
            url,
            max_commits=max_commits,
            analysis_mode=analysis_mode,
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


@csrf_exempt
def api_cancel_analysis(request, session_id):
    """
    Endpoint POST para cancelar una sesión de análisis activa o en cola.
    """
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    session = get_object_or_404(AnalysisSession, pk=session_id)
    if session.status in ["pending", "processing"]:
        session.status = "failed"
        session.error_message = "Análisis cancelado por el usuario."
        session.save(update_fields=["status", "error_message"])
        return JsonResponse({"status": "success", "message": "Análisis cancelado con éxito."})

    return JsonResponse({"error": "No se puede cancelar un análisis que no está activo."}, status=400)
