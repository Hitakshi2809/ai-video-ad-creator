#!/bin/bash

# ==================== Colors ====================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ==================== Functions ====================
print_header() {
  echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║   🎬 AI Ad Creator - Setup Guide      ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
  echo ""
}

print_step() {
  echo -e "${YELLOW}▶ $1${NC}"
}

print_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
  echo -e "${RED}❌ $1${NC}"
}

print_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

# ==================== Check Prerequisites ====================
check_requirements() {
  print_step "Checking prerequisites..."

  # Check Node.js
  if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    echo "Install from: https://nodejs.org"
    exit 1
  fi
  print_success "Node.js $(node --version) found"

  # Check npm
  if ! command -v npm &> /dev/null; then
    print_error "npm is not installed"
    exit 1
  fi
  print_success "npm $(npm --version) found"

  # Check Docker (optional but recommended)
  if ! command -v docker &> /dev/null; then
    print_info "Docker not found (optional for local development)"
  else
    print_success "Docker $(docker --version | awk '{print $3}') found"
  fi

  echo ""
}

# ==================== Setup Environment ====================
setup_env() {
  print_step "Setting up environment variables..."

  if [ -f ".env" ]; then
    print_info ".env file already exists, skipping creation"
  else
    cp .env.example .env
    print_success ".env file created"
    
    print_info "Please edit .env and add your API keys:"
    echo "  1. ANTHROPIC_API_KEY from https://console.anthropic.com"
    echo "  2. HUGGINGFACE_API_KEY from https://huggingface.co/settings/tokens"
  fi
  echo ""
}

# ==================== Install Dependencies ====================
install_deps() {
  print_step "Installing dependencies..."

  if [ -d "node_modules" ]; then
    print_info "node_modules already exists, skipping npm install"
  else
    npm ci
    print_success "Dependencies installed"
  fi
  echo ""
}

# ==================== Setup with Docker ====================
setup_docker() {
  print_step "Setting up with Docker Compose..."

  if ! command -v docker-compose &> /dev/null; then
    print_info "Docker Compose not found, skipping Docker setup"
    echo "Install from: https://docs.docker.com/compose/install"
    echo ""
    return
  fi

  read -p "Do you want to start services with Docker? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker-compose up -d
    print_success "Docker services started"
    
    # Wait for services
    print_step "Waiting for services to be ready..."
    sleep 5
    
    # Check health
    if curl -s http://localhost:3000/health > /dev/null; then
      print_success "API is healthy"
    else
      print_info "API still starting, check with: docker-compose logs -f api"
    fi
  fi
  echo ""
}

# ==================== Create Directories ====================
create_dirs() {
  print_step "Creating project directories..."

  mkdir -p public/images
  mkdir -p public/videos
  mkdir -p logs

  print_success "Directories created"
  echo ""
}

# ==================== Print Next Steps ====================
print_next_steps() {
  echo ""
  echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║        Setup Complete! 🎉              ║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
  echo ""
  
  print_info "Next steps:"
  echo ""
  echo "1. Add API Keys to .env file:"
  echo "   • ANTHROPIC_API_KEY: https://console.anthropic.com"
  echo "   • HUGGINGFACE_API_KEY: https://huggingface.co/settings/tokens"
  echo ""
  
  echo "2. Start the application:"
  echo "   Option A - With Docker (recommended):"
  echo "     docker-compose up"
  echo ""
  echo "   Option B - Without Docker:"
  echo "     npm start"
  echo ""
  
  echo "3. Open your browser:"
  echo "   http://localhost:3000"
  echo ""
  
  print_info "Useful commands:"
  echo "   • npm start          - Start server"
  echo "   • docker-compose up  - Start all services"
  echo "   • docker-compose logs -f api - View logs"
  echo ""
  
  print_info "Documentation:"
  echo "   • README.md - Full documentation"
  echo "   • API.md - API endpoints"
  echo "   • TROUBLESHOOTING.md - Common issues"
  echo ""
}

# ==================== Main ====================
main() {
  print_header
  
  check_requirements
  setup_env
  install_deps
  create_dirs
  setup_docker
  print_next_steps
}

# Run setup
main
