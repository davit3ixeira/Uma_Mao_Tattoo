# Deploy · umamaotattoo.doe-natal.com.br

O site é publicado automaticamente a cada push na `main` que mexa em `index.html` ou `assets/`.
O workflow está em `.github/workflows/deploy.yml`. Ele envia uma versão nova para
`/var/www/umamaotattoo/releases/<data>-<commit>` e troca o link `current` de uma vez,
então nunca fica um site pela metade no ar. O Caddy, que já atende o doe-natal, serve o
subdomínio e cuida do HTTPS sozinho.

## Configuração (uma vez só)

Rode no Git Bash, na raiz do projeto. Troque `CHAVE_LIGHTSAIL.pem` pelo caminho da chave
que você usa para entrar na instância (a padrão da AWS é `LightsailDefaultKey-sa-east-1.pem`).

### 1. Gerar a chave que o GitHub vai usar

```bash
ssh-keygen -t ed25519 -C "github-deploy-umamao" -f ~/.ssh/umamao_deploy -N ""
```

### 2. Preparar o servidor

```bash
scp -i CHAVE_LIGHTSAIL.pem deploy/setup-server.sh deploy/Caddyfile.umamaotattoo ubuntu@54.94.141.39:/tmp/
ssh -i CHAVE_LIGHTSAIL.pem ubuntu@54.94.141.39 "sudo bash /tmp/setup-server.sh '$(cat ~/.ssh/umamao_deploy.pub)'"
```

O script cria o usuário `umamao-deploy` (que só escreve na pasta do site), a pasta
`/var/www/umamaotattoo` e adiciona o bloco do subdomínio no `/etc/caddy/Caddyfile`.
Antes de recarregar o Caddy ele faz backup e valida a configuração: se algo der errado,
restaura o arquivo anterior e o doe-natal continua igual.

### 3. Cadastrar os secrets no GitHub

Em **Settings → Secrets and variables → Actions → New repository secret**:

| Nome | Valor |
| --- | --- |
| `DEPLOY_HOST` | `54.94.141.39` |
| `DEPLOY_USER` | `umamao-deploy` |
| `DEPLOY_SSH_KEY` | o conteúdo inteiro de `~/.ssh/umamao_deploy` (a chave **privada**) |
| `DEPLOY_KNOWN_HOSTS` | a saída de `ssh-keyscan -t ed25519 54.94.141.39` |

Ou, com o GitHub CLI:

```bash
gh secret set DEPLOY_HOST -b "54.94.141.39"
gh secret set DEPLOY_USER -b "umamao-deploy"
gh secret set DEPLOY_SSH_KEY < ~/.ssh/umamao_deploy
ssh-keyscan -t ed25519 54.94.141.39 | gh secret set DEPLOY_KNOWN_HOSTS
```

### 4. Publicar

Faça push na `main`. Para rodar sem push: aba **Actions → Deploy produção → Run workflow**.

## Voltar uma versão

```bash
ssh -i CHAVE_LIGHTSAIL.pem ubuntu@54.94.141.39
cd /var/www/umamaotattoo && ls -1t releases/
sudo -u umamao-deploy sh -c 'ln -sfn releases/NOME_DA_VERSAO current.tmp && mv -Tf current.tmp current'
```

O servidor guarda as 5 versões mais recentes.
