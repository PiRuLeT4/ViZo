import os
from cryptography.fernet import Fernet
from django.db import models
from django.conf import settings


class EncryptedCharField(models.CharField):
    """Campo que cifra/descifra automáticamente usando Fernet."""

    def __init__(self, *args, **kwargs):
        kwargs["max_length"] = kwargs.get("max_length", 500)
        super().__init__(*args, **kwargs)

    def _get_fernet(self):
        key = getattr(settings, "FIELD_ENCRYPTION_KEY", None) or os.getenv("FIELD_ENCRYPTION_KEY")
        if not key:
            raise ValueError("FIELD_ENCRYPTION_KEY no está configurada")
        return Fernet(key.encode() if isinstance(key, str) else key)

    def get_prep_value(self, value):
        value = super().get_prep_value(value)
        if value and not value.startswith("gAAAAA"):
            value = self._get_fernet().encrypt(value.encode()).decode()
        return value

    def from_db_value(self, value, expression, connection):
        if value and value.startswith("gAAAAA"):
            try:
                value = self._get_fernet().decrypt(value.encode()).decode()
            except Exception:
                pass
        return value
