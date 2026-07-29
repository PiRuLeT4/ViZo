import os
import shutil
import stat
from datetime import datetime, timedelta
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db.models import Max
from django.utils import timezone

from analyzer.models import AnalysisSession


def remove_readonly(func, path, excinfo):
    """Callback para shutil.rmtree: elimina el flag de solo lectura antes de borrar (Windows)."""
    os.chmod(path, stat.S_IWRITE)
    func(path)


def purge_orphan_temp_dirs(check_db: bool = True):
    """
    Busca carpetas temporales temp_repo_analysis* que no pertenezcan a sesiones activas.
    Si check_db es False (ej. arranque del servidor), elimina todas las carpetas huérfanas en disco sin consultar la BD.
    """
    base_dir = Path(__file__).resolve().parent.parent.parent.parent
    active_session_ids = set()

    if check_db:
        try:
            active_session_ids = set(
                AnalysisSession.objects.filter(status__in=["pending", "processing"]).values_list("id", flat=True)
            )
        except Exception:
            pass

    deleted_count = 0
    for path in base_dir.glob("temp_repo_analysis*"):
        if path.is_dir():
            folder_name = path.name
            session_id = None
            if "_" in folder_name:
                suffix = folder_name.split("_")[-1]
                if suffix.isdigit():
                    session_id = int(suffix)

            if not check_db or session_id is None or session_id not in active_session_ids:
                try:
                    shutil.rmtree(path, onerror=remove_readonly)
                    deleted_count += 1
                    print(f"[Cleanup] Carpeta temporal huérfana eliminada: {folder_name}")
                except Exception as e:
                    print(f"[Cleanup Warning] No se pudo eliminar {folder_name}: {e}")

    return deleted_count


class Command(BaseCommand):
    help = "Limpia sesiones de análisis antiguas de la BD y carpetas temporales huérfanas en disco."

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=30,
            help="Número de días de antigüedad para considerar una sesión desfasada (por defecto 30).",
        )

    def handle(self, *args, **options):
        days = options["days"]
        cutoff_date = timezone.now() - timedelta(days=days)

        self.stdout.write(f"Iniciando limpieza del sistema (sesiones > {days} días)...")

        # 1. Identificar las sesiones más recientes por repositorio (para NO borrar la última versión de cada repo)
        latest_session_ids = (
            AnalysisSession.objects.filter(status="completed")
            .values("repo_id")
            .annotate(latest_id=Max("id"))
            .values_list("latest_id", flat=True)
        )

        # 2. Purgar sesiones antiguas desfasadas
        old_sessions = AnalysisSession.objects.filter(
            analysis_date__lt=cutoff_date
        ).exclude(id__in=latest_session_ids)

        session_count = old_sessions.count()
        old_sessions.delete()

        self.stdout.write(self.style.SUCCESS(f"Purga de BD completada: {session_count} sesiones desfasadas eliminadas."))

        # 3. Purgar carpetas temporales huérfanas
        dirs_cleaned = purge_orphan_temp_dirs()
        self.stdout.write(self.style.SUCCESS(f"Purga de disco completada: {dirs_cleaned} carpetas temporales huérfanas eliminadas."))
