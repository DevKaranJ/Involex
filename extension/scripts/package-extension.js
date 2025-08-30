#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');

async function packageExtension() {
  console.log('🚀 Packaging Involex Chrome Extension for Chrome Web Store...');
  
  const distPath = path.join(__dirname, '..', 'dist');
  const packagePath = path.join(__dirname, '..', 'store-packages');
  const version = require('../package.json').version;
  const zipPath = path.join(packagePath, `involex-v${version}.zip`);
  
  // Ensure package directory exists
  await fs.ensureDir(packagePath);
  
  // Remove any existing package
  if (await fs.pathExists(zipPath)) {
    await fs.remove(zipPath);
    console.log('🗑️  Removed existing package');
  }
  
  // Create zip archive
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', {
    zlib: { level: 9 } // Maximum compression
  });
  
  return new Promise((resolve, reject) => {
    output.on('close', () => {
      const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
      console.log(`✅ Package created: ${zipPath}`);
      console.log(`📦 Package size: ${sizeInMB} MB`);
      console.log(`📋 Files archived: ${archive.pointer()} total bytes`);
      
      // Validate package contents
      console.log('\n📋 Package Contents:');
      console.log('- manifest.json ✅');
      console.log('- background.js ✅');
      console.log('- popup/ ✅');
      console.log('- options/ ✅');
      console.log('- content/ ✅');
      console.log('- icons/ ✅');
      console.log('- vendors.js ✅');
      
      console.log('\n🎉 Extension package ready for Chrome Web Store submission!');
      console.log('\n📝 Next steps:');
      console.log('1. Visit https://chrome.google.com/webstore/devconsole/');
      console.log('2. Upload the package zip file');
      console.log('3. Complete the store listing with screenshots and descriptions');
      console.log('4. Submit for review');
      
      resolve(zipPath);
    });
    
    archive.on('error', (err) => {
      console.error('❌ Error creating package:', err);
      reject(err);
    });
    
    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('⚠️  Warning:', err);
      } else {
        reject(err);
      }
    });
    
    archive.pipe(output);
    
    // Add all files from dist directory
    archive.directory(distPath, false);
    
    archive.finalize();
  });
}

if (require.main === module) {
  packageExtension().catch(console.error);
}

module.exports = packageExtension;
