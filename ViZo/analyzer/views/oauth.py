"""
oauth.py
────────
Vistas y flujos de autenticación OAuth para GitHub.
Permite iniciar sesión, registrar tokens de acceso y gestionar la desconexión.
"""
import os
import secrets
import requests
from django.shortcuts import redirect
from django.contrib.auth import login, logout
from django.contrib.auth.models import User
from django.contrib import messages
from django.urls import reverse
from analyzer.models import UserProfile


def github_login(request):
    """
    Redirige al usuario al portal de autorización OAuth de GitHub.
    """
    client_id = os.getenv("GITHUB_CLIENT_ID")
    client_secret = os.getenv("GITHUB_CLIENT_SECRET")

    if not client_id or not client_secret:
        messages.error(
            request,
            "GitHub OAuth no está configurado. Por favor, añade GITHUB_CLIENT_ID y GITHUB_CLIENT_SECRET en tu archivo .env"
        )
        return redirect("index")

    state = secrets.token_urlsafe(32)
    request.session["oauth_github_state"] = state

    # Scope: 'repo' para acceso a repositorios públicos/privados, 'user' para perfil
    scope = "repo user"
    redirect_uri = request.build_absolute_uri(reverse("github_callback"))
    
    # Construir la URL de autorización
    auth_url = (
        f"https://github.com/login/oauth/authorize"
        f"?client_id={client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&scope={scope}"
        f"&state={state}"
    )
    return redirect(auth_url)


def github_callback(request):
    """
    Procesa el callback de GitHub OAuth. Intercambia el código por un token de acceso,
    obtiene la información del usuario desde la API de GitHub y autentica/inicia sesión en Django.
    """
    state_received = request.GET.get("state")
    state_expected = request.session.pop("oauth_github_state", None)

    if not state_received or not state_expected or state_received != state_expected:
        messages.error(request, "Validación de seguridad OAuth fallida (state inválido). Por favor reintenta.")
        return redirect("index")

    code = request.GET.get("code")
    if not code:
        messages.error(request, "No se recibió código de autorización de GitHub.")
        return redirect("index")

    client_id = os.getenv("GITHUB_CLIENT_ID")
    client_secret = os.getenv("GITHUB_CLIENT_SECRET")
    redirect_uri = request.build_absolute_uri(reverse("github_callback"))

    # 1. Intercambiar código por Token de Acceso
    token_url = "https://github.com/login/oauth/access_token"
    payload = {
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code,
        "redirect_uri": redirect_uri,
    }
    headers = {"Accept": "application/json"}

    try:
        response = requests.post(token_url, data=payload, headers=headers, timeout=15)
        response.raise_for_status()
        token_data = response.json()
    except Exception as e:
        messages.error(request, f"Error al conectar con GitHub OAuth: {e}")
        return redirect("index")

    access_token = token_data.get("access_token")
    if not access_token:
        error_description = token_data.get("error_description", "Token de acceso no recibido.")
        messages.error(request, f"Fallo en la autenticación de GitHub: {error_description}")
        return redirect("index")

    # 2. Recuperar información del usuario desde la API de GitHub
    user_api_url = "https://api.github.com/user"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
    }

    try:
        user_response = requests.get(user_api_url, headers=headers, timeout=15)
        user_response.raise_for_status()
        github_user_data = user_response.json()
    except Exception as e:
        messages.error(request, f"Error al recuperar datos de usuario de GitHub: {e}")
        return redirect("index")

    github_username = github_user_data.get("login")
    avatar_url = github_user_data.get("avatar_url")
    email = github_user_data.get("email") or ""

    if not github_username:
        messages.error(request, "No se pudo recuperar el nombre de usuario de GitHub.")
        return redirect("index")

    # 3. Registrar o actualizar el usuario de Django y su UserProfile
    profile = UserProfile.objects.filter(github_username=github_username).first()
    if profile:
        user = profile.user
    else:
        username = github_username
        if User.objects.filter(username=username).exists():
            user = User.objects.get(username=username)
            if hasattr(user, 'profile'):
                username = f"{github_username}_github"
                count = 1
                while User.objects.filter(username=username).exists():
                    username = f"{github_username}_github_{count}"
                    count += 1
                user = User.objects.create_user(username=username, email=email)
        else:
            user = User.objects.create_user(username=username, email=email)

    profile, created = UserProfile.objects.get_or_create(user=user)
    profile.provider = "github"
    profile.github_token = access_token
    profile.github_username = github_username
    profile.avatar_url = avatar_url
    profile.save()

    # 4. Iniciar sesión en Django usando el backend por defecto
    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    messages.success(request, f"¡Conectado como {github_username}!")
    
    return redirect("index")


def user_logout(request):
    """
    Cierra la sesión del usuario en Django y lo redirige a la Landing Page.
    """
    logout(request)
    messages.success(request, "Sesión cerrada correctamente.")
    return redirect("index")


def gitlab_login(request):
    """
    Redirige al usuario al portal de autorización OAuth de GitLab.
    """
    client_id = os.getenv("GITLAB_CLIENT_ID")
    client_secret = os.getenv("GITLAB_CLIENT_SECRET")

    if not client_id or not client_secret:
        messages.error(
            request,
            "GitLab OAuth no está configurado. Por favor, añade GITLAB_CLIENT_ID y GITLAB_CLIENT_SECRET en tu archivo .env"
        )
        return redirect("index")

    state = secrets.token_urlsafe(32)
    request.session["oauth_gitlab_state"] = state

    scope = "read_user"
    redirect_uri = request.build_absolute_uri(reverse("gitlab_callback"))
    
    auth_url = (
        f"https://gitlab.com/oauth/authorize"
        f"?client_id={client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type=code"
        f"&scope={scope}"
        f"&state={state}"
    )
    return redirect(auth_url)


def gitlab_callback(request):
    """
    Procesa el callback de GitLab OAuth. Intercambia el código por un token de acceso,
    obtiene la información del usuario desde la API de GitLab y autentica/inicia sesión en Django.
    """
    state_received = request.GET.get("state")
    state_expected = request.session.pop("oauth_gitlab_state", None)

    if not state_received or not state_expected or state_received != state_expected:
        messages.error(request, "Validación de seguridad OAuth fallida (state inválido). Por favor reintenta.")
        return redirect("index")

    code = request.GET.get("code")
    if not code:
        messages.error(request, "No se recibió código de autorización de GitLab.")
        return redirect("index")

    client_id = os.getenv("GITLAB_CLIENT_ID")
    client_secret = os.getenv("GITLAB_CLIENT_SECRET")
    redirect_uri = request.build_absolute_uri(reverse("gitlab_callback"))

    # 1. Intercambiar código por Token de Acceso
    token_url = "https://gitlab.com/oauth/token"

    payload = {
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": redirect_uri,
    }
    headers = {"Accept": "application/json"}

    try:
        response = requests.post(token_url, data=payload, headers=headers, timeout=15)
        response.raise_for_status()
        token_data = response.json()
    except Exception as e:
        messages.error(request, f"Error al conectar con GitLab OAuth: {e}")
        return redirect("index")

    access_token = token_data.get("access_token")
    if not access_token:
        error_description = token_data.get("error_description", "Token de acceso no recibido.")
        messages.error(request, f"Fallo en la autenticación de GitLab: {error_description}")
        return redirect("index")

    # 2. Recuperar información del usuario desde la API de GitLab
    user_api_url = "https://gitlab.com/api/v4/user"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
    }

    try:
        user_response = requests.get(user_api_url, headers=headers, timeout=15)
        user_response.raise_for_status()
        gitlab_user_data = user_response.json()
    except Exception as e:
        messages.error(request, f"Error al recuperar datos de usuario de GitLab: {e}")
        return redirect("index")

    gitlab_username = gitlab_user_data.get("username")
    avatar_url = gitlab_user_data.get("avatar_url")
    email = gitlab_user_data.get("email") or ""

    if not gitlab_username:
        messages.error(request, "No se pudo recuperar el nombre de usuario de GitLab.")
        return redirect("index")

    # 3. Registrar o actualizar el usuario de Django y su UserProfile
    profile = UserProfile.objects.filter(gitlab_username=gitlab_username).first()
    if profile:
        user = profile.user
    else:
        username = gitlab_username
        if User.objects.filter(username=username).exists():
            user = User.objects.get(username=username)
            if hasattr(user, 'profile'):
                username = f"{gitlab_username}_gitlab"
                count = 1
                while User.objects.filter(username=username).exists():
                    username = f"{gitlab_username}_gitlab_{count}"
                    count += 1
                user = User.objects.create_user(username=username, email=email)
        else:
            user = User.objects.create_user(username=username, email=email)

    profile, created = UserProfile.objects.get_or_create(user=user)
    profile.provider = "gitlab"
    profile.gitlab_token = access_token
    profile.gitlab_username = gitlab_username
    profile.avatar_url = avatar_url
    profile.save()

    # 4. Iniciar sesión en Django
    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    messages.success(request, f"¡Conectado como {gitlab_username}!")
    
    return redirect("index")
