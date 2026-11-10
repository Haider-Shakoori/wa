# Worker 02 deployment gate (standard standby, never enterprise)
#
# Do not run against the active API's mounted dist directory.
# This document is intentionally a gate, not an auto-deployment.
#
# 1. Build the PR branch into a SEPARATE directory/container. Verify the
#    compiled worker-heartbeat-authorization module is present.
# 2. Verify existing worker heartbeat and session command auth against the
#    candidate API using a TEST database and test credentials. Never extract
#    or copy production WORKER_DISPATCH_SECRET.
# 3. Apply migration 055 to a staging PostgreSQL clone and verify existing
#    relaywa_worker_heartbeats and whatsapp_sessions remain unchanged.
# 4. Provision relaywa-worker-02 with a dedicated token; store the env file
#    outside the repository with mode 0600. Never print it in CI/logs.
# 5. Deploy the candidate API only after a health check and rollback image
#    are ready. No in-place writes to /home/devagent/relaywa-data/migration/
#    current-source/apps/api/dist while its container is running.
# 6. Start only docker-compose.worker02-standby.yml. Do not mount WhatsApp
#    auth directories or give it access to command endpoints.
# 7. Verify Worker 02 is listed with zero sessions, the original worker
#    remains healthy, and the existing WhatsApp sessions are unchanged.
# 8. Revoke the Worker 02 token and stop ONLY relaywa-worker-02 on failure.
#
# Stop conditions:
# - Candidate API does not compile or cannot authenticate existing workers.
# - Standby token is accepted on a command/session endpoint.
# - Platform session ownership changes or current worker heartbeat stops.
# - Standby worker cannot reach an authenticated HTTPS heartbeat route.
