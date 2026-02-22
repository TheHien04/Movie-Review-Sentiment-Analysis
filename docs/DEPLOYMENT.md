# Deployment Guide - Movie Review Sentiment Analysis

## Table of Contents
1. [Local Development](#local-development)
2. [Docker Deployment](#docker-deployment)
3. [Production Deployment](#production-deployment)
4. [Cloud Deployment](#cloud-deployment)
5. [Troubleshooting](#troubleshooting)

---

## Local Development

### Prerequisites
- Python 3.8+
- Node.js 14+ (for frontend development)
- Git

### Setup Steps

1. **Clone Repository**
```bash
git clone https://github.com/TheHien04/Movie-Review-Sentiment-Analysis.git
cd Movie-Review-Sentiment-Analysis
```

2. **Create Virtual Environment**
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install Dependencies**
```bash
pip install -r backend/requirements.txt
```

4. **Configure Environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

5. **Train Model (Optional)**
```bash
python scripts/model_training.py
```

6. **Start Backend**
```bash
cd backend
flask run --port 8000
```

7. **Start Frontend** (in another terminal)
```bash
cd frontend
python3 -m http.server 8080
```

8. **Access Application**
- Frontend: http://localhost:8080
- Backend API: http://localhost:8000

---

## Docker Deployment

### Quick Start with Docker Compose

1. **Build and Start Services**
```bash
docker-compose up -d
```

2. **Check Status**
```bash
docker-compose ps
```

3. **View Logs**
```bash
docker-compose logs -f
```

4. **Stop Services**
```bash
docker-compose down
```

### Manual Docker Build

1. **Build Backend Image**
```bash
docker build -t movie-sentiment-api .
```

2. **Run Backend Container**
```bash
docker run -d \
  --name movie-sentiment-api \
  -p 8000:8000 \
  -v $(pwd)/logs:/app/logs \
  movie-sentiment-api
```

3. **Run Frontend with Nginx**
```bash
docker run -d \
  --name movie-sentiment-frontend \
  -p 8080:80 \
  -v $(pwd)/frontend:/usr/share/nginx/html:ro \
  nginx:alpine
```

### Docker Compose Configuration

Edit `docker-compose.yml` for custom configuration:

```yaml
services:
  backend:
    environment:
      - RATE_LIMIT_PER_MINUTE=100  # Increase rate limit
      - CACHE_DEFAULT_TIMEOUT=600   # 10 minutes cache
      - LOG_LEVEL=DEBUG             # Enable debug logs
```

---

## Production Deployment

### Prerequisites
- Domain name
- SSL certificate
- Reverse proxy (Nginx)
- Process manager (systemd, PM2, or supervisor)

### Backend Production Setup

1. **Install System Dependencies**
```bash
sudo apt-get update
sudo apt-get install -y python3-pip python3-venv nginx
```

2. **Clone and Setup**
```bash
cd /opt
sudo git clone https://github.com/TheHien04/Movie-Review-Sentiment-Analysis.git
cd Movie-Review-Sentiment-Analysis
sudo python3 -m venv venv
sudo ./venv/bin/pip install -r backend/requirements.txt
```

3. **Configure Environment**
```bash
sudo nano .env
```

Set production values:
```env
FLASK_ENV=production
DEBUG=False
LOG_LEVEL=WARNING
SECRET_KEY=your-secret-key-here
RATE_LIMIT_PER_MINUTE=60
CACHE_ENABLED=True
```

4. **Create Systemd Service**
```bash
sudo nano /etc/systemd/system/movie-sentiment-api.service
```

```ini
[Unit]
Description=Movie Sentiment Analysis API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/Movie-Review-Sentiment-Analysis
Environment="PATH=/opt/Movie-Review-Sentiment-Analysis/venv/bin"
ExecStart=/opt/Movie-Review-Sentiment-Analysis/venv/bin/python -m flask run --host=0.0.0.0 --port=8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

5. **Start Service**
```bash
sudo systemctl daemon-reload
sudo systemctl start movie-sentiment-api
sudo systemctl enable movie-sentiment-api
sudo systemctl status movie-sentiment-api
```

### Nginx Configuration

1. **Create Nginx Config**
```bash
sudo nano /etc/nginx/sites-available/movie-sentiment
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Frontend
    location / {
        root /opt/Movie-Review-Sentiment-Analysis/frontend;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:8000/health;
        access_log off;
    }
}
```

2. **Enable Site**
```bash
sudo ln -s /etc/nginx/sites-available/movie-sentiment /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### SSL Certificate with Let's Encrypt

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
sudo certbot renew --dry-run  # Test renewal
```

---

## Cloud Deployment

### AWS EC2

1. **Launch EC2 Instance**
- AMI: Ubuntu 22.04 LTS
- Instance Type: t3.medium (4 GB RAM recommended)
- Security Group: Allow ports 22, 80, 443

2. **Connect and Setup**
```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

Follow [Production Deployment](#production-deployment) steps.

3. **Configure Elastic IP** (optional)
- Allocate and associate Elastic IP for static address

### Google Cloud Platform

1. **Create Compute Engine Instance**
```bash
gcloud compute instances create movie-sentiment \
  --zone=us-central1-a \
  --machine-type=n1-standard-2 \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud
```

2. **Configure Firewall**
```bash
gcloud compute firewall-rules create allow-http --allow tcp:80
gcloud compute firewall-rules create allow-https --allow tcp:443
```

### Heroku

1. **Create Heroku App**
```bash
heroku create movie-sentiment-analysis
```

2. **Add Buildpacks**
```bash
heroku buildpacks:add heroku/python
```

3. **Configure Environment**
```bash
heroku config:set FLASK_ENV=production
heroku config:set SECRET_KEY=your-secret-key
```

4. **Deploy**
```bash
git push heroku main
```

### Docker Hub + Cloud

1. **Push to Docker Hub**
```bash
docker build -t yourusername/movie-sentiment-api .
docker push yourusername/movie-sentiment-api
```

2. **Deploy on Cloud Platform**
```bash
# AWS ECS
aws ecs create-service ...

# Google Cloud Run
gcloud run deploy movie-sentiment-api \
  --image gcr.io/your-project/movie-sentiment-api \
  --platform managed

# Azure Container Instances
az container create ...
```

---

## Monitoring & Maintenance

### Health Checks

```bash
# Check API health
curl http://localhost:8000/health

# Check API metrics
curl http://localhost:8000/api/metrics
```

### Log Management

```bash
# View application logs
tail -f logs/app.log

# View system logs
sudo journalctl -u movie-sentiment-api -f

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Backup

```bash
# Backup model and data
tar -czf backup-$(date +%Y%m%d).tar.gz \
  sentiment_model/ data/ logs/

# Backup to S3
aws s3 cp backup-*.tar.gz s3://your-bucket/backups/
```

### Updates

```bash
# Pull latest changes
cd /opt/Movie-Review-Sentiment-Analysis
sudo git pull origin main

# Restart service
sudo systemctl restart movie-sentiment-api
```

---

## Troubleshooting

### Common Issues

**Issue: Port already in use**
```bash
# Find process using port
lsof -i :8000
# Kill process
kill -9 <PID>
```

**Issue: Model not loading**
```bash
# Check model directory
ls -la sentiment_model/
# Retrain model
python scripts/model_training.py
```

**Issue: Permission denied**
```bash
# Fix permissions
sudo chown -R www-data:www-data /opt/Movie-Review-Sentiment-Analysis
sudo chmod -R 755 /opt/Movie-Review-Sentiment-Analysis
```

**Issue: High memory usage**
```bash
# Monitor memory
free -h
# Restart service
sudo systemctl restart movie-sentiment-api
```

### Performance Tuning

**Increase Workers (Gunicorn)**
```bash
# Install Gunicorn
pip install gunicorn

# Run with multiple workers
gunicorn -w 4 -b 0.0.0.0:8000 backend.app:app
```

**Enable Caching**
```env
CACHE_ENABLED=True
CACHE_TYPE=redis
CACHE_DEFAULT_TIMEOUT=600
```

**Database Connection Pooling**
```python
# If using database
SQLALCHEMY_POOL_SIZE=10
SQLALCHEMY_MAX_OVERFLOW=20
```

---

## Security Checklist

- [ ] Change default SECRET_KEY
- [ ] Enable HTTPS with valid SSL certificate
- [ ] Configure firewall (UFW)
- [ ] Set up rate limiting
- [ ] Enable CORS only for trusted domains
- [ ] Regular security updates
- [ ] Backup sensitive data
- [ ] Monitor logs for suspicious activity
- [ ] Use environment variables for secrets
- [ ] Implement authentication (if needed)

---

## Support

For deployment issues:
- GitHub Issues: https://github.com/TheHien04/Movie-Review-Sentiment-Analysis/issues
- Email: support@example.com

---

**Last Updated:** February 2026  
**Version:** 3.0
