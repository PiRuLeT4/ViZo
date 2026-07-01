# evolution_analysis.py
# ──────────────────────
# Lógica dedicada a recorrer el historial de commits y versiones de Git/PyDriller.

import os
import traceback
import subprocess
from datetime import datetime
from colorama import Fore
from pydriller import Repository as DrillRepo

from .helpers import (
    _get_total_commits,
    _clean_git_path,
    _parse_git_date,
    _get_diff_stats,
    _get_clean_git_env,
)


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


def _run_releases_history(target_dir: str, tags: list) -> dict:
    """Recorre el historial de versiones por tags, simulando la evolución del repositorio."""
    total_commits = _get_total_commits(target_dir)
    evolution_data = {
        "total_commits": total_commits,
        "num_releases": len(tags),
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
    
    tags_chrono = list(reversed(tags))
    file_author_commits = {}
    file_last_modified = {}
    activity_dict = {}
    
    for idx, tag in enumerate(tags_chrono):
        tag_name = tag["name"]
        tag_hash = tag["hash"]
        tag_date_obj = tag["date_obj"]
        date_str = tag_date_obj.strftime("%Y-%m-%d")
        
        if idx > 0:
            tag_prev = tags_chrono[idx-1]["name"]
        else:
            check_parent = subprocess.run(
                ["git", "rev-parse", f"{tag_name}~1"],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                cwd=target_dir,
                env=_get_clean_git_env()
            )
            if check_parent.returncode == 0:
                tag_prev = f"{tag_name}~1"
            else:
                tag_prev = "4b825dc642cb6eb9a0accbf124f547182729c224"
        
        insertions, deletions = _get_diff_stats(target_dir, tag_prev, tag_name)
        
        log_res = subprocess.run(
            ["git", "log", f"{tag_prev}..{tag_name}", "--numstat", "--pretty=format:AUTHOR:%an|%cI"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            cwd=target_dir,
            env=_get_clean_git_env()
        )
        
        current_author = "Unknown"
        release_commits_count = 0
        
        if log_res.returncode == 0 and log_res.stdout and log_res.stdout.strip():
            lines = log_res.stdout.strip().splitlines()
            for line in lines:
                if not line:
                    continue
                if line.startswith("AUTHOR:"):
                    author_part = line.removeprefix("AUTHOR:")
                    parts = author_part.split("|")
                    current_author = parts[0] if parts else "Unknown"
                    evolution_data["authors"].add(current_author)
                    release_commits_count += 1
                    
                    key = (current_author, date_str)
                    if key not in activity_dict:
                        activity_dict[key] = {
                            "author": current_author,
                            "date": date_str,
                            "commits": 0,
                            "insertions": 0,
                        }
                    activity_dict[key]["commits"] += 1
                else:
                    parts = line.split(maxsplit=2)
                    if len(parts) >= 3:
                        try:
                            added = int(parts[0]) if parts[0] != "-" else 0
                            deleted = int(parts[1]) if parts[1] != "-" else 0
                        except ValueError:
                            added, deleted = 0, 0
                        
                        path = parts[2]
                        rel_path = _clean_git_path(path).replace("\\", "/")
                        
                        evolution_data["file_churn"][rel_path] = evolution_data["file_churn"].get(rel_path, 0) + 1
                        evolution_data["file_lines_added"][rel_path] = evolution_data["file_lines_added"].get(rel_path, 0) + added
                        evolution_data["file_lines_deleted"][rel_path] = evolution_data["file_lines_deleted"].get(rel_path, 0) + deleted
                        
                        if rel_path not in file_author_commits:
                            file_author_commits[rel_path] = {}
                        file_author_commits[rel_path][current_author] = file_author_commits[rel_path].get(current_author, 0) + 1
                        file_last_modified[rel_path] = tag_date_obj
        
        evolution_data["commits"].append({
            "hash": tag_hash,
            "author": "Release",
            "date": date_str,
            "message": f"Release {tag_name} ({release_commits_count} commits)",
            "insertions": insertions,
            "deletions": deletions,
        })
        evolution_data["timeline"][date_str] = evolution_data["timeline"].get(date_str, 0) + 1

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
    
    return evolution_data
