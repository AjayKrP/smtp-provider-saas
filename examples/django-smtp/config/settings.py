"""
Minimal Django settings, trimmed to what this example needs plus the email block.

The email section is the point; everything above it is the smallest configuration that
will start a server.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-only-change-me")
DEBUG = True
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.staticfiles",
    "emails",
]

MIDDLEWARE = [
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "emails" / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {"context_processors": ["django.template.context_processors.request"]},
    }
]

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --------------------------------------------------------------------- email

# During development, this prints messages to the console instead of sending them:
# EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"

EMAIL_HOST = os.environ.get("SMTP_HOST", "smtp.email4vibecoder.com")
EMAIL_PORT = int(os.environ.get("SMTP_PORT", 587))
EMAIL_HOST_USER = os.environ.get("SMTP_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("SMTP_PASS", "")

# Exactly one of these may be true. 587 negotiates STARTTLS after connecting;
# 465 is TLS from the first byte and wants EMAIL_USE_SSL instead.
EMAIL_USE_TLS = EMAIL_PORT == 587
EMAIL_USE_SSL = EMAIL_PORT == 465

# Must be on a domain verified with your provider, or the message is rejected.
DEFAULT_FROM_EMAIL = os.environ.get("MAIL_FROM", "hello@yourdomain.com")

# A slow mail server should not hold a worker open indefinitely.
EMAIL_TIMEOUT = 10
