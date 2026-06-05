"""
engine.py
─────────
Lógica pura de análisis de repositorio:
  - Clonado con git (subprocess nativo)
  - Análisis estático con Lizard (métricas por archivo)
  - Análisis de historial con PyDriller (churn, autores, commits, líneas añadidas/eliminadas)
  - Construcción de file_metrics y data_by_language
  - Construcción del repo_summary que se envía a la IA

No contiene lógica de BD, caché ni IA. Solo análisis.
"""
import gc
import os
import shutil
import stat
import subprocess
import time
import traceback
from datetime import datetime

import lizard
from colorama import Fore
from pydriller import Repository as DrillRepo

# ─────────────────────────────────────────────────────────────────────────────
# Helpers internos
# ─────────────────────────────────────────────────────────────────────────────


def _remove_readonly(func, path, excinfo):
    """Callback para shutil.rmtree: elimina el flag de solo lectura antes de borrar (necesario en Windows)."""
    os.chmod(path, stat.S_IWRITE)
    func(path)


def _temp_dir(session_id: int = None) -> str:
    """Devuelve la ruta absoluta del directorio temporal, aislado por sesión si se provee."""
    suffix = f"_{session_id}" if session_id else ""
    return os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", f"temp_repo_analysis{suffix}")
    )


def _cleanup(target_dir: str) -> None:
    """Elimina el directorio temporal si existe."""
    if os.path.exists(target_dir):
        print(Fore.LIGHTBLACK_EX + "Limpiando archivos temporales...")
        # Forzar recolección de basura para cerrar descriptores de archivos de GitPython/PyDriller
        gc.collect()
        try:
            shutil.rmtree(target_dir, onerror=_remove_readonly)
            print(Fore.LIGHTBLACK_EX + "Carpeta temporal eliminada.")
        except Exception:
            # Reintentar tras una pausa para que el sistema operativo libere bloqueos de archivos
            gc.collect()
            time.sleep(0.5)
            try:
                shutil.rmtree(target_dir, onerror=_remove_readonly)
                print(Fore.LIGHTBLACK_EX + "Carpeta temporal eliminada tras reintento.")
            except Exception as re_err:
                print(Fore.RED + f"No se pudo eliminar la carpeta temporal: {re_err}")


# ─────────────────────────────────────────────────────────────────────────────
# Etapas del análisis
# ─────────────────────────────────────────────────────────────────────────────


def _get_clean_git_env() -> dict:
    """
    Retorna un diccionario de variables de entorno limpio, de forma que se
    desactiven AskPass de VS Code y otros prompts interactivos de Git.
    """
    env = os.environ.copy()
    # Eliminar cualquier variable de AskPass para evitar que VS Code o Git abran popups
    for key in list(env.keys()):
        if "ASKPASS" in key or key.startswith("VSCODE_GIT"):
            env.pop(key)
    # Forzar no interactivo
    env["GIT_TERMINAL_PROMPT"] = "0"
    env["GIT_ASKPASS"] = "true"  # Evita prompts interactivos
    return env


def _clone_repo(url: str, target_dir: str) -> str:
    """
    Clona el repositorio remoto en target_dir mediante git clone (subprocess).
    Funciona con GitHub, GitLab, Bitbucket, Gitea, Forgejo, Codeberg, etc.
    Devuelve target_dir si el clon fue exitoso; lanza RuntimeError si falla.
    """
    print(Fore.GREEN + f"Clonando repositorio para análisis: {url}")
    result = subprocess.run(
        ["git", "clone", url, target_dir],
        capture_output=True,
        text=True,
        env=_get_clean_git_env(),
    )
    if result.returncode != 0:
        raise RuntimeError(f"git clone falló:\n{result.stderr.strip()}")
    print(Fore.GREEN + "Repositorio clonado correctamente.")
    return target_dir


def _get_head_commit(target_dir: str) -> str:
    """Obtiene el hash SHA del commit HEAD del clon local via git rev-parse."""
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        capture_output=True,
        text=True,
        cwd=target_dir,
        env=_get_clean_git_env(),
    )
    if result.returncode != 0:
        raise RuntimeError(f"No se pudo obtener HEAD: {result.stderr.strip()}")
    return result.stdout.strip()


def _get_total_commits(target_dir: str) -> int:
    """Obtiene el número total de commits en el repositorio de forma rápida via git rev-list."""
    result = subprocess.run(
        ["git", "rev-list", "--count", "HEAD"],
        capture_output=True,
        text=True,
        cwd=target_dir,
        env=_get_clean_git_env(),
    )
    if result.returncode != 0:
        return 0
    try:
        return int(result.stdout.strip())
    except ValueError:
        return 0


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


def _run_git_history(target_dir: str, max_commits: int = 150) -> dict:
    """
    Recorre el historial de commits con PyDriller de forma inversa y devuelve métricas de evolución.
    Limita la búsqueda a max_commits (si es > 0) para rendimiento óptimo.
    """
    limit_str = f"máx. {max_commits}" if max_commits > 0 else "completo"
    print(
        Fore.YELLOW
        + f"Analizando historial de evolución con PyDriller ({limit_str} commits)..."
    )

    evolution_data = {
        "total_commits": 0,
        "authors": set(),
        "timeline": {},
        "file_churn": {},
        "file_lines_added": {},
        "file_lines_deleted": {},
        "commits": [],
        "author_activity": [],
        "file_author_commits": {},
        "file_last_modified": {},
    }

    try:
        # Obtenemos el número total real de commits instantáneamente
        total_commits = _get_total_commits(target_dir)
        evolution_data["total_commits"] = total_commits

        recent_commits_info = []
        file_author_commits = {}
        file_last_modified = {}

        # Recorremos en orden inverso (los más nuevos primero) y limitamos a max_commits
        generator = DrillRepo(target_dir, order="reverse").traverse_commits()
        try:
            for commit in generator:
                if max_commits > 0 and len(recent_commits_info) >= max_commits:
                    break

                author_name = commit.author.name if commit.author else "Unknown"
                date_str = commit.author_date.strftime("%Y-%m-%d")

                # Extraemos lo que necesitamos mientras el objeto commit es válido
                info = {
                    "hash": commit.hash,
                    "author": author_name,
                    "date": date_str,
                    "message": commit.msg,
                    "insertions": commit.insertions,
                    "deletions": commit.deletions,
                    "modified_files": [],
                }

                for mf in commit.modified_files:
                    path = mf.new_path or mf.old_path
                    if path:
                        rel_path = path.replace("\\", "/")
                        if rel_path not in file_last_modified:
                            file_last_modified[rel_path] = commit.author_date
                        if rel_path not in file_author_commits:
                            file_author_commits[rel_path] = {}
                        file_author_commits[rel_path][author_name] = file_author_commits[rel_path].get(author_name, 0) + 1

                    info["modified_files"].append(
                        {
                            "path": path,
                            "added": mf.added_lines or 0,
                            "deleted": mf.deleted_lines or 0,
                        }
                    )

                recent_commits_info.append(info)
        finally:
            generator.close()

        # Invertimos la lista para restaurar el orden cronológico
        recent_commits_info.reverse()

        activity_dict = {}

        # Procesamos solo los finalistas
        for info in recent_commits_info:
            evolution_data["authors"].add(info["author"])
            evolution_data["timeline"][info["date"]] = (
                evolution_data["timeline"].get(info["date"], 0) + 1
            )

            # Formato esperado por el resto del sistema
            evolution_data["commits"].append(
                {
                    "hash": info["hash"],
                    "author": info["author"],
                    "date": info["date"],
                    "message": info["message"],
                    "insertions": info["insertions"],
                    "deletions": info["deletions"],
                }
            )

            # Agrupar para author_activity
            author = info["author"]
            date = info["date"]
            insertions = info["insertions"]
            key = (author, date)
            if key not in activity_dict:
                activity_dict[key] = {
                    "author": author,
                    "date": date,
                    "commits": 0,
                    "insertions": 0,
                }
            activity_dict[key]["commits"] += 1
            activity_dict[key]["insertions"] += insertions

            for mf in info["modified_files"]:
                if not mf["path"]:
                    continue
                file_path = mf["path"].replace("\\", "/")

                evolution_data["file_churn"][file_path] = (
                    evolution_data["file_churn"].get(file_path, 0) + 1
                )
                evolution_data["file_lines_added"][file_path] = (
                    evolution_data["file_lines_added"].get(file_path, 0) + mf["added"]
                )
                evolution_data["file_lines_deleted"][file_path] = (
                    evolution_data["file_lines_deleted"].get(file_path, 0)
                    + mf["deleted"]
                )

        # Filtrar las 15 fechas más recientes para evitar que el barsmap sea inmanejable
        author_activity = list(activity_dict.values())
        all_dates = sorted(
            list(set(item["date"] for item in author_activity if item["date"])),
            reverse=True,
        )
        recent_dates = set(all_dates[:15])
        evolution_data["author_activity"] = [
            item for item in author_activity if item["date"] in recent_dates
        ]
        evolution_data["file_author_commits"] = file_author_commits
        evolution_data["file_last_modified"] = file_last_modified

    except Exception as e:
        print(Fore.RED + f"Error procesando historial Git: {e}")
        traceback.print_exc()

    num_processed = len(evolution_data["commits"])
    print(Fore.CYAN + f"Total de commits procesados: {evolution_data['total_commits']} ({num_processed} analizados)")
    return evolution_data


def _process_metrics(
    analysis: list, evolution_data: dict, target_dir: str
) -> tuple[list, list, list, int, float, dict, list, list, list]:
    """
    Procesa los resultados de Lizard y PyDriller en una sola pasada.
    Construye métricas por archivo, agrupaciones por lenguaje, totales y datasets avanzados.

    Devuelve:
        file_metrics      : lista de dicts con métricas por archivo
        data_by_language  : lista de dicts agrupada por lenguaje (ordenada por frecuencia)
        filenames         : lista de nombres de archivo
        total_nloc        : suma total de NLOC
        total_ccn         : suma total de CCN
        language_counts   : dict {lang: count} para el resumen
        file_ownership    : lista de dicts con propiedad de autores para Barsmap
        age_distribution  : lista de dicts con agregaciones de Legacy Code
        top_complex_files : lista de dicts con el Top 10 de complejidad Peak CCN
    """
    file_metrics = []
    lang_data = {}  # {lang: {nloc, ccn_list, commits, count, added, deleted}}
    total_nloc = 0
    total_ccn = 0.0
    filenames = []
    file_ownership = []

    # Age distribution counters
    active_count = 0
    active_nloc = 0
    maintained_count = 0
    maintained_nloc = 0
    legacy_count = 0
    legacy_nloc = 0

    for file in analysis:
        rel_path = os.path.relpath(file.filename, target_dir).replace("\\", "/")
        basename = os.path.basename(file.filename)
        filenames.append(basename)

        # Churn/History data
        commits_count = evolution_data["file_churn"].get(rel_path, 0)
        lines_added = evolution_data["file_lines_added"].get(rel_path, 0)
        lines_deleted = evolution_data["file_lines_deleted"].get(rel_path, 0)

        # Totals
        total_nloc += file.nloc
        total_ccn += file.average_cyclomatic_complexity

        # Language
        _, ext = os.path.splitext(basename)
        lang = ext.lstrip(".").lower() if ext else "unknown"

        # Folder hierarchy
        parts = rel_path.split("/")
        folder = parts[0] if len(parts) > 1 else "root"

        # Lizard metrics
        num_functions = len(file.function_list)
        peak_ccn = float(max([func.cyclomatic_complexity for func in file.function_list])) if file.function_list else 0.0

        # PyDriller age calculation
        last_mod_dt = evolution_data["file_last_modified"].get(rel_path)
        if last_mod_dt:
            if last_mod_dt.tzinfo:
                now = datetime.now(last_mod_dt.tzinfo)
            else:
                now = datetime.now()
            age_days = (now - last_mod_dt).days
            if age_days < 0:
                age_days = 0
        else:
            age_days = 365  # Fallback for files not modified in the last 150 commits

        # Categorize age
        if age_days < 30:
            active_count += 1
            active_nloc += file.nloc
        elif age_days <= 180:
            maintained_count += 1
            maintained_nloc += file.nloc
        else:
            legacy_count += 1
            legacy_nloc += file.nloc

        # PyDriller ownership & Bus Factor
        author_counts = evolution_data["file_author_commits"].get(rel_path, {})
        total_file_commits = sum(author_counts.values())
        if total_file_commits > 0:
            dominant_author = max(author_counts, key=author_counts.get)
            dominant_commits = author_counts[dominant_author]
            ownership = (dominant_commits / total_file_commits) * 100.0
            owner_name = dominant_author

            # Records for all authors who touched this file
            for auth, auth_commits in author_counts.items():
                pct = (auth_commits / total_file_commits) * 100.0
                file_ownership.append({
                    "author": auth,
                    "file": basename,
                    "ownership": round(pct, 2)
                })
        else:
            ownership = 0.0
            owner_name = "N/A"

        # 1. Entry for file_metrics
        file_metrics.append(
            {
                "id": rel_path,
                "name": basename,
                "nloc": file.nloc,
                "ccn": file.average_cyclomatic_complexity,
                "commits": commits_count,
                "language": lang,
                "folder": folder,
                "num_functions": num_functions,
                "peak_ccn": peak_ccn,
                "ownership": round(ownership, 2),
                "owner_name": owner_name,
                "age_days": age_days,
            }
        )

        # 2. Aggregating for language_metrics
        if lang not in lang_data:
            lang_data[lang] = {
                "nloc": 0,
                "ccn_list": [],
                "commits": 0,
                "count": 0,
                "added": 0,
                "deleted": 0,
            }

        ld = lang_data[lang]
        ld["nloc"] += file.nloc
        ld["ccn_list"].append(file.average_cyclomatic_complexity)
        ld["commits"] += commits_count
        ld["count"] += 1
        ld["added"] += lines_added
        ld["deleted"] += lines_deleted

    # Build and sort data_by_language
    data_by_language = []
    for lang, ld in lang_data.items():
        avg_ccn = sum(ld["ccn_list"]) / len(ld["ccn_list"]) if ld["ccn_list"] else 0
        data_by_language.append(
            {
                "id": lang,
                "language": lang,
                "nloc": ld["nloc"],
                "ccn": round(avg_ccn, 2),
                "commits": ld["commits"],
                "count": ld["count"],
                "lines_added": ld["added"],
                "lines_deleted": ld["deleted"],
            }
        )

    # Ordenar por frecuencia (count) descendente
    data_by_language.sort(key=lambda x: x["count"], reverse=True)
    language_counts = {ld["language"]: ld["count"] for ld in data_by_language}

    # Aggregate age distribution
    age_distribution = [
        {"category": "Active", "nloc": active_nloc, "count": active_count},
        {"category": "Maintained", "nloc": maintained_nloc, "count": maintained_count},
        {"category": "Legacy", "nloc": legacy_nloc, "count": legacy_count},
    ]

    # Sort files by peak_ccn descending to get Top 10 complex files
    sorted_by_peak = sorted(file_metrics, key=lambda x: x["peak_ccn"], reverse=True)
    top_complex_files = [
        {
            "name": f["name"],
            "peak_ccn": f["peak_ccn"],
            "avg_ccn": round(f["ccn"], 2)
        }
        for f in sorted_by_peak[:10]
    ]

    print(
        Fore.CYAN
        + f"Datos procesados: {len(file_metrics)} archivos, {len(data_by_language)} lenguajes."
    )
    return (
        file_metrics,
        data_by_language,
        filenames,
        total_nloc,
        total_ccn,
        language_counts,
        file_ownership,
        age_distribution,
        top_complex_files,
    )


def _build_repo_summary(
    analysis: list,
    evolution_data: dict,
    filenames: list,
    language_counts: dict,
    total_nloc: float,
    total_ccn: float,
) -> dict:
    """Construye el resumen estadístico del repositorio que se envía a la IA."""
    n = len(analysis)

    # Calculamos sumas de líneas desde evolution_data si están disponibles
    # (PyDriller las acumula por commit)
    return {
        "num_files": n,
        "avg_nloc": total_nloc / n if n else 0,
        "avg_ccn": total_ccn / n if n else 0,
        "total_commits": evolution_data["total_commits"],
        "num_authors": len(evolution_data["authors"]),
        "filenames_sample": filenames[:10],
        "languages": language_counts,
        "num_languages": len(language_counts),
        "total_lines_added": sum(c["insertions"] for c in evolution_data["commits"]),
        "total_lines_deleted": sum(c["deletions"] for c in evolution_data["commits"]),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Función pública principal
# ─────────────────────────────────────────────────────────────────────────────


def run_analysis(url: str, max_commits: int = 150, session_id: int = None) -> dict | None:
    """
    Clona el repositorio indicado por `url`, ejecuta el análisis completo
    (Lizard + PyDriller) y devuelve un dict con los resultados.
    """
    target_dir = _temp_dir(session_id)

    # Limpieza previa
    if os.path.exists(target_dir):
        shutil.rmtree(target_dir, onerror=_remove_readonly)

    try:
        _clone_repo(url, target_dir)
        last_commit_id = _get_head_commit(target_dir)
        repo_name = url.rstrip("/").split("/")[-1].removesuffix(".git")

        analysis = _run_lizard(target_dir)
        evolution_raw = _run_git_history(target_dir, max_commits=max_commits)

        # PASADA ÚNICA: Procesar métricas y lenguajes
        (
            file_metrics,
            data_by_language,
            filenames,
            total_nloc,
            total_ccn,
            language_counts,
            file_ownership,
            age_distribution,
            top_complex_files,
        ) = _process_metrics(analysis, evolution_raw, target_dir)

        main_language = next(iter(language_counts), "unknown")
        print(Fore.CYAN + f"Lenguaje principal: {main_language}")

        repo_summary = _build_repo_summary(
            analysis,
            evolution_raw,
            filenames,
            language_counts,
            total_nloc,
            total_ccn,
        )

        # Lista raw de Lizard (compatibilidad legacy)
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
            "evolution_data": evolution_raw["commits"],
            "author_activity": evolution_raw["author_activity"],
            "file_metrics": file_metrics,
            "data_by_language": data_by_language,
            "repo_summary": repo_summary,
            "repo_name": repo_name,
            "last_commit_id": last_commit_id,
            "main_language": main_language,
            "file_ownership": file_ownership,
            "age_distribution": age_distribution,
            "top_complex_files": top_complex_files,
        }

    except RuntimeError as e:
        print(Fore.RED + f"Error de clonado/Git: {e}")
        return None
    except Exception as e:
        print(Fore.RED + f"Error general en el análisis: {e}")
        traceback.print_exc()
        return None
    finally:
        _cleanup(target_dir)
