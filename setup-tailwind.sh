#!/bin/bash
# Script to setup tailwind CSS for dedpaste

echo "Setting up Tailwind CSS for dedpaste..."

# Create directories if they don't exist
mkdir -p src/styles public

# Install required packages if not already installed
echo "Installing Tailwind CSS and related packages..."
npm install -D tailwindcss postcss autoprefixer concurrently

# Run the tailwind build to generate CSS
echo "Building Tailwind CSS..."
npm run build:tailwind

# Make sure the script is executable
chmod +x ./setup-tailwind.sh

echo "Tailwind CSS setup complete!"
echo "To run the dev server with Tailwind:"
echo "  npm run dev"
echo ""
echo "This will automatically watch Tailwind CSS files for changes and rebuild as needed."