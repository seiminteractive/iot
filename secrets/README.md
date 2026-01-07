# IoT Telemetry Secrets

Este directorio contiene los certificados y credenciales sensibles necesarios para el proyecto.

## Archivos requeridos:

### 1. AWS IoT Core Certificates

Descarga estos archivos desde AWS IoT Core Console:

- `certificate.pem.crt` - Certificado del dispositivo
- `private.pem.key` - Llave privada del certificado
- `AmazonRootCA1.pem` - Certificado raíz de Amazon

#### Cómo obtener los certificados:

1. Ve a AWS IoT Core Console
2. Security → Certificates
3. Create certificate
4. Descarga:
   - Device certificate (certificate.pem.crt)
   - Private key (private.pem.key)
   - Root CA certificate (AmazonRootCA1.pem)
4. Activa el certificado
5. Adjunta una policy que permita:
   - `iot:Connect`
   - `iot:Subscribe`
   - `iot:Receive`
   - `iot:Publish`

### 2. Database Password

Crea el archivo `db_password.txt` con la contraseña de PostgreSQL:

```bash
echo "tu_password_seguro_aqui" > db_password.txt
```

## ⚠️ IMPORTANTE

- **NUNCA** commitees estos archivos a Git
- Mantén backups seguros de los certificados
- Los certificados son únicos y no se pueden re-descargar
- Si pierdes la llave privada, deberás generar nuevos certificados

## Permisos

Asegúrate de que los archivos tengan los permisos correctos:

```bash
chmod 600 *.pem.key
chmod 644 *.pem.crt
chmod 644 AmazonRootCA1.pem
chmod 600 db_password.txt
```
