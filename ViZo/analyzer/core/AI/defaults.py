# defaults.py
# -----------
# Valores predeterminados, mapeos y estructuras de control para la IA en ViZzo.

# Configuración por defecto si la IA falla o devuelve JSON inválido
DEFAULT_AI_CONFIG = {
    "dashboards": [
        {
            "id": "boats-complexity",
            "component": "babia-boats",
            "dataset": "file_metrics",
            "title": "Code Complexity Boats",
            "mappings": {"key": "id", "height": "nloc", "area": "ccn"},
        }
    ],
    "ai_status": "offline",
}

# Componentes y datasets válidos para validación
_VALID_COMPONENTS = {"babia-boats", "babia-cyls", "babia-doughnut", "babia-pie", "babia-barsmap", "babia-network", "babia-bars"}
_VALID_DATASETS = {
    "file_metrics",
    "data_by_language",
    "evolution_data",
    "author_activity",
    "file_ownership",
    "age_distribution",
    "top_complex_files",
    "file_network",
    "issues",
    "pull_requests",
    "code_reviews",
    "issues_health",
    "releases_health",
    "community_activity",
}

# Mappings por defecto para cada componente
_DEFAULT_MAPPINGS = {
    "babia-boats": {"key": "id", "height": "nloc", "area": "ccn"},
    "babia-cyls": {"x_axis": "language", "height": "nloc", "radius": "count"},
    "babia-doughnut": {"key": "language", "size": "count"},
    "babia-pie": {"key": "label", "size": "count"},
    "babia-barsmap": {"x_axis": "author", "z_axis": "date", "height": "commits"},
    "babia-network": {
        "nodeId": "id",
        "nodeLabel": "name",
        "nodeVal": "size",
        "nodeColor": "color",
        "linkSource": "source",
        "linkTarget": "target",
    },
    "babia-bars": {"x_axis": "title", "height": "comments"},
}

_DEFAULT_MAPPINGS_BY_DATASET = {
    ("babia-boats", "file_metrics"): {"key": "id", "height": "nloc", "area": "ccn"},
    ("babia-cyls", "data_by_language"): {
        "x_axis": "language",
        "height": "nloc",
        "radius": "count",
    },
    ("babia-cyls", "age_distribution"): {
        "x_axis": "category",
        "height": "nloc",
        "radius": "count",
    },
    ("babia-cyls", "top_complex_files"): {
        "x_axis": "name",
        "height": "peak_ccn",
        "radius": "avg_ccn",
    },
    ("babia-doughnut", "data_by_language"): {"key": "language", "size": "count"},
    ("babia-doughnut", "issues"): {"key": "state", "size": "count"},
    ("babia-pie", "issues_health"): {"key": "label", "size": "count"},
    ("babia-doughnut", "issues_health"): {"key": "label", "size": "count"},
    ("babia-barsmap", "author_activity"): {
        "x_axis": "author",
        "z_axis": "date",
        "height": "commits",
    },
    ("babia-barsmap", "file_ownership"): {
        "x_axis": "author",
        "z_axis": "file",
        "height": "ownership",
    },
    ("babia-barsmap", "releases_health"): {
        "x_axis": "release_version",
        "z_axis": "stability_index",
        "height": "bugs_count"
    },
    ("babia-barsmap", "file_metrics"): {
        "x_axis": "folder",
        "z_axis": "language",
        "height": "num_functions",
    },
    ("babia-network", "file_network"): {
        "nodeId": "author",
        "nodeLabel": "author",
        "linkId": "file",
        "nodeVal": "size",
        "nodeColor": "color",
    },
    ("babia-network", "code_reviews"): {
        "nodeId": "id",
        "nodeLabel": "name",
        "nodeVal": "total_reviews_given",
        "linkSource": "source",
        "linkTarget": "target",
        "linkWidth": "review_count"
    },
    ("babia-bars", "pull_requests"): {"x_axis": "title", "height": "comments"},
    ("babia-bars", "community_activity"): {
        "x_axis": "user",
        "height": "total_contributions"
    },
}

_DEFAULT_DATASETS = {
    "babia-boats": "file_metrics",
    "babia-cyls": "data_by_language",
    "babia-doughnut": "data_by_language",
    "babia-pie": "issues_health",
    "babia-barsmap": "author_activity",
    "babia-network": "file_network",
    "babia-bars": "pull_requests",
}
