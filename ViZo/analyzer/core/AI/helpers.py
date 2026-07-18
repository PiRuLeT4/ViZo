# helpers.py
# ----------
# Módulo fachada para re-exportar constantes y lógica de validación de IA
# de forma retrocompatible.

from .defaults import (
    DEFAULT_AI_CONFIG,
    _VALID_COMPONENTS,
    _VALID_DATASETS,
    _DEFAULT_MAPPINGS,
    _DEFAULT_MAPPINGS_BY_DATASET,
    _DEFAULT_DATASETS,
)
from .validator import (
    _extract_summary_and_json,
    _validate_and_fix_config,
)
