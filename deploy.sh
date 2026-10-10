#!/usr/bin/env bash
# Сборка и выкладка демо на GitHub Pages (ветка gh-pages).
set -euo pipefail
cd "$(dirname "$0")"
BASE=/tektonika/ ORIGIN=https://daviddavidso.github.io NOINDEX=1 node build.mjs
cd dist
rm -rf .git
git init -q
git checkout -q -b gh-pages
git add -A
git commit -q -m "Deploy $(date '+%Y-%m-%d %H:%M')"
export GIT_TERMINAL_PROMPT=0
git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push -q -f https://github.com/Daviddavidso/tektonika.git gh-pages:gh-pages
rm -rf .git
echo "Выложено: https://daviddavidso.github.io/tektonika/"
