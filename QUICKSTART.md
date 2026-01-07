# ⚡ Quick Start Guide

Guía rápida para poner en marcha el proyecto en 10 minutos.

## 🎯 Requisitos Mínimos

- VPS con Ubuntu 22.04
- Docker y Docker Compose instalados
- Certificados AWS IoT Core descargados
- Subdominio configurado

## 🚀 Deployment en 5 Pasos

### 1️⃣ Clonar el proyecto

```bash
cd /srv/apps
git clone <tu-repo> iot-telemetry
cd iot-telemetry
```

### 2️⃣ Configurar certificados

```bash
# Copiar tus certificados AWS IoT
cp ~/Downloads/*-certificate.pem.crt secrets/certificate.pem.crt
cp ~/Downloads/*-private.pem.key secrets/private.pem.key
cp secrets/AmazonRootCA1.pem.example secrets/AmazonRootCA1.pem

# Crear password de DB
echo "iot_$(openssl rand -hex 16)" > secrets/db_password.txt

# Permisos
chmod 600 secrets/*.key secrets/db_password.txt
chmod 644 secrets/*.crt secrets/*.pem
```

### 3️⃣ Configurar variables de entorno

```bash
cp env.production.example .env.production
nano .env.production
```

Cambiar:
- `DB_PASSWORD` (usar el valor de `secrets/db_password.txt`)
- `AWS_IOT_ENDPOINT` (tu endpoint de AWS IoT)
- `AWS_IOT_CLIENT_ID` (debe coincidir con el Thing creado en AWS)
- `CORS_ORIGIN` (tu dominio)

### 4️⃣ Configurar Nginx y SSL

```bash
# Crear config de Nginx
sudo nano /etc/nginx/sites-available/testingiot.seiminteractive.io
```

Pegar:

```nginx
server {
    listen 80;
    server_name testingiot.seiminteractive.io;
    location / {
        proxy_pass http://localhost:80;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Activar:

```bash
sudo ln -s /etc/nginx/sites-available/testingiot.seiminteractive.io /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# SSL con Certbot
sudo certbot --nginx -d testingiot.seiminteractive.io
```

### 5️⃣ Levantar servicios

```bash
chmod +x deploy.sh
./deploy.sh start
```

## ✅ Verificar

```bash
# Ver estado
./deploy.sh status

# Health check
curl https://testingiot.seiminteractive.io/health

# Ver logs
./deploy.sh logs
```

## 🧪 Enviar datos de prueba

Desde AWS IoT Console → Test → MQTT test client:

**Topic:** `factory/home/plc-test/telemetry`

**Message:**
```json
{
  "temperature": 25.5,
  "pressure": 101.3,
  "motorOn": true
}
```

Click **Publish** y verás el evento en el dashboard web en tiempo real!

## 📚 Documentación Completa

- **README.md** - Documentación técnica completa
- **DEPLOYMENT.md** - Guía detallada paso a paso
- **secrets/README.md** - Info sobre certificados

## 🆘 Problemas Comunes

### MQTT no conecta

```bash
# Verificar certificados
ls -la secrets/

# Ver logs
docker logs iot-telemetry-api | grep -i mqtt
```

### Frontend no carga

```bash
# Verificar que todos los servicios estén corriendo
docker ps

# Ver logs del frontend
docker logs iot-telemetry-frontend
```

### Base de datos no inicia

```bash
# Ver logs
docker logs iot-telemetry-db

# Verificar password
cat secrets/db_password.txt
cat .env.production | grep DB_PASSWORD
```

## 📞 Comandos Útiles

```bash
./deploy.sh start      # Iniciar todo
./deploy.sh stop       # Detener todo
./deploy.sh restart    # Reiniciar
./deploy.sh logs       # Ver logs
./deploy.sh logs api   # Logs del API
./deploy.sh status     # Estado de servicios
./deploy.sh backup     # Backup de DB
```

## 🎉 ¡Listo!

Tu sistema está corriendo en:
- **Dashboard:** https://testingiot.seiminteractive.io
- **API:** https://testingiot.seiminteractive.io/api/*
- **Health:** https://testingiot.seiminteractive.io/health

---

**Tiempo estimado:** 10-15 minutos ⏱️
