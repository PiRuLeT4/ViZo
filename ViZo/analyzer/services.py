import json
import os
import shutil
import stat

import lizard
from colorama import Fore, init
from git import GitCommandError, Repo

from .ai_engine import get_city_config

init(autoreset=True)


def remove_readonly(func, path, excinfo):
    """Callback para shutil.rmtree que elimina el flag solo-lectura antes de borrar (necesario en Windows)."""
    os.chmod(path, stat.S_IWRITE)
    func(path)


def analyze_repository(url):
    """
    Clona el repo una sola vez, extrae métricas con Lizard y
    cuenta commits con GitPython, luego limpia todo.
    """
    target_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "temp_repo_analysis")
    )
    repo = None

    # 1. Limpieza inicial
    if os.path.exists(target_dir):
        shutil.rmtree(target_dir, onerror=remove_readonly)

    try:
        # 2. Clonar el repositorio (No bare, para que Lizard pueda leer los archivos)
        print(Fore.GREEN + f"Clonando repositorio para análisis: {url}")
        repo = Repo.clone_from(
            url,
            target_dir,
            env={"GIT_TERMINAL_PROMPT": "0"},
        )
        print(Fore.GREEN + "Repositorio clonado correctamente.")

        # region LIZARD
        # 3. Analizar con Lizard
        print(Fore.YELLOW + "Analizando métricas con Lizard...")
        analysis = list(lizard.analyze([target_dir]))
        metrics_list = []

        for file in analysis:
            entry = {
                "filename": os.path.basename(file.filename),
                "ccn": file.average_cyclomatic_complexity,
                "nloc": file.nloc,
                "functions": file.function_list,
            }
            metrics_list.append(entry)
            print(
                Fore.BLUE
                + f"  {entry['filename']} | CCN: {entry['ccn']:.2f} | NLOC: {entry['nloc']}"
            )
        # endregion

        # region GITPYTHON
        # 4. Análisis de evolución con GitPython
        print(Fore.YELLOW + "Analizando historial de evolución...")

        evolution_data = {
            "total_commits": 0,
            "authors": set(),
            "timeline": {},
            "file_churn": {},
        }

        for commit in repo.iter_commits():
            # Total commits
            evolution_data["total_commits"] += 1

            # Autores
            evolution_data["authors"].add(commit.author.name)

            # Timeline
            date = commit.authored_datetime.strftime("%Y-%m-%d")
            evolution_data["timeline"][date] = (
                evolution_data["timeline"].get(date, 0) + 1
            )

            # Churn de código
            for file_path in commit.stats.files:
                evolution_data["file_churn"][file_path] = (
                    evolution_data["file_churn"].get(file_path, 0) + 1
                )

        print(Fore.CYAN + f"Total de commits: {evolution_data['total_commits']}")
        print(Fore.CYAN + f"Autores encontrados: {len(evolution_data['authors'])}")
        print(Fore.CYAN + f"Días con actividad: {len(evolution_data['timeline'])}")
        # endregion

        # 5. Preparar data_to_display para la visualización
        data_to_display = []
        total_nloc = 0
        total_ccn = 0
        filenames = []

        for file in analysis:
            # Obtener el path relativo para buscar en file_churn (normalizado a '/')
            rel_path = os.path.relpath(file.filename, target_dir).replace("\\", "/")
            commits_count = evolution_data["file_churn"].get(rel_path, 0)

            total_nloc += file.nloc
            total_ccn += file.average_cyclomatic_complexity
            filenames.append(os.path.basename(file.filename))

            data_to_display.append(
                {
                    "id": os.path.basename(file.filename),
                    "nloc": file.nloc,
                    "ccn": file.average_cyclomatic_complexity,
                    "commits": commits_count,
                }
            )
        # region LM STUDIO
        # 6. Generar resumen para la IA
        repo_summary = {
            "num_files": len(analysis),
            "avg_nloc": total_nloc / len(analysis) if analysis else 0,
            "avg_ccn": total_ccn / len(analysis) if analysis else 0,
            "total_commits": evolution_data["total_commits"],
            "filenames_sample": filenames[:10],  # Solo una muestra
        }

        print(Fore.MAGENTA + "Enviando resumen a la IA (LM Studio)...")
        ai_config_raw = get_city_config(json.dumps(repo_summary))

        try:
            # Intentar parsear el JSON de la IA
            ai_config = json.loads(ai_config_raw)
            print(Fore.GREEN + f"Configuración de IA recibida: {ai_config}")
        except Exception:
            # Si falla, usar una por defecto
            print(
                Fore.RED
                + "Error parseando JSON de IA, usando configuración por defecto."
            )
            ai_config = {
                "fheight": "nloc",
                "farea": "ccn",
                "building_color": "#00fbff",
                "base_color": "#1a1a1a",
                "extra": 1.5,
            }

        return {
            "metrics": metrics_list,
            "evolution_data": evolution_data,
            "data_to_display": data_to_display,
            "ai_config": ai_config,
        }

    except GitCommandError as e:
        print(Fore.RED + f"Error de Git: {e}")
        return None
    except Exception as e:
        print(Fore.RED + f"Error general en el análisis: {e}")
        return None

    finally:
        # 7. Cierre y Limpieza
        if repo:
            # IMPORTANTE en Windows: cerrar el repo antes de borrar la carpeta
            repo.close()
            del repo

        if os.path.exists(target_dir):
            print(Fore.LIGHTBLACK_EX + "Limpiando archivos temporales...")
            try:
                shutil.rmtree(target_dir, onerror=remove_readonly)
                print(Fore.LIGHTBLACK_EX + "Carpeta temporal eliminada.")
            except Exception as e:
                print(Fore.RED + f"No se pudo eliminar la carpeta temporal: {e}")
