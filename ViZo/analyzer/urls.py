"""
urls.py
───────
Mapeo de rutas correspondientes a la app analyzer (Análisis backend y APIs de sondeo).
"""
from django.urls import path
from analyzer.views import home, index, api_analyze, api_session_status, api_cancel_analysis, github_login, github_callback, user_logout, gitlab_login, gitlab_callback, api_save_ai_config

urlpatterns = [
    path("", home, name="home"),
    path("analyzer/", index, name="index"),
    path("api/analyze/", api_analyze, name="api_analyze"),
    path("api/save-ai-config/", api_save_ai_config, name="api_save_ai_config"),

    path("api/session/<int:session_id>/status/", api_session_status, name="api_session_status"),
    path("api/session/<int:session_id>/cancel/", api_cancel_analysis, name="api_cancel_analysis"),
    path("oauth/github/login/", github_login, name="github_login"),
    path("oauth/github/callback/", github_callback, name="github_callback"),
    path("oauth/gitlab/login/", gitlab_login, name="gitlab_login"),
    path("oauth/gitlab/callback/", gitlab_callback, name="gitlab_callback"),
    path("logout/", user_logout, name="user_logout"),
]
