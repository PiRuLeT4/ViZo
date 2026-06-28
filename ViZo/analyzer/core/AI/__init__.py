# __init__.py
# -----------
# Exponer la API pública del subpaquete AI.

from .ai import get_ai_config, get_ai_explanation, get_offline_explanation, client, AI_MODEL
from .helpers import _extract_summary_and_json, _validate_and_fix_config
