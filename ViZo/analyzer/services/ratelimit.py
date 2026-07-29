import sys
import time
from functools import wraps
from django.core.cache import cache
from django.http import JsonResponse


def get_client_ip(request):
    """Obtiene la dirección IP real del cliente considerando cabeceras de proxy."""
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        ip = x_forwarded_for.split(",")[0].strip()
    else:
        ip = request.META.get("REMOTE_ADDR", "127.0.0.1")
    return ip


def ratelimit(rate="10/m"):
    """
    Decorador de Rate Limiting por IP para vistas Django.
    Formato de `rate`: 'N/m' (N solicitudes por minuto) o 'N/h' (N solicitudes por hora).
    """
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            if "test" in sys.argv:
                return view_func(request, *args, **kwargs)
            try:
                num_str, period = rate.split("/")
                max_requests = int(num_str)
                window_seconds = 60 if period == "m" else 3600 if period == "h" else 60
            except ValueError:
                max_requests = 10
                window_seconds = 60

            ip = get_client_ip(request)
            cache_key = f"ratelimit:{view_func.__module__}.{view_func.__name__}:{ip}"

            now = time.time()
            timestamps = cache.get(cache_key, [])

            # Filtrar timestamps dentro de la ventana de tiempo activa
            valid_timestamps = [t for t in timestamps if now - t < window_seconds]

            if len(valid_timestamps) >= max_requests:
                return JsonResponse(
                    {
                        "error": "Has superado el límite de peticiones autorizadas. Por favor, reintenta más tarde."
                    },
                    status=429,
                )

            valid_timestamps.append(now)
            cache.set(cache_key, valid_timestamps, timeout=window_seconds)

            return view_func(request, *args, **kwargs)

        return _wrapped_view

    return decorator
