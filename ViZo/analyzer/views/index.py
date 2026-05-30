"""
index.py
────────
Vista para el portal principal (Landing Page) de ViZo.
"""
from django.shortcuts import redirect, render
from analyzer.persistence.queries import get_latest_active_sessions


def index(request):
    """
    Vista principal que renderiza el portal de inicio y el feed de repositorios.
    """
    if request.method == "POST":
        # Deshabilitado el envío síncrono. Redirigimos a GET index de forma segura.
        return redirect("index")
        
    # GET: Carga el historial desde la capa de persistencia limpia
    latest_sessions = get_latest_active_sessions(limit=10)
    return render(request, "analyzer/index.html", {"latest_sessions": latest_sessions})
