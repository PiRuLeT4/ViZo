from django.test import TestCase
from django.urls import reverse
from django.contrib.auth.models import User
from analyzer.models import Repository, AnalysisSession, FileMetric, LanguageMetric
import json

class VisualizationViewsTestCase(TestCase):
    def setUp(self):
        # Crear usuario de prueba
        self.user = User.objects.create_user(username="testuser", password="password")
        # Crear repositorio de prueba
        self.repo = Repository.objects.create(
            name="repo",
            url="https://github.com/test/repo",
            user=self.user
        )
        # Crear una sesión de análisis de prueba vinculada
        self.session = AnalysisSession.objects.create(
            repo=self.repo,
            status="completed",
            last_commit_id="12345678",
            ai_config={
                "dashboards": [
                    {
                        "id": "boats-complexity",
                        "component": "babia-boats",
                        "dataset": "file_metrics",
                        "title": "Boats Test",
                        "mappings": {"key": "id", "height": "nloc", "area": "ccn"}
                    }
                ]
            }
        )
        # Crear métricas asociadas
        FileMetric.objects.create(
            session=self.session,
            file_name="file1.py",
            language="Python",
            nloc=50,
            ccn=3.0,
            commits=10,
            num_functions=1,
            peak_ccn=3.0,
            ownership=100.0,
            owner_name="testuser",
            age_days=0
        )
        LanguageMetric.objects.create(
            session=self.session,
            language="Python",
            nloc=50,
            ccn=3.0,
            commits=10,
            count=1
        )

    def test_show_visualization_page(self):
        # Probar que la vista principal del visualizador responde con éxito
        url = reverse("show_visualization", args=[self.session.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        # Verificar que el HTML contiene la inyección del ID de sesión
        self.assertContains(response, f'window.ViZzoSessionId = "{self.session.id}";')
        # Verificar que no están presentes los divs antiguos con JSONs
        self.assertNotContains(response, 'id="vizzo-data-json"')

    def test_api_session_data_endpoint(self):
        # Probar que el nuevo endpoint REST de datos asíncronos responde correctamente
        url = reverse("api_session_data", args=[self.session.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/json")
        
        # Cargar y verificar estructura del JSON
        data = json.loads(response.content)
        self.assertEqual(data["repo_name"], "repo")
        self.assertIn("file_metrics", data)
        self.assertIn("data_by_language", data)
        self.assertIn("evolution_data", data)
        self.assertIn("ai_config", data)
        self.assertEqual(len(data["file_metrics"]), 1)
        self.assertEqual(data["file_metrics"][0]["name"], "file1.py")
