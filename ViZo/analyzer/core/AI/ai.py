# ai.py
# -----
# Lógica principal del servicio de IA de ViZzo.
# Procesa peticiones para configuraciones dinámicas de dashboards y
# explicaciones holográficas mediante modelos de lenguaje (OpenAI / local).

import json
import os
from colorama import Fore
from dotenv import load_dotenv
from openai import APIConnectionError, OpenAI

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

# Cargar variables de entorno
load_dotenv()

# POR DEFECTO SE USARA MI PLAN DE DEEPSEEK COMO IA DE LA APLICACION.
AI_BASE_URL = os.getenv("DEEPSEEK_BASE_URL")
AI_API_KEY = os.getenv("DEEPSEEK_API_KEY")
AI_MODEL = os.getenv("DEEPSEEK_MODEL")

# Conexión local con LM Studio / OpenAI
client = OpenAI(
    base_url=AI_BASE_URL,
    api_key=AI_API_KEY,
    timeout=None,  # Sin límite de tiempo
    max_retries=0,  # No reintentar si falla la conexión inicial
)


def get_openai_client(base_url=None, api_key=None):
    """
    Crea una instancia local del cliente OpenAI con los parámetros suministrados,
    haciendo fallback a los valores por defecto del sistema.
    """
    return OpenAI(
        base_url=base_url or AI_BASE_URL,
        api_key=api_key or AI_API_KEY,
        timeout=None,
        max_retries=0,
    )


def get_ai_config(
    repo_summary: str, base_url: str = None, api_key: str = None, model: str = None
) -> dict:
    """
    Envía el resumen del análisis a LM Studio/OpenAI/LLM personalizado y devuelve la configuración de dashboards.
    Selecciona dinámicamente el prompt del sistema basado en la disponibilidad de datos de la API.
    """
    try:
        # Analizar disponibilidad de datos de API en el resumen
        has_api_data = False
        try:
            summary_dict = json.loads(repo_summary)
            code_reviews = summary_dict.get("code_reviews", {})
            if code_reviews and (
                code_reviews.get("nodes") or code_reviews.get("links")
            ):
                has_api_data = True
            elif (
                summary_dict.get("pull_requests")
                or summary_dict.get("issues_health")
                or summary_dict.get("releases_health")
                or summary_dict.get("community_activity")
            ):
                has_api_data = True
        except Exception:
            pass

        if has_api_data:
            system_prompt = _SYSTEM_PROMPT
            print(
                Fore.CYAN
                + "ViZzo // IA // Utilizando prompt de sistema ENRIQUECIDO (API de Comunidad)."
            )
        else:
            system_prompt = _SYSTEM_PROMPT_LOCAL
            print(
                Fore.CYAN
                + "ViZzo // IA // Utilizando prompt de sistema LOCAL (Sin API)."
            )

        ai_model = model or AI_MODEL
        local_client = get_openai_client(base_url, api_key)

        print(
            Fore.YELLOW
            + f"\n[AI] Generando configuración de dashboards con {ai_model} (URL: {base_url or AI_BASE_URL})..."
        )
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


def get_offline_explanation(dashboard_type: str, repo_name: str) -> str:
    """
    Devuelve explicaciones técnicas de calidad predefinidas si el LLM local está offline.
    """
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


def get_ai_explanation(
    dashboard_type: str,
    dashboard_data: str,
    repo_name: str,
    base_url: str = None,
    api_key: str = None,
    model: str = None,
) -> str:
    """
    Envía los datos de un dashboard de visualización específico a la IA para
    obtener una explicación técnica de la salud y calidad del código.
    """
    # Intentar resumir el JSON de datos si es una lista muy larga para evitar exceder el contexto del LLM local
    try:
        data_obj = json.loads(dashboard_data)
        if isinstance(data_obj, list) and len(data_obj) > 15:
            # Ordenar por el campo más relevante si existe
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
    except Exception:
        pass

    desc = _DASHBOARD_DESCRIPTIONS.get(dashboard_type)
    if not desc:
        desc = f"Dashboard de tipo '{dashboard_type}'. Analiza los datos JSON provistos y explica su significado."

    system_prompt = _EXPLAIN_SYSTEM_PROMPT_BASE.format(dashboard_description=desc)

    prompt_user = f"""
    Repositorio: {repo_name}
    Tipo de Dashboard: {dashboard_type}
    Datos del Dashboard (JSON):
    {dashboard_data[:3000]}

    INSTRUCCIÓN CRÍTICA: Concéntrate EXCLUSIVAMENTE en el dashboard de tipo '{dashboard_type}' descrito en el mensaje del sistema. Ignora los demás dashboards de la base de datos de ViZzo. No repitas explicaciones ni menciones otros componentes.
    """
    try:
        ai_model = model or AI_MODEL
        local_client = get_openai_client(base_url, api_key)
        print(
            Fore.YELLOW
            + f"[AI] Generando explicación aislada para {dashboard_type} con {ai_model} (URL: {base_url or AI_BASE_URL})..."
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
        print(f"[AI Explanation] Error: {e}. Usando fallback offline.")
        return get_offline_explanation(dashboard_type, repo_name)
