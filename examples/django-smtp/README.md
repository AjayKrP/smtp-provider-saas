# Send email from Django over SMTP

Django has a mail backend built in, so this example adds no dependencies beyond Django
itself and `python-dotenv`. It works with [Email4VibeCoder](https://email4vibecoder.com)
or any other SMTP server — the settings are the only thing that changes.

## Run it

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then fill in the credentials
python manage.py runserver
```

Open <http://localhost:8000>, enter an address, send.

## The settings

```
SMTP_HOST=smtp.email4vibecoder.com
SMTP_PORT=587
SMTP_USER=<username from the dashboard>
SMTP_PASS=<password from the dashboard>
MAIL_FROM="Your App <hello@yourdomain.com>"
```

Which map onto Django's own names in `config/settings.py`:

```python
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = os.environ["SMTP_HOST"]
EMAIL_PORT = int(os.environ.get("SMTP_PORT", 587))
EMAIL_HOST_USER = os.environ["SMTP_USER"]
EMAIL_HOST_PASSWORD = os.environ["SMTP_PASS"]
EMAIL_USE_TLS = True          # STARTTLS on 587
EMAIL_USE_SSL = False         # set the other way round for port 465
DEFAULT_FROM_EMAIL = os.environ["MAIL_FROM"]
```

`DEFAULT_FROM_EMAIL` must be on a domain verified with your provider — that is what allows
the message to be DKIM-signed, and unverified senders are rejected at SMTP time.

## Things worth knowing

- **`EMAIL_USE_TLS` and `EMAIL_USE_SSL` are mutually exclusive.** Setting both raises an
  error at startup. Port 587 wants `EMAIL_USE_TLS = True`; port 465 wants `EMAIL_USE_SSL`.
- **`send_mail` is synchronous.** It blocks the request while it talks to the mail server.
  For anything user-facing, move it to Celery, django-q or a management command.
- **Local development.** Django ships a console backend that prints mail instead of
  sending it — see the commented line in `settings.py`.
- **Password resets** use the same settings automatically once `DEFAULT_FROM_EMAIL` is set;
  `django.contrib.auth`'s views need no extra configuration.
