#!/bin/bash

# Deployment Drift Detection - Prevents runtime errors from undeployed function changes
# Usage: ./scripts/check-deploy-drift.sh [--ci]
# Exit: 0 = no drift, 1 = drift detected

CI_MODE=false
[[ "$1" == "--ci" ]] && CI_MODE=true

PROJECT_ID="eregi-8fc1e"

# Files that must be deployed together with hosting
WATCH_FILES=("functions/src/" "firestore.rules" "firestore.indexes.json")

echo "🔍 Checking deployment drift..."

# Find last hosting deploy commit (dist/ or .firebase/ changed)
LAST_DEPLOY_COMMIT=$(git log --all --format="%H" -- dist/ .firebase/ 2>/dev/null | head -1)

if [[ -z "$LAST_DEPLOY_COMMIT" ]]; then
  LAST_DEPLOY_COMMIT="HEAD~10"
  echo "⚠️  No deploy commit found, using HEAD~10 as fallback"
fi

COMMIT_DATE=$(git log -1 --format="%ar" "$LAST_DEPLOY_COMMIT" 2>/dev/null || echo "unknown")
COMMIT_SHORT=$(git rev-parse --short "$LAST_DEPLOY_COMMIT" 2>/dev/null || echo "unknown")

echo "Last deploy commit: $COMMIT_SHORT ($COMMIT_DATE)"
echo ""

CHANGED_FILES=$(git diff --name-only "$LAST_DEPLOY_COMMIT" HEAD -- "${WATCH_FILES[@]}" 2>/dev/null)

if [[ -z "$CHANGED_FILES" ]]; then
  if [[ "$CI_MODE" == true ]]; then
    echo '{"drift":false,"files":[]}'
  else
    echo "✅ No drift detected - backend is in sync with last deploy"
  fi
  exit 0
fi

if [[ "$CI_MODE" == true ]]; then
  FILES_ARRAY=$(echo "$CHANGED_FILES" | jq -R -s -c 'split("\n") | map(select(length > 0))')
  echo "{\"drift\":true,\"files\":$FILES_ARRAY}"
else
  echo "⚠️  DRIFT DETECTED! The following files changed since last deploy:"
  echo ""
  echo "$CHANGED_FILES" | while read -r file; do
    echo "  - $file"
  done
  echo ""
  echo "Run the following to sync:"
  echo "  cd functions && npm run build && cd .."
  echo "  firebase deploy --only functions --project $PROJECT_ID"
  echo "  firebase deploy --only firestore:rules --project $PROJECT_ID"
fi
exit 1
