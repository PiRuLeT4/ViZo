import json

from django.shortcuts import redirect, render

from .services import analyze_repository


def index(request):
    if request.method == "POST":
        url = request.POST.get("repoUrl")
        result = analyze_repository(url)

        if result:
            data_to_display = result.get("data_to_display", [])
            return render(
                request,
                "visualization/index.html",
                {"data_to_display": json.dumps(data_to_display)},
            )

        return redirect("index")
    return render(request, "analyzer/index.html")
