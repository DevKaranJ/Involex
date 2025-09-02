#!/bin/bash

# Involex Website Deployment Script
# This script helps deploy the Involex website to various hosting platforms

echo "🚀 Involex Website Deployment Script"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "index.html" ]; then
    print_error "Please run this script from the website directory"
    exit 1
fi

print_info "Preparing Involex website for deployment..."

# Create deployment package
DEPLOY_DIR="involex-website-deploy"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
PACKAGE_NAME="involex-website-${TIMESTAMP}.zip"

print_info "Creating deployment package: $PACKAGE_NAME"

# Create deployment directory
mkdir -p "$DEPLOY_DIR"

# Copy website files
cp -r * "$DEPLOY_DIR/"

# Remove unnecessary files
rm -f "$DEPLOY_DIR/deploy.sh"
rm -f "$DEPLOY_DIR/README.md"

print_status "Website files prepared"

# Optimize files for production
print_info "Optimizing files for production..."

# Add cache headers to .htaccess (for Apache servers)
cat > "$DEPLOY_DIR/.htaccess" << 'EOF'
# Enable compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/plain
    AddOutputFilterByType DEFLATE text/html
    AddOutputFilterByType DEFLATE text/xml
    AddOutputFilterByType DEFLATE text/css
    AddOutputFilterByType DEFLATE application/xml
    AddOutputFilterByType DEFLATE application/xhtml+xml
    AddOutputFilterByType DEFLATE application/rss+xml
    AddOutputFilterByType DEFLATE application/javascript
    AddOutputFilterByType DEFLATE application/x-javascript
</IfModule>

# Set cache headers
<IfModule mod_expires.c>
    ExpiresActive on
    ExpiresByType text/css "access plus 1 month"
    ExpiresByType application/javascript "access plus 1 month"
    ExpiresByType image/png "access plus 1 month"
    ExpiresByType image/jpg "access plus 1 month"
    ExpiresByType image/jpeg "access plus 1 month"
    ExpiresByType image/gif "access plus 1 month"
    ExpiresByType image/svg+xml "access plus 1 month"
    ExpiresByType image/ico "access plus 1 year"
    ExpiresByType image/x-icon "access plus 1 year"
</IfModule>

# Security headers
<IfModule mod_headers.c>
    Header always set X-Frame-Options DENY
    Header always set X-Content-Type-Options nosniff
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    Header always set Permissions-Policy "geolocation=(), microphone=(), camera=()"
</IfModule>

# Error pages
ErrorDocument 404 /404.html
EOF

# Create robots.txt
cat > "$DEPLOY_DIR/robots.txt" << 'EOF'
User-agent: *
Allow: /

Sitemap: https://involex.dev/sitemap.xml
EOF

# Create sitemap.xml
cat > "$DEPLOY_DIR/sitemap.xml" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>https://involex.dev/</loc>
        <lastmod>2025-01-01</lastmod>
        <changefreq>weekly</changefreq>
        <priority>1.0</priority>
    </url>
    <url>
        <loc>https://involex.dev/docs/</loc>
        <lastmod>2025-01-01</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.8</priority>
    </url>
</urlset>
EOF

# Create 404 page
cat > "$DEPLOY_DIR/404.html" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Page Not Found - Involex</title>
    <link rel="stylesheet" href="styles/main.css">
</head>
<body>
    <div class="container" style="text-align: center; padding: 4rem 1.5rem;">
        <h1 style="font-size: 4rem; color: #2563eb; margin-bottom: 1rem;">404</h1>
        <h2 style="margin-bottom: 1rem;">Page Not Found</h2>
        <p style="color: #6b7280; margin-bottom: 2rem;">The page you're looking for doesn't exist.</p>
        <a href="/" class="btn btn-primary">Go Home</a>
    </div>
</body>
</html>
EOF

print_status "Production optimization complete"

# Create zip package
if command -v zip >/dev/null 2>&1; then
    cd "$DEPLOY_DIR"
    zip -r "../$PACKAGE_NAME" .
    cd ..
    print_status "Created deployment package: $PACKAGE_NAME"
else
    print_warning "zip command not found. Deployment directory created at: $DEPLOY_DIR"
fi

# Deployment options
echo ""
print_info "Deployment Options:"
echo ""

echo "1. 🌐 Netlify (Recommended - Free)"
echo "   - Drag and drop the website folder to https://app.netlify.com/drop"
echo "   - Or connect your GitHub repository for automatic deployments"
echo ""

echo "2. 🚀 Vercel (Free)"
echo "   - Run: npx vercel --prod"
echo "   - Or import your GitHub repository at https://vercel.com/new"
echo ""

echo "3. 📄 GitHub Pages (Free)"
echo "   - Push to GitHub repository"
echo "   - Enable Pages in repository settings"
echo "   - Select main branch as source"
echo ""

echo "4. 🔥 Firebase Hosting (Free tier)"
echo "   - Install: npm install -g firebase-tools"
echo "   - Run: firebase init hosting"
echo "   - Run: firebase deploy"
echo ""

echo "5. 📁 Traditional Web Hosting"
echo "   - Upload contents of $DEPLOY_DIR to your web server"
echo "   - Ensure your domain points to the upload directory"
echo ""

# Performance checklist
echo ""
print_info "Pre-Launch Checklist:"
echo ""
echo "□ Replace placeholder images with actual assets"
echo "□ Add your Google Analytics tracking ID"
echo "□ Update social media meta tags with your URLs"
echo "□ Test all links and forms"
echo "□ Verify mobile responsiveness"
echo "□ Test loading speed"
echo "□ Set up SSL certificate (HTTPS)"
echo "□ Configure custom domain"
echo ""

# Next steps
print_info "Next Steps:"
echo "1. Choose a deployment option above"
echo "2. Upload your website files"
echo "3. Configure your custom domain"
echo "4. Set up analytics and monitoring"
echo "5. Submit to search engines"
echo ""

print_status "Deployment preparation complete!"
print_info "Your website is ready to go live! 🎉"

# Clean up
if [ -d "$DEPLOY_DIR" ] && [ -f "$PACKAGE_NAME" ]; then
    print_info "Cleaning up temporary files..."
    rm -rf "$DEPLOY_DIR"
fi

echo ""
print_info "Happy launching! 🚀"
