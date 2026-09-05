#!/usr/bin/env bash
# Configura la protección de main y develop y las opciones de merge del repositorio.
# Idempotente: si un ruleset con el mismo nombre ya existe, lo reemplaza.
#
# Requisitos: gh CLI autenticado (gh auth login) con permisos de administrador sobre el repo.
# Uso:        scripts/github/protect-branches.sh [owner/repo]
set -euo pipefail

REPO="${1:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
echo "Repositorio: $REPO"

ruleset() {
  local name="$1" branch="$2" strict="$3"
  local existing
  existing="$(gh api "repos/$REPO/rulesets" -q ".[] | select(.name == \"$name\") | .id")"
  if [[ -n "$existing" ]]; then
    echo "Reemplazando ruleset '$name' (id $existing)"
    gh api -X DELETE "repos/$REPO/rulesets/$existing" >/dev/null
  fi
  gh api -X POST "repos/$REPO/rulesets" --input - >/dev/null <<JSON
{
  "name": "$name",
  "target": "branch",
  "enforcement": "active",
  "bypass_actors": [],
  "conditions": { "ref_name": { "include": ["refs/heads/$branch"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": true,
        "allowed_merge_methods": ["squash", "merge"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": $strict,
        "do_not_enforce_on_create": false,
        "required_status_checks": [{ "context": "CI" }]
      }
    }
  ]
}
JSON
  echo "Ruleset '$name' aplicado sobre $branch"
}

# main: la rama debe estar al día con la base antes de mezclar (releases, pocas veces).
ruleset "Proteger main" main true
# develop: no se exige estar al día para no frenar los PRs diarios del equipo.
ruleset "Proteger develop" develop false

echo "Opciones de merge y rama por defecto"
gh repo edit "$REPO" \
  --default-branch develop \
  --enable-squash-merge \
  --enable-merge-commit \
  --enable-rebase-merge=false \
  --delete-branch-on-merge \
  --enable-auto-merge

echo "Listo. Verificar en https://github.com/$REPO/settings/rules"
