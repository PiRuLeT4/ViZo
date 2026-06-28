# __init__.py
# -----------
# Exponer la API pública del subpaquete ENGINE.

from .analysis import run_analysis
from .metrics import _process_metrics, _build_repo_summary
from .helpers import (
    _remove_readonly,
    _temp_dir,
    _cleanup,
    _get_clean_git_env,
    _clone_repo,
    _get_head_commit,
    _get_total_commits,
    _clean_git_path,
    _parse_git_date,
    _get_tags_info,
    _get_diff_stats,
)
from .lizard_analysis import _run_lizard
from .evolution_analysis import _run_git_history, _run_releases_history
