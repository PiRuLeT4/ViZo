import json
import os
import shutil
import stat

import lizard
from colorama import Fore, init
from git import GitCommandError, Repo

from .ai_engine import get_ai_config
from .models import AnalysisSession, FileMetric, LanguageMetric, Repository

init(autoreset=True)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def remove_readonly(func, path, excinfo):
    """Callback para shutil.rmtree que elimina el flag solo-lectura antes de borrar (necesario en Windows)."""
    os.chmod(path, stat.S_IWRITE)
    func(path)


def _build_result_from_session(session):
    """Reconstruye el dict de resultado a partir de una AnalysisSession ya guardada en BD."""
    data_to_display = [fm.to_dict() for fm in session.file_metrics.all()]
    data_by_language = [lm.to_dict() for lm in session.language_metrics.all()]
    print(Fore.CYAN + f"[Cache] Datos cargados desde BD (session id={session.pk}, commit={session.last_commit_id[:8]})")
    return {
        "metrics": data_to_display,           # compatible con lo que espera la view
        "evolution_data": {},                  # no se necesita en frontend
        "data_to_display": data_to_display,
        "data_by_language": data_by_language,
        "ai_config": session.ai_config,
        "from_cache": True,
    }


def _save_session(repo_obj, last_commit_id, data_to_display, data_by_language, ai_config, repo_summary):
    """Persiste una nueva AnalysisSession con todas sus métricas en la BD."""
    session = AnalysisSession.objects.create(
        repo=repo_obj,
        last_commit_id=last_commit_id,
        ai_config=ai_config,
        repo_summary=repo_summary,
    )

    # Métricas por archivo
    file_metrics = [
        FileMetric(
            session=session,
            file_name=entry["id"],
            language=entry.get("language", ""),
            nloc=entry.get("nloc", 0),
            ccn=entry.get("ccn", 0.0),
            commits=entry.get("commits", 0),
        )
        for entry in data_to_display
    ]
    FileMetric.objects.bulk_create(file_metrics)

    # Métricas por lenguaje
    lang_metrics = [
        LanguageMetric(
            session=session,
            language=entry["language"],
            nloc=entry.get("nloc", 0),
            ccn=entry.get("ccn", 0.0),
            commits=entry.get("commits", 0),
            count=entry.get("count", 0),
        )
        for entry in data_by_language
    ]
    LanguageMetric.objects.bulk_create(lang_metrics)

    print(Fore.GREEN + f"[DB] Sesión guardada (id={session.pk}) con {len(file_metrics)} archivos y {len(lang_metrics)} lenguajes.")
    return session


# ─────────────────────────────────────────────────────────────────────────────
# Función principal
# ─────────────────────────────────────────────────────────────────────────────

def analyze_repository(url):
    """
    1. Comprueba si el repo ya está en BD y si el HEAD commit coincide.
       → Si SÍ: devuelve los datos cacheados (sin clonar ni analizar).
       → Si NO: clona, analiza, guarda en BD y devuelve los datos frescos.
    """

    # ── PASO 0: Check rápido del último commit sin clonar (solo el HEAD ref) ──
    # Intentamos obtener el hash del HEAD remoto de forma ligera.
    latest_commit_id = _get_remote_head(url)

    if latest_commit_id:
        # ¿Tenemos este repo en BD?
        try:
            repo_obj = Repository.objects.get(url=url)
            # ¿La sesión más reciente ya corresponde a este commit?
            latest_session = repo_obj.sessions.first()  # ordering=[-analysis_date]
            if latest_session and latest_session.last_commit_id == latest_commit_id:
                print(Fore.GREEN + f"[Cache HIT] Repo '{repo_obj.name}' sin cambios. Usando datos de BD.")
                return _build_result_from_session(latest_session)
            else:
                print(Fore.YELLOW + f"[Cache MISS] Repo '{repo_obj.name}' tiene nuevos commits. Re-analizando...")
        except Repository.DoesNotExist:
            print(Fore.YELLOW + f"[Cache MISS] Repo nuevo: {url}. Analizando por primera vez...")
            repo_obj = None
    else:
        print(Fore.YELLOW + "[Git] No se pudo obtener HEAD remoto. Se procederá con análisis completo.")
        repo_obj = None
        latest_commit_id = None

    # ── PASO 1–6: Análisis completo (igual que antes) ──────────────────────
    return _full_analysis(url, repo_obj, latest_commit_id)


def _get_remote_head(url):
    """
    Obtiene el hash del commit HEAD del repo remoto usando ls-remote,
    sin necesidad de clonar. Devuelve None si falla.
    """
    try:
        import subprocess
        result = subprocess.run(
            ["git", "ls-remote", "--quiet", "--exit-code", url, "HEAD"],
            capture_output=True, text=True, timeout=15,
            env={**os.environ, "GIT_TERMINAL_PROMPT": "0"},
        )
        if result.returncode == 0 and result.stdout:
            # Formato: "<hash>\tHEAD"
            return result.stdout.split()[0]
    except Exception as e:
        print(Fore.YELLOW + f"[Git ls-remote] No disponible: {e}")
    return None


def _full_analysis(url, repo_obj, known_commit_id):
    """Clona el repositorio, analiza con Lizard + GitPython, guarda en BD y retorna el resultado."""

    target_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "temp_repo_analysis")
    )
    repo = None

    # 1. Limpieza inicial
    if os.path.exists(target_dir):
        shutil.rmtree(target_dir, onerror=remove_readonly)

    try:
        # 2. Clonar
        print(Fore.GREEN + f"Clonando repositorio para análisis: {url}")
        repo = Repo.clone_from(url, target_dir, env={"GIT_TERMINAL_PROMPT": "0"})
        print(Fore.GREEN + "Repositorio clonado correctamente.")

        # Obtener el commit HEAD real (del clon) si no lo teníamos
        last_commit_id = known_commit_id or repo.head.commit.hexsha

        # Nombre del repo (última parte de la URL sin .git)
        repo_name = url.rstrip("/").split("/")[-1].removesuffix(".git")

        # region LIZARD
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
            print(Fore.BLUE + f"  {entry['filename']} | CCN: {entry['ccn']:.2f} | NLOC: {entry['nloc']}")
        # endregion

        # region GITPYTHON
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
                evolution_data["file_churn"][file_path] = evolution_data["file_churn"].get(file_path, 0) + 1

        print(Fore.CYAN + f"Total de commits: {evolution_data['total_commits']}")
        print(Fore.CYAN + f"Autores encontrados: {len(evolution_data['authors'])}")
        # endregion

        # 5. Preparar data_to_display
        data_to_display = []
        total_nloc = 0
        total_ccn = 0
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
            data_to_display.append({
                "id": basename,
                "nloc": file.nloc,
                "ccn": file.average_cyclomatic_complexity,
                "commits": commits_count,
                "language": lang,
            })

        languages_sorted = sorted(language_counts.items(), key=lambda x: x[1], reverse=True)
        main_language = languages_sorted[0][0] if languages_sorted else ""
        print(Fore.CYAN + f"Lenguajes detectados: { {k: v for k, v in languages_sorted} }")

        # 5b. data_by_language
        lang_nloc_map = {}
        lang_ccn_map = {}
        lang_commits_map = {}
        for file in analysis:
            _, ext = os.path.splitext(os.path.basename(file.filename))
            lang = ext.lstrip(".").lower() if ext else "unknown"
            rel_path = os.path.relpath(file.filename, target_dir).replace("\\", "/")
            commits_count = evolution_data["file_churn"].get(rel_path, 0)
            lang_nloc_map[lang] = lang_nloc_map.get(lang, 0) + file.nloc
            lang_ccn_map[lang] = lang_ccn_map.get(lang, []) + [file.average_cyclomatic_complexity]
            lang_commits_map[lang] = lang_commits_map.get(lang, 0) + commits_count

        data_by_language = []
        for lang, count in languages_sorted:
            avg_ccn = sum(lang_ccn_map[lang]) / len(lang_ccn_map[lang]) if lang_ccn_map.get(lang) else 0
            data_by_language.append({
                "id": lang,
                "language": lang,
                "nloc": lang_nloc_map.get(lang, 0),
                "ccn": round(avg_ccn, 2),
                "commits": lang_commits_map.get(lang, 0),
                "count": count,
            })
        print(Fore.CYAN + f"Datos por lenguaje generados: {len(data_by_language)} entradas")

        # region LM STUDIO
        repo_summary = {
            "num_files": len(analysis),
            "avg_nloc": total_nloc / len(analysis) if analysis else 0,
            "avg_ccn": total_ccn / len(analysis) if analysis else 0,
            "total_commits": evolution_data["total_commits"],
            "num_authors": len(evolution_data["authors"]),
            "filenames_sample": filenames[:10],
            "languages": {k: v for k, v in languages_sorted},
            "num_languages": len(language_counts),
        }

        print(Fore.MAGENTA + "Enviando resumen a la IA (LM Studio)...")
        ai_config_raw = get_ai_config(json.dumps(repo_summary))

        try:
            ai_config = json.loads(ai_config_raw)
            NUMERIC_FIELDS = {"nloc", "ccn", "commits", "count"}
            if ai_config.get("component") == "babia-doughnut":
                mappings = ai_config.setdefault("mappings", {})
                fvalues = mappings.get("fvalues", "")
                if fvalues not in NUMERIC_FIELDS:
                    print(Fore.YELLOW + f"[Guardia] fvalues='{fvalues}' no es numérico. Corrigiendo a 'count'.")
                    mappings["fvalues"] = "count"
            print(Fore.GREEN + f"Configuración de IA recibida: {ai_config}")
        except Exception:
            print(Fore.RED + "Error parseando JSON de IA, usando configuración por defecto.")
            ai_config = {
                "component": "babia-city",
                "mappings": {"key": "id", "fheight": "nloc", "farea": "ccn"},
                "visuals": {"building_color": "#00fbff", "base_color": "#1a1a1a", "extra": 1.5},
            }
        # endregion

        # ── GUARDAR EN BD ───────────────────────────────────────────────────
        if repo_obj is None:
            # Repo nuevo: crear o recuperar (puede existir si ls-remote falló antes)
            repo_obj, _ = Repository.objects.get_or_create(
                url=url,
                defaults={"name": repo_name, "main_language": main_language},
            )
        else:
            # Actualizar el lenguaje principal si cambió
            repo_obj.main_language = main_language
            repo_obj.save(update_fields=["main_language"])

        _save_session(repo_obj, last_commit_id, data_to_display, data_by_language, ai_config, repo_summary)
        # ────────────────────────────────────────────────────────────────────

        print(f"data_to_display: {data_to_display}")
        print(f"data_by_language: {data_by_language}")

        return {
            "metrics": metrics_list,
            "evolution_data": evolution_data,
            "data_to_display": data_to_display,
            "data_by_language": data_by_language,
            "ai_config": ai_config,
            "from_cache": False,
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
        if os.path.exists(target_dir):
            print(Fore.LIGHTBLACK_EX + "Limpiando archivos temporales...")
            try:
                shutil.rmtree(target_dir, onerror=remove_readonly)
                print(Fore.LIGHTBLACK_EX + "Carpeta temporal eliminada.")
            except Exception as e:
                print(Fore.RED + f"No se pudo eliminar la carpeta temporal: {e}")
