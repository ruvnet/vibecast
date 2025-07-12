#!/bin/bash
"""
Production Monitoring Deployment Script
Deploys the complete monitoring infrastructure for VibeCast
"""

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONITORING_ROOT="/workspaces/vibecast/monitoring"
LOG_DIR="/var/log/vibecast"
SERVICE_DIR="/etc/systemd/system"
CONFIG_DIR="/etc/vibecast/monitoring"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC} $1"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root"
        exit 1
    fi
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        error "Python 3 is required but not installed"
        exit 1
    fi
    
    # Check pip
    if ! command -v pip3 &> /dev/null; then
        error "pip3 is required but not installed"
        exit 1
    fi
    
    # Check NVIDIA drivers
    if ! command -v nvidia-smi &> /dev/null; then
        warn "nvidia-smi not found - GPU monitoring may not work"
    fi
    
    # Check systemd
    if ! command -v systemctl &> /dev/null; then
        error "systemd is required but not found"
        exit 1
    fi
    
    log "Prerequisites check completed"
}

# Install Python dependencies
install_dependencies() {
    log "Installing Python dependencies..."
    
    # Create requirements file
    cat > /tmp/monitoring_requirements.txt << EOF
psutil>=5.8.0
pynvml>=11.4.1
numpy>=1.21.0
pandas>=1.3.0
matplotlib>=3.4.0
seaborn>=0.11.0
prometheus-client>=0.14.0
requests>=2.25.0
pyyaml>=5.4.0
cupy-cuda11x>=10.0.0
EOF
    
    pip3 install -r /tmp/monitoring_requirements.txt
    
    log "Python dependencies installed"
}

# Create directories
create_directories() {
    log "Creating directory structure..."
    
    # Create log directories
    mkdir -p "$LOG_DIR"
    mkdir -p "$LOG_DIR/memory_leak_reports"
    mkdir -p "$LOG_DIR/performance_alerts"
    mkdir -p "$LOG_DIR/multi_gpu_alerts"
    
    # Create config directories
    mkdir -p "$CONFIG_DIR"
    
    # Create runtime directories
    mkdir -p /var/run/vibecast
    mkdir -p /var/lib/vibecast/monitoring
    
    # Set permissions
    chown -R vibecast:vibecast "$LOG_DIR" 2>/dev/null || true
    chown -R vibecast:vibecast /var/run/vibecast 2>/dev/null || true
    chown -R vibecast:vibecast /var/lib/vibecast 2>/dev/null || true
    
    log "Directory structure created"
}

# Install configuration files
install_configs() {
    log "Installing configuration files..."
    
    # Copy main configuration
    cp "$MONITORING_ROOT/config/production_monitor.yaml" "$CONFIG_DIR/"
    
    # Set permissions
    chmod 644 "$CONFIG_DIR/production_monitor.yaml"
    
    log "Configuration files installed"
}

# Create systemd service files
create_services() {
    log "Creating systemd service files..."
    
    # GPU Metrics Collector Service
    cat > "$SERVICE_DIR/vibecast-gpu-metrics.service" << EOF
[Unit]
Description=VibeCast GPU Metrics Collector
After=network.target
Wants=network.target

[Service]
Type=simple
User=vibecast
Group=vibecast
WorkingDirectory=$MONITORING_ROOT/scripts
ExecStart=/usr/bin/python3 $MONITORING_ROOT/scripts/gpu_metrics_collector.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment=PYTHONPATH=$MONITORING_ROOT/scripts

[Install]
WantedBy=multi-user.target
EOF

    # Memory Leak Detector Service
    cat > "$SERVICE_DIR/vibecast-memory-leak.service" << EOF
[Unit]
Description=VibeCast Memory Leak Detector
After=network.target
Wants=network.target

[Service]
Type=simple
User=vibecast
Group=vibecast
WorkingDirectory=$MONITORING_ROOT/scripts
ExecStart=/usr/bin/python3 $MONITORING_ROOT/scripts/memory_leak_detector.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment=PYTHONPATH=$MONITORING_ROOT/scripts

[Install]
WantedBy=multi-user.target
EOF

    # Kernel Performance Tracker Service
    cat > "$SERVICE_DIR/vibecast-kernel-perf.service" << EOF
[Unit]
Description=VibeCast Kernel Performance Tracker
After=network.target
Wants=network.target

[Service]
Type=simple
User=vibecast
Group=vibecast
WorkingDirectory=$MONITORING_ROOT/scripts
ExecStart=/usr/bin/python3 $MONITORING_ROOT/scripts/kernel_performance_tracker.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment=PYTHONPATH=$MONITORING_ROOT/scripts

[Install]
WantedBy=multi-user.target
EOF

    # Multi-GPU Monitor Service
    cat > "$SERVICE_DIR/vibecast-multi-gpu.service" << EOF
[Unit]
Description=VibeCast Multi-GPU Monitor
After=network.target
Wants=network.target

[Service]
Type=simple
User=vibecast
Group=vibecast
WorkingDirectory=$MONITORING_ROOT/scripts
ExecStart=/usr/bin/python3 $MONITORING_ROOT/scripts/multi_gpu_monitor.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment=PYTHONPATH=$MONITORING_ROOT/scripts

[Install]
WantedBy=multi-user.target
EOF

    # Health Checker Service
    cat > "$SERVICE_DIR/vibecast-health-check.service" << EOF
[Unit]
Description=VibeCast Health Checker
After=network.target
Wants=network.target

[Service]
Type=simple
User=vibecast
Group=vibecast
WorkingDirectory=$MONITORING_ROOT/scripts
ExecStart=/usr/bin/python3 $MONITORING_ROOT/scripts/health_checker.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment=PYTHONPATH=$MONITORING_ROOT/scripts

[Install]
WantedBy=multi-user.target
EOF

    # Monitoring Dashboard Service (simple HTTP server)
    cat > "$SERVICE_DIR/vibecast-dashboard.service" << EOF
[Unit]
Description=VibeCast Monitoring Dashboard
After=network.target
Wants=network.target

[Service]
Type=simple
User=vibecast
Group=vibecast
WorkingDirectory=$MONITORING_ROOT/dashboards
ExecStart=/usr/bin/python3 -m http.server 8080
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    log "Systemd service files created"
}

# Create monitoring user
create_user() {
    log "Creating monitoring user..."
    
    # Create vibecast user if it doesn't exist
    if ! id "vibecast" &>/dev/null; then
        useradd -r -s /bin/false -d /var/lib/vibecast vibecast
        log "Created vibecast user"
    else
        info "vibecast user already exists"
    fi
    
    # Add vibecast user to necessary groups for GPU access
    usermod -a -G video vibecast 2>/dev/null || true
}

# Install logrotate configuration
setup_logrotate() {
    log "Setting up log rotation..."
    
    cat > /etc/logrotate.d/vibecast << EOF
$LOG_DIR/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 vibecast vibecast
    postrotate
        systemctl reload vibecast-* 2>/dev/null || true
    endscript
}

$LOG_DIR/*/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 vibecast vibecast
}

$LOG_DIR/*/*.json {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 vibecast vibecast
}
EOF

    log "Log rotation configured"
}

# Setup monitoring scripts permissions
setup_permissions() {
    log "Setting up permissions..."
    
    # Make scripts executable
    chmod +x "$MONITORING_ROOT/scripts/"*.py
    chmod +x "$MONITORING_ROOT/scripts/"*.sh
    
    # Set ownership
    chown -R vibecast:vibecast "$MONITORING_ROOT" 2>/dev/null || true
    
    log "Permissions configured"
}

# Start and enable services
start_services() {
    log "Starting monitoring services..."
    
    # Reload systemd
    systemctl daemon-reload
    
    # Enable and start services
    services=(
        "vibecast-gpu-metrics"
        "vibecast-memory-leak"
        "vibecast-kernel-perf"
        "vibecast-multi-gpu"
        "vibecast-health-check"
        "vibecast-dashboard"
    )
    
    for service in "${services[@]}"; do
        info "Starting $service..."
        systemctl enable "$service"
        systemctl start "$service"
        
        # Check if service started successfully
        if systemctl is-active --quiet "$service"; then
            log "✓ $service started successfully"
        else
            error "✗ Failed to start $service"
            systemctl status "$service" --no-pager
        fi
    done
    
    log "All monitoring services started"
}

# Create monitoring status script
create_status_script() {
    log "Creating monitoring status script..."
    
    cat > "$MONITORING_ROOT/scripts/monitoring_status.sh" << 'EOF'
#!/bin/bash

# VibeCast Monitoring Status Script

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🚀 VibeCast Monitoring System Status"
echo "====================================="

services=(
    "vibecast-gpu-metrics:GPU Metrics Collector"
    "vibecast-memory-leak:Memory Leak Detector"
    "vibecast-kernel-perf:Kernel Performance Tracker"
    "vibecast-multi-gpu:Multi-GPU Monitor"
    "vibecast-health-check:Health Checker"
    "vibecast-dashboard:Monitoring Dashboard"
)

for service_info in "${services[@]}"; do
    IFS=':' read -r service_name description <<< "$service_info"
    
    if systemctl is-active --quiet "$service_name"; then
        status="${GREEN}●${NC} Running"
    else
        status="${RED}●${NC} Stopped"
    fi
    
    printf "%-30s %s\n" "$description" "$status"
done

echo ""
echo "📊 System Health Summary"
echo "========================"

# Check GPU status
if command -v nvidia-smi &> /dev/null; then
    gpu_count=$(nvidia-smi --query-gpu=count --format=csv,noheader,nounits | head -1)
    echo "GPUs Detected: $gpu_count"
    
    # Check GPU temperatures
    temps=$(nvidia-smi --query-gpu=temperature.gpu --format=csv,noheader,nounits | tr '\n' ' ')
    echo "GPU Temperatures: $temps°C"
    
    # Check GPU utilization
    utils=$(nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits | tr '\n' ' ')
    echo "GPU Utilization: $utils%"
else
    echo "${YELLOW}WARNING:${NC} nvidia-smi not available"
fi

# Check disk space
disk_usage=$(df -h / | awk 'NR==2 {print $5}')
echo "Disk Usage: $disk_usage"

# Check memory usage
mem_usage=$(free | awk 'NR==2{printf "%.1f%%", $3*100/$2}')
echo "Memory Usage: $mem_usage"

echo ""
echo "📈 Monitoring Endpoints"
echo "======================="
echo "Prometheus Metrics: http://localhost:8000/metrics"
echo "Monitoring Dashboard: http://localhost:8080"
echo "Log Directory: /var/log/vibecast"

echo ""
echo "🔧 Useful Commands"
echo "=================="
echo "View logs: journalctl -u vibecast-* -f"
echo "Restart all: systemctl restart vibecast-*"
echo "Stop all: systemctl stop vibecast-*"
echo "Service status: systemctl status vibecast-*"
EOF

    chmod +x "$MONITORING_ROOT/scripts/monitoring_status.sh"
    
    # Create symlink in /usr/local/bin for easy access
    ln -sf "$MONITORING_ROOT/scripts/monitoring_status.sh" /usr/local/bin/vibecast-status
    
    log "Monitoring status script created"
}

# Create uninstall script
create_uninstall_script() {
    log "Creating uninstall script..."
    
    cat > "$MONITORING_ROOT/scripts/uninstall_monitoring.sh" << 'EOF'
#!/bin/bash

# VibeCast Monitoring Uninstall Script

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}This script must be run as root${NC}"
    exit 1
fi

log "Stopping VibeCast monitoring services..."

services=(
    "vibecast-gpu-metrics"
    "vibecast-memory-leak"
    "vibecast-kernel-perf"
    "vibecast-multi-gpu"
    "vibecast-health-check"
    "vibecast-dashboard"
)

for service in "${services[@]}"; do
    log "Stopping $service..."
    systemctl stop "$service" 2>/dev/null || true
    systemctl disable "$service" 2>/dev/null || true
    rm -f "/etc/systemd/system/$service.service"
done

log "Reloading systemd..."
systemctl daemon-reload

log "Removing configuration files..."
rm -rf /etc/vibecast/monitoring

log "Removing log rotation configuration..."
rm -f /etc/logrotate.d/vibecast

log "Removing status script symlink..."
rm -f /usr/local/bin/vibecast-status

warn "Log files in /var/log/vibecast are preserved"
warn "User 'vibecast' is preserved"
warn "Python packages are preserved"

log "VibeCast monitoring system uninstalled successfully"
EOF

    chmod +x "$MONITORING_ROOT/scripts/uninstall_monitoring.sh"
    
    log "Uninstall script created"
}

# Verify installation
verify_installation() {
    log "Verifying installation..."
    
    # Check services
    failed_services=()
    for service in vibecast-gpu-metrics vibecast-memory-leak vibecast-kernel-perf vibecast-multi-gpu vibecast-health-check vibecast-dashboard; do
        if ! systemctl is-active --quiet "$service"; then
            failed_services+=("$service")
        fi
    done
    
    if [ ${#failed_services[@]} -eq 0 ]; then
        log "✓ All services are running"
    else
        error "✗ Failed services: ${failed_services[*]}"
        return 1
    fi
    
    # Check if metrics endpoint is responding
    if curl -s http://localhost:8000/metrics > /dev/null; then
        log "✓ Prometheus metrics endpoint responding"
    else
        warn "⚠ Prometheus metrics endpoint not responding"
    fi
    
    # Check if dashboard is accessible
    if curl -s http://localhost:8080 > /dev/null; then
        log "✓ Monitoring dashboard accessible"
    else
        warn "⚠ Monitoring dashboard not accessible"
    fi
    
    log "Installation verification completed"
}

# Print final status
print_status() {
    echo ""
    echo "======================================"
    echo "🚀 VibeCast Monitoring Deployment Complete!"
    echo "======================================"
    echo ""
    echo "📊 Monitoring Services:"
    echo "  • GPU Metrics Collector"
    echo "  • Memory Leak Detector"
    echo "  • Kernel Performance Tracker"
    echo "  • Multi-GPU Monitor"
    echo "  • Health Checker"
    echo "  • Monitoring Dashboard"
    echo ""
    echo "📈 Access Points:"
    echo "  • Prometheus Metrics: http://localhost:8000/metrics"
    echo "  • Monitoring Dashboard: http://localhost:8080"
    echo "  • System Status: vibecast-status"
    echo ""
    echo "📂 Important Locations:"
    echo "  • Logs: /var/log/vibecast/"
    echo "  • Config: /etc/vibecast/monitoring/"
    echo "  • Scripts: $MONITORING_ROOT/scripts/"
    echo ""
    echo "🔧 Management Commands:"
    echo "  • Status: vibecast-status"
    echo "  • Logs: journalctl -u vibecast-* -f"
    echo "  • Restart: systemctl restart vibecast-*"
    echo "  • Stop: systemctl stop vibecast-*"
    echo ""
    echo "📚 Next Steps:"
    echo "  1. Configure alerting endpoints in $CONFIG_DIR/production_monitor.yaml"
    echo "  2. Set up external monitoring (Grafana, etc.)"
    echo "  3. Test alert notifications"
    echo "  4. Review and adjust monitoring thresholds"
    echo ""
    echo "Happy Monitoring! 🎉"
}

# Main deployment function
main() {
    log "Starting VibeCast Monitoring Deployment..."
    
    check_root
    check_prerequisites
    install_dependencies
    create_user
    create_directories
    install_configs
    setup_permissions
    create_services
    setup_logrotate
    create_status_script
    create_uninstall_script
    start_services
    
    # Wait a moment for services to start
    sleep 5
    
    verify_installation
    print_status
    
    log "Deployment completed successfully!"
}

# Run main function
main "$@"