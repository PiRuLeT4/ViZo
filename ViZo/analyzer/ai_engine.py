# ai_engine.py
import json
import math
import re

from colorama import Fore
from openai import OpenAI

# Conexión local con LM Studio (RTX 4060)
client = OpenAI(base_url="http://localhost:1234/v1", api_key="lm-studio")

# ─────────────────────────────────────────────────────────────────────────────
# Constantes de normalización
# ─────────────────────────────────────────────────────────────────────────────
HEIGHT_MIN = 0.5  # Altura mínima (archivo con menos nloc)
HEIGHT_MAX = 9.0  # Altura máxima (archivo con más nloc)

# Configuración por defecto si la IA falla o devuelve JSON inválido
DEFAULT_AI_CONFIG = {
    "dashboards": [
        {
            "id": "city-complexity",
            "component": "babia-city",
            "dataset": "file_metrics",
            "title": "Code Complexity City",
            "mappings": {"key": "id", "fheight": "height", "farea": "area"},
        }
    ]
}

_SYSTEM_PROMPT = """
Eres un experto en visualización de software y BabiaXR. Tu tarea es decidir qué dashboards 3D
generar para representar los datos de un repositorio de código.

# DATASETS DISPONIBLES

Tienes acceso a dos datasets ya preparados:

1. "file_metrics": lista de archivos del repo. Cada entrada tiene:
   - "id": path relativo del archivo (ej: "src/utils/helpers.py"), sirve como clave jerárquica
   - "name": nombre del archivo
   - "nloc": líneas de código (ya normalizadas en "height", rango 1-9)
   - "ccn": complejidad ciclomática media (ya normalizada en "area", rango 1-9)
   - "commits": número de commits que tocaron ese archivo
   - "language": lenguaje del archivo
   - "height": nloc normalizado logarítmicamente [1-9]
   - "area": ccn normalizado logarítmicamente [1-9]

2. "data_by_language": lista agrupada por lenguaje. Cada entrada tiene:
   - "id": nombre del lenguaje (ej: "py", "js")
   - "language": nombre del lenguaje
   - "nloc": total de líneas de código en ese lenguaje
   - "ccn": complejidad media del lenguaje
   - "commits": total de commits en ese lenguaje
   - "count": número de archivos de ese lenguaje

# COMPONENTES DISPONIBLES

Puedes combinar estos componentes para crear múltiples dashboards:

## babia-city
Representa archivos como edificios en una ciudad 3D. Ideal para visualizar la complejidad y tamaño
de archivos individuales. Requiere dataset "file_metrics".
Mappings posibles: { "key": "id", "fheight": "height", "farea": "area" }

## babia-cyls
Representa datos como cilindros. Ideal para comparar métricas por lenguaje.
Requiere dataset "data_by_language".
Mappings posibles: { "x_axis": "language", "height": "nloc", "radius": "count" }

## babia-doughnut
Representa distribuciones como un donut chart. Ideal para mostrar distribución de código por lenguaje.
Requiere dataset "data_by_language".
Mappings posibles: { "key": "language", "size": "count" }

## babia-barsmap
Representa datos como un mapa de barras en 2 ejes. Ideal para comparar métricas por lenguaje en 2D.
Requiere dataset "data_by_language".
Mappings posibles: { "x_axis": "language", "z_axis": "language", "height": "commits" }

# REGLAS DE DECISIÓN

- SIEMPRE incluye babia-city (es la visualización principal de complejidad de archivos)
- Si num_languages >= 2: añade babia-doughnut para mostrar distribución de lenguajes
- Si num_languages >= 3: añade babia-cyls para comparar NLOC por lenguaje
- Si avg_ccn > 3.0 (complejidad alta): añade babia-barsmap mostrando commits por lenguaje
- No incluyas más de 3 dashboards en total

# FORMATO DE RESPUESTA

Devuelve ÚNICAMENTE un JSON válido con esta estructura EXACTA (sin texto adicional, sin comentarios):
{
  "dashboards": [
    {
      "id": "city-complexity",
      "component": "babia-city",
      "dataset": "file_metrics",
      "title": "Code Complexity City",
      "mappings": { "key": "id", "fheight": "height", "farea": "area" }
    }
  ]
}

Los valores de "component" deben ser exactamente uno de: babia-city, babia-cyls, babia-doughnut, babia-barsmap
Los valores de "dataset" deben ser exactamente uno de: file_metrics, data_by_language
"""


# ─────────────────────────────────────────────────────────────────────────────
# Normalización logarítmica (Python puro, sin IA)
# ─────────────────────────────────────────────────────────────────────────────


def _log_normalize(
    value: float,
    v_min: float,
    v_max: float,
    out_min: float = HEIGHT_MIN,
    out_max: float = HEIGHT_MAX,
) -> float:
    """
    Normaliza `value` al rango [out_min, out_max] usando escala logarítmica.
    Si todos los valores son iguales devuelve la media del rango de salida.
    """
    if v_max <= v_min:
        return (out_min + out_max) / 2.0

    # Trabajamos con log(1 + x) para evitar log(0)
    log_val = math.log1p(value - v_min)
    log_max = math.log1p(v_max - v_min)

    if log_max == 0:
        return out_min

    normalized = log_val / log_max  # [0, 1]
    return out_min + normalized * (out_max - out_min)


def normalize_data(file_metrics: list) -> list:
    """
    Recorre file_metrics y añade:
      - "height"  : nloc  normalizado logarítmicamente a [1, 9] (entero)
      - "area"    : ccn   normalizado logarítmicamente a [1, 9] (entero)

    El archivo con mayor nloc recibe height=9.
    El archivo con menor nloc recibe height=1.
    Lo mismo para ccn/area.

    Devuelve una NUEVA lista de dicts (no modifica el original).
    """
    if not file_metrics:
        return file_metrics

    nloc_values = [f["nloc"] for f in file_metrics]
    ccn_values = [f["ccn"] for f in file_metrics]

    nloc_min, nloc_max = min(nloc_values), max(nloc_values)
    ccn_min, ccn_max = min(ccn_values), max(ccn_values)

    result = []
    for entry in file_metrics:
        new_entry = dict(entry)
        new_entry["height"] = int(
            round(
                _log_normalize(
                    entry["nloc"], nloc_min, nloc_max, HEIGHT_MIN, HEIGHT_MAX
                )
            )
        )
        new_entry["area"] = int(
            round(
                _log_normalize(entry["ccn"], ccn_min, ccn_max, HEIGHT_MIN, HEIGHT_MAX)
            )
        )
        result.append(new_entry)

    return result


# ─────────────────────────────────────────────────────────────────────────────
# Helpers de limpieza y validación de la respuesta de la IA
# ─────────────────────────────────────────────────────────────────────────────


def _sanitize_raw_content(content: str) -> str:
    """
    Limpia la respuesta cruda del modelo:
      1. Extrae el contenido de bloques de código markdown (```json ... ```).
      2. Elimina comentarios de una línea (//) que rompen el JSON.
    """
    if "```" in content:
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]
        content = content.strip()

    # Quitar comentarios inline tipo JS/JSON5
    content = re.sub(r"//.*", "", content)
    return content.strip()


# Componentes y datasets válidos para validación
_VALID_COMPONENTS = {"babia-city", "babia-cyls", "babia-doughnut", "babia-barsmap"}
_VALID_DATASETS = {"file_metrics", "data_by_language"}

# Mappings por defecto para cada componente (fallback si la IA no los especifica correctamente)
_DEFAULT_MAPPINGS = {
    "babia-city": {"key": "id", "fheight": "height", "farea": "area"},
    "babia-cyls": {"x_axis": "language", "height": "nloc", "radius": "count"},
    "babia-doughnut": {"key": "language", "size": "count"},
    "babia-barsmap": {"x_axis": "language", "z_axis": "language", "height": "commits"},
}
_DEFAULT_DATASETS = {
    "babia-city": "file_metrics",
    "babia-cyls": "data_by_language",
    "babia-doughnut": "data_by_language",
    "babia-barsmap": "data_by_language",
}


def _validate_and_fix_config(config: dict) -> dict:
    """
    Valida y corrige el dict de configuración devuelto por la IA.
    Asegura que dashboards sea una lista válida con al menos babia-city.
    Filtra componentes o datasets inválidos y rellena mappings por defecto.
    """
    dashboards = config.get("dashboards", [])

    if not isinstance(dashboards, list) or len(dashboards) == 0:
        print(Fore.YELLOW + "[AI] dashboards vacío o inválido, usando fallback.")
        return DEFAULT_AI_CONFIG

    validated = []
    has_city = False

    for dash in dashboards:
        component = dash.get("component", "")
        dataset = dash.get("dataset", "")

        # Filtrar componentes o datasets no reconocidos
        if component not in _VALID_COMPONENTS:
            print(Fore.YELLOW + f"[AI] Componente desconocido '{component}', ignorado.")
            continue
        if dataset not in _VALID_DATASETS:
            # Asignar dataset por defecto según el componente
            dataset = _DEFAULT_DATASETS[component]
            dash["dataset"] = dataset

        # Rellenar mappings si faltan o son incorrectos
        if not isinstance(dash.get("mappings"), dict) or not dash["mappings"]:
            dash["mappings"] = _DEFAULT_MAPPINGS[component]

        # Asegurar que tiene id y title
        if not dash.get("id"):
            dash["id"] = f"{component}-{len(validated)}"
        if not dash.get("title"):
            dash["title"] = component

        if component == "babia-city":
            has_city = True

        validated.append(dash)

    # Garantizar que babia-city siempre está presente
    if not has_city:
        print(Fore.YELLOW + "[AI] babia-city no incluido, añadiendo como dashboard principal.")
        validated.insert(0, {
            "id": "city-complexity",
            "component": "babia-city",
            "dataset": "file_metrics",
            "title": "Code Complexity City",
            "mappings": _DEFAULT_MAPPINGS["babia-city"],
        })

    config["dashboards"] = validated[:3]  # máximo 3 dashboards
    return config


# ─────────────────────────────────────────────────────────────────────────────
# Función pública principal
# ─────────────────────────────────────────────────────────────────────────────


def get_ai_config(repo_summary: str) -> dict:
    """
    Envía el resumen del análisis a LM Studio y devuelve la configuración
    de dashboards como dict de Python (ya validada y corregida).

    El dict tiene la forma: { "dashboards": [ {id, component, dataset, title, mappings}, ... ] }

    Si la IA no responde o devuelve JSON inválido, retorna DEFAULT_AI_CONFIG
    (siempre contiene al menos babia-city con file_metrics).
    """
    try:
        response = client.chat.completions.create(
            model="qwen/qwen3-coder-30b",
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": f"Resumen del repo: {repo_summary}",
                },
            ],
            temperature=0.2,
        )
        raw_content = response.choices[0].message.content.strip()
        clean_content = _sanitize_raw_content(raw_content)
        config = json.loads(clean_content)
        config = _validate_and_fix_config(config)
        print(Fore.GREEN + f"[AI] Dashboards elegidos: {[d['component'] for d in config['dashboards']]}")
        return config

    except json.JSONDecodeError as e:
        print(Fore.RED + f"[AI] Error parseando JSON de la IA: {e}. Usando configuración por defecto.")
    except Exception as e:
        print(Fore.RED + f"[AI] Error conectando con LM Studio: {e}")

    return DEFAULT_AI_CONFIG
