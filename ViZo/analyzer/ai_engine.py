# ai_engine.py
from openai import OpenAI

# Conexión local con LM Studio (RTX 4060)
client = OpenAI(base_url="http://localhost:1234/v1", api_key="lm-studio")


def get_ai_config(repo_summary):
    """
    Envía el resumen del análisis a Llama 3.1 y devuelve la configuración visual.
    """
    system_prompt = """
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

    try:
        response = client.chat.completions.create(
            model="meta-llama-3.1-8b-instruct",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Resumen del repo: {repo_summary}"},
            ],
            temperature=0.0,  # Máxima determinismo para evitar errores
        )
        content = response.choices[0].message.content.strip()

        # Limpieza de seguridad (Sanitize)
        # 1. Quitar bloques de código markdown si los pone
        if "```" in content:
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:].strip()
            content = content.strip()

        # 2. Quitar comentarios de una línea (//) que suelen romper el JSON
        import re

        content = re.sub(r"//.*", "", content)

        return content
    except Exception as e:
        return f"Error conectando con LM Studio: {e}"
