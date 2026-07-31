# ai.py
# -----
# Lógica principal del servicio de IA de ViZzo.
# Procesa peticiones para configuraciones dinámicas de dashboards y
# explicaciones holográficas mediante modelos de lenguaje (OpenAI / local).

import json
import logging
import os
from openai import APIConnectionError, APITimeoutError, OpenAI

logger = logging.getLogger(__name__)

from .prompts import (
    _SYSTEM_PROMPT,
    _SYSTEM_PROMPT_LOCAL,
    _EXPLAIN_SYSTEM_PROMPT_BASE,
      _DASHBOARD_DESCRIPTIONS,
)
from .helpers import (
    DEFAULT_AI_CONFIG,
    _extract_summary_and_json,
    _validate_and_fix_config,
)

# POR DEFECTO SE USARA MI PLAN DE DEEPSEEK COMO IA DE LA APLICACION.
AI_BASE_URL = os.getenv("DEEPSEEK_BASE_URL")
AI_API_KEY = os.getenv("DEEPSEEK_API_KEY")
AI_MODEL = os.getenv("DEEPSEEK_MODEL")
DEFAULT_AI_TIMEOUT = float(os.getenv("AI_TIMEOUT", "60.0"))

# Conexión local con LM Studio / OpenAI
client = OpenAI(
    base_url=AI_BASE_URL,
    api_key=AI_API_KEY,
    timeout=DEFAULT_AI_TIMEOUT,
    max_retries=0,  # No reintentar si falla la conexión inicial
)


def get_openai_client(base_url=None, api_key=None, timeout=None):
    """
    Crea una instancia local del cliente OpenAI con los parámetros suministrados,
    haciendo fallback a los valores por defecto del sistema.
    """
    return OpenAI(
        base_url=base_url or AI_BASE_URL,
        api_key=api_key or AI_API_KEY,
        timeout=timeout or DEFAULT_AI_TIMEOUT,
        max_retries=0,
    )


def get_ai_config(
    repo_summary: str, base_url: str = None, api_key: str = None, model: str = None, language: str = "es"
) -> dict:
    """
    Envía el resumen del análisis a LM Studio/OpenAI/LLM personalizado y devuelve la configuración de dashboards.
    Selecciona dinámicamente el prompt del sistema basado en la disponibilidad de datos de la API.
    """
    try:
        # Analizar disponibilidad de datos de API en el resumen
        has_api_data = False
        try:
            summary_dict = json.loads(repo_summary) if isinstance(repo_summary, str) else repo_summary
            if (
                summary_dict.get("code_reviews")
                or summary_dict.get("issues_health")
                or summary_dict.get("releases_health")
                or summary_dict.get("community_activity")
            ):
                has_api_data = True
        except Exception:
            pass

        if has_api_data:
            system_prompt = _SYSTEM_PROMPT
            logger.info("ViZzo // IA // Utilizando prompt de sistema ENRIQUECIDO (API de Comunidad).")
        else:
            system_prompt = _SYSTEM_PROMPT_LOCAL
            logger.info("ViZzo // IA // Utilizando prompt de sistema LOCAL (Sin API).")

        if language == "en":
            system_prompt += "\n\nCRITICAL INSTRUCTION: All dashboard titles ('title' field in JSON) MUST be written in ENGLISH (e.g. 'Code City', 'Developer Collaboration Network', 'Languages Distribution', 'Commits Evolution', 'Releases Health', 'Community Activity', 'File Ownership', 'Code Age', 'Top Complex Files', 'Issues Health')."

        ai_model = model or AI_MODEL
        local_client = get_openai_client(base_url, api_key)

        logger.info(f"[AI] Generando configuración de dashboards con {ai_model} (URL: {base_url or AI_BASE_URL})...")
        response = local_client.chat.completions.create(
            model=ai_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Resumen del repo: {repo_summary}"},
            ],
            temperature=0.3,
        )

        raw_content = response.choices[0].message.content.strip()
        summary, json_str = _extract_summary_and_json(raw_content)

        logger.info(f"ESTRATEGIA DE LA IA: {summary}")

        config = json.loads(json_str)
        config = _validate_and_fix_config(config)
        config["ai_status"] = "success"

        logger.info(f"[AI] Dashboards configurados: {[d['component'] for d in config['dashboards']]}")
        return config

    except APITimeoutError:
        logger.warning(f"[AI] Timeout de la API excedido ({DEFAULT_AI_TIMEOUT}s). Usando fallback offline.")
    except APIConnectionError:
        logger.warning(f"[AI] Error de Conexión: No se pudo contactar con el servidor en {AI_BASE_URL}.")
    except Exception as e:
        logger.error(f"[AI] Error: {e}. Usando fallback.")

    return DEFAULT_AI_CONFIG


def get_offline_explanation(dashboard_type: str, repo_name: str, language: str = "es") -> str:
    """
    Devuelve explicaciones técnicas de calidad predefinidas si el LLM local está offline.
    Soporta idiomas 'es' y 'en'.
    """
    if language == "en":
        if dashboard_type in {"boats", "file_metrics"}:
            return f"""[VIZZO_01 ANALYSIS SYSTEM - OFFLINE FALLBACK]
COMPLEXITY & NLOC REPORT (3D CITY) - REPOSITORY: {repo_name}

1. FILE STRUCTURAL ANALYSIS:
   The 3D city represents directory and file hierarchy.
   - Building height: Represents physical lines of code (NLOC). Tall buildings indicate extensive files that might violate the Single Responsibility Principle.
   - Building width/area: Represents McCabe's Cyclomatic Complexity (CCN). Wide buildings indicate dense conditional logic that is difficult to test.

2. DETECTED OBSERVATIONS:
   - High density code nuclei observed. Files combining large height and width (massive buildings) are critical "Hotspots" requiring immediate refactoring.
   - Directories with many small files reflect good modularization, whereas isolated monoliths are risk candidates.

3. CLEAN CODE RECOMMENDATIONS:
   - Split monolithic classes into smaller components.
   - Extract complex methods with CCN > 10 into independent helper functions.
   - Implement unit tests focused on identified hotspots."""

        elif dashboard_type in {"cyls", "data_by_language"}:
            return f"""[VIZZO_01 ANALYSIS SYSTEM - OFFLINE FALLBACK]
LANGUAGE DISTRIBUTION REPORT (3D CYLINDERS) - REPOSITORY: {repo_name}

1. TECHNOLOGICAL DIVERSIFICATION ANALYSIS:
   3D cylinders compare programming language presence in the repository.
   - Cylinder height: Total lines of code (NLOC) in that language.
   - Cylinder radius: Number of individual files in that language.

2. DETECTED OBSERVATIONS:
   - The tallest cylinder represents the project's core/dominant technology.
   - A wide radius with low height indicates fragmentation into small files (configs, templates, or automation scripts).

3. ARCHITECTURE RECOMMENDATIONS:
   - Keep main language dependencies up to date.
   - Properly document integration and communication between detected technologies."""

        elif dashboard_type == "doughnut":
            return f"""[VIZZO_01 ANALYSIS SYSTEM - OFFLINE FALLBACK]
LANGUAGE SHARE REPORT (3D DONUT) - REPOSITORY: {repo_name}

1. RELATIVE WEIGHT ANALYSIS:
   The 3D donut chart illustrates percentage proportion and file distribution per language.

2. DETECTED OBSERVATIONS:
   - Allows quick identification of project ecosystem and coupling level to a single technology.

3. RECOMMENDATIONS:
   - Optimize folder architecture to isolate build/transpilation languages from native source code.
   - Standardize linters and formatters (Prettier, ESLint, Black) for each identified language."""

        elif dashboard_type in {"barsmap", "author_activity"}:
            return f"""[VIZZO_01 ANALYSIS SYSTEM - OFFLINE FALLBACK]
AUTHOR ACTIVITY & COHESION REPORT (3D BARS) - REPOSITORY: {repo_name}

1. COLLABORATIVE DEVELOPMENT ANALYSIS:
   The 3D barsmap projects historical developer activity on a temporal grid.
   - X-Axis: Authors (Developers).
   - Z-Axis: Commit/activity timeline.
   - Bar height: Commit frequency or insertions per interval.

2. DETECTED OBSERVATIONS:
   - Clearly visualizes Bus Factor. If most high bars belong to a single author, the project has high individual dependency.

3. MANAGEMENT RECOMMENDATIONS:
   - Encourage Code Reviews to distribute domain knowledge.
   - Document key processes to reduce risk from primary developer departures."""

        elif dashboard_type == "file_ownership":
            return f"""[VIZZO_01 ANALYSIS SYSTEM - OFFLINE FALLBACK]
FILE OWNERSHIP REPORT (BUS FACTOR) - REPOSITORY: {repo_name}

1. BUS FACTOR ANALYSIS:
   Shows author contributions per file.
   - X-Axis: Authors.
   - Z-Axis: Files.
   - Height: Ownership percentage.

2. DETECTED OBSERVATIONS:
   - Solitary tall bars indicate files heavily dependent on a single developer.

3. RECOMMENDATIONS:
   - Promote task rotation and Pair Programming on critical files."""

        elif dashboard_type == "age_distribution":
            return f"""[VIZZO_01 ANALYSIS SYSTEM - OFFLINE FALLBACK]
CODE AGE REPORT (LEGACY CODE) - REPOSITORY: {repo_name}

1. AGE ANALYSIS:
   Groups files by age: Active (<30 days), Maintained (30-180 days), Legacy (>180 days).

2. RECOMMENDATIONS:
   - Periodically audit Legacy Code cylinders to remove dead or redundant code."""

        elif dashboard_type == "top_complex_files":
            return f"""[VIZZO_01 ANALYSIS SYSTEM - OFFLINE FALLBACK]
PEAK CCN COMPLEXITY REPORT (TOP 10) - REPOSITORY: {repo_name}

1. EXTREME COMPLEXITY ANALYSIS:
   Shows top 10 files with highest peak cyclomatic complexity in a single function.

2. RECOMMENDATIONS:
   - Refactor functions with Peak CCN > 10 applying divide-and-conquer principles."""

        elif dashboard_type in {"network", "babia-network"}:
            return f"""[VIZZO_01 ANALYSIS SYSTEM - OFFLINE FALLBACK]
DEVELOPER COLLABORATION NETWORK (3D GRAPH) - REPOSITORY: {repo_name}

1. SOCIAL INTERACTION ANALYSIS:
   Topology of collaboration among authors who co-edited files.

2. RECOMMENDATIONS:
   - Transfer knowledge from central connected nodes to isolated developers."""

        return f"""[VIZZO_01 ANALYSIS SYSTEM - OFFLINE FALLBACK]
GENERAL TECHNICAL REPORT - REPOSITORY: {repo_name}

General metrics available on the corresponding pedestal. Use wrist menu or physical controls to interact."""

    # Default Spanish fallback

    if dashboard_type in {"boats", "file_metrics"}:
        return f"""[SISTEMA DE ANÁLISIS VIZZO_01 - OFFLINE FALLBACK]
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
        return f"""[SISTEMA DE ANÁLISIS VIZZO_01 - OFFLINE FALLBACK]
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
        return f"""[SISTEMA DE ANÁLISIS VIZZO_01 - OFFLINE FALLBACK]
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
        return f"""[SISTEMA DE ANÁLISIS VIZZO_01 - OFFLINE FALLBACK]
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
        return f"""[SISTEMA DE ANÁLISIS VIZZO_01 - OFFLINE FALLBACK]
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
        return f"""[SISTEMA DE ANÁLISIS VIZZO_01 - OFFLINE FALLBACK]
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
        return f"""[SISTEMA DE ANÁLISIS VIZZO_01 - OFFLINE FALLBACK]
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

    elif dashboard_type in {"network", "babia-network"}:
        return f"""[SISTEMA DE ANÁLISIS VIZZO_01 - OFFLINE FALLBACK]
REPORTE DE RED DE COLABORACIÓN DE DESARROLLADORES (GRAFO 3D) - REPOSITORIO: {repo_name}

1. ANÁLISIS DE INTERACCIÓN SOCIAL Y TRABAJO COMPARITDO:
   El grafo 3D representa la topología de colaboración entre los autores que han co-editado archivos.
   - Nodos (esferas): Cada esfera es un desarrollador. Esferas de mayor tamaño indican autores con alta frecuencia de commits.
   - Enlaces (líneas): Conexiones entre desarrolladores. Líneas más gruesas indican un alto número de archivos co-editados en común.

2. OBSERVACIONES DETECTADAS:
   - Se distinguen agrupaciones (clústeres) que reflejan equipos de trabajo o áreas acopladas del repositorio.
   - Nodos periféricos y aislados corresponden a contribuidores puntuales o desarrolladores con tareas muy independientes.
   - Conexiones densas muestran una comunicación técnica saludable o, en el peor de los casos, un alto acoplamiento en las mismas piezas de código.

3. RECOMENDACIONES DE GESTIÓN Y CALIDAD:
   - Fomentar la transferencia de conocimiento de los nodos centrales muy conectados hacia los desarrolladores más aislados.
   - Identificar si las conexiones muy gruesas esconden un "hotspot" de acoplamiento de archivos (múltiples personas modificando constantemente el mismo archivo grande)."""

    return f"""[SISTEMA DE ANÁLISIS VIZZO_01 - OFFLINE FALLBACK]
REPORTE TÉCNICO GENERAL - REPOSITORIO: {repo_name}

Métricas generales disponibles en el pedestal correspondiente. Use los controles físicos o el menú holográfico de muñeca para alternar mapeos e interactuar con la visualización."""


def parse_explanation_sections(raw_text: str) -> dict:
    """
    Parsea la respuesta de la IA (JSON o texto plano) en 3 secciones bien definidas.
    """
    import json
    import re

    if not raw_text or not isinstance(raw_text, str):
        return {
            "summary": "Sin información de explicación disponible.",
            "problems": "No se detectaron problemas críticos adicionales.",
            "recommendations": "No se generaron recomendaciones específicas adicionales.",
        }

    # Intentar parsear JSON directo o dentro de bloque ```json ... ```
    json_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw_text, re.DOTALL)
    candidate_str = json_match.group(1) if json_match else raw_text.strip()
    try:
        data = json.loads(candidate_str)
        if isinstance(data, dict) and "summary" in data:
            return {
                "summary": data.get("summary", "").strip(),
                "problems": data.get("problems", "").strip(),
                "recommendations": data.get("recommendations", "").strip(),
            }
    except Exception:
        pass

    # Fallback si vino texto plano o respuesta offline (soporta encabezados ES y EN)
    summary_match = re.search(r"(?:1\.\s*TÍTULO|1\.\s*TITLE|\#\s*1|\#\s*TÍTULO|\#\s*TITLE|RESUMEN|SUMMARY)(.*?)(?=(?:2\.\s*PRINCIPALES|2\.\s*KEY|2\.\s*MAIN|3\.\s*RECOMENDACIONES|3\.\s*RECOMMENDATIONS|\#\s*2|\#\s*3|PROBLEMAS|PROBLEMS|$))", raw_text, re.DOTALL | re.IGNORECASE)
    problems_match = re.search(r"(?:2\.\s*PRINCIPALES|2\.\s*KEY|2\.\s*MAIN|\#\s*2|\#\s*PROBLEMAS|\#\s*PROBLEMS|PROBLEMAS|PROBLEMS)(.*?)(?=(?:3\.\s*RECOMENDACIONES|3\.\s*RECOMMENDATIONS|4\.\s*RECOMENDACIONES|4\.\s*RECOMMENDATIONS|\#\s*3|MEJORAS|RECOMMENDATIONS|$))", raw_text, re.DOTALL | re.IGNORECASE)
    recs_match = re.search(r"(?:3\.\s*RECOMENDACIONES|3\.\s*RECOMMENDATIONS|4\.\s*RECOMENDACIONES|4\.\s*RECOMMENDATIONS|\#\s*3|\#\s*RECOMENDACIONES|\#\s*RECOMMENDATIONS|MEJORAS|RECOMMENDATIONS)(.*?)$", raw_text, re.DOTALL | re.IGNORECASE)

    summary_text = summary_match.group(1).strip() if summary_match and summary_match.group(1).strip() else raw_text
    problems_text = problems_match.group(1).strip() if problems_match and problems_match.group(1).strip() else ("No critical problems detected for this section." if "SUMMARY" in raw_text or "TITLE" in raw_text else "No se detectaron problemas críticos adicionales para esta sección.")
    recs_text = recs_match.group(1).strip() if recs_match and recs_match.group(1).strip() else ("No specific additional recommendations generated." if "SUMMARY" in raw_text or "TITLE" in raw_text else "No se generaron recomendaciones específicas adicionales.")

    return {
        "summary": summary_text,
        "problems": problems_text,
        "recommendations": recs_text,
    }


def generate_dashboard_explanation(
    dashboard_type: str,
    dashboard_data: str,
    repo_name: str = "PROYECTO",
    base_url: str = None,
    api_key: str = None,
    model: str = None,
    language: str = "es",
) -> str:
    """
    Genera una explicación técnica y profesional adaptada al tipo de dashboard provisto.
    Soporta idioma 'es' y 'en'.
    """
    try:
        # Intentar resumir el JSON de datos si es una lista muy larga para evitar exceder el contexto del LLM local
        data_obj = json.loads(dashboard_data)
        if isinstance(data_obj, list) and len(data_obj) > 15:
            first_item = data_obj[0]
            if "nloc" in first_item:
                data_obj.sort(key=lambda x: float(x.get("nloc") or 0), reverse=True)
            elif "commits" in first_item:
                data_obj.sort(key=lambda x: float(x.get("commits") or 0), reverse=True)
            elif "ownership" in first_item:
                data_obj.sort(
                    key=lambda x: float(x.get("ownership") or 0), reverse=True
                )

            data_obj = data_obj[:15]
            dashboard_data = json.dumps(data_obj)
        elif isinstance(data_obj, dict) and ("nodes" in data_obj or "links" in data_obj):
            # Sintetizar y recortar grafos de red (code_reviews / file_network)
            raw_nodes = data_obj.get("nodes", [])
            raw_links = data_obj.get("links", [])

            # Ordenar nodos por peso (total_reviews_given, val, size, etc.) y seleccionar el Top 10
            sorted_nodes = sorted(
                raw_nodes,
                key=lambda n: float(
                    n.get("total_reviews_given") or n.get("val") or n.get("size") or 0
                ),
                reverse=True,
            )[:10]

            selected_node_ids = {str(n.get("id")) for n in sorted_nodes if n.get("id") is not None}

            # Filtrar los enlaces principales asociados a estos nodos
            filtered_links = []
            for l in raw_links:
                src = str(l.get("source") or l.get("linkSource") or "")
                tgt = str(l.get("target") or l.get("linkTarget") or "")
                if src in selected_node_ids or tgt in selected_node_ids:
                    filtered_links.append(l)
            filtered_links = filtered_links[:15]

            # Construir JSON limpio sin metadatos ruidosos de la API de GitHub
            clean_nodes = [
                {
                    "developer": n.get("name") or n.get("id"),
                    "contributions_or_reviews": n.get("total_reviews_given") or n.get("val") or n.get("size") or 0,
                }
                for n in sorted_nodes
            ]

            clean_links = [
                {
                    "reviewer": l.get("source") or l.get("linkSource"),
                    "author_or_target": l.get("target") or l.get("linkTarget"),
                    "interactions": l.get("review_count") or l.get("linkWidth") or l.get("weight") or 1,
                }
                for l in filtered_links
            ]

            dashboard_data = json.dumps({
                "type": "network_graph",
                "top_nodes": clean_nodes,
                "main_links": clean_links,
            })
    except Exception:
        pass

    try:
        from analyzer.core.AI.prompts import (
            _DASHBOARD_DESCRIPTIONS,
            _EXPLAIN_SYSTEM_PROMPT_BASE,
            _EXPLAIN_SYSTEM_PROMPT_BASE_EN,
        )
    except Exception:
        pass

    try:
        desc = _DASHBOARD_DESCRIPTIONS.get(dashboard_type)
        if not desc and ("pie" in dashboard_type or "doughnut" in dashboard_type):
            desc = _DASHBOARD_DESCRIPTIONS.get("doughnut")
        if not desc:
            desc = f"Dashboard type '{dashboard_type}'. Analyze provided JSON data and explain its meaning."

        if language == "en":
            base_prompt = _EXPLAIN_SYSTEM_PROMPT_BASE_EN if '_EXPLAIN_SYSTEM_PROMPT_BASE_EN' in locals() else _EXPLAIN_SYSTEM_PROMPT_BASE
            system_prompt = base_prompt.format(dashboard_description=desc)
            prompt_user = f"""
            Repository: {repo_name}
            Dashboard Type: {dashboard_type}
            Dashboard Data (JSON):
            {dashboard_data[:3000]}

            CRITICAL INSTRUCTION: Focus EXCLUSIVELY on the dashboard of type '{dashboard_type}' described in the system message. Write your ENTIRE explanation in ENGLISH.
            """
        else:
            system_prompt = _EXPLAIN_SYSTEM_PROMPT_BASE.format(dashboard_description=desc)
            prompt_user = f"""
            Repositorio: {repo_name}
            Tipo de Dashboard: {dashboard_type}
            Datos del Dashboard (JSON):
            {dashboard_data[:3000]}

            INSTRUCCIÓN CRÍTICA: Concéntrate EXCLUSIVAMENTE en el dashboard de tipo '{dashboard_type}' descrito en el mensaje del sistema. Ignora los demás dashboards de la base de datos de ViZzo. No repitas explicaciones ni menciones otros componentes.
            """

        ai_model = model or AI_MODEL
        local_client = get_openai_client(base_url, api_key)
        logger.info(
            f"[AI] Generando explicación aislada para {dashboard_type} ({language}) con {ai_model} (URL: {base_url or AI_BASE_URL})..."
        )
        response = local_client.chat.completions.create(
            model=ai_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt_user},
            ],
            temperature=0.4,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"[AI Explanation] Error: {e}. Usando fallback offline.")
        return get_offline_explanation(dashboard_type, repo_name, language=language)


def get_ai_explanation(
    dashboard_type: str,
    dashboard_data: str,
    repo_name: str,
    base_url: str = None,
    api_key: str = None,
    model: str = None,
    language: str = "es",
) -> str:
    """
    Envía los datos de un dashboard de visualización específico a la IA para
    obtener una explicación técnica de la salud y calidad del código.
    """
    return generate_dashboard_explanation(
        dashboard_type=dashboard_type,
        dashboard_data=dashboard_data,
        repo_name=repo_name,
        base_url=base_url,
        api_key=api_key,
        model=model,
        language=language,
    )
