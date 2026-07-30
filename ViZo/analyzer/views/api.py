"""
api.py
──────
Endpoints de la API para registrar, arrancar asíncronamente y sondear estados de análisis.
"""
import json
import logging
from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.conf import settings

from analyzer.services.orchestrator import start_async_analysis, cancel_task
from analyzer.services.ratelimit import ratelimit
from analyzer.models import AnalysisSession
from analyzer.utils.url_validator import validate_repo_url

logger = logging.getLogger(__name__)


@ratelimit(rate="5/m")
def api_analyze(request):
    """
    Endpoint POST AJAX de análisis asíncrono de alto rendimiento.
    """
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    raw_url = request.POST.get("repoUrl")
    depth = request.POST.get("depth")
    analysis_mode = request.POST.get("analysis_mode", "commits")
    if analysis_mode not in ["commits", "releases"]:
        analysis_mode = "commits"

    if not raw_url:
        return JsonResponse({"error": "La URL del repositorio es obligatoria."}, status=400)

    try:
        url = validate_repo_url(raw_url)
    except ValueError as val_err:
        return JsonResponse({"error": str(val_err)}, status=400)

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

    # Obtener credenciales de IA (priorizando cookies seguras HttpOnly)
    llm_base_url = request.COOKIES.get("vizzo_llm_base_url", "").strip() or request.POST.get("llm_base_url", "").strip() or None
    llm_api_key = request.COOKIES.get("vizzo_llm_api_key", "").strip() or request.POST.get("llm_api_key", "").strip() or None
    llm_model = request.COOKIES.get("vizzo_llm_model", "").strip() or request.POST.get("llm_model", "").strip() or None

    try:
        # Iniciar flujo asíncrono con control de hilos, usuario, privacidad y caché inteligente
        session_id, is_cache_hit = start_async_analysis(
            url,
            max_commits=max_commits,
            analysis_mode=analysis_mode,
            user=request.user,
            is_private=is_private,
            llm_base_url=llm_base_url,
            llm_api_key=llm_api_key,
            llm_model=llm_model,
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


@ratelimit(rate="30/m")
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


@ratelimit(rate="10/m")
def api_cancel_analysis(request, session_id):
    """
    Endpoint POST para cancelar una sesión de análisis activa o en cola.
    """
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    session = get_object_or_404(AnalysisSession, pk=session_id)
    
    # Verificar autoría: solo el usuario propietario (o cualquier usuario si es repo público sin propietario) puede cancelar
    if session.repo.user is not None and session.repo.user != request.user:
        return JsonResponse({"error": "No tienes permiso para cancelar este análisis."}, status=403)

    if session.status in ["pending", "processing"]:
        session.status = "failed"
        session.error_message = "Análisis cancelado por el usuario."
        session.save(update_fields=["status", "error_message"])
        cancel_task(session_id)
        return JsonResponse({"status": "success", "message": "Análisis cancelado con éxito."})

    return JsonResponse({"error": "No se puede cancelar un análisis que no está activo."}, status=400)


def api_save_ai_config(request):
    """
    Endpoint POST para guardar las credenciales personalizadas de IA en cookies seguras.
    """
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body)
        llm_base_url = data.get("llm_base_url", "").strip()
        llm_api_key = data.get("llm_api_key", "").strip()
        llm_model = data.get("llm_model", "").strip()
        llm_is_local = data.get("llm_is_local", True)
        
        response = JsonResponse({"status": "success"})
        
        # Si la URL está vacía, eliminamos las cookies (se desactiva la IA personalizada)
        if not llm_base_url:
            response.delete_cookie("vizzo_llm_base_url")
            response.delete_cookie("vizzo_llm_api_key")
            response.delete_cookie("vizzo_llm_model")
            response.delete_cookie("vizzo_llm_is_local")
            return response
            
        # De lo contrario, configuramos las cookies con opciones seguras
        is_secure = not settings.DEBUG
        cookie_opts = {"max_age": 30 * 24 * 60 * 60, "samesite": "Lax", "httponly": True, "secure": is_secure}

        response.set_cookie("vizzo_llm_base_url", llm_base_url, **cookie_opts)
        response.set_cookie("vizzo_llm_model", llm_model, **cookie_opts)
        response.set_cookie("vizzo_llm_is_local", "true" if llm_is_local else "false", **cookie_opts)
        
        # Si el api_key es el valor ficticio '••••••••••••••••', no lo sobreescribimos
        if llm_api_key and llm_api_key != "••••••••••••••••":
            response.set_cookie("vizzo_llm_api_key", llm_api_key, **cookie_opts)
        elif not llm_api_key:
            # Si se deja vacío, eliminamos la cookie de la API Key
            response.delete_cookie("vizzo_llm_api_key")
            
        return response

    except Exception as e:
        logger.exception("Error guardando configuración de IA")
        return JsonResponse({"error": "Error interno al guardar la configuración."}, status=500)


