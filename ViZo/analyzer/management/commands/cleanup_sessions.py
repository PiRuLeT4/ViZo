from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from datetime import timedelta
from analyzer.models import AnalysisSession, Repository

class Command(BaseCommand):
    help = "Limpia las sesiones de análisis antiguas de la base de datos de ViZo."

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            help="Elimina sesiones más viejas que el número indicado de días.",
        )
        parser.add_argument(
            "--keep-last",
            type=int,
            help="Conserva las últimas N sesiones de análisis para cada repositorio, eliminando las más antiguas.",
        )

    def handle(self, *args, **options):
        days = options.get("days")
        keep_last = options.get("keep_last")

        if days is None and keep_last is None:
            raise CommandError(
                "Debes especificar al menos un criterio de limpieza: --days o --keep-last."
            )

        deleted_count = 0

        # Criterio 1: Antigüedad (--days)
        if days is not None:
            if days < 0:
                raise CommandError("El número de días no puede ser negativo.")
            cutoff_date = timezone.now() - timedelta(days=days)
            old_sessions = AnalysisSession.objects.filter(analysis_date__lt=cutoff_date)
            count = old_sessions.count()
            if count > 0:
                self.stdout.write(
                    self.style.WARNING(
                        f"Eliminando {count} sesiones anteriores a {cutoff_date:%Y-%m-%d %H:%M:%S}..."
                    )
                )
                old_sessions.delete()
                deleted_count += count
            else:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"No se encontraron sesiones anteriores a {cutoff_date:%Y-%m-%d %H:%M:%S}."
                    )
                )

        # Criterio 2: Mantener solo las últimas N sesiones por repositorio (--keep-last)
        if keep_last is not None:
            if keep_last < 0:
                raise CommandError("El valor de --keep-last no puede ser negativo.")
            self.stdout.write(
                self.style.NOTICE(
                    f"Purgando sesiones antiguas para mantener solo las últimas {keep_last} de cada repositorio..."
                )
            )
            for repo in Repository.objects.all():
                sessions = repo.sessions.all()  # Meta ordering is [-analysis_date]
                if sessions.count() > keep_last:
                    # Conservamos las primeras keep_last y borramos el resto
                    sessions_to_delete = sessions[keep_last:]
                    count = len(sessions_to_delete)
                    ids_to_delete = [s.id for s in sessions_to_delete]
                    AnalysisSession.objects.filter(id__in=ids_to_delete).delete()
                    deleted_count += count
                    self.stdout.write(
                        self.style.WARNING(
                            f"  - Repo '{repo.name}': Eliminadas {count} sesiones antiguas."
                        )
                    )

        self.stdout.write(
            self.style.SUCCESS(
                f"Proceso de limpieza completado con éxito. Total de sesiones eliminadas: {deleted_count}."
            )
        )
