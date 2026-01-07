#!/bin/bash

# IoT Telemetry Deployment Script
# Usage: ./deploy.sh [start|stop|restart|logs|status]

set -e

COMPOSE_FILE="docker-compose.production.yml"
PROJECT_NAME="iot-telemetry"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

function print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

function print_error() {
    echo -e "${RED}✗ $1${NC}"
}

function print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

function check_requirements() {
    echo "Checking requirements..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    print_success "Docker installed"
    
    # Check Docker Compose
    if ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not installed"
        exit 1
    fi
    print_success "Docker Compose installed"
    
    # Check .env.production
    if [ ! -f .env.production ]; then
        print_error ".env.production file not found"
        print_warning "Copy env.production.example to .env.production and configure it"
        exit 1
    fi
    print_success ".env.production found"
    
    # Check secrets
    if [ ! -f secrets/certificate.pem.crt ]; then
        print_error "AWS IoT certificate not found: secrets/certificate.pem.crt"
        exit 1
    fi
    
    if [ ! -f secrets/private.pem.key ]; then
        print_error "AWS IoT private key not found: secrets/private.pem.key"
        exit 1
    fi
    
    if [ ! -f secrets/AmazonRootCA1.pem ]; then
        print_warning "Amazon Root CA not found, copying from example..."
        cp secrets/AmazonRootCA1.pem.example secrets/AmazonRootCA1.pem
    fi
    
    if [ ! -f secrets/db_password.txt ]; then
        print_error "Database password not found: secrets/db_password.txt"
        print_warning "Create it with: echo 'your_password' > secrets/db_password.txt"
        exit 1
    fi
    
    print_success "All secrets found"
}

function start() {
    echo "Starting IoT Telemetry services..."
    check_requirements
    
    docker compose -f $COMPOSE_FILE up -d --build
    
    print_success "Services started"
    echo ""
    echo "Access the application at:"
    echo "  - Frontend: http://localhost:80"
    echo "  - API: http://localhost:3002"
    echo "  - Health: http://localhost:3002/health"
    echo ""
    echo "View logs with: ./deploy.sh logs"
}

function stop() {
    echo "Stopping IoT Telemetry services..."
    docker compose -f $COMPOSE_FILE down
    print_success "Services stopped"
}

function restart() {
    echo "Restarting IoT Telemetry services..."
    stop
    start
}

function logs() {
    SERVICE=${2:-}
    if [ -z "$SERVICE" ]; then
        docker compose -f $COMPOSE_FILE logs -f
    else
        docker compose -f $COMPOSE_FILE logs -f $SERVICE
    fi
}

function status() {
    echo "IoT Telemetry Services Status:"
    echo ""
    docker compose -f $COMPOSE_FILE ps
    echo ""
    
    # Check health
    echo "Health Check:"
    if curl -s http://localhost:3002/health > /dev/null 2>&1; then
        print_success "API is healthy"
        curl -s http://localhost:3002/health | jq '.' 2>/dev/null || curl -s http://localhost:3002/health
    else
        print_error "API is not responding"
    fi
}

function backup_db() {
    BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
    echo "Creating database backup: $BACKUP_FILE"
    
    docker exec iot-telemetry-db pg_dump -U iot_user iot_telemetry > $BACKUP_FILE
    
    print_success "Backup created: $BACKUP_FILE"
}

function show_help() {
    echo "IoT Telemetry Deployment Script"
    echo ""
    echo "Usage: ./deploy.sh [command]"
    echo ""
    echo "Commands:"
    echo "  start       Start all services"
    echo "  stop        Stop all services"
    echo "  restart     Restart all services"
    echo "  logs        Show logs (add service name for specific service)"
    echo "  status      Show services status and health"
    echo "  backup      Create database backup"
    echo "  help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./deploy.sh start"
    echo "  ./deploy.sh logs api"
    echo "  ./deploy.sh status"
}

# Main
case "${1:-help}" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    logs)
        logs $@
        ;;
    status)
        status
        ;;
    backup)
        backup_db
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac
