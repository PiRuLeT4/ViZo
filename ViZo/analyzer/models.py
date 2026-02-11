from django.db import models


# Create your models here.
class Repository(models.Model):
    name = models.CharField(max_length=255)
    url = models.CharField(max_length=255)  # .. la url de Github/Gitlab
    created_at = models.DateTimeField(auto_now_add=True)
    main_language = models.CharField(max_length=255)


class AnalysisSession(models.Model):
    repo = models.ForeignKey(Repository, on_delete=models.CASCADE)
    analysis_date = models.DateTimeField(auto_now_add=True)
    last_commit_id = models.CharField(max_length=255)


class Metric(models.Model):
    session = models.ForeignKey(AnalysisSession, on_delete=models.CASCADE)
    file_name = models.CharField(max_length=255)
    value = models.CharField(max_length=255)
    complexity = models.IntegerField()
