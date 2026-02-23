#!/bin/bash

set -e

echo "=========================================="
echo "  BEOKSOLUTION Firebase Deployment"
echo "=========================================="
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if ! command -v node &> /dev/null; then
    echo -e "${RED}ERROR: Node.js is not installed.${NC}"
    echo "Please install Node.js first:"
    echo "  - macOS: brew install node"
    echo "  - Or visit: https://nodejs.org/"
    exit 1
fi

if ! command -v firebase &> /dev/null; then
    echo -e "${YELLOW}Firebase CLI not found. Installing...${NC}"
    npm install -g firebase-tools
    echo -e "${GREEN}Firebase CLI installed!${NC}"
fi

FIREBASE_TOKEN="${FIREBASE_TOKEN:-1//0e83NImpyYHpWCgYIARAAGA4SNwF-L9IrfKBtiro7TlEz0cQlFoY5AZ7QDZN_ffIL-GwSKllinxPmB-oTh33LRNDj3-eaHNZSQ7k}"

echo -e "${YELLOW}[1/4] Building project...${NC}"
npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi

echo -e "${YELLOW}[2/4] Installing function dependencies...${NC}"
cd functions && npm install && cd ..
echo -e "${GREEN}✓ Dependencies installed${NC}"

echo -e "${YELLOW}[3/4] Deploying Firestore rules and indexes...${NC}"
firebase deploy --token "$FIREBASE_TOKEN" --only firestore:rules,firestore:indexes,storage:rules
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Firestore rules deployed${NC}"
else
    echo -e "${RED}✗ Firestore deployment failed${NC}"
    exit 1
fi

echo -e "${YELLOW}[4/4] Deploying Cloud Functions and Hosting...${NC}"
firebase deploy --token "$FIREBASE_TOKEN" --only functions,hosting
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Functions and Hosting deployed${NC}"
else
    echo -e "${RED}✗ Deployment failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}=========================================="
echo "  Deployment Complete! 🚀"
echo "==========================================${NC}"
echo ""
echo "Your app is now live at:"
echo "  - Hosting: https://eregi-8fc1e.web.app"
echo "  - Firebase Console: https://console.firebase.google.com/project/eregi-8fc1e"
echo ""
