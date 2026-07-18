from django.shortcuts import render

def home(request):
    """Vista principal de bienvenida e introducción a ViZzo."""
    return render(request, "home/home.html")
