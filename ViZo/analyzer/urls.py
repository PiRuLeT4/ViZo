"""
urls.py
───────
Mapeo de rutas correspondientes a la app analyzer (Análisis backend y APIs de sondeo).
"""
from django.urls import path
from analyzer.views import index, api_analyze, api_session_status, github_login, github_callback, user_logout, gitlab_login, gitlab_callback

urlpatterns = [
    path("", index, name="index"),
    path("api/analyze/", api_analyze, name="api_analyze"),
    path("api/session/<int:session_id>/status/", api_session_status, name="api_session_status"),
    path("oauth/github/login/", github_login, name="github_login"),
    path("oauth/github/callback/", github_callback, name="github_callback"),
    path("oauth/gitlab/login/", gitlab_login, name="gitlab_login"),
    path("oauth/gitlab/callback/", gitlab_callback, name="gitlab_callback"),
    path("logout/", user_logout, name="user_logout"),
]
