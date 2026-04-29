# ai_engine.py
import json
import re

from colorama import Fore
from openai import APIConnectionError, OpenAI

# Conexión local con LM Studio (RTX 4060)
# Se quita el timeout para que pueda tardar lo necesario, pero fallará si está cerrado
client = OpenAI(
    base_url="http://localhost:1234/v1",
    api_key="lm-studio",
    timeout=None,  # Sin límite de tiempo
    max_retries=0,  # No reintentar si falla la conexión inicial
)

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
    ]
}

_SYSTEM_PROMPT = """
Eres un arquitecto de visualización de software experto en BabiaXR. 
Tu misión es diseñar un centro de mando virtual para analizar la salud de un repositorio de código utilizando visualizaciones 3D.

# DATASETS DISPONIBLES
1. "file_metrics": Detalle por archivo (nloc, ccn, commits, language, folder).
2. "data_by_language": Agrupaciones por lenguaje (nloc, avg_ccn, total_commits, count).
3. "evolution_data": Historial de commits (hash, author, date, message, insertions, deletions).
4. "author_activity": Actividad agrupada por autor y fecha (author, date, commits, insertions).

# COMPONENTES 3D (BabiaXR) — Mappings obligatorios
- babia-boats: (Dataset: file_metrics) ESENCIAL. Visualiza archivos como edificios.
  Mappings: {"key": "id", "height": "<campo numérico: nloc|ccn|commits>", "area": "<campo numérico: nloc|ccn|commits>"}
- babia-cyls: (Dataset: data_by_language) Cilindros comparativos.
  Mappings: {"x_axis": "language", "height": "<campo numérico: nloc|ccn|commits|count>", "radius": "<campo numérico: nloc|ccn|commits|count>"}
- babia-doughnut: (Dataset: data_by_language) Gráfico de tarta 3D para distribución.
  Mappings: {"key": "language", "size": "<campo numérico: nloc|ccn|commits|count>"}
- babia-barsmap: (Dataset: author_activity) Mapa de barras 2D/3D para actividad por autor.
  Mappings: {"x_axis": "author", "z_axis": "date", "height": "<campo numérico: commits|insertions>"}

# FORMATO DE RESPUESTA (ESTRICTO)
A la hora de elegir los componentes, SIEMPRE DEBES ELEGIR los dashboards predefinidos para cada repositorio que son: 

- file_metrics -> babia-boats: Para representar el numero de archivos y su complejidad
- data_by_language -> babia-cyls: Para representar la cantidad de lineas de codigo por lenguaje
- data_by_language -> babia-doughnut: Para representar la distribucion de archivos por lenguaje
- author_activity -> babia-barsmap: Para representar la actividad de los autores
Lo que tu puedes alterar son los mappings de cada dashboard como lo creas conveniente.
Ademas, puedes utilizar los mismos dashboards para representar otro tipo de datos si lo crees necesario, aniadiendo los mappings correspondientes.

RESUMEN:
Un breve párrafo de 2-3 líneas explicando qué has observado en los datos y por qué has elegido esos componentes.

CONFIGURACIÓN:
```json
{
  "dashboards": [
    {
      "id": "slug-unico",
      "component": "babia-boats",
      "dataset": "file_metrics",
      "title": "Nombre del Dashboard",
      "mappings": { ... }
    }
  ]
}
```
"""


# ─────────────────────────────────────────────────────────────────────────────
# Helpers de limpieza y validación de la respuesta de la IA
# ─────────────────────────────────────────────────────────────────────────────


def _extract_summary_and_json(raw_content: str) -> tuple[str, str]:
    """
    Separa el resumen textual del bloque JSON en la respuesta de la IA.
    """
    summary = "No se pudo extraer la justificación de la IA."
    json_part = "{}"

    # Extraer resumen (lo que esté entre RESUMEN: y CONFIGURACIÓN: o el primer ``` )
    if "RESUMEN:" in raw_content:
        parts = raw_content.split("RESUMEN:", 1)[1]
        summary = parts.split("CONFIGURACIÓN:")[0].split("```")[0].strip()

    # Extraer JSON del bloque de código
    if "```json" in raw_content:
        json_part = raw_content.split("```json")[1].split("```")[0].strip()
    elif "```" in raw_content:
        json_part = raw_content.split("```")[1].split("```")[0].strip()
    else:
        # Fallback: buscar llaves {}
        start = raw_content.find("{")
        end = raw_content.rfind("}")
        if start != -1 and end != -1:
            json_part = raw_content[start : end + 1]

    # Eliminar posibles comentarios inline que rompen JSON estándar
    json_part = re.sub(r"//.*", "", json_part)

    return summary, json_part


# Componentes y datasets válidos para validación
_VALID_COMPONENTS = {"babia-boats", "babia-cyls", "babia-doughnut", "babia-barsmap"}
_VALID_DATASETS = {
    "file_metrics",
    "data_by_language",
    "evolution_data",
    "author_activity",
}

# Mappings por defecto para cada componente (fallback si la IA no los especifica correctamente)
_DEFAULT_MAPPINGS = {
    "babia-boats": {"key": "id", "height": "nloc", "area": "ccn"},
    "babia-cyls": {"x_axis": "language", "height": "nloc", "radius": "count"},
    "babia-doughnut": {"key": "language", "size": "count"},
    "babia-barsmap": {"x_axis": "author", "z_axis": "date", "height": "commits"},
}
_DEFAULT_DATASETS = {
    "babia-boats": "file_metrics",
    "babia-cyls": "data_by_language",
    "babia-doughnut": "data_by_language",
    "babia-barsmap": "author_activity",
}


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

        # Fuerza author_activity para babia-barsmap para evitar errores si la IA elige evolution_data
        if component == "babia-barsmap" and dash["dataset"] != "author_activity":
            dash["dataset"] = "author_activity"
            dash["mappings"] = _DEFAULT_MAPPINGS["babia-barsmap"]

        if not isinstance(dash.get("mappings"), dict) or not dash["mappings"]:
            dash["mappings"] = _DEFAULT_MAPPINGS.get(component, {})

        if not dash.get("id"):
            dash["id"] = f"{component}-{len(validated)}"
        if not dash.get("title"):
            dash["title"] = f"Dashboard {component}"

        if component == "babia-boats":
            has_city = True

        validated.append(dash)

    if not has_city:
        validated.insert(0, DEFAULT_AI_CONFIG["dashboards"][0])

    config["dashboards"] = validated[:4]
    return config


# ─────────────────────────────────────────────────────────────────────────────
# Función pública principal
# ─────────────────────────────────────────────────────────────────────────────


def get_ai_config(repo_summary: str) -> dict:
    """
    Envía el resumen del análisis a LM Studio y devuelve la configuración de dashboards.
    Ahora también imprime el razonamiento técnico de la IA.
    """
    try:
        response = client.chat.completions.create(
            model="qwen/qwen3-coder-30b",
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": f"Resumen del repo: {repo_summary}"},
            ],
            temperature=0.3,
        )

        raw_content = response.choices[0].message.content.strip()
        summary, json_str = _extract_summary_and_json(raw_content)

        # Imprimir resumen de la IA con estilo
        print("\n" + Fore.MAGENTA + "=" * 60)
        print(Fore.CYAN + "ESTRATEGIA DE LA IA:")
        print(Fore.WHITE + summary)
        print(Fore.MAGENTA + "=" * 60 + "\n")

        config = json.loads(json_str)
        config = _validate_and_fix_config(config)

        print(
            Fore.GREEN
            + f"[AI] Dashboards configurados: {[d['component'] for d in config['dashboards']]}"
        )
        return config

    except APIConnectionError:
        print(
            Fore.RED
            + "[AI] Error de Conexión: No se pudo contactar con LM Studio. ¿Está abierto y el servidor local está corriendo?"
        )
    except Exception as e:
        print(Fore.RED + f"[AI] Error: {e}. Usando fallback.")
        # if not isinstance(e, json.JSONDecodeError):
        #      traceback.print_exc()

    return DEFAULT_AI_CONFIG
