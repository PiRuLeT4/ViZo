"""
urls.py
───────
Mapeo de rutas correspondientes a la app analyzer (Análisis backend y APIs de sondeo).
"""
from django.urls import path
from analyzer.views import index, api_analyze, api_session_status

urlpatterns = [
    path("", index, name="index"),
    path("api/analyze/", api_analyze, name="api_analyze"),
    path("api/session/<int:session_id>/status/", api_session_status, name="api_session_status"),
]
