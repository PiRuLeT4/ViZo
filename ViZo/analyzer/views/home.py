from django.shortcuts import render

def home(request):
    """Vista principal de bienvenida e introducción a ViZo."""
    return render(request, "home/home.html")
