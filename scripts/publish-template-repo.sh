#!/usr/bin/env bash
# Run locally as Malikkun09 to publish the sanitized template to its own repo.
set -euo pipefail

REPO_OWNER="${REPO_OWNER:-Malikkun09}"
REPO_NAME="${REPO_NAME:-portofoliov5-template}"
EXPORT_BRANCH="${EXPORT_BRANCH:-cursor/portofoliov5-template-export-a405}"
SOURCE_REPO="${SOURCE_REPO:-Malikkun09/portofoliov5}"

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

echo "Cloning export branch from ${SOURCE_REPO}..."
git clone --branch "$EXPORT_BRANCH" --single-branch "https://github.com/${SOURCE_REPO}.git" "$WORKDIR/template"

cd "$WORKDIR/template"

if gh repo view "${REPO_OWNER}/${REPO_NAME}" >/dev/null 2>&1; then
  echo "Repo ${REPO_OWNER}/${REPO_NAME} exists — force-pushing sanitized main."
  git remote add publish "https://github.com/${REPO_OWNER}/${REPO_NAME}.git"
  git push publish HEAD:main --force
else
  echo "Creating ${REPO_OWNER}/${REPO_NAME}..."
  gh repo create "${REPO_OWNER}/${REPO_NAME}" \
    --public \
    --description "Shareable Next.js portfolio template with GSAP motion, WebGL fluid, and multimodal chatbot demo." \
    --source=. \
    --remote=publish \
    --push
fi

echo "Done: https://github.com/${REPO_OWNER}/${REPO_NAME}"
