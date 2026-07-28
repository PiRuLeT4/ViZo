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
        self.assertIn("Debes iniciar sesión", resp_json["error"])
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
    def test_api_analyze_authenticated_gitlab_private_repo_allowed(self, mock_start):
        gitlab_user = User.objects.create_user(username="gitlabuser", password="password")
        UserProfile.objects.create(
            user=gitlab_user,
            gitlab_token="mock_gitlab_token",
            gitlab_username="gitlabuser",
            provider="gitlab"
        )
        self.client.force_login(gitlab_user)
        mock_start.return_value = (43, False)

        response = self.client.post(
            "/api/analyze/",
            {"repoUrl": "https://gitlab.com/some/private-repo", "isPrivate": "true"},
        )
        self.assertEqual(response.status_code, 200)
        resp_json = response.json()
        self.assertEqual(resp_json["status"], "success")
        self.assertEqual(resp_json["session_id"], 43)
        mock_start.assert_called_once()

    @patch("analyzer.views.api.start_async_analysis")
    def test_api_analyze_cross_provider_denied(self, mock_start):
        # User has github token but tries to analyze gitlab private repo
        self.client.force_login(self.user)
        response = self.client.post(
            "/api/analyze/",
            {"repoUrl": "https://gitlab.com/some/private-repo", "isPrivate": "true"},
        )
        self.assertEqual(response.status_code, 401)
        resp_json = response.json()
        self.assertIn("debes iniciar sesión usando GitLab", resp_json["error"])
        mock_start.assert_not_called()

        # User has gitlab token but tries to analyze github private repo
        gitlab_user = User.objects.create_user(username="gitlabuser_cross", password="password")
        UserProfile.objects.create(
            user=gitlab_user,
            gitlab_token="mock_gitlab_token",
            gitlab_username="gitlabuser",
            provider="gitlab"
        )
        self.client.force_login(gitlab_user)
        response = self.client.post(
            "/api/analyze/",
            {"repoUrl": "https://github.com/some/private-repo", "isPrivate": "true"},
        )
        self.assertEqual(response.status_code, 401)
        resp_json = response.json()
        self.assertIn("debes iniciar sesión usando GitHub", resp_json["error"])
        mock_start.assert_not_called()

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

    @patch("analyzer.views.api.start_async_analysis")
    def test_api_analyze_releases_mode(self, mock_start):
        self.client.force_login(self.user)
        mock_start.return_value = (45, False)

        response = self.client.post(
            "/api/analyze/",
            {
                "repoUrl": "https://github.com/some/public-repo",
                "analysis_mode": "releases",
                "depth": "5"
            }
        )
        self.assertEqual(response.status_code, 200)
        resp_json = response.json()
        self.assertEqual(resp_json["status"], "success")
        self.assertEqual(resp_json["session_id"], 45)

        mock_start.assert_called_once()
        args, kwargs = mock_start.call_args
        self.assertEqual(args[0], "https://github.com/some/public-repo")
        self.assertEqual(kwargs.get("max_commits"), 5)
        self.assertEqual(kwargs.get("analysis_mode"), "releases")
        self.assertEqual(kwargs.get("is_private"), False)

    @patch("analyzer.views.api.start_async_analysis")
    def test_api_analyze_releases_mode_all(self, mock_start):
        self.client.force_login(self.user)
        mock_start.return_value = (46, False)

        response = self.client.post(
            "/api/analyze/",
            {
                "repoUrl": "https://github.com/some/public-repo",
                "analysis_mode": "releases",
                "depth": "all"
            }
        )
        self.assertEqual(response.status_code, 200)
        resp_json = response.json()
        self.assertEqual(resp_json["status"], "success")
        self.assertEqual(resp_json["session_id"], 46)

        mock_start.assert_called_once()
        args, kwargs = mock_start.call_args
        self.assertEqual(args[0], "https://github.com/some/public-repo")
        self.assertEqual(kwargs.get("max_commits"), 0)
        self.assertEqual(kwargs.get("analysis_mode"), "releases")
        self.assertEqual(kwargs.get("is_private"), False)

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


class GitLabOAuthIntegrationTestCase(TestCase):
    def setUp(self):
        self.client = Client()

    @patch("analyzer.views.oauth.os.getenv")
    def test_gitlab_login_redirect_success(self, mock_getenv):
        def side_effect(key, default=None):
            if key == "GITLAB_CLIENT_ID":
                return "dummy_id"
            if key == "GITLAB_CLIENT_SECRET":
                return "dummy_secret"
            return default
        mock_getenv.side_effect = side_effect

        response = self.client.get("/oauth/gitlab/login/")
        self.assertEqual(response.status_code, 302)
        self.assertIn("https://gitlab.com/oauth/authorize", response["Location"])
        self.assertIn("client_id=dummy_id", response["Location"])
        self.assertIn("scope=read_user", response["Location"])

    @patch("analyzer.views.oauth.os.getenv")
    def test_gitlab_login_missing_config(self, mock_getenv):
        mock_getenv.return_value = None

        response = self.client.get("/oauth/gitlab/login/")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "/analyzer/")
        
        # Check that an error message is set
        messages = list(response.wsgi_request._messages)
        self.assertEqual(len(messages), 1)
        self.assertIn("GitLab OAuth no está configurado", str(messages[0]))

    def test_gitlab_callback_missing_code(self):
        response = self.client.get("/oauth/gitlab/callback/")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "/analyzer/")
        messages = list(response.wsgi_request._messages)
        self.assertEqual(len(messages), 1)
        self.assertIn("No se recibió código de autorización", str(messages[0]))

    @patch("analyzer.views.oauth.os.getenv")
    @patch("analyzer.views.oauth.requests.post")
    @patch("analyzer.views.oauth.requests.get")
    def test_gitlab_callback_success(self, mock_get, mock_post, mock_getenv):
        def side_effect(key, default=None):
            if key == "GITLAB_CLIENT_ID":
                return "dummy_id"
            if key == "GITLAB_CLIENT_SECRET":
                return "dummy_secret"
            return default
        mock_getenv.side_effect = side_effect

        # Mock token request response
        mock_token_resp = mock_post.return_value
        mock_token_resp.json.return_value = {"access_token": "mock_gitlab_access_token"}
        mock_token_resp.status_code = 200

        # Mock user API response
        mock_user_resp = mock_get.return_value
        mock_user_resp.json.return_value = {
            "username": "gitlabtestuser",
            "avatar_url": "https://gitlab.com/avatar.png",
            "email": "test@gitlab.com",
        }
        mock_user_resp.status_code = 200

        response = self.client.get("/oauth/gitlab/callback/?code=testcode")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "/analyzer/")

        # User and UserProfile should be created
        user = User.objects.get(username="gitlabtestuser")
        profile = user.profile
        self.assertEqual(profile.provider, "gitlab")
        self.assertEqual(profile.gitlab_token, "mock_gitlab_access_token")
        self.assertEqual(profile.gitlab_username, "gitlabtestuser")
        self.assertEqual(profile.avatar_url, "https://gitlab.com/avatar.png")

        # Session should be authenticated
        self.assertTrue(response.wsgi_request.user.is_authenticated)
        self.assertEqual(response.wsgi_request.user, user)

    @patch("analyzer.views.oauth.os.getenv")
    @patch("analyzer.views.oauth.requests.post")
    def test_gitlab_callback_token_error(self, mock_post, mock_getenv):
        def side_effect(key, default=None):
            if key == "GITLAB_CLIENT_ID":
                return "dummy_id"
            if key == "GITLAB_CLIENT_SECRET":
                return "dummy_secret"
            return default
        mock_getenv.side_effect = side_effect

        # Mock token request exception
        mock_post.side_effect = Exception("Connection refused")

        response = self.client.get("/oauth/gitlab/callback/?code=testcode")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "/analyzer/")
        messages = list(response.wsgi_request._messages)
        self.assertEqual(len(messages), 1)
        self.assertIn("Error al conectar con GitLab OAuth", str(messages[0]))

    @patch("analyzer.views.oauth.os.getenv")
    @patch("analyzer.views.oauth.requests.post")
    @patch("analyzer.views.oauth.requests.get")
    def test_gitlab_callback_profile_error(self, mock_get, mock_post, mock_getenv):
        def side_effect(key, default=None):
            if key == "GITLAB_CLIENT_ID":
                return "dummy_id"
            if key == "GITLAB_CLIENT_SECRET":
                return "dummy_secret"
            return default
        mock_getenv.side_effect = side_effect

        # Mock token request response
        mock_token_resp = mock_post.return_value
        mock_token_resp.json.return_value = {"access_token": "mock_gitlab_access_token"}
        mock_token_resp.status_code = 200

        # Mock user API exception
        mock_get.side_effect = Exception("User API error")

        response = self.client.get("/oauth/gitlab/callback/?code=testcode")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "/analyzer/")
        messages = list(response.wsgi_request._messages)
        self.assertEqual(len(messages), 1)
        self.assertIn("Error al recuperar datos de usuario de GitLab", str(messages[0]))


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
