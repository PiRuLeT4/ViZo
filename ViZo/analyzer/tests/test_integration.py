from unittest.mock import patch

from django.test import TestCase, Client
from django.contrib.auth.models import User


from analyzer.models import Repository, AnalysisSession, UserProfile


class APIAnalyzeIntegrationTestCase(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(username="githubuser", password="password")
        UserProfile.objects.get_or_create(
            user=self.user,
            github_token="mock_github_token",
            github_username="githubuser",
        )

    @patch("analyzer.views.api.start_async_analysis")
    def test_api_analyze_anonymous_private_repo_denied(self, mock_start):
        # Un usuario anónimo no puede analizar como privado
        response = self.client.post(
            "/api/analyze/",
            {"repoUrl": "https://github.com/some/private-repo", "isPrivate": "true"},
        )
        self.assertEqual(response.status_code, 401)
        resp_json = response.json()
        self.assertIn("Debes iniciar sesión con GitHub", resp_json["error"])
        mock_start.assert_not_called()

    @patch("analyzer.views.api.start_async_analysis")
    def test_api_analyze_authenticated_private_repo_allowed(self, mock_start):
        self.client.force_login(self.user)
        mock_start.return_value = (42, False)  # session_id=42, cache_hit=False

        response = self.client.post(
            "/api/analyze/",
            {"repoUrl": "https://github.com/some/private-repo", "isPrivate": "true"},
        )
        self.assertEqual(response.status_code, 200)
        resp_json = response.json()
        self.assertEqual(resp_json["status"], "success")
        self.assertEqual(resp_json["session_id"], 42)
        self.assertFalse(resp_json["is_cache_hit"])

        mock_start.assert_called_once()

    @patch("analyzer.views.api.start_async_analysis")
    def test_api_analyze_private_shield_error_cascade(self, mock_start):
        self.client.force_login(self.user)
        # Forzar un PermissionError de tipo PRIVATE_REPO_WITHOUT_SHIELD
        mock_start.side_effect = PermissionError("PRIVATE_REPO_WITHOUT_SHIELD")

        response = self.client.post(
            "/api/analyze/", {"repoUrl": "https://github.com/some/private-repo"}
        )
        self.assertEqual(response.status_code, 403)
        resp_json = response.json()
        self.assertIn(
            "El repositorio es privado. Debes activar la opción 'Analizar como Privado'",
            resp_json["error"],
        )

    def test_api_session_status_pending_processing_completed(self):
        # Crear un repo y sesiones mock
        repo = Repository.objects.create(
            name="status-repo", url="https://github.com/status/repo", is_private=False
        )
        session = AnalysisSession.objects.create(
            repo=repo, status="pending", last_commit_id=""
        )

        # Test status pending
        response = self.client.get(f"/api/session/{session.id}/status/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "pending")

        # Test status completed
        session.status = "completed"
        session.save()
        response = self.client.get(f"/api/session/{session.id}/status/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "completed")


class AsyncOrchestratorIntegrationTestCase(TestCase):
    def setUp(self):
        self.repo = Repository.objects.create(
            name="async-repo", url="https://github.com/async/repo", is_private=False
        )

    @patch("django.db.backends.base.base.BaseDatabaseWrapper.close")
    @patch("analyzer.services.orchestrator._get_remote_head")
    @patch("analyzer.services.orchestrator.run_analysis")
    @patch("analyzer.services.orchestrator.get_ai_config")
    def test_async_worker_lifecycle(self, mock_ai, mock_run, mock_head, mock_close):
        from analyzer.services.orchestrator import async_analysis_worker

        # Mocks para simular el análisis
        mock_head.return_value = "fake_commit_hash"
        mock_run.return_value = {
            "repo_name": "async-repo",
            "main_language": "Python",
            "last_commit_id": "fake_commit_hash",
            "file_metrics": [],
            "data_by_language": [],
            "evolution_data": [],
            "repo_summary": {},
            "author_activity": [],
        }
        mock_ai.return_value = {"dashboards": []}

        # Crear sesión en pending
        session = AnalysisSession.objects.create(
            repo=self.repo, status="pending", last_commit_id=""
        )

        # Ejecutar worker directamente en el hilo de pruebas
        async_analysis_worker(session.id, self.repo.url, 150)

        # Refrescar de BD
        session.refresh_from_db()
        self.assertEqual(session.status, "completed")
        self.assertEqual(session.last_commit_id, "fake_commit_hash")
