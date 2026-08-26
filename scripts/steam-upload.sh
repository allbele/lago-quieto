#!/usr/bin/env bash
# Lago Quieto — envia a build para o Steam via steamcmd (SteamPipe).
# Uso:  STEAM_BUILD_USER=usuario_de_build ./scripts/steam-upload.sh [--preview] [--set-live beta]
# Pré-requisitos (feitos pelo USUÁRIO, ver scripts/steam/CHECKLIST-STEAMWORKS.md):
#   - steam/steam_appid.txt com o App ID real
#   - placeholders <APPID>/<DEPOTID_*> preenchidos nos .vdf em scripts/steam/
#   - conteúdo empacotado em steam/dist/{windows,macos,linux}/
#   - usuário de build com Steam Guard (na 1ª execução o steamcmd pede o código; depois fica em cache)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VDF_DIR="$ROOT/scripts/steam"
APPID_FILE="$ROOT/steam/steam_appid.txt"
DIST="$ROOT/steam/dist"

erro(){ echo "ERRO: $*" >&2; exit 1; }

# --- opções -------------------------------------------------------------
PREVIEW=0; SETLIVE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --preview) PREVIEW=1 ;;
    --set-live) shift; SETLIVE="${1:-}" ;;
    *) erro "opção desconhecida: $1" ;;
  esac; shift
done

# --- App ID -------------------------------------------------------------
[ -f "$APPID_FILE" ] || erro "arquivo $APPID_FILE não existe. Crie-o com o App ID do Steamworks."
APPID="$(tr -d '[:space:]' < "$APPID_FILE")"
[[ "$APPID" =~ ^[0-9]+$ ]] || erro "steam/steam_appid.txt contém '$APPID' — substitua pelo App ID numérico (placeholder <APPID> não foi preenchido)."

# --- placeholders nos VDF -------------------------------------------------
if grep -v "^[[:space:]]*//" "$VDF_DIR"/*.vdf | grep -qE "<(APPID|DEPOTID_[A-Z]+)>" >/dev/null 2>&1; then
  echo "Placeholders ainda presentes:" >&2
  grep -nE "<(APPID|DEPOTID_[A-Z]+)>" "$VDF_DIR"/*.vdf | grep -v ":[[:space:]]*//" >&2
  erro "preencha <APPID> e <DEPOTID_WINDOWS|MACOS|LINUX> em scripts/steam/*.vdf (passo 6 do CHECKLIST-STEAMWORKS.md)."
fi
grep -q "\"AppID\"[[:space:]]*\"$APPID\"" "$VDF_DIR/app_build.vdf" \
  || erro "AppID em app_build.vdf difere de steam/steam_appid.txt ($APPID)."

# --- conteúdo -------------------------------------------------------------
for p in windows macos linux; do
  [ -d "$DIST/$p" ] && [ -n "$(ls -A "$DIST/$p")" ] || erro "steam/dist/$p/ está vazio — empacote a build antes de enviar."
done

# --- credenciais ----------------------------------------------------------
[ -n "${STEAM_BUILD_USER:-}" ] || erro "defina STEAM_BUILD_USER (usuário de build criado no Steamworks)."

# --- steamcmd -------------------------------------------------------------
if ! command -v steamcmd >/dev/null 2>&1; then
  echo "steamcmd não encontrado; instalando..."
  if [ "$(uname)" = "Darwin" ] && command -v brew >/dev/null 2>&1; then
    brew install --cask steamcmd
  else
    # download oficial (Linux/macOS sem brew)
    SC_DIR="$HOME/steamcmd"; mkdir -p "$SC_DIR"
    if [ "$(uname)" = "Darwin" ]; then
      curl -sSL https://steamcdn-a.akamaihd.net/client/installer/steamcmd_osx.tar.gz | tar -xz -C "$SC_DIR"
    else
      curl -sSL https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz | tar -xz -C "$SC_DIR"
    fi
    export PATH="$SC_DIR:$PATH"
  fi
  command -v steamcmd >/dev/null 2>&1 || erro "falha ao instalar steamcmd."
fi

# --- ajustes opcionais no VDF (cópia temporária, não altera o original) -----
TMP_VDF="$(mktemp -t app_build.XXXXXX.vdf)"
cp "$VDF_DIR/app_build.vdf" "$TMP_VDF"
[ "$PREVIEW" = 1 ] && sed -i.bak -E 's/("Preview"[[:space:]]*")0(")/\11\2/' "$TMP_VDF"
[ -n "$SETLIVE" ] && sed -i.bak -E "s/(\"SetLive\"[[:space:]]*\")[^\"]*(\")/\1$SETLIVE\2/" "$TMP_VDF"
# caminhos relativos do VDF são resolvidos a partir da cópia temporária → apontar de forma absoluta
sed -i.bak -E "s#\"\.\./\.\./steam/#\"$ROOT/steam/#g; s#\"depot_build_#\"$VDF_DIR/depot_build_#g" "$TMP_VDF"
rm -f "$TMP_VDF.bak"

echo "Enviando App $APPID como $STEAM_BUILD_USER (preview=$PREVIEW, set_live='${SETLIVE:-nenhuma}')..."
# A senha é pedida interativamente pelo steamcmd (ou use STEAM_BUILD_PASSWORD).
if [ -n "${STEAM_BUILD_PASSWORD:-}" ]; then
  steamcmd +login "$STEAM_BUILD_USER" "$STEAM_BUILD_PASSWORD" +run_app_build "$TMP_VDF" +quit
else
  steamcmd +login "$STEAM_BUILD_USER" +run_app_build "$TMP_VDF" +quit
fi
rm -f "$TMP_VDF"
echo "OK. Verifique em https://partner.steamgames.com/apps/builds/$APPID e defina a branch (default/beta)."
