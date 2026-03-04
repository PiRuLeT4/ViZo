# ai_engine.py
from openai import OpenAI

# Conexión local con LM Studio (RTX 4060)
client = OpenAI(base_url="http://localhost:1234/v1", api_key="lm-studio")


def get_city_config(repo_summary):
    """
    Envía el resumen del análisis a Llama 3.1 y devuelve la configuración visual.
    """
    system_prompt = """
    Eres un experto en visualización de software y BabiaXR.
    Tu tarea es decidir cómo representar un repositorio en 3D.
    
    CAMPOS DISPONIBLES (debes usar estos nombres exactos para fheight y farea):
    - nloc: Líneas de código reales.
    - ccn: Complejidad ciclomática.
    - commits: Número de veces que ha cambiado el archivo.

    INSTRUCCIONES DE SALIDA:
    1. Responde ÚNICAMENTE con un objeto JSON válido.
    2. NO incluyas comentarios (// o /* */) dentro del JSON.
    3. NO incluyas bloques de código markdown (```json).
    4. NO incluyas explicaciones antes o después.
    
    ESQUEMA REQUERIDO:
    {
        "id": "nombre del archivo",
        "fheight": "nloc" o "ccn" o "commits",
        "farea": "nloc" o "ccn" o "commits",
        "building_color": "hexadecimal (ej: #00fbff)",
        "base_color": "hexadecimal (ej: #1a1a1a)",
        "extra": valor_flotante (ej: 1.5)
    }
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
