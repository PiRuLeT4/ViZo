# ai_engine.py
import json
import re

from colorama import Fore
from openai import OpenAI

# Conexión local con LM Studio (RTX 4060)
client = OpenAI(base_url="http://localhost:1234/v1", api_key="lm-studio")

# Campos numéricos válidos para los mappings BabiaXR
NUMERIC_FIELDS = {"nloc", "ccn", "commits", "count"}

# Configuración por defecto si la IA falla o devuelve JSON inválido
DEFAULT_AI_CONFIG = {
    "component": "babia-city",
    "mappings": {"key": "id", "fheight": "nloc", "farea": "ccn"},
    "visuals": {
        "building_color": "#00fbff",
        "base_color": "#1a1a1a",
        "extra": 1.5,
    },
}

_SYSTEM_PROMPT = """
Eres un experto en visualización de software y BabiaXR.
Tu tarea es decidir cómo representar un repositorio en 3D y devolver ÚNICAMENTE un objeto JSON válido.

OPCIONES DE COMPONENTE:
1. "babia-city": Ideal para repos grandes con muchos archivos (más de 50). Usa fheight y farea.
2. "babia-doughnut": Ideal para repos pequeños (menos de 50 archivos) o para mostrar distribución de lenguajes. Usa fvalues.
3. "babia-cyls": Ideal para resaltar el impacto de commits. Usa fheight y fradius.

REGLAS DE DECISIÓN:
- Si el repo tiene más de 50 archivos con alta complejidad → usa "babia-city".
- Si el repo tiene menos de 50 archivos → usa "babia-doughnut".
- Si quieres resaltar el impacto de los commits → usa "babia-cyls".

════════════════════════════════════════════════════════════
REGLA CRÍTICA SOBRE fvalues (BABIA-DOUGHNUT):
════════════════════════════════════════════════════════════
El campo "fvalues" en mappings DEBE ser SIEMPRE un campo NUMÉRICO.
Los únicos valores permitidos para "fvalues" son: "count", "nloc", "ccn", "commits".
NUNCA uses "language", "languages", "id" ni ninguna cadena de texto como valor de "fvalues".
Para mostrar cuántos archivos hay de cada lenguaje, usa EXACTAMENTE: "fvalues": "count".
════════════════════════════════════════════════════════════

CAMPO KEY (obligatorio en mappings):
- Para "babia-city" y "babia-cyls": key = "id".
- Para "babia-doughnut" mostrando distribución por lenguaje: key = "language".

CAMPOS NUMÉRICOS DISPONIBLES:
- "nloc": líneas de código (numérico).
- "ccn": complejidad ciclomática media (numérico).
- "commits": número de commits que tocaron el archivo/lenguaje (numérico).
- "count": número de archivos de ese lenguaje (numérico, SOLO disponible en babia-doughnut).

── EJEMPLO CORRECTO para babia-doughnut ────────────────────
{
    "component": "babia-doughnut",
    "mappings": {
        "key": "language",
        "fvalues": "count"
    },
    "visuals": {
        "building_color": "#00fbff",
        "base_color": "#1a1a2e",
        "extra": 1.5
    }
}
── EJEMPLO INCORRECTO (PROHIBIDO) ──────────────────────────
{
    "component": "babia-doughnut",
    "mappings": {
        "key": "language",
        "fvalues": "language"   <-- ERROR: language NO es numérico
    }
}
── EJEMPLO CORRECTO para babia-city ────────────────────────
{
    "component": "babia-city",
    "mappings": {
        "key": "id",
        "fheight": "nloc",
        "farea": "ccn"
    },
    "visuals": {
        "building_color": "#ff6b35",
        "base_color": "#1a1a2e",
        "extra": 1.5
    }
}

REGLAS ESTRICTAS:
- Devuelve SOLO el objeto JSON, sin texto adicional, sin comentarios, sin bloques markdown.
- Los valores de fheight/farea/fvalues/fradius SIEMPRE deben ser campos numéricos: "nloc", "ccn", "commits" o "count".
- "count" solo es válido para "babia-doughnut".
- "building_color" y "base_color" DEBEN ser colores hexadecimales válidos (ej: #00fbff).
"""


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


def _validate_and_fix_config(config: dict) -> dict:
    """
    Aplica reglas de negocio al dict de configuración devuelto por la IA:
      - Para babia-doughnut: garantiza que fvalues es un campo numérico válido.
    Modifica el dict in-place y lo devuelve.
    """
    if config.get("component") == "babia-doughnut":
        mappings = config.setdefault("mappings", {})
        fvalues = mappings.get("fvalues", "")
        if fvalues not in NUMERIC_FIELDS:
            print(
                Fore.YELLOW
                + f"[Guardia] fvalues='{fvalues}' no es numérico. Corrigiendo a 'count'."
            )
            mappings["fvalues"] = "count"
    return config


def get_ai_config(repo_summary: str) -> dict:
    """
    Envía el resumen del análisis a LM Studio y devuelve la configuración visual
    como dict de Python (ya validada y corregida).

    Si la IA no responde o devuelve JSON inválido, retorna DEFAULT_AI_CONFIG.
    """
    try:
        response = client.chat.completions.create(
            model="meta-llama-3.1-8b-instruct",
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": f"Resumen del repo: {repo_summary}"},
            ],
            temperature=0.0,  # Máximo determinismo para evitar errores
        )
        raw_content = response.choices[0].message.content.strip()
        clean_content = _sanitize_raw_content(raw_content)
        config = json.loads(clean_content)
        config = _validate_and_fix_config(config)
        print(Fore.GREEN + f"Configuración de IA recibida: {config}")
        return config

    except json.JSONDecodeError:
        print(Fore.RED + "Error parseando JSON de IA, usando configuración por defecto.")
        return DEFAULT_AI_CONFIG.copy()
    except Exception as e:
        print(Fore.RED + f"Error conectando con LM Studio: {e}")
        return DEFAULT_AI_CONFIG.copy()
