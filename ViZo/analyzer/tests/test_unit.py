from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from django.core.management import call_command, CommandError

from analyzer.core.AI.helpers import _extract_summary_and_json, _validate_and_fix_config
from analyzer.models import Repository, AnalysisSession
from analyzer.persistence.queries import (
    get_latest_active_sessions,
    get_user_active_sessions,
)


class AIUtilsTestCase(TestCase):
    def test_extract_summary_and_json_standard(self):
        raw = 'RESUMEN:\nEste es el resumen.\nCONFIGURACIÓN:\n```json\n{"dashboards":[]}\n```'
        summary, json_str = _extract_summary_and_json(raw)
        self.assertEqual(summary, "Este es el resumen.")
        self.assertEqual(json_str, '{"dashboards":[]}')

    def test_extract_summary_and_json_markdown(self):
        raw = '### **Resumen**:\nUn resumen markdown con estrellas.\n### **Configuracion**\n```json\n{"test": 1}\n```'
        summary, json_str = _extract_summary_and_json(raw)
        self.assertEqual(summary, "Un resumen markdown con estrellas.")
        self.assertEqual(json_str, '{"test": 1}')

    def test_extract_summary_and_json_no_header(self):
        raw = 'Texto libre introductorio que sirve de justificación.\n```json\n{"foo":"bar"}\n```'
        summary, json_str = _extract_summary_and_json(raw)
        self.assertEqual(
            summary, "Texto libre introductorio que sirve de justificación."
        )
        self.assertEqual(json_str, '{"foo":"bar"}')

    def test_validate_and_fix_config_missing_boats(self):
        # Si no tiene babia-boats, el validador debe insertarlo en el índice 0
        config = {
            "dashboards": [
                {
                    "component": "babia-cyls",
                    "dataset": "data_by_language",
                    "mappings": {},
                }
            ]
        }
        fixed = _validate_and_fix_config(config)
        components = [d["component"] for d in fixed["dashboards"]]
        self.assertIn("babia-boats", components)
        self.assertEqual(components[0], "babia-boats")

    def test_validate_and_fix_config_correct_mappings(self):
        # Mapea cilindros sin mappings, debe auto-inyectar los mapeos por defecto
        config = {
            "dashboards": [
                {
                    "component": "babia-boats",
                },
                {
                    "component": "babia-cyls",
                },
            ]
        }
        fixed = _validate_and_fix_config(config)
        cyls_dash = next(
            d for d in fixed["dashboards"] if d["component"] == "babia-cyls"
        )
        self.assertIsNotNone(cyls_dash.get("mappings"))
        self.assertEqual(cyls_dash["mappings"]["x_axis"], "language")

    def test_get_offline_explanation_network(self):
        from analyzer.core.AI.ai import get_offline_explanation

        explanation = get_offline_explanation("network", "test-repo")
        self.assertIn("REPORTE DE RED DE COLABORACIÓN DE DESARROLLADORES", explanation)
        self.assertIn("test-repo", explanation)

        explanation_babia = get_offline_explanation("babia-network", "test-repo")
        self.assertIn(
            "REPORTE DE RED DE COLABORACIÓN DE DESARROLLADORES", explanation_babia
        )


class PersistenceQueriesTestCase(TestCase):
    def setUp(self):
        from django.contrib.auth.models import User

        self.user = User.objects.create_user(username="testuser", password="password")
        self.repo_public = Repository.objects.create(
            name="public-repo", url="https://github.com/test/public", is_private=False
        )
        self.repo_private = Repository.objects.create(
            name="private-repo",
            url="https://github.com/test/private",
            is_private=True,
            user=self.user,
        )

    def test_get_latest_active_sessions_filters_private(self):
        # Creamos sesión pública completada
        s_pub = AnalysisSession.objects.create(
            repo=self.repo_public,
            status="completed",
            last_commit_id="12345678",
            ai_config={},
        )
        # Creamos sesión privada completada
        s_priv = AnalysisSession.objects.create(
            repo=self.repo_private,
            status="completed",
            last_commit_id="87654321",
            ai_config={},
        )

        public_sessions = get_latest_active_sessions()
        self.assertIn(s_pub, public_sessions)
        self.assertNotIn(s_priv, public_sessions)

    def test_get_user_active_sessions(self):
        # Sesión privada completada para el usuario
        s_priv = AnalysisSession.objects.create(
            repo=self.repo_private,
            status="completed",
            last_commit_id="87654321",
            ai_config={},
        )

        # Test con usuario autenticado
        user_sessions = get_user_active_sessions(self.user)
        self.assertIn(s_priv, user_sessions)

        # Test con usuario anónimo/no autenticado
        from django.contrib.auth.models import AnonymousUser

        anon_user = AnonymousUser()
        anon_sessions = get_user_active_sessions(anon_user)
        self.assertEqual(len(anon_sessions), 0)


class CleanupSessionsTestCase(TestCase):
    def setUp(self):
        self.repo = Repository.objects.create(
            name="cleanup-repo", url="https://github.com/test/cleanup", is_private=False
        )

    def test_cleanup_by_days(self):
        now = timezone.now()
        # Sesión reciente (hace 1 día)
        s_recent = AnalysisSession.objects.create(
            repo=self.repo, status="completed", last_commit_id="recent", ai_config={}
        )
        s_recent.analysis_date = now - timedelta(days=1)
        s_recent.save()

        # Sesión vieja (hace 10 días)
        s_old = AnalysisSession.objects.create(
            repo=self.repo, status="completed", last_commit_id="old", ai_config={}
        )
        s_old.analysis_date = now - timedelta(days=10)
        s_old.save()

        # Limpiamos con --days 5
        call_command("cleanup_sessions", days=5)

        # Verificamos que s_recent siga existiendo y s_old haya sido borrada
        self.assertTrue(AnalysisSession.objects.filter(id=s_recent.id).exists())
        self.assertFalse(AnalysisSession.objects.filter(id=s_old.id).exists())

    def test_cleanup_by_keep_last(self):
        # Crear 5 sesiones para el mismo repositorio
        sessions = []
        for i in range(5):
            s = AnalysisSession.objects.create(
                repo=self.repo,
                status="completed",
                last_commit_id=f"commit-{i}",
                ai_config={},
            )
            # Forzar fechas escalonadas para ordenar correctamente
            s.analysis_date = timezone.now() - timedelta(minutes=i * 10)
            s.save()
            sessions.append(s)

        # Purgamos manteniendo solo las últimas 2
        call_command("cleanup_sessions", keep_last=2)

        # Deben quedar las dos más recientes
        remaining_ids = list(
            AnalysisSession.objects.filter(repo=self.repo).values_list("id", flat=True)
        )
        self.assertEqual(len(remaining_ids), 2)
        self.assertIn(sessions[0].id, remaining_ids)
        self.assertIn(sessions[1].id, remaining_ids)

    def test_cleanup_no_criteria_errors(self):
        with self.assertRaises(CommandError):
            call_command("cleanup_sessions")


class LocalMetricsTestCase(TestCase):
    def test_process_metrics_calculations(self):
        from unittest.mock import MagicMock
        from datetime import datetime
        from analyzer.core.ENGINE.metrics import _process_metrics

        # Create a mock Lizard file
        mock_func = MagicMock()
        mock_func.cyclomatic_complexity = 5

        mock_file = MagicMock()
        mock_file.filename = "/tmp/test_dir/file1.py"
        mock_file.nloc = 100
        mock_file.average_cyclomatic_complexity = 3.0
        mock_file.function_list = [mock_func]

        # Create evolution data
        now = datetime.now()
        evolution_data = {
            "file_churn": {"file1.py": 2},
            "file_lines_added": {"file1.py": 50},
            "file_lines_deleted": {"file1.py": 10},
            "file_author_commits": {"file1.py": {"Author A": 2, "Author B": 1}},
            "file_last_modified": {"file1.py": now},
            "commits": [
                {"author": "Author A", "hash": "123", "date": now},
                {"author": "Author A", "hash": "456", "date": now},
                {"author": "Author B", "hash": "789", "date": now},
            ],
            "author_activity": [],
        }

        # Run process_metrics
        (
            file_metrics,
            data_by_language,
            filenames,
            total_nloc,
            total_ccn,
            language_counts,
            file_ownership,
            age_distribution,
            top_complex_files,
            file_network,
        ) = _process_metrics([mock_file], evolution_data, "/tmp/test_dir")

        # Verify calculations
        self.assertEqual(len(file_metrics), 1)
        fm = file_metrics[0]
        self.assertEqual(fm["name"], "file1.py")
        self.assertEqual(fm["num_functions"], 1)
        self.assertEqual(fm["peak_ccn"], 5.0)
        self.assertEqual(fm["age_days"], 0)
        # Dominant author: Author A (2 commits out of 3 total) -> ownership = 66.67%
        self.assertAlmostEqual(fm["ownership"], 66.67, places=2)
        self.assertEqual(fm["owner_name"], "Author A")

        # Verify file_ownership list
        # It should list A (66.67%) and B (33.33%)
        self.assertEqual(len(file_ownership), 2)
        self.assertEqual(file_ownership[0]["author"], "Author A")
        self.assertAlmostEqual(file_ownership[0]["ownership"], 66.67, places=2)
        self.assertEqual(file_ownership[1]["author"], "Author B")
        self.assertAlmostEqual(file_ownership[1]["ownership"], 33.33, places=2)

        # Verify age_distribution
        # Since age_days is 0, it should be in "Active"
        active_cat = next(
            cat for cat in age_distribution if cat["category"] == "Active"
        )
        self.assertEqual(active_cat["count"], 1)
        self.assertEqual(active_cat["nloc"], 100)

        # Verify top_complex_files
        self.assertEqual(len(top_complex_files), 1)
        self.assertEqual(top_complex_files[0]["name"], "file1.py")
        self.assertEqual(top_complex_files[0]["peak_ccn"], 5.0)

        # Verify file_network
        self.assertIsInstance(file_network, list)
        self.assertEqual(len(file_network), 2)

        # Verify items properties
        item_a = next(
            item for item in file_network if item["author"] == "Author A"
        )
        item_b = next(
            item for item in file_network if item["author"] == "Author B"
        )
        self.assertEqual(item_a["file"], "file1.py")
        self.assertEqual(item_a["size"], 2)
        self.assertEqual(item_a["commits"], 2)
        self.assertEqual(item_b["file"], "file1.py")
        self.assertEqual(item_b["size"], 1)
        self.assertEqual(item_b["commits"], 1)


class ReleasesHistoryTestCase(TestCase):
    def test_clean_git_path(self):
        from analyzer.core.ENGINE.helpers import _clean_git_path

        self.assertEqual(_clean_git_path("src/{old => new}/file.py"), "src/new/file.py")
        self.assertEqual(_clean_git_path("old_name.py => new_name.py"), "new_name.py")
        self.assertEqual(
            _clean_git_path("regular/path/to/file.py"), "regular/path/to/file.py"
        )

    def test_parse_git_date(self):
        from analyzer.core.ENGINE.helpers import _parse_git_date
        from datetime import datetime

        # Valid standard ISO
        dt = _parse_git_date("2026-06-23T13:33:57+02:00")
        self.assertEqual(dt.year, 2026)
        self.assertEqual(dt.month, 6)

        # Git log date format (with space and no colon in tz)
        dt2 = _parse_git_date("2026-06-23 13:33:57 +0200")
        self.assertEqual(dt2.year, 2026)

        # Empty / None fallback
        dt3 = _parse_git_date("")
        self.assertIsInstance(dt3, datetime)

        # Invalid format fallback
        dt4 = _parse_git_date("not-a-date")
        self.assertIsInstance(dt4, datetime)

    @patch("analyzer.core.ENGINE.helpers.subprocess.run")
    def test_get_tags_info(self, mock_run):
        from analyzer.core.ENGINE.helpers import _get_tags_info
        from unittest.mock import MagicMock

        # Mock git for-each-ref
        mock_each_ref = MagicMock()
        mock_each_ref.returncode = 0
        mock_each_ref.stdout = "v1.0.0|hash123|2026-06-20T10:00:00+00:00\nv1.1.0|hash456|2026-06-21T10:00:00+00:00\n"

        mock_run.return_value = mock_each_ref

        tags = _get_tags_info("/fake/dir", max_releases=2)
        self.assertEqual(len(tags), 2)
        self.assertEqual(tags[0]["name"], "v1.0.0")
        self.assertEqual(tags[0]["hash"], "hash123")
        self.assertEqual(tags[0]["date"], "2026-06-20T10:00:00+00:00")
        self.assertEqual(tags[1]["name"], "v1.1.0")

    @patch("analyzer.core.ENGINE.helpers.subprocess.run")
    def test_get_diff_stats(self, mock_run):
        from analyzer.core.ENGINE.helpers import _get_diff_stats
        from unittest.mock import MagicMock

        # 1. Both insertions and deletions
        mock_res1 = MagicMock()
        mock_res1.returncode = 0
        mock_res1.stdout = " 3 files changed, 24 insertions(+), 12 deletions(-)\n"
        mock_run.return_value = mock_res1
        ins, dels = _get_diff_stats("/fake/dir", "v1.0.0", "v1.1.0")
        self.assertEqual(ins, 24)
        self.assertEqual(dels, 12)

        # 2. Only insertions
        mock_res2 = MagicMock()
        mock_res2.returncode = 0
        mock_res2.stdout = " 1 file changed, 5 insertions(+)\n"
        mock_run.return_value = mock_res2
        ins, dels = _get_diff_stats("/fake/dir", "v1.0.0", "v1.1.0")
        self.assertEqual(ins, 5)
        self.assertEqual(dels, 0)

        # 3. Error code
        mock_res3 = MagicMock()
        mock_res3.returncode = 1
        mock_run.return_value = mock_res3
        ins, dels = _get_diff_stats("/fake/dir", "v1.0.0", "v1.1.0")
        self.assertEqual(ins, 0)
        self.assertEqual(dels, 0)

    @patch("analyzer.core.ENGINE.evolution_analysis._get_diff_stats")
    @patch("analyzer.core.ENGINE.evolution_analysis.subprocess.run")
    def test_run_releases_history(self, mock_run, mock_diff_stats):
        from analyzer.core.ENGINE.evolution_analysis import _run_releases_history
        from datetime import datetime
        from unittest.mock import MagicMock

        mock_diff_stats.return_value = (50, 10)

        # Mock git rev-list --count
        mock_count = MagicMock()
        mock_count.returncode = 0
        mock_count.stdout = "1\n"

        # Mock git parent check (fails, so fallback to empty tree hash)
        mock_parent = MagicMock()
        mock_parent.returncode = 1

        # Mock git log --numstat
        mock_log = MagicMock()
        mock_log.returncode = 0
        mock_log.stdout = (
            "AUTHOR:Alice|2026-06-20T10:00:00+00:00\n10\t5\tfile1.py\n20\t0\tfile2.py\n"
        )

        mock_run.side_effect = [mock_count, mock_parent, mock_log]

        tags = [
            {
                "name": "v1.0.0",
                "hash": "hash123",
                "date": "2026-06-20T10:00:00+00:00",
                "date_obj": datetime(2026, 6, 20),
            }
        ]

        res = _run_releases_history("/fake/dir", tags)
        self.assertEqual(res["total_commits"], 1)
        self.assertEqual(res["timeline"], {"2026-06-20": 1})
        self.assertIn("Alice", res["authors"])
        self.assertEqual(res["file_churn"]["file1.py"], 1)
        self.assertEqual(res["file_lines_added"]["file1.py"], 10)
        self.assertEqual(res["file_lines_deleted"]["file1.py"], 5)
        self.assertEqual(res["file_author_commits"]["file1.py"]["Alice"], 1)

        # Verify commit mock representation
        commit = res["commits"][0]
        self.assertEqual(commit["hash"], "hash123")
        self.assertEqual(commit["author"], "Release")
        self.assertEqual(commit["message"], "Release v1.0.0 (1 commits)")
        self.assertEqual(commit["insertions"], 50)
        self.assertEqual(commit["deletions"], 10)


class LizardOptimizationTestCase(TestCase):
    @patch("analyzer.core.ENGINE.lizard_analysis.lizard.analyze")
    def test_run_lizard_options(self, mock_analyze):
        from analyzer.core.ENGINE.lizard_analysis import _run_lizard

        mock_analyze.return_value = []

        res = _run_lizard("/fake/dir")
        self.assertEqual(res, [])

        mock_analyze.assert_called_once()
        args, kwargs = mock_analyze.call_args
        self.assertEqual(args[0], ["/fake/dir"])
        self.assertIn("exclude_pattern", kwargs)
        self.assertIn("threads", kwargs)
        self.assertIn("*/node_modules/*", kwargs["exclude_pattern"])
