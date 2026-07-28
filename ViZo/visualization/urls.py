"""
urls.py
───────
Mapeo de rutas correspondientes a la app visualization (Escena 3D y APIs visuales).
"""
from django.urls import path
from . import views

urlpatterns = [
    path("visualization/<int:session_id>/", views.show_visualization, name="show_visualization"),
    path("visualization/<int:session_id>/api/data/", views.api_session_data, name="api_session_data"),
    path("api/explain/", views.api_explain, name="api_explain"),
    path("api/tts/", views.api_tts, name="api_tts"),
]
