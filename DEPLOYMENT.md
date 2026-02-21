# 🚀 Guide de Déploiement Production - KPATA AI

Guide complet pour déployer KPATA AI sur votre serveur de production.

## 📋 Table des matières

1. [Prérequis](#prérequis)
2. [Préparation du serveur](#préparation-du-serveur)
3. [Configuration](#configuration)
4. [Déploiement](#déploiement)
5. [Configuration Nginx](#configuration-nginx)
6. [SSL avec Let's Encrypt](#ssl-avec-lets-encrypt)
7. [Webhook Paystack](#webhook-paystack)
8. [Monitoring](#monitoring)
9. [Maintenance](#maintenance)

---

## 🔧 Prérequis

### Sur votre serveur de production :
- Ubuntu 20.04+ / Debian 11+ (recommandé)
- 2 CPU minimum
- 4GB RAM minimum (8GB recommandé)
- 20GB d'espace disque
- Accès root (sudo)
- Nom de domaine pointant vers votre serveur

### Services externes nécessaires :
- ✅ Compte Supabase (base de données)
- ✅ Compte Cloudflare R2 (stockage)
- ✅ Compte OpenRouter (IA)
- ✅ Compte Paystack (paiements)

---

## 🖥️ Préparation du serveur

### 1. Connexion SSH

```bash
ssh root@votre-serveur-ip
```

### 2. Installation de Docker

```bash
# Mise à jour du système
apt update && apt upgrade -y

# Installation des dépendances
apt install -y apt-transport-https ca-certificates curl software-properties-common git

# Ajout du repository Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Installation de Docker
apt update
apt install -y docker-ce docker-ce-cli containerd.io

# Vérification
docker --version
```

### 3. Installation de Docker Compose

```bash
# Installation
curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Permissions
chmod +x /usr/local/bin/docker-compose

# Vérification
docker-compose --version
```

### 4. Configuration du firewall

```bash
# Installation UFW (si pas déjà installé)
apt install -y ufw

# Configuration
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS

# Activation
ufw enable
ufw status
```

---

## ⚙️ Configuration

### 1. Cloner le projet

```bash
# Créer le répertoire
mkdir -p /opt/kpata-ai
cd /opt/kpata-ai

# Cloner (remplacez par votre repo)
git clone https://github.com/YOUR_USERNAME/KPATA-AI.git .
```

### 2. Configuration des variables d'environnement

#### API Service

```bash
# Créer le fichier .env.production pour l'API
nano services/api/.env.production
```

Contenu :

```bash
# ===========================================
# KPATA AI - API Production Configuration
# ===========================================

# Server
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Supabase (REQUIRED)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Redis (will be set by docker-compose)
REDIS_URL=redis://:VOTRE_MOT_DE_PASSE@redis:6379

# JWT Authentication (CHANGE THIS!)
JWT_SECRET=GENERATE_SECURE_RANDOM_STRING_HERE
JWT_EXPIRES_IN=7d

# OpenRouter AI API (REQUIRED)
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxx
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# Cloudflare R2 Storage (REQUIRED)
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_PUBLIC_URL=https://your-r2-bucket.r2.dev

# Media Worker
MEDIA_WORKER_URL=https://your-r2-bucket.r2.dev
MEDIA_TOKEN_SECRET=GENERATE_SECURE_RANDOM_STRING_HERE

# Payment Providers (REQUIRED)
PAYSTACK_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxx

# Web App URL (REQUIRED for payment callbacks)
WEB_APP_URL=https://votre-domaine.com

# Telegram Bot (optional)
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_ADMIN_CHAT_ID=your-admin-chat-id

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info

# Dev Auth (MUST be false in production)
ENABLE_DEV_AUTH=false
```

#### Worker Service

```bash
# Créer le fichier .env.production pour le Worker
nano services/worker/.env.production
```

Contenu :

```bash
# ===========================================
# KPATA AI - Worker Production Configuration
# ===========================================

# Environment
NODE_ENV=production

# Supabase (REQUIRED)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# Redis (will be set by docker-compose)
REDIS_URL=redis://:VOTRE_MOT_DE_PASSE@redis:6379

# OpenRouter AI API (REQUIRED)
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxx
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# Cloudflare R2 Storage (REQUIRED)
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=kpata-media
R2_PUBLIC_URL=https://your-r2-bucket.r2.dev

# Telegram Bot (optional)
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_ADMIN_CHAT_ID=your-admin-chat-id

# Worker Configuration
WORKER_CONCURRENCY=5
JOB_TIMEOUT_MS=30000
MAX_RETRIES=3

# Logging
LOG_LEVEL=info
```

### 3. Générer des secrets sécurisés

```bash
# Générer JWT_SECRET
openssl rand -base64 64

# Générer MEDIA_TOKEN_SECRET
openssl rand -base64 64

# Générer REDIS_PASSWORD
openssl rand -base64 32
```

Ajoutez le `REDIS_PASSWORD` dans un fichier `.env` à la racine :

```bash
echo "REDIS_PASSWORD=$(openssl rand -base64 32)" > .env
```

---

## 🚀 Déploiement

### Méthode 1 : Script automatique (recommandé)

```bash
# Rendre le script exécutable
chmod +x deploy.sh

# Lancer le déploiement
sudo ./deploy.sh
```

### Méthode 2 : Commandes manuelles

```bash
# 1. Construire les images
docker-compose -f docker-compose.prod.yml build

# 2. Lancer les services
docker-compose -f docker-compose.prod.yml up -d

# 3. Vérifier le statut
docker-compose -f docker-compose.prod.yml ps

# 4. Voir les logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Lancer avec Telegram Bot

```bash
docker-compose -f docker-compose.prod.yml --profile with-bot up -d
```

---

## 🔒 Configuration Nginx

### 1. Installation

```bash
apt install -y nginx
```

### 2. Configuration

```bash
nano /etc/nginx/sites-available/kpata-ai
```

Contenu :

```nginx
# KPATA AI - Nginx Configuration

upstream api_backend {
    server localhost:3000;
    keepalive 32;
}

server {
    listen 80;
    listen [::]:80;
    server_name votre-domaine.com api.votre-domaine.com;

    # Limite de taille pour uploads
    client_max_body_size 10M;

    # Logs
    access_log /var/log/nginx/kpata-access.log;
    error_log /var/log/nginx/kpata-error.log;

    # Proxy vers l'API
    location / {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        
        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffer
        proxy_buffering on;
        proxy_buffer_size 8k;
        proxy_buffers 16 8k;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://api_backend/health;
        access_log off;
    }

    # Webhook Paystack (important !)
    location /payments/webhook/paystack {
        proxy_pass http://api_backend/payments/webhook/paystack;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. Activation

```bash
# Créer le lien symbolique
ln -s /etc/nginx/sites-available/kpata-ai /etc/nginx/sites-enabled/

# Tester la configuration
nginx -t

# Redémarrer Nginx
systemctl restart nginx
systemctl enable nginx
```

---

## 🔐 SSL avec Let's Encrypt

```bash
# Installation Certbot
apt install -y certbot python3-certbot-nginx

# Génération du certificat
certbot --nginx -d votre-domaine.com -d api.votre-domaine.com

# Vérifier le renouvellement automatique
certbot renew --dry-run
```

---

## 💳 Webhook Paystack

### Configuration dans le Dashboard Paystack

1. Aller sur https://dashboard.paystack.com/#/settings/developer
2. Configurer l'URL du webhook :
   ```
   https://votre-domaine.com/payments/webhook/paystack
   ```
3. Copier la clé secrète et vérifier qu'elle correspond à `PAYSTACK_SECRET_KEY` dans votre `.env.production`

---

## 📊 Monitoring

### Voir les logs en temps réel

```bash
# Tous les services
docker-compose -f docker-compose.prod.yml logs -f

# Service spécifique
docker-compose -f docker-compose.prod.yml logs -f api
docker-compose -f docker-compose.prod.yml logs -f worker
docker-compose -f docker-compose.prod.yml logs -f redis
```

### Statistiques des conteneurs

```bash
docker stats
```

### Espace disque

```bash
# Vérifier l'espace
df -h

# Nettoyer Docker
docker system prune -a --volumes
```

---

## 🔧 Maintenance

### Mise à jour du code

```bash
cd /opt/kpata-ai

# Pull les dernières modifications
git pull origin main

# Redéployer
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

### Backup de Redis

```bash
# Backup manuel
docker exec kpata-redis-prod redis-cli --raw BGSAVE

# Copier le dump
docker cp kpata-redis-prod:/data/dump.rdb ./backup-$(date +%Y%m%d).rdb
```

### Redémarrage des services

```bash
# Redémarrer tout
docker-compose -f docker-compose.prod.yml restart

# Redémarrer un service spécifique
docker-compose -f docker-compose.prod.yml restart api
```

### Arrêt complet

```bash
docker-compose -f docker-compose.prod.yml down
```

---

## 🆘 Dépannage

### Les conteneurs ne démarrent pas

```bash
# Vérifier les logs
docker-compose -f docker-compose.prod.yml logs

# Vérifier le statut
docker-compose -f docker-compose.prod.yml ps
```

### Erreur de connexion à Redis

```bash
# Vérifier que Redis est en cours d'exécution
docker exec kpata-redis-prod redis-cli ping

# Tester avec le mot de passe
docker exec kpata-redis-prod redis-cli -a VOTRE_MOT_DE_PASSE ping
```

### L'API ne répond pas

```bash
# Vérifier les logs de l'API
docker logs kpata-api-prod --tail=100

# Vérifier la santé du conteneur
docker inspect kpata-api-prod | grep -A 5 Health
```

---

## 📞 Support

Pour toute question ou problème, consultez les logs et vérifiez la configuration des variables d'environnement.

**Commandes utiles :**
```bash
# Logs complets
docker-compose -f docker-compose.prod.yml logs -f

# Entrer dans un conteneur
docker exec -it kpata-api-prod sh

# Vérifier les variables d'environnement
docker exec kpata-api-prod env | grep SUPABASE
```
