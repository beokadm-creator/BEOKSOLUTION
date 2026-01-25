#!/bin/bash
echo "Building project..."
npm run build

echo "Deploying Cloud Functions..."
firebase deploy --only functions

echo "Deploying Hosting..."
firebase deploy --only hosting

echo "Deployment Complete!"
