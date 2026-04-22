from django.contrib import admin

from .models import AnalysisSession, FileMetric, LanguageMetric, Repository

# Register your models here.

admin.site.register(Repository)
admin.site.register(AnalysisSession)
admin.site.register(FileMetric)
admin.site.register(LanguageMetric)
