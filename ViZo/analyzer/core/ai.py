"""
ai.py
─────
Integración de Inteligencia Artificial para ViZo:
  - Generación de configuraciones dinámicas de dashboards
  - Generación de reportes explicativos del visualizador 3D/VR
  - Fallbacks locales y offline autosanables
"""

import json
import os
import re

from colorama import Fore
from dotenv import load_dotenv
from openai import APIConnectionError, OpenAI

# Cargar variables de entorno
load_dotenv()

AI_BASE_URL = os.getenv("AI_BASE_URL", "http://localhost:1234/v1")
AI_API_KEY = os.getenv("AI_API_KEY", "lm-studio")
AI_MODEL = os.getenv("AI_MODEL", "qwen/qwen3-coder-30b")

# Conexión local con LM Studio / OpenAI
client = OpenAI(
    base_url=AI_BASE_URL,
    api_key=AI_API_KEY,
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
    ],
    "ai_status": "offline",
}

_SYSTEM_PROMPT = """
Eres un arquitecto de visualización de software experto en BabiaXR. 
Tu misión es diseñar un centro de mando virtual para analizar la salud de un repositorio de código utilizando visualizaciones 3D.
Debes analizar detenidamente las estadísticas del repositorio recibidas en el prompt del usuario (resumen del repo) para decidir qué dashboards instanciar (de 1 a 4 máximo).

# DATASETS DISPONIBLES
1. "file_metrics": Detalle por archivo (nloc, ccn, commits, language, folder, num_functions, peak_ccn, ownership, age_days).
2. "data_by_language": Agrupaciones por lenguaje (nloc, avg_ccn, total_commits, count).
3. "evolution_data": Historial de commits (hash, author, date, message, insertions, deletions).
4. "author_activity": Actividad agrupada por autor y fecha (author, date, commits, insertions).
5. "file_ownership": Propiedad de archivos por autor (author, file, ownership).
6. "age_distribution": Agrupación de archivos por antigüedad (category: Active/Maintained/Legacy, nloc, count).
7. "top_complex_files": Top 10 archivos más complejos (name, peak_ccn, avg_ccn).

# COMPONENTES Y DASHBOARDS DISPONIBLES
- babia-boats (Ciudad de Código) [Dataset: file_metrics]
  ESENCIAL/OBLIGATORIO. Representa archivos como edificios.
  Mappings: {"key": "id", "height": "nloc|ccn|commits", "area": "nloc|ccn|commits", "color": "commits|nloc|ccn"}
  * Mapea "color" a "commits" si deseas mostrar el Churn/actividad térmica (de azul a rojo).
  
- babia-barsmap (Bus Factor / Propiedad de Autores) [Dataset: file_ownership]
  Representa el monopolio de conocimiento. Eje X = Autores, Eje Z = Archivos, Altura = Porcentaje de propiedad (0-100%).
  Mappings: {"x_axis": "author", "z_axis": "file", "height": "ownership"}
  * Elígelo si hay múltiples autores y quieres visualizar el factor de riesgo por autor.

- babia-cyls (Legacy Code / Edad del Código) [Dataset: age_distribution]
  Agrupa volumen de código por edad en 3 cilindros: Active (<30 días), Maintained (30-180 días) y Legacy (>180 días).
  Mappings: {"x_axis": "category", "height": "nloc", "radius": "count"}
  * Elígelo si hay commits antiguos y quieres alertar sobre código legado.

- babia-barsmap (Modularidad / Funciones) [Dataset: file_metrics]
  Eje X = Carpetas (folder), Eje Z = Lenguajes (language), Altura = Promedio de funciones.
  Mappings: {"x_axis": "folder", "z_axis": "language", "height": "num_functions"}
  * Elígelo si quieres auditar la modularidad y cantidad de funciones en directorios.

- babia-cyls (Peak CCN / Top 10 Complejidad) [Dataset: top_complex_files]
  Compara de un vistazo si la complejidad es puntual (función monstruo) o generalizada en los 10 archivos más complejos.
  Mappings: {"x_axis": "name", "height": "peak_ccn", "radius": "avg_ccn"}
  * Elígelo si quieres resaltar los archivos de mayor complejidad ciclomática máxima.

- babia-cyls / babia-doughnut (Distribución Estándar) [Dataset: data_by_language]
  Úsalos para mostrar la distribución general de lenguajes.
  Mappings para babia-cyls: {"x_axis": "language", "height": "nloc", "radius": "count"}
  Mappings para babia-doughnut: {"key": "language", "size": "count"}

# INSTRUCCIONES DE SELECCIÓN DINÁMICA
*   `babia-boats` es siempre OBLIGATORIO para representar la ciudad de archivos.
*   Puedes elegir hasta 3 dashboards satélites adicionales (total máximo 4 dashboards).
*   Si el repositorio es monolenguaje (num_languages == 1), evita cilindros/tartas de lenguaje estándar.
*   Si solo hay 1 autor, no uses el Bus Factor.
*   Combina los componentes de forma equilibrada y justificada en tu resumen.

RESUMEN:
Un breve párrafo de 2-3 líneas explicando qué has observado en los datos y por qué has elegido esos componentes (por ejemplo, si has descartado alguno por falta de diversidad de autores o lenguajes).

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


# Componentes y datasets válidos para validación
_VALID_COMPONENTS = {"babia-boats", "babia-cyls", "babia-doughnut", "babia-barsmap"}
_VALID_DATASETS = {
    "file_metrics",
    "data_by_language",
    "evolution_data",
    "author_activity",
    "file_ownership",
    "age_distribution",
    "top_complex_files",
}

# Mappings por defecto para cada componente (fallback si la IA no los especifica correctamente)
_DEFAULT_MAPPINGS = {
    "babia-boats": {"key": "id", "height": "nloc", "area": "ccn"},
    "babia-cyls": {"x_axis": "language", "height": "nloc", "radius": "count"},
    "babia-doughnut": {"key": "language", "size": "count"},
    "babia-barsmap": {"x_axis": "author", "z_axis": "date", "height": "commits"},
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

        # Fuerza author_activity para babia-barsmap si no usa uno de los nuevos datasets permitidos
        if component == "babia-barsmap" and dash["dataset"] not in {
            "author_activity",
            "file_ownership",
            "file_metrics",
        }:
            dash["dataset"] = "author_activity"

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

    config["dashboards"] = validated[:4]
    return config


# ─────────────────────────────────────────────────────────────────────────────
# Función pública principal
# ─────────────────────────────────────────────────────────────────────────────


def get_ai_config(repo_summary: str) -> dict:
    """
    Envía el resumen del análisis a LM Studio/OpenAI y devuelve la configuración de dashboards.
    Ahora también imprime el razonamiento técnico de la IA.
    """
    try:
        response = client.chat.completions.create(
            model=AI_MODEL,
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
        config["ai_status"] = "success"

        print(
            Fore.GREEN
            + f"[AI] Dashboards configurados: {[d['component'] for d in config['dashboards']]}"
        )
        return config

    except APIConnectionError:
        print(
            Fore.RED
            + f"[AI] Error de Conexión: No se pudo contactar con el servidor en {AI_BASE_URL}. ¿Está abierto y corriendo?"
        )
    except Exception as e:
        print(Fore.RED + f"[AI] Error: {e}. Usando fallback.")

    return DEFAULT_AI_CONFIG


_EXPLAIN_SYSTEM_PROMPT = """
Eres VIZO_AI, un analizador holográfico retro-futurista y arquitecto experto en calidad de software.
Tu propósito es analizar los datos estructurados del repositorio y proporcionar una explicación analítica sumamente detallada, profesional y estilizada para el panel de visualización 3D seleccionado.

MANDATO CRÍTICO:
Debes iniciar tu explicación describiendo claramente qué representan los ejes, dimensiones y valores del dashboard seleccionado en función de su "Tipo de Dashboard" (dashboard_type) para orientar al usuario. Usa este mapeo de referencia para explicarlos:

1. Ciudad de Código ("file_metrics" o "boats"):
   - Los edificios representan archivos individuales de código.
   - Altura de los edificios: Representa la métrica activa de volumen (líneas de código NLOC, commits, funciones, etc.).
   - Base/Área de los edificios: Representa la complejidad o el tamaño (por defecto ccn / complejidad ciclomática).
   - Color de los edificios: Teñido térmico HSL según la métrica activa (commits / Churn, complejidad ccn, propiedad de autoría, o antigüedad en días).

2. Cilindros comparativos de lenguajes ("data_by_language" o "cyls"):
   - Los cilindros representan los lenguajes de programación del repositorio.
   - Altura: Líneas de código totales (NLOC) o commits acumulados en dicho lenguaje.
   - Radio/Grosor: Cantidad de archivos individuales desarrollados en ese lenguaje.

3. Cilindros del Top 10 Complejidad ("top_complex_files"):
   - Los cilindros representan los 10 archivos individuales más complejos del proyecto.
   - Altura: Complejidad máxima alcanzada en una sola función (Peak CCN).
   - Radio/Grosor: Complejidad ciclomática promedio de todas las funciones del archivo.
   - Eje X: Identificador/nombre del archivo.

4. Cilindros de Antigüedad ("age_distribution"):
   - Los cilindros agrupan los archivos en base a su fecha de última modificación.
   - Categorías (Eje X): "Active" (<30 días), "Maintained" (30-180 días) y "Legacy" (>180 días).
   - Altura: Líneas de código totales (NLOC) acumuladas en esa categoría.
   - Radio/Grosor: Cantidad de archivos en esa franja temporal.

5. Gráfico de Tarta/Donut ("doughnut"):
   - Los sectores 3D representan la proporción de archivos o volumen por lenguaje en el proyecto.
   - Tamaño/Ángulo del sector: Peso relativo porcentual del lenguaje respecto al total del repositorio.

6. Actividad de Autores ("author_activity" o "barsmap"):
   - El mapa de barras 3D proyecta commits e inserciones a lo largo del tiempo.
   - Eje X: Autores (Desarrolladores).
   - Eje Z: Línea temporal de commits.
   - Altura de las barras: Frecuencia de commits o inserciones en ese intervalo.

7. Propiedad de Archivos / Bus Factor ("file_ownership"):
   - El mapa de barras 3D proyecta la concentración de conocimiento de autores por archivo.
   - Eje X: Autores (Desarrolladores).
   - Eje Z: Archivos individuales.
   - Altura de las barras: Porcentaje de propiedad (proporción de commits del autor en dicho archivo de 0 a 100%).

Habla con un tono técnico, cibernético y preciso (estilo hacker de los 80 / terminal de Matrix, pero sumamente profesional).
Analiza las métricas clave del dataset provisto y ofrece conclusiones claras, problemas potenciales detectados (como alta complejidad ciclomática, monopolio de conocimiento o archivos obsoletos/legacy) y recomendaciones específicas de refactorización de código limpio.

Limita tu respuesta a un máximo de 3-4 párrafos cortos o puntos clave bien estructurados y espaciados para facilitar su lectura en una terminal de pantalla monospace.
"""


def get_offline_explanation(dashboard_type: str, repo_name: str) -> str:
    """
    Devuelve explicaciones técnicas de calidad predefinidas si el LLM local está offline.
    """
    if dashboard_type in {"boats", "file_metrics"}:
        return f"""[SISTEMA DE ANÁLISIS VIZO_01 - OFFLINE FALLBACK]
REPORTE DE COMPLEJIDAD Y NLOC (CIUDAD 3D) - REPOSITORIO: {repo_name}

1. ANÁLISIS ESTRUCTURAL DE ARCHIVOS:
   La ciudad 3D representa la jerarquía de directorios y archivos.
   - Altura de los edificios: Representa el número de líneas de código físicas (NLOC). Edificios altos indican archivos extensos que podrían violar el principio de responsabilidad única (Single Responsibility Principle).
   - Anchura/Área de los edificios: Representa la Complejidad Ciclomática (CCN) de McCabe. Edificios anchos indican lógica condicional densa y difícil de testear.

2. OBSERVACIONES DETECTADAS:
   - Se observan varios núcleos de código con alta densidad. Los archivos que combinan gran altura y gran anchura (edificios masivos) son "Hotspots" críticos que requieren refactorización inmediata.
   - Directorios con muchos archivos pequeños reflejan una buena modularización, mientras que los monolitos solitarios en la periferia son candidatos de riesgo.

3. RECOMENDACIONES DE CÓDIGO LIMPIO:
   - Dividir clases monolíticas en componentes pequeños.
   - Extraer métodos complejos con CCN > 10 en funciones auxiliares independientes.
   - Implementar pruebas unitarias enfocadas en los hotspots identificados."""

    elif dashboard_type in {"cyls", "data_by_language"}:
        return f"""[SISTEMA DE ANÁLISIS VIZO_01 - OFFLINE FALLBACK]
REPORTE DE DISTRIBUCIÓN POR LENGUAJE (CILINDROS 3D) - REPOSITORIO: {repo_name}

1. ANÁLISIS DE DIVERSIFICACIÓN TECNOLÓGICA:
   Los cilindros 3D comparan la presencia de lenguajes de programación en el repositorio.
   - Altura del cilindro: Líneas de código totales (NLOC) en ese lenguaje.
   - Radio del cilindro: Cantidad de archivos individuales de dicho lenguaje.

2. OBSERVACIONES DETECTADAS:
   - El lenguaje con mayor altura representa la tecnología core/dominante del proyecto.
   - Un radio amplio con poca altura indica una fragmentación de archivos pequeños (configuraciones, plantillas o scripts de automatización).
   - Un desequilibrio extremo (p. ej. un solo cilindro masivo frente a otros diminutos) confirma una arquitectura monolítica tecnológica.

3. RECOMENDACIONES DE ARQUITECTURA:
   - Mantener actualizadas las dependencias del lenguaje principal.
   - Documentar adecuadamente la integración y comunicación entre las diferentes tecnologías detectadas."""

    elif dashboard_type == "doughnut":
        return f"""[SISTEMA DE ANÁLISIS VIZO_01 - OFFLINE FALLBACK]
REPORTE DE PARTICIPACIÓN POR LENGUAJE (TARTA 3D) - REPOSITORIO: {repo_name}

1. ANÁLISIS DE PESO RELATIVO:
   El gráfico de tarta 3D (doughnut) ilustra la proporción porcentual y distribución de archivos por lenguaje en el repositorio.

2. OBSERVACIONES DETECTADAS:
   - Permite identificar rápidamente el ecosistema del proyecto y el nivel de acoplamiento a una sola tecnología.
   - Los sectores minoritarios suelen representar infraestructuras auxiliares, herramientas de construcción (Build tools) o archivos de pruebas unitarias.

3. RECOMENDACIONES:
   - Optimizar la arquitectura de carpetas para aislar los lenguajes de compilación/transpilación de los de código fuente nativo.
   - Estandarizar linters y formateadores (Prettier, ESLint, Black) para cada lenguaje identificado."""

    elif dashboard_type in {"barsmap", "author_activity"}:
        return f"""[SISTEMA DE ANÁLISIS VIZO_01 - OFFLINE FALLBACK]
REPORTE DE ACTIVIDAD Y COHESIÓN DE AUTORES (BARRAS 3D) - REPOSITORIO: {repo_name}

1. ANÁLISIS DE DESARROLLO COLABORATIVO:
   El mapa de barras 3D proyecta la actividad histórica de los desarrolladores en una cuadrícula temporal.
   - Eje X: Autores (Desarrolladores).
   - Eje Z: Línea temporal de commits/actividad.
   - Altura de las barras: Frecuencia de commits o inserciones realizadas en cada intervalo.

2. OBSERVACIONES DETECTADAS:
   - Permite visualizar de forma clara el "Factor Autobús" (Bus Factor). Si la gran mayoría de las barras altas pertenecen a un solo autor, el proyecto tiene una alta dependencia individual.
   - Picos aislados representan hitos de entrega o integraciones masivas, mientras que una distribución uniforme muestra un ritmo ágil constante de desarrollo (cohesión de equipo).

3. RECOMENDACIONES DE GESTIÓN:
   - Fomentar la revisión de código (Code Reviews) para distribuir el conocimiento del dominio.
   - Documentar procesos clave en repositorios compartidos para reducir el riesgo asociado a la partida de desarrolladores principales."""

    elif dashboard_type == "file_ownership":
        return f"""[SISTEMA DE ANÁLISIS VIZO_01 - OFFLINE FALLBACK]
REPORTE DE PROPIEDAD DE ARCHIVOS (BUS FACTOR) - REPOSITORIO: {repo_name}

1. ANÁLISIS DE FACTOR AUTOBÚS:
   El gráfico 3D Barsmap de Propiedad muestra la contribución de los autores por cada archivo.
   - Eje X: Autores (Desarrolladores).
   - Eje Z: Archivos.
   - Altura: Porcentaje de propiedad (proporción de commits del autor en dicho archivo).

2. OBSERVACIONES DETECTADAS:
   - Barras altas solitarias indican archivos con alta dependencia de un único desarrollador (bajo Bus Factor).
   - Si un solo autor domina múltiples archivos con 100% de propiedad, la pérdida de dicho desarrollador representa un riesgo alto.

3. RECOMENDACIONES:
   - Fomentar la rotación de tareas de programación.
   - Realizar sesiones de Pair Programming en los archivos más críticos con alta concentración de propiedad."""

    elif dashboard_type == "age_distribution":
        return f"""[SISTEMA DE ANÁLISIS VIZO_01 - OFFLINE FALLBACK]
REPORTE DE EDAD DEL CÓDIGO (LEGACY CODE) - REPOSITORIO: {repo_name}

1. ANÁLISIS DE ANTIGÜEDAD:
   El gráfico agrupa los archivos en tres categorías de edad:
   - Active: Modificados hace menos de 30 días.
   - Maintained: Modificados hace entre 30 y 180 días.
   - Legacy: Modificados hace más de 180 días (6 meses).

2. OBSERVACIONES DETECTADAS:
   - El volumen de código Legacy (cilindros correspondientes) representa la base heredada del sistema.
   - Un volumen alto de código Active muestra un ritmo acelerado de desarrollo o refactorizaciones recientes.

3. RECOMENDACIONES:
   - Auditar periódicamente el cilindro de Legacy Code para eliminar código muerto o redundante.
   - Garantizar que el código mantenido cuente con suficiente cobertura de tests antes de realizar modificaciones."""

    elif dashboard_type == "top_complex_files":
        return f"""[SISTEMA DE ANÁLISIS VIZO_01 - OFFLINE FALLBACK]
REPORTE DE COMPLEJIDAD PEAK CCN (TOP 10) - REPOSITORIO: {repo_name}

1. ANÁLISIS DE COMPLEJIDAD EXTREMA:
   Los cilindros muestran los 10 archivos con mayor complejidad ciclomática máxima en una sola función (Peak CCN).
   - Altura del cilindro: Complejidad máxima de una función (Peak CCN).
   - Radio del cilindro: Complejidad promedio de todas las funciones del archivo.

2. OBSERVACIONES DETECTADAS:
   - Si la altura (Peak CCN) es muy alta pero el radio (CCN promedio) es pequeño, existe una sola función sumamente compleja ("función monstruo").
   - Si ambos valores son altos, el archivo completo está sobrecargado de lógica condicional.

3. RECOMENDACIONES:
   - Refactorizar las funciones con Peak CCN > 10 aplicando el principio de división y conquista.
   - Desacoplar grandes estructuras condicionales (if/switch) usando polimorfismo o patrones de diseño."""

    return f"""[SISTEMA DE ANÁLISIS VIZO_01 - OFFLINE FALLBACK]
REPORTE TÉCNICO GENERAL - REPOSITORIO: {repo_name}

Métricas generales disponibles en el pedestal correspondiente. Use los controles físicos o el menú holográfico de muñeca para alternar mapeos e interactuar con la visualización."""


def get_ai_explanation(dashboard_type: str, dashboard_data: str, repo_name: str) -> str:
    """
    Envía los datos de un dashboard de visualización específico a la IA para
    obtener una explicación técnica de la salud y calidad del código.
    """
    prompt_user = f"""
    Repositorio: {repo_name}
    Tipo de Dashboard: {dashboard_type}
    Datos del Dashboard (JSON):
    {dashboard_data[:8000]}
    """
    try:
        response = client.chat.completions.create(
            model=AI_MODEL,
            messages=[
                {"role": "system", "content": _EXPLAIN_SYSTEM_PROMPT},
                {"role": "user", "content": prompt_user},
            ],
            temperature=0.4,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"[AI Explanation] Error: {e}. Usando fallback offline.")
        return get_offline_explanation(dashboard_type, repo_name)
