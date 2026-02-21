# 🚀 Déploiement Rapide - KPATA AI

Guide ultra-rapide pour déployer KPATA AI en production.

## ⚡ Installation Rapide (Copier-Coller)

### 1. Connexion au serveur

```bash
ssh root@VOTRE_IP_SERVEUR
```

### 2. Installation automatique

```bash
# Installation Docker + Docker Compose + Git
curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh
curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
apt install -y git ufw

# Configuration Firewall
ufw allow ssh && ufw allow 80/tcp && ufw allow 443/tcp && echo "y" | ufw enable
```

### 3. Cloner le projet

```bash
mkdir -p /opt/kpata-ai && cd /opt/kpata-ai
git clone https://github.com/YOUR_USERNAME/KPATA-AI.git .
```

### 4. Configuration des fichiers .env

```bash
# Copier les exemples
cp services/api/.env.example services/api/.env.production
cp services/worker/.env.example services/worker/.env.production

# Générer les secrets
openssl rand -base64 64  # Pour JWT_SECRET
openssl rand -base64 64  # Pour MEDIA_TOKEN_SECRET
openssl rand -base64 32  # Pour REDIS_PASSWORD

# Éditer les fichiers .env.production
nano services/api/.env.production
nano services/worker/.env.production

# Créer .env à la racine avec REDIS_PASSWORD
echo "REDIS_PASSWORD=$(openssl rand -base64 32)" > .env
```

### 5. Déploiement

```bash
# Méthode automatique (recommandée)
chmod +x deploy.sh
./deploy.sh

# OU méthode manuelle
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

### 6. Installation Nginx + SSL

```bash
# Installation
apt install -y nginx certbot python3-certbot-nginx

# Configuration Nginx
cat > /etc/nginx/sites-available/kpata-ai << 'EOF'
upstream api_backend {
    server localhost:3000;
    keepalive 32;
}

server {
    listen 80;
    server_name VOTRE_DOMAINE.com;
    
    client_max_body_size 10M;
    
    location / {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
    }
    
    location /payments/webhook/paystack {
        proxy_pass http://api_backend/payments/webhook/paystack;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

# Activation
ln -s /etc/nginx/sites-available/kpata-ai /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx

# SSL automatique
certbot --nginx -d VOTRE_DOMAINE.com
```

---

## 📋 Variables d'environnement OBLIGATOIRES

### API (.env.production)

```bash
# OBLIGATOIRES
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
JWT_SECRET=GENERATE_64_CHAR_STRING
OPENROUTER_API_KEY=sk-or-v1-xxx
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_PUBLIC_URL=https://xxx.r2.dev
PAYSTACK_SECRET_KEY=sk_live_xxx
WEB_APP_URL=https://VOTRE_DOMAINE.com
MEDIA_TOKEN_SECRET=GENERATE_64_CHAR_STRING

# Redis (auto-configuré par docker-compose)
REDIS_URL=redis://:PASSWORD@redis:6379
```

### Worker (.env.production)

```bash
# OBLIGATOIRES
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJxxx...
OPENROUTER_API_KEY=sk-or-v1-xxx
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=kpata-media
R2_PUBLIC_URL=https://xxx.r2.dev

# Redis (auto-configuré par docker-compose)
REDIS_URL=redis://:PASSWORD@redis:6379
```

---

## 🔍 Vérification

```bash
# Statut des conteneurs
docker-compose -f docker-compose.prod.yml ps

# Logs en temps réel
docker-compose -f docker-compose.prod.yml logs -f

# Test API
curl http://localhost:3000/health

# Stats ressources
docker stats
```

---

## 🔧 Commandes Utiles

```bash
# Redémarrage
docker-compose -f docker-compose.prod.yml restart

# Arrêt
docker-compose -f docker-compose.prod.yml down

# Mise à jour du code
cd /opt/kpata-ai
git pull origin main
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

# Voir les logs d'un service spécifique
docker-compose -f docker-compose.prod.yml logs -f api
docker-compose -f docker-compose.prod.yml logs -f worker

# Entrer dans un conteneur
docker exec -it kpata-api-prod sh
docker exec -it kpata-worker-prod sh

# Backup Redis
docker exec kpata-redis-prod redis-cli --raw BGSAVE
docker cp kpata-redis-prod:/data/dump.rdb ./backup-$(date +%Y%m%d).rdb

# Nettoyer Docker
docker system prune -a --volumes
```

---

## 💳 Configuration Paystack

1. Dashboard Paystack : https://dashboard.paystack.com/#/settings/developer
2. Webhook URL : `https://VOTRE_DOMAINE.com/payments/webhook/paystack`
3. Copier la clé secrète dans `PAYSTACK_SECRET_KEY`

---

## 🐛 Dépannage Express

```bash
# Conteneur ne démarre pas
docker-compose -f docker-compose.prod.yml logs api

# Erreur Redis
docker exec kpata-redis-prod redis-cli -a VOTRE_PASSWORD ping

# Vérifier les variables d'env
docker exec kpata-api-prod env | grep SUPABASE

# Rebuild complet
docker-compose -f docker-compose.prod.yml down -v
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

---

## 📊 Monitoring Production

```bash
# Installer ctop (Docker monitoring UI)
wget https://github.com/bcicen/ctop/releases/download/v0.7.7/ctop-0.7.7-linux-amd64 -O /usr/local/bin/ctop
chmod +x /usr/local/bin/ctop
ctop  # Lance l'interface

# Logs Nginx
tail -f /var/log/nginx/kpata-access.log
tail -f /var/log/nginx/kpata-error.log

# Espace disque
df -h
du -sh /var/lib/docker
```

---

## ✅ Checklist Avant Production

- [ ] Variables d'environnement configurées
- [ ] Secrets générés (JWT_SECRET, MEDIA_TOKEN_SECRET, REDIS_PASSWORD)
- [ ] Clés API valides (Supabase, OpenRouter, R2, Paystack)
- [ ] Nom de domaine configuré (DNS A record)
- [ ] SSL installé (Let's Encrypt)
- [ ] Webhook Paystack configuré
- [ ] Firewall activé (UFW)
- [ ] Nginx configuré
- [ ] Backups planifiés

---

## 🔐 Sécurité

```bash
# Changer le port SSH (optionnel mais recommandé)
nano /etc/ssh/sshd_config  # Modifier Port 22 → Port 2222
systemctl restart sshd
ufw allow 2222/tcp

# Désactiver l'authentification par mot de passe (utiliser clés SSH)
nano /etc/ssh/sshd_config  # PasswordAuthentication no
systemctl restart sshd

# Fail2ban (protection brute force)
apt install -y fail2ban
systemctl enable fail2ban
```

---

## 📞 Support

**Documentation complète :** Voir `DEPLOYMENT.md`

**Architecture :**
- API : Port 3000 (Express + TypeScript)
- Worker : BullMQ job processor
- Redis : Port 6379 (queue + cache)
- Web App : Next.js (déployé séparément)

**Stack :**
- Docker + Docker Compose
- Node.js 20 Alpine
- PostgreSQL (Supabase)
- Redis 7
- Cloudflare R2
- OpenRouter AI
