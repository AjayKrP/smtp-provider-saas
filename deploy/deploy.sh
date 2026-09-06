#!/usr/bin/env bash
# Change-based blue/green deploy for the smtp-provider-saas stack.
#
# Only rebuilds and cuts over the services whose own source actually changed
# between the last deploy and HEAD. Each of the four buildable services has a
# different cutover mechanism because they're reached differently:
#   - api: nothing publishes a host port for real traffic - dashboard's own
#     nginx resolves the "smtpsaas-api" alias dynamically per request (see
#     deploy/dashboard-nginx.conf), so cutover just moves that alias.
#   - dashboard: the host's nginx proxies to a fixed 127.0.0.1:port with no
#     dynamic resolution, so cutover moves an included nginx snippet instead
#     (same pattern as ajaykrp.me).
#   - worker: nothing calls it by name or port at all - just build, confirm
#     it logged a clean startup, then stop the old one. BullMQ is designed
#     for multiple concurrent consumers, so briefly running old+new together
#     is safe (see DEPLOYMENT.md 8) and lets in-flight jobs finish.
#   - smtp-ingress: the one exception that cannot be a true overlapping
#     cutover, because only one container can ever hold host ports 587/465.
#     The new image is validated first in an unpublished throwaway container,
#     then there's a brief stop-old/start-new swap - SMTP senders retry on a
#     refused connection, so a few seconds here is the industry-normal
#     tradeoff, not a bug.
#
# Run from the repo root on the server, after the target commit has already
# been checked out (the GitHub Actions workflow does `git reset --hard` then
# calls this script).
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

# GitHub Actions' own `concurrency:` guard only serializes runs it triggers
# against each other - it does nothing to stop a manual SSH session (or any
# other trigger) from racing a CI-triggered run. Learned this the hard way on
# the ondc-project-prod deploy script this pipeline is modeled on: a manual
# run and an automatic CI run executed concurrently and left a stale network
# alias on a dead container. flock makes a second concurrent invocation exit
# immediately instead of racing.
LOCK_FILE="/tmp/smtp-provider-saas-deploy.lock"
exec 200>"$LOCK_FILE"
if ! flock -n 200; then
    echo "==> Another deploy is already running against this repo - exiting without making changes."
    exit 1
fi

COMPOSE_FILE="docker-compose.prod.yml"
STATE_DIR="$REPO_DIR/deploy/state"
mkdir -p "$STATE_DIR"
LAST_SHA_FILE="$STATE_DIR/last_deployed_sha"
NETWORK="mynet"
NGINX_SNIPPET="/etc/nginx/snippets/smtpsaas_active_dashboard.conf"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-60}"
HEALTH_INTERVAL=2

# 127.0.0.1, not localhost: these images resolve "localhost" to ::1 first,
# and the api/dashboard servers only listen on IPv4 - confirmed the hard way
# on the ondc-project deploy script this is modeled on (an nginx-based health
# check using "localhost" always got "Connection refused" there).
API_HEALTH_CMD="node -e \"fetch('http://127.0.0.1:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""
DASHBOARD_HEALTH_CMD='wget -q -O- http://127.0.0.1:80/'

NEW_SHA="$(git rev-parse HEAD)"

if [[ -f "$LAST_SHA_FILE" ]]; then
    OLD_SHA="$(cat "$LAST_SHA_FILE")"
    CHANGED_FILES="$(git diff --name-only "$OLD_SHA" "$NEW_SHA" || true)"
    echo "==> Diffing $OLD_SHA..$NEW_SHA"
else
    echo "==> No prior deploy recorded on this server - treating this as a first-time deploy of every service."
    CHANGED_FILES="$(git ls-files)"
fi

echo "==> Changed paths:"
echo "$CHANGED_FILES" | sed 's/^/    /'

path_changed() {
    # A pipe into `grep -q` would race `pipefail` on a large input (grep exits
    # on first match while the writer can still be mid-write, causing a
    # SIGPIPE that pipefail turns into a false failure) - hit this for real on
    # the ondc-project deploy script. A here-string has no live pipe to race.
    grep -q "^$1" <<< "$CHANGED_FILES"
}

# The Dockerfile COPYs packages/shared and the root lockfile/tsconfigs into
# EVERY one of api/dashboard/smtp-ingress/worker's build, so a change to any
# of those needs to redeploy all four, not just one.
REDEPLOY_ALL=false
for shared_prefix in "docker-compose.prod.yml" "Dockerfile" "package.json" "package-lock.json" \
    "tsconfig.base.json" "tsconfig.json" "packages/shared/"; do
    if path_changed "$shared_prefix"; then
        echo "==> $shared_prefix changed - it's a build input for every service, redeploying all of them."
        REDEPLOY_ALL=true
        break
    fi
done

DEPLOYED_ANY=false
FAILED_ANY=false

# deploy_alias_service <alias> <blue-service> <green-service> <blue-container> <green-container> <health-check-shell-command>
# For services reached by other containers purely through a Docker network
# alias (api) - no host port involved in the real traffic path.
deploy_alias_service() {
    local alias="$1" blue_service="$2" green_service="$3" blue_container="$4" green_container="$5" health_cmd="$6"
    local state_file="$STATE_DIR/${alias}.slot"
    local current="none"
    [[ -f "$state_file" ]] && current="$(cat "$state_file")"

    local target_slot target_service target_container old_service old_container
    if [[ "$current" == "blue" ]]; then
        target_slot="green"; target_service="$green_service"; target_container="$green_container"
        old_service="$blue_service"; old_container="$blue_container"
    else
        target_slot="blue"; target_service="$blue_service"; target_container="$blue_container"
        old_service="$green_service"; old_container="$green_container"
    fi

    echo "==> [$alias] current=$current -> deploying $target_slot ($target_container)"
    docker compose -f "$COMPOSE_FILE" build "$target_service"
    docker compose -f "$COMPOSE_FILE" up -d --no-deps "$target_service"

    echo "==> [$alias] waiting up to ${HEALTH_TIMEOUT}s for $target_container to report healthy"
    local elapsed=0 healthy=false
    while [[ "$elapsed" -lt "$HEALTH_TIMEOUT" ]]; do
        if docker exec "$target_container" sh -c "$health_cmd" > /dev/null 2>&1; then
            healthy=true
            break
        fi
        sleep "$HEALTH_INTERVAL"
        elapsed=$((elapsed + HEALTH_INTERVAL))
    done

    if [[ "$healthy" != "true" ]]; then
        echo "==> [$alias] FAILED: $target_container did not become healthy within ${HEALTH_TIMEOUT}s"
        echo "==> [$alias] leaving old slot ($current) live. Logs from the failed container:"
        docker logs --tail 80 "$target_container" || true
        docker compose -f "$COMPOSE_FILE" stop "$target_service" || true
        FAILED_ANY=true
        return
    fi

    echo "==> [$alias] $target_container is healthy - cutting over alias '$alias'"
    if docker network inspect "$NETWORK" -f '{{range .Containers}}{{.Name}} {{end}}' 2>/dev/null | grep -qw "$target_container"; then
        docker network disconnect "$NETWORK" "$target_container"
    fi
    docker network connect --alias "$alias" "$NETWORK" "$target_container"

    echo "$target_slot" > "$state_file"
    echo "==> [$alias] traffic switched to $target_slot. Stopping old slot ($old_container)."
    docker compose -f "$COMPOSE_FILE" stop "$old_service" || true
    # Stopping a container does not remove its network alias registration -
    # confirmed live on the ondc-project deploy script that a stopped old
    # slot can keep claiming the alias forever, and a share of requests can
    # then resolve to a dead container.
    docker network disconnect "$NETWORK" "$old_container" 2>/dev/null || true
    DEPLOYED_ANY=true
}

# Dashboard is reached through the host's own nginx at a fixed 127.0.0.1:port
# (no dynamic resolution there, unlike dashboard's own proxy to api), so
# cutover moves an included nginx snippet instead of a network alias.
deploy_dashboard() {
    local blue_service="dashboard-blue" green_service="dashboard-green"
    local blue_container="smtpsaas_dashboard_blue" green_container="smtpsaas_dashboard_green"
    local blue_port=5175 green_port=5176
    local state_file="$STATE_DIR/dashboard.slot"
    local current="none"
    [[ -f "$state_file" ]] && current="$(cat "$state_file")"

    local target_slot target_service target_container target_port old_service old_container
    if [[ "$current" == "blue" ]]; then
        target_slot="green"; target_service="$green_service"; target_container="$green_container"; target_port="$green_port"
        old_service="$blue_service"; old_container="$blue_container"
    else
        target_slot="blue"; target_service="$blue_service"; target_container="$blue_container"; target_port="$blue_port"
        old_service="$green_service"; old_container="$green_container"
    fi

    echo "==> [dashboard] current=$current -> deploying $target_slot ($target_container, port $target_port)"
    docker compose -f "$COMPOSE_FILE" build "$target_service"
    docker compose -f "$COMPOSE_FILE" up -d --no-deps "$target_service"

    echo "==> [dashboard] waiting up to ${HEALTH_TIMEOUT}s for $target_container to report healthy"
    local elapsed=0 healthy=false
    while [[ "$elapsed" -lt "$HEALTH_TIMEOUT" ]]; do
        if docker exec "$target_container" sh -c "$DASHBOARD_HEALTH_CMD" > /dev/null 2>&1; then
            healthy=true
            break
        fi
        sleep "$HEALTH_INTERVAL"
        elapsed=$((elapsed + HEALTH_INTERVAL))
    done

    if [[ "$healthy" != "true" ]]; then
        echo "==> [dashboard] FAILED: $target_container did not become healthy within ${HEALTH_TIMEOUT}s"
        docker logs --tail 80 "$target_container" || true
        docker compose -f "$COMPOSE_FILE" stop "$target_service" || true
        FAILED_ANY=true
        return
    fi

    echo "==> [dashboard] healthy - pointing host nginx at port $target_port"
    echo "proxy_pass http://127.0.0.1:${target_port};" > "$NGINX_SNIPPET"
    nginx -t
    systemctl reload nginx

    echo "$target_slot" > "$state_file"
    echo "==> [dashboard] traffic switched to $target_slot. Stopping old slot ($old_container)."
    docker compose -f "$COMPOSE_FILE" stop "$old_service" || true
    DEPLOYED_ANY=true
}

# Worker has no HTTP endpoint, no host port, and nothing calls it by network
# alias - the only thing to check is that it actually logged a clean startup
# instead of crashing on a bad Mongo/Redis connection.
deploy_worker() {
    local blue_service="worker-blue" green_service="worker-green"
    local blue_container="smtpsaas_worker_blue" green_container="smtpsaas_worker_green"
    local state_file="$STATE_DIR/worker.slot"
    local current="none"
    [[ -f "$state_file" ]] && current="$(cat "$state_file")"

    local target_slot target_service target_container old_service old_container
    if [[ "$current" == "blue" ]]; then
        target_slot="green"; target_service="$green_service"; target_container="$green_container"
        old_service="$blue_service"; old_container="$blue_container"
    else
        target_slot="blue"; target_service="$blue_service"; target_container="$blue_container"
        old_service="$green_service"; old_container="$green_container"
    fi

    echo "==> [worker] current=$current -> deploying $target_slot ($target_container)"
    docker compose -f "$COMPOSE_FILE" build "$target_service"
    docker compose -f "$COMPOSE_FILE" up -d --no-deps "$target_service"

    echo "==> [worker] waiting up to ${HEALTH_TIMEOUT}s for $target_container to log a clean startup"
    local elapsed=0 healthy=false
    while [[ "$elapsed" -lt "$HEALTH_TIMEOUT" ]]; do
        if docker logs "$target_container" 2>&1 | grep -q "delivery worker started" \
            && [[ "$(docker inspect -f '{{.State.Running}}' "$target_container" 2>/dev/null)" == "true" ]]; then
            healthy=true
            break
        fi
        sleep "$HEALTH_INTERVAL"
        elapsed=$((elapsed + HEALTH_INTERVAL))
    done

    if [[ "$healthy" != "true" ]]; then
        echo "==> [worker] FAILED: $target_container never logged a clean startup within ${HEALTH_TIMEOUT}s"
        docker logs --tail 80 "$target_container" || true
        docker compose -f "$COMPOSE_FILE" stop "$target_service" || true
        FAILED_ANY=true
        return
    fi

    echo "$target_slot" > "$state_file"
    # BullMQ workers are designed to scale horizontally with multiple
    # concurrent consumers (DEPLOYMENT.md 8), so briefly running old+new
    # together here is safe and lets in-flight jobs finish instead of being
    # interrupted mid-delivery.
    echo "==> [worker] $target_container healthy. Stopping old slot ($old_container)."
    docker compose -f "$COMPOSE_FILE" stop "$old_service" || true
    DEPLOYED_ANY=true
}

# smtp-ingress publishes 587/465 directly to the internet, and only one
# container can ever hold those ports - true overlapping blue/green is not
# possible here. Validate the built image first in an unpublished throwaway
# container (it binds its ports inside its own network namespace regardless
# of whether they're published to the host, so this exercises the real
# startup path including cert loading), then do the shortest possible
# stop-old/start-new swap.
deploy_smtp_ingress() {
    local blue_service="smtp-ingress-blue" green_service="smtp-ingress-green"
    local blue_container="smtpsaas_ingress_blue" green_container="smtpsaas_ingress_green"
    local state_file="$STATE_DIR/smtp-ingress.slot"
    local current="none"
    [[ -f "$state_file" ]] && current="$(cat "$state_file")"

    local target_slot target_service target_container old_service old_container
    if [[ "$current" == "blue" ]]; then
        target_slot="green"; target_service="$green_service"; target_container="$green_container"
        old_service="$blue_service"; old_container="$blue_container"
    else
        target_slot="blue"; target_service="$blue_service"; target_container="$blue_container"
        old_service="$green_service"; old_container="$green_container"
    fi

    echo "==> [smtp-ingress] current=$current -> deploying $target_slot ($target_container)"
    docker compose -f "$COMPOSE_FILE" build "$target_service"
    local image
    image="$(docker compose -f "$COMPOSE_FILE" config --images "$target_service")"

    local validate_name="smtp_ingress_validate_$$"
    docker rm -f "$validate_name" > /dev/null 2>&1 || true
    docker run -d --name "$validate_name" --network "$NETWORK" \
        --env-file .env.production \
        -e SMTP_SUBMISSION_PORT=587 -e SMTP_TLS_PORT=465 \
        -e SMTP_TLS_CERT_PATH=/certs/fullchain.pem -e SMTP_TLS_KEY_PATH=/certs/privkey.pem \
        -v "$REPO_DIR/certs:/certs:ro" \
        "$image" > /dev/null

    echo "==> [smtp-ingress] validating new image in an unpublished container (up to ${HEALTH_TIMEOUT}s)"
    local elapsed=0 validated=false
    while [[ "$elapsed" -lt "$HEALTH_TIMEOUT" ]]; do
        if docker logs "$validate_name" 2>&1 | grep -q "smtp submission" \
            && docker logs "$validate_name" 2>&1 | grep -q "smtp implicit-TLS" \
            && [[ "$(docker inspect -f '{{.State.Running}}' "$validate_name" 2>/dev/null)" == "true" ]]; then
            validated=true
            break
        fi
        sleep "$HEALTH_INTERVAL"
        elapsed=$((elapsed + HEALTH_INTERVAL))
    done

    if [[ "$validated" != "true" ]]; then
        echo "==> [smtp-ingress] FAILED: new image never came up cleanly. Logs:"
        docker logs --tail 80 "$validate_name" || true
        docker rm -f "$validate_name" > /dev/null 2>&1 || true
        FAILED_ANY=true
        return
    fi
    docker rm -f "$validate_name" > /dev/null 2>&1 || true

    echo "==> [smtp-ingress] new image validated - swapping public ports now (brief gap; SMTP clients retry on refused connections)"
    docker compose -f "$COMPOSE_FILE" stop "$old_service" || true
    docker compose -f "$COMPOSE_FILE" up -d --no-deps "$target_service"

    sleep 3
    if [[ "$(docker inspect -f '{{.State.Running}}' "$target_container" 2>/dev/null)" != "true" ]]; then
        echo "==> [smtp-ingress] FAILED after the swap - rolling back to $current immediately"
        docker logs --tail 80 "$target_container" || true
        docker compose -f "$COMPOSE_FILE" stop "$target_service" || true
        docker compose -f "$COMPOSE_FILE" up -d --no-deps "$old_service"
        FAILED_ANY=true
        return
    fi

    echo "$target_slot" > "$state_file"
    echo "==> [smtp-ingress] traffic switched to $target_slot."
    DEPLOYED_ANY=true
}

if [[ "$REDEPLOY_ALL" == "true" ]] || path_changed "apps/api/"; then
    deploy_alias_service "smtpsaas-api" "api-blue" "api-green" \
        "smtpsaas_api_blue" "smtpsaas_api_green" "$API_HEALTH_CMD"
fi

if [[ "$REDEPLOY_ALL" == "true" ]] || path_changed "apps/dashboard/" || path_changed "deploy/dashboard-nginx.conf"; then
    deploy_dashboard
fi

if [[ "$REDEPLOY_ALL" == "true" ]] || path_changed "apps/smtp-ingress/"; then
    deploy_smtp_ingress
fi

if [[ "$REDEPLOY_ALL" == "true" ]] || path_changed "apps/worker/"; then
    deploy_worker
fi

# deploy/nginx-smtp.ajaykrp.me.conf is a reference copy - the live installed
# file at /etc/nginx/sites-enabled/ has been rewritten by certbot to add the
# TLS server block, so overwriting it automatically would destroy that.
# Flag it for manual reconciliation instead.
if path_changed "deploy/nginx-smtp.ajaykrp.me.conf"; then
    echo "==> deploy/nginx-smtp.ajaykrp.me.conf changed - this is a reference copy only (certbot has since rewritten the live file with the TLS block). Reconcile /etc/nginx/sites-enabled/smtp.ajaykrp.me.conf by hand."
fi

if [[ "$DEPLOYED_ANY" == "false" && "$FAILED_ANY" == "false" ]]; then
    echo "==> No deployable changes detected. Nothing to do."
fi

# Only advance the "last deployed" marker on a fully clean run, so a failed
# service's change gets retried on the next push instead of silently
# dropping out of the diff once something else changes.
if [[ "$FAILED_ANY" == "false" ]]; then
    echo "$NEW_SHA" > "$LAST_SHA_FILE"
fi

# Same rationale as the other two projects on this shared host: this Docker
# daemon runs several unrelated projects and had 44GB of reclaimable build
# cache accumulate with nothing ever pruning it.
echo "==> Pruning dangling images and capping build cache"
docker image prune -f || true
docker builder prune -f --keep-storage 5GB || true

if [[ "$FAILED_ANY" == "true" ]]; then
    echo "==> Deploy run finished WITH FAILURES - see above."
    exit 1
fi

echo "==> Deploy run complete."
