# helpers.py
# ----------
# Funciones auxiliares y estructuras de datos para validación y extracción
# de las respuestas del modelo de IA en ViZo.

import re

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
_VALID_COMPONENTS = {"babia-boats", "babia-cyls", "babia-doughnut", "babia-barsmap", "babia-network", "babia-bars"}
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
}

# Mappings por defecto para cada componente
_DEFAULT_MAPPINGS = {
    "babia-boats": {"key": "id", "height": "nloc", "area": "ccn"},
    "babia-cyls": {"x_axis": "language", "height": "nloc", "radius": "count"},
    "babia-doughnut": {"key": "language", "size": "count"},
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
    ("babia-bars", "pull_requests"): {"x_axis": "title", "height": "comments"},
}

_DEFAULT_DATASETS = {
    "babia-boats": "file_metrics",
    "babia-cyls": "data_by_language",
    "babia-doughnut": "data_by_language",
    "babia-barsmap": "author_activity",
    "babia-network": "file_network",
    "babia-bars": "pull_requests",
}


def _extract_summary_and_json(raw_content: str) -> tuple[str, str]:
    """
    Separa el resumen textual del bloque JSON en la respuesta de la IA.
    """
    summary = "No se pudo extraer la justificación de la IA."
    json_part = "{}"

    # 1. Extraer el bloque JSON
    json_start = -1

    if "```json" in raw_content:
        parts = raw_content.split("```json", 1)
        if len(parts) > 1:
            json_part = parts[1].split("```", 1)[0].strip()
            json_start = raw_content.find("```json")
    elif "```" in raw_content:
        parts = raw_content.split("```", 1)
        if len(parts) > 1:
            json_part = parts[1].split("```", 1)[0].strip()
            json_start = raw_content.find("```")
    else:
        # Fallback: buscar llaves {}
        start = raw_content.find("{")
        end = raw_content.rfind("}")
        if start != -1 and end != -1:
            json_part = raw_content[start : end + 1]
            json_start = start

    # Eliminar posibles comentarios inline que rompen JSON estándar
    json_part = re.sub(r"//.*", "", json_part)

    # 2. Extraer el resumen
    text_before_json = raw_content[:json_start] if json_start != -1 else raw_content

    # Buscar "RESUMEN" en el texto de forma insensible a mayúsculas/minúsculas
    match = re.search(r"(?i)\bresumen\b", text_before_json)
    if match:
        start_pos = match.end()
        extra_match = re.match(r"^[\s\*\#\-\:]*", text_before_json[start_pos:])
        if extra_match:
            start_pos += extra_match.end()

        summary_text = text_before_json[start_pos:].strip()

        # Limpiar cualquier texto de "CONFIGURACIÓN" al final del resumen
        config_match = re.search(r"(?i)\bconfiguraci[oó]n\b", summary_text)
        if config_match:
            summary_text = summary_text[: config_match.start()].strip()
            summary_text = re.sub(r"[\s\*\#\-\:]+$", "", summary_text).strip()

        if summary_text:
            summary = summary_text
    else:
        # Fallback si no hay cabecera explícita
        candidate = text_before_json.strip()
        config_match = re.search(r"(?i)\bconfiguraci[oó]n\b", candidate)
        if config_match:
            candidate = candidate[: config_match.start()].strip()
            candidate = re.sub(r"[\s\*\#\-\:]+$", "", candidate).strip()

        if len(candidate) > 10:
            summary = candidate

    return summary, json_part


def _validate_and_fix_config(config: dict) -> dict:
    """
    Valida y corrige el dict de configuración devuelto por la IA.
    Asegura que dashboards sea una lista válida con al menos babia-boats.
    """
    dashboards = config.get("dashboards", [])

    if not isinstance(dashboards, list) or len(dashboards) == 0:
        return DEFAULT_AI_CONFIG

    validated = []
    has_city = False

    for dash in dashboards:
        component = dash.get("component", "")
        dataset = dash.get("dataset", "")

        if component not in _VALID_COMPONENTS:
            continue

        if dataset not in _VALID_DATASETS:
            dataset = _DEFAULT_DATASETS.get(component, "file_metrics")
            dash["dataset"] = dataset

        # Fuerza author_activity para babia-barsmap si no usa uno de los nuevos datasets permitidos
        if component == "babia-barsmap" and dash["dataset"] not in {
            "author_activity",
            "file_ownership",
            "file_metrics",
        }:
            dash["dataset"] = "author_activity"

        # Fuerza file_network para babia-network
        if component == "babia-network":
            dash["dataset"] = "file_network"

        if not isinstance(dash.get("mappings"), dict) or not dash["mappings"]:
            dash["mappings"] = _DEFAULT_MAPPINGS_BY_DATASET.get(
                (component, dataset), _DEFAULT_MAPPINGS.get(component, {})
            )

        if not dash.get("id"):
            dash["id"] = f"{component}-{len(validated)}"
        if not dash.get("title"):
            dash["title"] = f"Dashboard {component}"

        if component == "babia-boats":
            has_city = True

        validated.append(dash)

    if not has_city:
        validated.insert(0, DEFAULT_AI_CONFIG["dashboards"][0])

    config["dashboards"] = validated[:8]
    return config
