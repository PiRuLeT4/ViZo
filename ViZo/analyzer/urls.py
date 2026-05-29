from django.urls import path

from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("api/explain/", views.api_explain, name="api_explain"),
]
