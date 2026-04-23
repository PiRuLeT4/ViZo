from django.db import models


class Repository(models.Model):
    """Repositorio analizado. La URL es el identificador único."""

    name = models.CharField(max_length=255)
    url = models.CharField(max_length=500, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    main_language = models.CharField(max_length=100, blank=True, default="")

    def __str__(self):
        return f"{self.name} ({self.url})"


class AnalysisSession(models.Model):
    """
    Una sesión de análisis vinculada a un repositorio.
    Se crea una nueva sesión si el last_commit_id cambia (repo actualizado).
    """

    repo = models.ForeignKey(
        Repository, on_delete=models.CASCADE, related_name="sessions"
    )
    analysis_date = models.DateTimeField(auto_now_add=True)
    last_commit_id = models.CharField(max_length=255)

    # Configuración que la IA eligió para representar este análisis
    ai_config = models.JSONField(default=dict)

    # Resumen estadístico del repo (num_files, avg_nloc, etc.)
    repo_summary = models.JSONField(default=dict)

    # Datos de evolución (lista de commits)
    evolution_data = models.JSONField(default=list)

    class Meta:
        ordering = ["-analysis_date"]

    def __str__(self):
        return f"Session({self.repo.name}, {self.analysis_date:%Y-%m-%d}, commit={self.last_commit_id[:8]})"


class FileMetric(models.Model):
    """Métricas por archivo (una fila = un archivo analizado)."""

    session = models.ForeignKey(
        AnalysisSession, on_delete=models.CASCADE, related_name="file_metrics"
    )
    file_name = models.CharField(max_length=500)
    language = models.CharField(max_length=50, blank=True, default="")
    nloc = models.IntegerField(default=0)
    ccn = models.FloatField(default=0.0)  # cyclomatic complexity (puede ser decimal)
    commits = models.IntegerField(default=0)

    def __str__(self):
        return f"{self.file_name} (nloc={self.nloc}, ccn={self.ccn})"

    def to_dict(self):
        rel_path = self.file_name  # stored as rel_path since last refactor
        parts = rel_path.split("/")
        basename = parts[-1]
        folder = parts[0] if len(parts) > 1 else "root"
        return {
            "id": rel_path,
            "name": basename,
            "nloc": self.nloc,
            "ccn": self.ccn,
            "commits": self.commits,
            "language": self.language,
            "folder": folder,
        }


class LanguageMetric(models.Model):
    """Métricas agrupadas por lenguaje (una fila = un lenguaje)."""

    session = models.ForeignKey(
        AnalysisSession, on_delete=models.CASCADE, related_name="language_metrics"
    )
    language = models.CharField(max_length=50)
    nloc = models.IntegerField(default=0)
    ccn = models.FloatField(default=0.0)  # CCN media del lenguaje
    commits = models.IntegerField(default=0)
    count = models.IntegerField(default=0)  # nº de archivos de este lenguaje

    def __str__(self):
        return f"{self.language} (count={self.count}, nloc={self.nloc})"

    def to_dict(self):
        return {
            "id": self.language,
            "language": self.language,
            "nloc": self.nloc,
            "ccn": self.ccn,
            "commits": self.commits,
            "count": self.count,
        }
