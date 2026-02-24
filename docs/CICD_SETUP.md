# CI/CD Setup Guide - KPATA AI

Ce guide explique comment configurer le déploiement automatique sur ton VPS via GitHub Actions.

## 📋 Prérequis

- Accès SSH à ton VPS
- Repository GitHub
- Docker et Docker Compose installés sur le VPS

## 🔧 Configuration

### 1. Générer une clé SSH pour GitHub Actions

Sur ton **ordinateur local** :

```bash
# Générer une nouvelle clé SSH (sans passphrase)
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_actions_deploy

# Afficher la clé publique
cat ~/.ssh/github_actions_deploy.pub
```

### 2. Ajouter la clé publique au VPS

Sur ton **VPS** :

```bash
# Se connecter au VPS
ssh ubuntu@ton-vps-ip

# Ajouter la clé publique aux authorized_keys
echo "COLLE_LA_CLE_PUBLIQUE_ICI" >> ~/.ssh/authorized_keys

# Vérifier les permissions
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
```

### 3. Configurer les secrets GitHub

1. Va sur ton repository GitHub
2. **Settings** → **Secrets and variables** → **Actions**
3. Clique sur **New repository secret**
4. Ajoute ces secrets :

| Secret Name | Valeur | Description |
|-------------|--------|-------------|
| `VPS_HOST` | `ton-vps-ip` ou `kpata-ai.online` | IP ou domaine du VPS |
| `VPS_USERNAME` | `ubuntu` | Utilisateur SSH |
| `VPS_SSH_KEY` | Contenu de `~/.ssh/github_actions_deploy` | Clé privée SSH (tout le fichier) |
| `VPS_PORT` | `22` | Port SSH (optionnel, défaut: 22) |

**Pour copier la clé privée :**
```bash
cat ~/.ssh/github_actions_deploy
```

### 4. Préparer le VPS

Sur ton **VPS** :

```bash
# Aller dans le dossier du projet
cd /home/ubuntu/KPATA-AI

# Rendre le script de déploiement exécutable
chmod +x deploy-prod.sh

# Vérifier que .env.production existe
ls -la .env.production

# Tester le script manuellement
./deploy-prod.sh
```

### 5. Tester le déploiement automatique

Sur ton **ordinateur local** :

```bash
# Faire un petit changement
echo "# Test CI/CD" >> README.md

# Commit et push
git add .
git commit -m "test: CI/CD deployment"
git push origin main
```

### 6. Vérifier le déploiement

1. Va sur GitHub → **Actions**
2. Tu devrais voir le workflow "Deploy to Production" en cours
3. Clique dessus pour voir les logs en temps réel
4. Une fois terminé, vérifie que ton application fonctionne

## 🔍 Monitoring

### Voir les logs du workflow

```bash
# Sur GitHub
Repository → Actions → Dernier workflow → Deploy to VPS
```

### Voir les logs des containers

```bash
# Sur le VPS
cd /home/ubuntu/KPATA-AI
docker compose -f docker-compose.prod.yml logs -f
```

## 🛠️ Dépannage

### Le workflow échoue à la connexion SSH

- Vérifie que la clé SSH est correctement configurée
- Vérifie que le port SSH est correct (22 par défaut)
- Vérifie que le firewall autorise la connexion depuis GitHub Actions

### Le déploiement échoue

```bash
# Sur le VPS, vérifier les logs
cd /home/ubuntu/KPATA-AI
docker compose -f docker-compose.prod.yml logs

# Vérifier l'espace disque
df -h

# Vérifier les containers
docker ps -a
```

### Rollback en cas de problème

```bash
# Sur le VPS
cd /home/ubuntu/KPATA-AI

# Revenir au commit précédent
git log --oneline -5
git reset --hard COMMIT_HASH

# Redéployer
./deploy-prod.sh
```

## 🚀 Workflow de déploiement

1. Tu push du code sur `main`
2. GitHub Actions détecte le push
3. Le workflow se connecte au VPS via SSH
4. Git pull du dernier code
5. Exécution de `deploy-prod.sh`
6. Rebuild et restart des containers Docker
7. Vérification de la santé des services

## 📝 Personnalisation

### Déployer sur une autre branche

Modifier `.github/workflows/deploy.yml` :

```yaml
on:
  push:
    branches:
      - main
      - staging  # Ajouter d'autres branches
```

### Ajouter des notifications

Tu peux ajouter des notifications Slack, Discord, ou email en cas de succès/échec.

### Déploiement manuel

Tu peux aussi déclencher le déploiement manuellement :

```yaml
on:
  push:
    branches:
      - main
  workflow_dispatch:  # Ajouter cette ligne
```

Ensuite sur GitHub : **Actions** → **Deploy to Production** → **Run workflow**

## 🔒 Sécurité

- ✅ La clé SSH est stockée dans les secrets GitHub (chiffrés)
- ✅ La clé SSH n'a pas de passphrase (nécessaire pour l'automatisation)
- ✅ La clé SSH est dédiée uniquement au déploiement
- ⚠️ Ne jamais commit la clé privée dans le repository
- ⚠️ Limiter les permissions de la clé SSH si possible

## 📊 Améliorations futures

- [ ] Tests automatiques avant déploiement
- [ ] Déploiement progressif (blue-green deployment)
- [ ] Notifications sur Discord/Slack
- [ ] Backup automatique avant déploiement
- [ ] Health checks après déploiement
- [ ] Rollback automatique en cas d'échec
