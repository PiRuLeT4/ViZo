"""
analyzer_core.py
────────────────
Lógica pura de análisis de repositorio:
  - Clonado con GitPython
  - Análisis estático con Lizard (métricas por archivo)
  - Análisis de historial con GitPython (churn, autores, commits)
  - Construcción de data_to_display y data_by_language
  - Construcción del repo_summary que se envía a la IA

No contiene lógica de BD, caché ni IA. Solo análisis.
"""

import os
import shutil
import stat

import lizard
from colorama import Fore
from git import GitCommandError, Repo


# ─────────────────────────────────────────────────────────────────────────────
# Helpers internos
# ─────────────────────────────────────────────────────────────────────────────


def _remove_readonly(func, path, excinfo):
    """Callback para shutil.rmtree: elimina el flag de solo lectura antes de borrar (necesario en Windows)."""
    os.chmod(path, stat.S_IWRITE)
    func(path)


def _temp_dir() -> str:
    """Devuelve la ruta absoluta del directorio temporal de análisis."""
    return os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "temp_repo_analysis")
    )


def _cleanup(target_dir: str) -> None:
    """Elimina el directorio temporal si existe."""
    if os.path.exists(target_dir):
        print(Fore.LIGHTBLACK_EX + "Limpiando archivos temporales...")
        try:
            shutil.rmtree(target_dir, onerror=_remove_readonly)
            print(Fore.LIGHTBLACK_EX + "Carpeta temporal eliminada.")
        except Exception as e:
            print(Fore.RED + f"No se pudo eliminar la carpeta temporal: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# Etapas del análisis
# ─────────────────────────────────────────────────────────────────────────────


def _clone_repo(url: str, target_dir: str) -> Repo:
    """Clona el repositorio remoto en target_dir y devuelve el objeto Repo."""
    print(Fore.GREEN + f"Clonando repositorio para análisis: {url}")
    repo = Repo.clone_from(url, target_dir, env={"GIT_TERMINAL_PROMPT": "0"})
    print(Fore.GREEN + "Repositorio clonado correctamente.")
    return repo


def _run_lizard(target_dir: str) -> list:
    """Ejecuta Lizard sobre target_dir y devuelve la lista de resultados por archivo."""
    print(Fore.YELLOW + "Analizando métricas con Lizard...")
    analysis = list(lizard.analyze([target_dir]))
    for file in analysis:
        print(
            Fore.BLUE
            + f"  {os.path.basename(file.filename)} | CCN: {file.average_cyclomatic_complexity:.2f} | NLOC: {file.nloc}"
        )
    return analysis


def _run_git_history(repo: Repo) -> dict:
    """
    Recorre el historial de commits y devuelve:
      - total_commits
      - authors (set)
      - timeline  {fecha: nº commits}
      - file_churn {ruta_relativa: nº commits que la tocaron}
    """
    print(Fore.YELLOW + "Analizando historial de evolución...")
    evolution_data = {
        "total_commits": 0,
        "authors": set(),
        "timeline": {},
        "file_churn": {},
    }

    for commit in repo.iter_commits():
        evolution_data["total_commits"] += 1
        evolution_data["authors"].add(commit.author.name)
        date = commit.authored_datetime.strftime("%Y-%m-%d")
        evolution_data["timeline"][date] = evolution_data["timeline"].get(date, 0) + 1
        for file_path in commit.stats.files:
            evolution_data["file_churn"][file_path] = (
                evolution_data["file_churn"].get(file_path, 0) + 1
            )

    print(Fore.CYAN + f"Total de commits: {evolution_data['total_commits']}")
    print(Fore.CYAN + f"Autores encontrados: {len(evolution_data['authors'])}")
    return evolution_data


def _build_file_metrics(analysis: list, evolution_data: dict, target_dir: str) -> tuple[list, dict, list, int, float]:
    """
    Construye data_to_display (lista por archivo) y las estructuras auxiliares
    necesarias para data_by_language.

    Devuelve:
        data_to_display   : lista de dicts con métricas por archivo
        language_counts   : {lang: nº archivos}
        filenames         : lista de nombres de archivo (para el summary)
        total_nloc        : suma total de NLOC
        total_ccn         : suma total de CCN
    """
    data_to_display = []
    total_nloc = 0
    total_ccn = 0.0
    filenames = []
    language_counts = {}

    for file in analysis:
        rel_path = os.path.relpath(file.filename, target_dir).replace("\\", "/")
        commits_count = evolution_data["file_churn"].get(rel_path, 0)
        total_nloc += file.nloc
        total_ccn += file.average_cyclomatic_complexity
        basename = os.path.basename(file.filename)
        filenames.append(basename)
        _, ext = os.path.splitext(basename)
        lang = ext.lstrip(".").lower() if ext else "unknown"
        language_counts[lang] = language_counts.get(lang, 0) + 1
        data_to_display.append(
            {
                "id": basename,
                "nloc": file.nloc,
                "ccn": file.average_cyclomatic_complexity,
                "commits": commits_count,
                "language": lang,
            }
        )

    return data_to_display, language_counts, filenames, total_nloc, total_ccn


def _build_language_metrics(
    analysis: list,
    evolution_data: dict,
    target_dir: str,
    languages_sorted: list,
) -> list:
    """
    Construye data_by_language (lista agrupada por lenguaje).

    languages_sorted: lista de tuplas (lang, count) ya ordenada por frecuencia desc.
    """
    lang_nloc_map: dict[str, int] = {}
    lang_ccn_map: dict[str, list] = {}
    lang_commits_map: dict[str, int] = {}

    for file in analysis:
        _, ext = os.path.splitext(os.path.basename(file.filename))
        lang = ext.lstrip(".").lower() if ext else "unknown"
        rel_path = os.path.relpath(file.filename, target_dir).replace("\\", "/")
        commits_count = evolution_data["file_churn"].get(rel_path, 0)
        lang_nloc_map[lang] = lang_nloc_map.get(lang, 0) + file.nloc
        lang_ccn_map.setdefault(lang, []).append(file.average_cyclomatic_complexity)
        lang_commits_map[lang] = lang_commits_map.get(lang, 0) + commits_count

    data_by_language = []
    for lang, count in languages_sorted:
        ccn_values = lang_ccn_map.get(lang, [])
        avg_ccn = sum(ccn_values) / len(ccn_values) if ccn_values else 0
        data_by_language.append(
            {
                "id": lang,
                "language": lang,
                "nloc": lang_nloc_map.get(lang, 0),
                "ccn": round(avg_ccn, 2),
                "commits": lang_commits_map.get(lang, 0),
                "count": count,
            }
        )

    print(Fore.CYAN + f"Datos por lenguaje generados: {len(data_by_language)} entradas")
    return data_by_language


def _build_repo_summary(
    analysis: list,
    evolution_data: dict,
    filenames: list,
    languages_sorted: list,
    language_counts: dict,
    total_nloc: float,
    total_ccn: float,
) -> dict:
    """Construye el resumen estadístico del repositorio que se envía a la IA."""
    n = len(analysis)
    return {
        "num_files": n,
        "avg_nloc": total_nloc / n if n else 0,
        "avg_ccn": total_ccn / n if n else 0,
        "total_commits": evolution_data["total_commits"],
        "num_authors": len(evolution_data["authors"]),
        "filenames_sample": filenames[:10],
        "languages": {k: v for k, v in languages_sorted},
        "num_languages": len(language_counts),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Función pública principal
# ─────────────────────────────────────────────────────────────────────────────


def run_analysis(url: str) -> dict | None:
    """
    Clona el repositorio indicado por `url`, ejecuta el análisis completo
    (Lizard + GitPython) y devuelve un dict con:
        - metrics           : lista raw de Lizard (compatibilidad legacy)
        - evolution_data    : historial de commits
        - data_to_display   : lista de métricas por archivo (para BabiaXR)
        - data_by_language  : lista de métricas por lenguaje (para BabiaXR)
        - repo_summary      : resumen estadístico (para la IA)
        - repo_name         : nombre del repositorio
        - last_commit_id    : hash del commit HEAD del clon
        - main_language     : lenguaje mayoritario

    Devuelve None si ocurre un error irrecuperable.
    """
    target_dir = _temp_dir()
    repo = None

    # Limpieza previa por si quedó basura de un análisis anterior
    if os.path.exists(target_dir):
        shutil.rmtree(target_dir, onerror=_remove_readonly)

    try:
        repo = _clone_repo(url, target_dir)
        last_commit_id = repo.head.commit.hexsha
        repo_name = url.rstrip("/").split("/")[-1].removesuffix(".git")

        analysis = _run_lizard(target_dir)
        evolution_data = _run_git_history(repo)

        data_to_display, language_counts, filenames, total_nloc, total_ccn = (
            _build_file_metrics(analysis, evolution_data, target_dir)
        )

        languages_sorted = sorted(
            language_counts.items(), key=lambda x: x[1], reverse=True
        )
        main_language = languages_sorted[0][0] if languages_sorted else ""
        print(Fore.CYAN + f"Lenguajes detectados: { {k: v for k, v in languages_sorted} }")

        data_by_language = _build_language_metrics(
            analysis, evolution_data, target_dir, languages_sorted
        )

        repo_summary = _build_repo_summary(
            analysis,
            evolution_data,
            filenames,
            languages_sorted,
            language_counts,
            total_nloc,
            total_ccn,
        )

        # Lista raw de Lizard (compatibilidad con posibles consumidores futuros)
        metrics_list = [
            {
                "filename": os.path.basename(f.filename),
                "ccn": f.average_cyclomatic_complexity,
                "nloc": f.nloc,
                "functions": f.function_list,
            }
            for f in analysis
        ]

        return {
            "metrics": metrics_list,
            "evolution_data": evolution_data,
            "data_to_display": data_to_display,
            "data_by_language": data_by_language,
            "repo_summary": repo_summary,
            "repo_name": repo_name,
            "last_commit_id": last_commit_id,
            "main_language": main_language,
        }

    except GitCommandError as e:
        print(Fore.RED + f"Error de Git: {e}")
        return None
    except Exception as e:
        print(Fore.RED + f"Error general en el análisis: {e}")
        return None
    finally:
        if repo:
            repo.close()
            del repo
        _cleanup(target_dir)
