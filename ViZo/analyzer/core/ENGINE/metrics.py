import os
from dataclasses import dataclass
from datetime import datetime
from colorama import Fore


@dataclass
class MetricsResult:
    """Estructura de datos tipada con los resultados del análisis de métricas locales."""
    file_metrics: list
    data_by_language: list
    filenames: list
    total_nloc: int
    total_ccn: float
    language_counts: dict
    file_ownership: list
    age_distribution: list
    top_complex_files: list
    file_network: list
    top_churn_files: list


def _process_metrics(
    analysis: list, evolution_data: dict, target_dir: str
) -> MetricsResult:
    """
    Procesa los resultados de Lizard y PyDriller en una sola pasada.
    Construye métricas por archivo, agrupaciones por lenguaje, totales y datasets avanzados.
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
        peak_ccn = (
            float(max([func.cyclomatic_complexity for func in file.function_list]))
            if file.function_list
            else 0.0
        )

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
                file_ownership.append(
                    {"author": auth, "file": basename, "ownership": round(pct, 2)}
                )
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
        {"name": f["name"], "peak_ccn": f["peak_ccn"], "avg_ccn": round(f["ccn"], 2)}
        for f in sorted_by_peak[:10]
    ]

    # Sort files by commits descending to get Top 10 files with highest churn
    sorted_by_churn = sorted(
        file_metrics, key=lambda x: x.get("commits", 0), reverse=True
    )
    top_churn_files = [
        {"name": f["name"], "commits": f["commits"], "nloc": f["nloc"]}
        for f in sorted_by_churn[:10]
    ]

    # -------------------------------------------------------------------------
    # Cálculo de la Red de Colaboración de Desarrolladores (babia-network)
    # -------------------------------------------------------------------------
    author_commits = {}
    # 1. Contar commits únicos reales por autor en la ventana analizada
    for commit in evolution_data.get("commits", []):
        author = commit.get("author", "Unknown")
        if author != "Release":
            author_commits[author] = author_commits.get(author, 0) + 1

    # Fallback si evolution_data["commits"] no estuviera disponible
    if not author_commits:
        for rel_path, authors_dict in evolution_data.get(
            "file_author_commits", {}
        ).items():
            for author, count in authors_dict.items():
                if author != "Release":
                    author_commits[author] = author_commits.get(author, 0) + count

    # 2. Obtener los 10 autores principales por número de commits para evitar sobrecargar la red
    top_authors = sorted(author_commits.items(), key=lambda x: x[1], reverse=True)[:10]
    top_authors_set = {auth for auth, _ in top_authors}

    file_network = []
    # Generar red basada en autor y archivo (linkId)
    # Por cada autor de cada archivo que tiene commits
    for rel_path, authors_dict in evolution_data.get("file_author_commits", {}).items():
        for author in authors_dict.keys():
            if author not in top_authors_set:
                continue

            raw_size = author_commits.get(author, 1)

            file_network.append(
                {
                    "author": author,
                    "file": rel_path,
                    "size": raw_size,
                    "commits": raw_size,
                }
            )

    print(Fore.CYAN + "ViZzo // Red de Colaboración:")
    print(
        Fore.CYAN
        + f"  - Autores principales seleccionados (Top 10): {list(top_authors_set)}"
    )
    print(
        Fore.CYAN + f"  - Relaciones totales generadas en la red: {len(file_network)}"
    )
    if file_network:
        print(Fore.YELLOW + "  - Muestra de los primeros 10 elementos de la red:")
        for idx, item in enumerate(file_network[:10]):
            print(
                Fore.YELLOW
                + f"    [{idx}] Autor: {item['author']} | Archivo: {item['file']} | Tamaño Normalizado: {item['size']}"
            )

    print(
        Fore.CYAN
        + f"Datos procesados: {len(file_metrics)} archivos, {len(data_by_language)} lenguajes."
    )
    return MetricsResult(
        file_metrics=file_metrics,
        data_by_language=data_by_language,
        filenames=filenames,
        total_nloc=total_nloc,
        total_ccn=total_ccn,
        language_counts=language_counts,
        file_ownership=file_ownership,
        age_distribution=age_distribution,
        top_complex_files=top_complex_files,
        file_network=file_network,
        top_churn_files=top_churn_files,
    )


def _build_repo_summary(
    analysis: list,
    evolution_data: dict,
    filenames: list,
    language_counts: dict,
    total_nloc: float,
    total_ccn: float,
    analysis_mode: str = "commits",
) -> dict:
    """Construye el resumen estadístico del repositorio que se envía a la IA."""
    n = len(analysis)

    # Calculamos sumas de líneas desde evolution_data si están disponibles
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
        "analysis_mode": analysis_mode,
        "num_releases": evolution_data.get("num_releases", 0)
        if analysis_mode == "releases"
        else 0,
    }
