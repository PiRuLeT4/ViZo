# validator.py
# ------------
# Funciones auxiliares para validación y extracción de las respuestas de IA en ViZzo.

import re
from .defaults import (
    DEFAULT_AI_CONFIG,
    _VALID_COMPONENTS,
    _VALID_DATASETS,
    _DEFAULT_MAPPINGS,
    _DEFAULT_MAPPINGS_BY_DATASET,
    _DEFAULT_DATASETS,
)


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
    Asegura que dashboards sea una lista válida con al menos babia-boats y sin duplicados.
    """
    dashboards = config.get("dashboards", [])

    if not isinstance(dashboards, list) or len(dashboards) == 0:
        return DEFAULT_AI_CONFIG

    validated = []
    seen_dashboards = set()
    has_city = False

    for dash in dashboards:
        component = dash.get("component", "")
        dataset = dash.get("dataset", "")

        if component not in _VALID_COMPONENTS:
            continue

        if dataset not in _VALID_DATASETS:
            dataset = _DEFAULT_DATASETS.get(component, "file_metrics")
            dash["dataset"] = dataset

        # Fuerza author_activity para babia-barsmap si no usa uno de los permitidos
        if component == "babia-barsmap" and dash["dataset"] not in {
            "author_activity",
            "file_ownership",
            "file_metrics",
            "releases_health",
        }:
            dash["dataset"] = "author_activity"

        # Fuerza file_network para babia-network si no usa uno de los permitidos
        if component == "babia-network" and dash["dataset"] not in {
            "file_network",
            "code_reviews",
        }:
            dash["dataset"] = "file_network"

        # Evitar duplicación de dashboards con la misma combinación (component, dataset)
        key = (component, dash["dataset"])
        if key in seen_dashboards:
            print(f"ViZzo // IA // Omitiendo dashboard duplicado: {key}")
            continue
        seen_dashboards.add(key)

        # Asegurar mappings válidos para el dataset seleccionado (Autocuración inteligente)
        if not isinstance(dash.get("mappings"), dict):
            dash["mappings"] = {}
            
        dataset_defaults = _DEFAULT_MAPPINGS_BY_DATASET.get((component, dataset))
        if dataset_defaults:
            for k, v in dataset_defaults.items():
                if k not in dash["mappings"] or dash["mappings"][k] in {"...", "nombre_campo_x", "nombre_campo_y", ""}:
                    dash["mappings"][k] = v
        else:
            comp_defaults = _DEFAULT_MAPPINGS.get(component, {})
            for k, v in comp_defaults.items():
                if k not in dash["mappings"] or dash["mappings"][k] in {"...", "nombre_campo_x", "nombre_campo_y", ""}:
                    dash["mappings"][k] = v

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
