from django.db import models
from django.contrib.auth.models import User


class UserProfile(models.Model):
    """Perfil ampliado del usuario para guardar tokens de OAuth y metadatos."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    provider = models.CharField(max_length=50, default="github")
    github_token = models.CharField(max_length=255, blank=True, null=True)
    avatar_url = models.CharField(max_length=500, blank=True, null=True)
    github_username = models.CharField(max_length=150, blank=True, null=True)
    gitlab_token = models.CharField(max_length=255, blank=True, null=True)
    gitlab_username = models.CharField(max_length=150, blank=True, null=True)

    def __str__(self):
        return f"Profile of {self.user.username}"


class Repository(models.Model):
    """Repositorio analizado. La URL es el identificador único."""

    name = models.CharField(max_length=255)
    url = models.CharField(max_length=500, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    main_language = models.CharField(max_length=100, blank=True, default="")
    
    # Campos para repositorios privados y propiedad
    is_private = models.BooleanField(default=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="repositories", null=True, blank=True)

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
    
    # Seguimiento de estado asíncrono
    status = models.CharField(max_length=20, default="completed")
    analysis_mode = models.CharField(max_length=20, default="commits")
    error_message = models.TextField(null=True, blank=True)

    # Configuración que la IA eligió para representar este análisis
    ai_config = models.JSONField(default=dict)

    # Resumen estadístico del repo (num_files, avg_nloc, etc.)
    repo_summary = models.JSONField(default=dict)

    # Datos de evolución (lista de commits)
    evolution_data = models.JSONField(default=list)

    # Actividad agrupada por autor y fecha (author, date, commits, insertions)
    author_activity = models.JSONField(default=list)

    # Datasets agregados avanzados de métricas locales
    file_ownership = models.JSONField(default=list)
    age_distribution = models.JSONField(default=list)
    top_complex_files = models.JSONField(default=list)
    file_network = models.JSONField(default=dict, blank=True, null=True)

    # Metadatos extraídos de APIs públicas (PRs e Issues)
    pull_requests = models.JSONField(default=list, blank=True)
    issues = models.JSONField(default=list, blank=True)

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
    num_functions = models.IntegerField(default=0)
    peak_ccn = models.FloatField(default=0.0)
    ownership = models.FloatField(default=0.0)
    owner_name = models.CharField(max_length=255, blank=True, default="")
    age_days = models.IntegerField(default=0)

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
            "num_functions": self.num_functions,
            "peak_ccn": self.peak_ccn,
            "ownership": self.ownership,
            "owner_name": self.owner_name or "N/A",
            "age_days": self.age_days,
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
