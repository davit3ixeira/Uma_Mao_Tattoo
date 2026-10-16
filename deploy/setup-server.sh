#!/usr/bin/env bash
# Prepara o servidor (rodar uma vez só) para receber o site pelo GitHub Actions.
#
# Uso, no servidor:
#   sudo bash setup-server.sh "ssh-ed25519 AAAA... github-deploy-umamao"
#
# O que faz:
#   - cria o usuário "umamao-deploy", que só consegue escrever na pasta do site
#   - cria /var/www/umamaotattoo/{releases,current}
#   - adiciona o bloco do subdomínio no Caddyfile (com backup e validação antes de recarregar)
set -euo pipefail

DOMAIN="umamaotattoo.doe-natal.com.br"
SITE_DIR="/var/www/umamaotattoo"
DEPLOY_USER="umamao-deploy"
CADDYFILE="/etc/caddy/Caddyfile"
SNIPPET="$(dirname "$0")/Caddyfile.umamaotattoo"
PUBKEY="${1:-}"

fail() { echo "ERRO: $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || fail "rode com sudo."
[[ -n "$PUBKEY" ]] || fail "passe a chave pública do deploy como argumento."
[[ -f "$SNIPPET" ]] || fail "não achei $SNIPPET (envie junto com este script)."
[[ -f "$CADDYFILE" ]] || fail "não achei $CADDYFILE. O Caddy está instalado de outro jeito? Ajuste manualmente."
systemctl is-active --quiet caddy || fail "o Caddy não está rodando como serviço systemd. Ajuste manualmente."

if ! command -v rsync >/dev/null; then
  apt-get update -qq && apt-get install -y -qq rsync
fi

# usuário de deploy
if ! id "$DEPLOY_USER" &>/dev/null; then
  useradd --create-home --shell /bin/bash "$DEPLOY_USER"
fi
SSH_DIR="/home/$DEPLOY_USER/.ssh"
AUTH="$SSH_DIR/authorized_keys"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$SSH_DIR"
touch "$AUTH"
grep -qxF "$PUBKEY" "$AUTH" || echo "$PUBKEY" >> "$AUTH"
chown "$DEPLOY_USER:$DEPLOY_USER" "$AUTH"
chmod 600 "$AUTH"

# pastas do site
install -d -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$SITE_DIR" "$SITE_DIR/releases"
if [[ ! -e "$SITE_DIR/current" ]]; then
  install -d -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$SITE_DIR/releases/inicial"
  printf '<!doctype html><meta charset="utf-8"><title>Uma Mão</title><p>Em breve.</p>\n' > "$SITE_DIR/releases/inicial/index.html"
  chown "$DEPLOY_USER:$DEPLOY_USER" "$SITE_DIR/releases/inicial/index.html"
  ln -sfn releases/inicial "$SITE_DIR/current"
  chown -h "$DEPLOY_USER:$DEPLOY_USER" "$SITE_DIR/current"
fi

# bloco do Caddy
if grep -q "^$DOMAIN" "$CADDYFILE"; then
  echo "O Caddyfile já tem o bloco de $DOMAIN, não mexi nele."
else
  BACKUP="$CADDYFILE.bak-$(date +%Y%m%d%H%M%S)"
  cp -a "$CADDYFILE" "$BACKUP"
  { echo; cat "$SNIPPET"; } >> "$CADDYFILE"
  if ! caddy validate --config "$CADDYFILE" --adapter caddyfile; then
    cp -a "$BACKUP" "$CADDYFILE"
    fail "o Caddyfile novo não validou. Restaurei o backup ($BACKUP), nada mudou no ar."
  fi
  systemctl reload caddy
  echo "Bloco adicionado e Caddy recarregado. Backup do anterior: $BACKUP"
fi

echo
echo "Pronto. Falta configurar os secrets no GitHub (veja deploy/README.md)."
