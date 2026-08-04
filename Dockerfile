# ── Imagen Base en Python 3.12 (Slim Bookworm - Requerido por Django 6.0+) ──
FROM python:3.12-slim-bookworm

# Evitar la generación de archivos .pyc y forzar salida de logs síncrona
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DEBIAN_FRONTEND=noninteractive \
    PORT=8000

# Instalar paquetes del sistema imprescindibles (Git para Lizard/PyDriller y libpq para PostgreSQL)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Crear usuario sin privilegios root para garantizar la seguridad en producción
RUN groupadd -g 1000 vizzouser && \
    useradd -u 1000 -g vizzouser -m -s /bin/bash vizzouser

# Directorio de trabajo en el contenedor
WORKDIR /app

# Copiar e instalar dependencias de Python (Aprovechamiento de caché de capas de Docker)
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /app/requirements.txt

# Copiar el proyecto Django completo
COPY ViZo /app/ViZo

# Cambiar al directorio del proyecto donde reside manage.py y ajustar permisos para vizzouser
WORKDIR /app/ViZo
RUN mkdir -p /app/ViZo/logs && \
    chown -R vizzouser:vizzouser /app

# Cambiar al usuario no-root vizzouser
USER vizzouser

# Puerto expuesto para el contenedor
EXPOSE 8000

# Comando de inicio: Aplica migraciones, recolecta estáticos (WhiteNoise) y arranca Gunicorn
CMD ["sh", "-c", "python manage.py migrate && python manage.py collectstatic --noinput && gunicorn ViZo.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 120"]
