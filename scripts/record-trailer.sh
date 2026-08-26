#!/usr/bin/env bash
# Documenta (e opcionalmente executa) a captura do material bruto do trailer com Chrome + ffmpeg no macOS.
# NÃO precisa ser executado para gerar a loja; é um roteiro técnico. Leia antes de rodar.
#
# Requisitos:
#   brew install ffmpeg
#   Google Chrome instalado
#   Permissão de "Gravação de Tela" para o Terminal em Ajustes > Privacidade e Segurança
#   Para capturar o áudio do jogo: BlackHole 2ch (brew install blackhole-2ch) e um
#   Dispositivo Agregado/Multi-Saída no "Configuração de Áudio MIDI" com fones + BlackHole.
#
# Uso:
#   scripts/record-trailer.sh              # só imprime os passos
#   scripts/record-trailer.sh --run 360    # grava 360 s (6 min) em store/trailer-raw/
set -euo pipefail
cd "$(dirname "$0")/.."

URL="http://localhost:8080/"            # servir web/ localmente (abaixo) ou usar https://allbele.github.io/lago-quieto/
OUT_DIR="store/trailer-raw"
DUR="${2:-360}"
W=1920; H=1080

cat <<TXT
== Passos de gravação ==
1) Servir o jogo local (evita cache/rede):     python3 -m http.server 8080 -d web
2) Abrir o Chrome em janela dedicada 1920x1080, sem UI, sem extensões:
     open -na "Google Chrome" --args --new-window --app="$URL" --window-size=$W,$H --window-position=0,0 \\
        --disable-extensions --autoplay-policy=no-user-gesture-required --force-device-scale-factor=1
   (modo --app remove barra de endereço; pressione Ctrl+Cmd+F para tela cheia se preferir.)
3) Descobrir índices de tela/áudio do avfoundation:
     ffmpeg -f avfoundation -list_devices true -i ""
   Anote o índice da tela ("Capture screen 0") e do BlackHole 2ch.
4) Gravar tela + áudio (troque 1 e 0 pelos índices anotados):
     ffmpeg -f avfoundation -framerate 60 -capture_cursor 1 -capture_mouse_clicks 0 \\
        -i "1:0" -t $DUR -vf "crop=$W:$H:0:0" \\
        -c:v libx264 -preset veryfast -crf 16 -pix_fmt yuv420p \\
        -c:a pcm_s16le $OUT_DIR/bruto.mov
   Áudio separado para edição:
     ffmpeg -i $OUT_DIR/bruto.mov -vn -c:a pcm_s16le $OUT_DIR/bruto.wav
5) Roteiro de cliques (novo save; apague localStorage "lagoquieto" antes):
     0:05  1 clique no centro | 0:10  1 clique | 0:20  5 cliques em arco, 0,6 s entre eles
     depois deixe parado ~4 min até a lua/lírios/aurora; 2 cliques a cada 30 s para o sapo/peixe.
6) Temas (Steam build ou flag de dev): repita 20 s para Inverno e Tinta -> tema-inverno.mov / tema-tinta.mov
7) Montagem conforme store/trailer-roteiro.md. Export final:
     ffmpeg -i trailer.mov -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart trailer-1080p.mp4
   Steam aceita MP4 H.264 até 1920x1080 (30 ou 60 fps), e ainda pede uma thumbnail 1920x1080 (usar frame 0:28).
TXT

if [[ "${1:-}" == "--run" ]]; then
  mkdir -p "$OUT_DIR"
  command -v ffmpeg >/dev/null || { echo "ffmpeg não encontrado (brew install ffmpeg)"; exit 1; }
  python3 -m http.server 8080 -d web >/dev/null 2>&1 &
  SERVER=$!
  trap 'kill $SERVER 2>/dev/null || true' EXIT
  sleep 1
  open -na "Google Chrome" --args --new-window --app="$URL" --window-size=$W,$H --window-position=0,0 \
    --disable-extensions --autoplay-policy=no-user-gesture-required --force-device-scale-factor=1
  echo "Chrome aberto. A gravação começa em 5 s (Ctrl+C para cancelar)..."; sleep 5
  # Ajuste "1:0" aos índices listados por: ffmpeg -f avfoundation -list_devices true -i ""
  ffmpeg -f avfoundation -framerate 60 -capture_cursor 1 -i "1:0" -t "$DUR" -vf "crop=$W:$H:0:0" \
    -c:v libx264 -preset veryfast -crf 16 -pix_fmt yuv420p -c:a pcm_s16le "$OUT_DIR/bruto.mov"
  ffmpeg -y -i "$OUT_DIR/bruto.mov" -vn -c:a pcm_s16le "$OUT_DIR/bruto.wav"
  echo "Gravado em $OUT_DIR/"
fi
