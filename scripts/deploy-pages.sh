#!/usr/bin/env bash
# Publica a pasta web/ no GitHub Pages (repo allbele/lago-quieto, branch main, pasta /web).
set -euo pipefail
cd "$(dirname "$0")/.."
REPO="allbele/lago-quieto"
git init -q 2>/dev/null || true
git add -A
git commit -q -m "${1:-Atualiza Lago Quieto}" || echo "nada a commitar"
if ! gh repo view "$REPO" >/dev/null 2>&1; then
  gh repo create "$REPO" --public --source=. --remote=origin --push --description "Lago Quieto — jogue uma pedra, o lago faz o resto. Clicker zen sem texto."
else
  git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$REPO.git"
  git branch -M main
  git push -u origin main
fi
# Ativa Pages servindo /web da branch main
gh api -X POST "repos/$REPO/pages" -f 'source[branch]=main' -f 'source[path]=/' >/dev/null 2>&1 \
  || gh api -X PUT "repos/$REPO/pages" -f 'source[branch]=main' -f 'source[path]=/' >/dev/null
echo "Pages: https://allbele.github.io/lago-quieto/"
