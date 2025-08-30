#!/bin/bash

# 🚀 Involex FREE Deployment Helper Script
# Prepares the project for deployment to Render.com (FREE tier)

echo "🎯 Involex FREE Deployment Preparation"
echo "======================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this script from the project root directory"
    exit 1
fi

echo "📁 Current directory: $(pwd)"
echo "🌟 Preparing FREE deployment to Render.com..."

# 1. Build backend
echo ""
echo "🔨 Building backend..."
cd backend
npm install
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Backend build successful"
else
    echo "❌ Backend build failed"
    exit 1
fi

# 2. Build extension
echo ""
echo "🔧 Building extension..."
cd ../extension
npm install
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Extension build successful"
else
    echo "❌ Extension build failed"
    exit 1
fi

# 3. Package extension
echo ""
echo "📦 Packaging extension..."
node scripts/package-extension.js

if [ $? -eq 0 ]; then
    echo "✅ Extension packaged successfully"
else
    echo "❌ Extension packaging failed"
    exit 1
fi

# 4. Check deployment files
echo ""
echo "📋 Checking deployment files..."
cd ..

FILES_TO_CHECK=(
    "render.yaml"
    "backend/start.sh"
    "backend/dist/server.js"
    "extension/store-packages/involex-v1.0.0.zip"
    "docs/FREE_DEPLOYMENT_GUIDE.md"
)

ALL_FILES_EXIST=true

for file in "${FILES_TO_CHECK[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ Missing: $file"
        ALL_FILES_EXIST=false
    fi
done

# 5. Git status check
echo ""
echo "📝 Git status:"
git status --porcelain

# 6. Final summary
echo ""
echo "🎉 Deployment Preparation Summary"
echo "================================="

if [ "$ALL_FILES_EXIST" = true ]; then
    echo "✅ All deployment files ready"
    echo "✅ Backend built and ready"
    echo "✅ Extension packaged and ready"
    echo ""
    echo "🚀 Next Steps:"
    echo "1. Commit and push changes to GitHub"
    echo "2. Sign up for Render.com (FREE)"
    echo "3. Connect GitHub repository to Render"
    echo "4. Deploy using the FREE_DEPLOYMENT_GUIDE.md"
    echo ""
    echo "📁 Extension package location:"
    echo "   extension/store-packages/involex-v1.0.0.zip"
    echo ""
    echo "🌐 Render deployment config:"
    echo "   render.yaml (ready for one-click deploy)"
    echo ""
    echo "💡 Estimated deployment time: 10-15 minutes"
    echo "💰 Total cost: $0.00 (FREE tier)"
else
    echo "❌ Some files are missing. Please check the errors above."
    exit 1
fi

echo ""
echo "🎯 Ready to deploy Involex for FREE! 🎉"
