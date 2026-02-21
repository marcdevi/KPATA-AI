# Déploiement de l'Application Web KPATA AI

## 📋 Prérequis

- API déployée et fonctionnelle sur `https://api.kpata-ai.online`
- Accès SSH au serveur
- Docker et Docker Compose installés
- Variables d'environnement Supabase configurées

## 🔧 Configuration

### 1. Variables d'environnement

Créer/éditer le fichier `apps/web/.env.production` sur le serveur :

```bash
NEXT_PUBLIC_API_URL=https://api.kpata-ai.online
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 2. Variables Docker Compose

Ajouter au fichier `.env` à la racine du projet :

```bash
# Web App
NEXT_PUBLIC_API_URL=https://api.kpata-ai.online
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 🚀 Déploiement

### Sur le serveur

```bash
# 1. Aller dans le projet
cd ~/KPATA-AI

# 2. Pull les dernières modifications
git pull origin main

# 3. Mettre à jour les variables d'environnement
nano apps/web/.env.production
# Ou copier depuis .env.example et modifier

# 4. Build l'image Docker de l'app web
sudo docker compose -f docker-compose.prod.yml build web

# 5. Démarrer l'app web
sudo docker compose -f docker-compose.prod.yml up -d web

# 6. Vérifier le statut
sudo docker compose -f docker-compose.prod.yml ps

# 7. Voir les logs
sudo docker compose -f docker-compose.prod.yml logs -f web
```

### Redémarrer tous les services

```bash
# Redémarrer tous les services (API, Worker, Web)
sudo docker compose -f docker-compose.prod.yml restart

# Ou redémarrer uniquement l'app web
sudo docker compose -f docker-compose.prod.yml restart web
```

## 🌐 Configuration Nginx

### Ajouter le reverse proxy pour l'app web

Éditer `/etc/nginx/sites-available/kpata-ai` :

```nginx
# App Web Next.js
server {
    listen 80;
    server_name kpata-ai.online www.kpata-ai.online;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Activer SSL avec Certbot

```bash
# Installer Certbot si pas déjà fait
sudo apt install certbot python3-certbot-nginx -y

# Obtenir le certificat SSL
sudo certbot --nginx -d kpata-ai.online -d www.kpata-ai.online

# Tester le renouvellement automatique
sudo certbot renew --dry-run
```

### Redémarrer Nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 🔍 Vérification

### Vérifier que l'app web fonctionne

```bash
# Test local
curl http://localhost:3001

# Test avec le domaine
curl https://kpata-ai.online
```

### Vérifier les logs

```bash
# Logs de l'app web
sudo docker compose -f docker-compose.prod.yml logs -f web

# Logs de tous les services
sudo docker compose -f docker-compose.prod.yml logs -f
```

### Vérifier les ressources

```bash
# Voir l'utilisation des ressources
sudo docker stats

# Voir les conteneurs en cours d'exécution
sudo docker ps
```

## 🐛 Dépannage

### L'app web ne démarre pas

```bash
# Vérifier les logs
sudo docker compose -f docker-compose.prod.yml logs web

# Vérifier les variables d'environnement
sudo docker compose -f docker-compose.prod.yml config

# Rebuild l'image
sudo docker compose -f docker-compose.prod.yml build --no-cache web
sudo docker compose -f docker-compose.prod.yml up -d web
```

### Erreur de connexion à l'API

Vérifier que `NEXT_PUBLIC_API_URL` pointe vers `https://api.kpata-ai.online` et non `http://localhost:3000`.

### Problème de build

```bash
# Nettoyer les images Docker
sudo docker system prune -a

# Rebuild depuis zéro
sudo docker compose -f docker-compose.prod.yml build --no-cache web
```

## 📊 Monitoring

### Vérifier la santé des services

```bash
# Healthcheck de l'app web
curl http://localhost:3001

# Healthcheck de l'API
curl https://api.kpata-ai.online/health
```

### Logs en temps réel

```bash
# Tous les services
sudo docker compose -f docker-compose.prod.yml logs -f

# Uniquement l'app web
sudo docker compose -f docker-compose.prod.yml logs -f web
```

## 🔄 Mise à jour

```bash
# 1. Pull les modifications
cd ~/KPATA-AI
git pull origin main

# 2. Rebuild et redémarrer
sudo docker compose -f docker-compose.prod.yml build web
sudo docker compose -f docker-compose.prod.yml up -d web

# 3. Vérifier
sudo docker compose -f docker-compose.prod.yml ps
```

## 🎯 URLs de Production

- **App Web**: https://kpata-ai.online
- **API**: https://api.kpata-ai.online
- **API Health**: https://api.kpata-ai.online/health

## 📝 Notes

- L'app web tourne sur le port **3001**
- L'API tourne sur le port **3000**
- Les deux sont derrière Nginx avec SSL
- Les variables `NEXT_PUBLIC_*` sont injectées au moment du build
- Pour changer ces variables, il faut rebuild l'image Docker
