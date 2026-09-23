"""A form that sends one test message, and nothing else."""

from django.core.mail import send_mail
from django.shortcuts import redirect, render
from django.contrib import messages
from smtplib import SMTPException


def index(request):
    return render(request, "index.html")


def send(request):
    if request.method != "POST":
        return redirect("index")

    recipient = request.POST.get("to", "").strip()
    if "@" not in recipient:
        messages.error(request, "Enter a valid email address.")
        return redirect("index")

    try:
        send_mail(
            subject="Hello from Django",
            message="This message was sent over plain SMTP from a Django view.",
            from_email=None,  # falls back to DEFAULT_FROM_EMAIL
            recipient_list=[recipient],
            html_message="<p>This message was sent over plain SMTP from a Django view.</p>",
            # Let failures raise so they can be reported rather than silently dropped.
            fail_silently=False,
        )
    except SMTPException as exc:
        # The SMTP reply says exactly what was wrong — log it, show something friendlier.
        print(f"send failed: {exc}")
        messages.error(request, "Could not send the message. Check the server logs.")
        return redirect("index")

    messages.success(request, f"Sent to {recipient}.")
    return redirect("index")
