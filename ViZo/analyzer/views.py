from django.shortcuts import redirect, render

from .services import analyze_repository


def index(request):
    if request.method == "POST":
        url = request.POST.get("repoUrl")
        # Ahora llamamos a una única función que hace todo
        result = analyze_repository(url)

        if result:
            evo = result.get("evolution_data", {})
            print(
                f"Análisis completado: {evo.get('total_commits', 0)} commits encontrados."
            )
            print(f"Autores: {len(evo.get('authors', []))}")

        return redirect("index")
    return render(request, "analyzer/index.html")
