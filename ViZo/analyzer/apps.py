import logging
import sys
from django.apps import AppConfig

logger = logging.getLogger(__name__)


class AnalyzerConfig(AppConfig):
    name = 'analyzer'

    def ready(self):
        # Evitar ejecutar la limpieza en operaciones de comandos de gestión como makemigrations/migrate
        if "runserver" in sys.argv or "wsgi" in sys.argv or "asgi" in sys.argv:
            try:
                from analyzer.management.commands.cleanup_system import purge_orphan_temp_dirs
                purge_orphan_temp_dirs(check_db=False)
            except Exception as e:
                logger.warning(f"[AppConfig Warning] No se pudo ejecutar la limpieza inicial de temporales: {e}")


