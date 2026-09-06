#!/usr/bin/env bash
# Copy the Let's Encrypt cert for the SMTP hostname somewhere the smtp-ingress
# container's unprivileged `node` user (uid 1000) can read it. /etc/letsencrypt/live
# and /archive are 0700 root, so a read-only bind mount of them is not enough.
#
# Installed as a certbot deploy hook so renewals propagate:
#   /etc/letsencrypt/renewal-hooks/deploy/smtp-saas-certs.sh
set -euo pipefail

DOMAIN="${SMTP_CERT_DOMAIN:-smtp.ajaykrp.me}"
DEST="${SMTP_CERT_DEST:-/opt/smtp-provider-saas/certs}"
SRC="/etc/letsencrypt/live/${DOMAIN}"

[ -d "$SRC" ] || { echo "no cert at $SRC" >&2; exit 1; }

# `install -o 1000` is rejected when no host user owns that uid, so chown separately.
mkdir -p "$DEST"
install -m 0644 "$SRC/fullchain.pem" "$DEST/fullchain.pem"
install -m 0640 "$SRC/privkey.pem"   "$DEST/privkey.pem"
chown 1000:1000 "$DEST" "$DEST/fullchain.pem" "$DEST/privkey.pem"
chmod 0750 "$DEST"

echo "synced $DOMAIN cert to $DEST"

# Restart the ingress so it picks up the renewed pair (it reads the PEMs at boot).
if command -v docker >/dev/null && docker inspect smtpsaas-ingress >/dev/null 2>&1; then
  docker restart smtpsaas-ingress >/dev/null && echo "restarted smtpsaas-ingress"
fi
