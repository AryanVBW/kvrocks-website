/**
 * Script to download GitHub avatars and store them locally
 * Run this script periodically (e.g., weekly) to update avatars
 * This helps solve Content Security Policy (CSP) issues by serving avatars from your own domain
 * 
 * This script is designed to be run automatically by the server's cron job
 * It will download all avatars and store them in the static/img/avatars directory
 * 
 * Usage:
 *   node download-avatars.js [--force]
 *     --force: Force download all avatars even if they exist and are recent
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const CONFIG = {
  // How old an avatar can be before it's refreshed (1 week in milliseconds)
  maxAgeMs: 7 * 24 * 60 * 60 * 1000,
  // Size of avatar to request from GitHub
  avatarSize: 128,
  // Whether to force download all avatars regardless of age
  forceDownload: process.argv.includes('--force')
};

// Create avatars directory if it doesn't exist
const avatarsDir = path.join(__dirname, '../static/img/avatars');
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}

// Create a metadata file to track when avatars were last updated
const metadataFile = path.join(avatarsDir, 'metadata.json');
let metadata = { lastRun: 0, avatars: {} };

// Load existing metadata if available
if (fs.existsSync(metadataFile)) {
  try {
    metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
  } catch (err) {
    console.warn('Failed to parse metadata file, creating new one:', err.message);
  }
}

// Extract the committers array from the source file
const committersList = getCommittersFromSource();

// Download each avatar
downloadAvatars(committersList).then(() => {
  // Update metadata with current timestamp
  metadata.lastRun = Date.now();
  
  // Save updated metadata
  fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
  
  console.log(`Metadata updated. Next scheduled refresh: ${new Date(Date.now() + CONFIG.maxAgeMs).toLocaleString()}`);
}).catch(err => {
  console.error('Error in avatar download process:', err);
});

/**
 * Parse the committers array from the source file
 */
function getCommittersFromSource() {
  const sourceFile = path.join(__dirname, '../src/components/Committers/index.tsx');
  const content = fs.readFileSync(sourceFile, 'utf8');
  
  // Extract the committers array using regex
  const committerMatch = content.match(/const committers: CommitterData\[\] = \[([\s\S]*?)\]/);
  if (!committerMatch) {
    console.error('Could not find committers array in source file');
    return [];
  }
  
  const committerEntries = committerMatch[1].trim().split('},');
  return committerEntries
    .filter(entry => entry.trim())
    .map(entry => {
      // Extract githubId using regex
      const githubIdMatch = entry.match(/githubId: ['"]([^'"]+)['"]/);
      return githubIdMatch ? githubIdMatch[1] : null;
    })
    .filter(id => id !== null);
}

/**
 * Download avatars for all committers
 * @param {string[]} githubIds - Array of GitHub usernames
 * @returns {Promise<void>} - Promise that resolves when all downloads are complete
 */
function downloadAvatars(githubIds) {
  return new Promise((resolve, reject) => {
    console.log(`Processing ${githubIds.length} avatars...`);
    
    let completed = 0;
    let downloaded = 0;
    let skipped = 0;
    let failed = 0;
    let promises = [];
    
    githubIds.forEach(githubId => {
      // Use the GitHub username directly with the .png endpoint
      const avatarUrl = `https://github.com/${githubId}.png?size=${CONFIG.avatarSize}`;
      const outputPath = path.join(avatarsDir, `${githubId}.png`);
      
      // Check if we need to download this avatar
      if (!shouldDownloadAvatar(githubId, outputPath)) {
        completed++;
        skipped++;
        console.log(`Skipped avatar for ${githubId} (${completed}/${githubIds.length}) - recently updated`);
        return;
      }
      
      const promise = downloadFile(avatarUrl, outputPath)
        .then(() => {
          completed++;
          downloaded++;
          // Update metadata for this avatar
          metadata.avatars[githubId] = { 
            lastUpdated: Date.now(),
            path: outputPath
          };
          console.log(`Downloaded avatar for ${githubId} (${completed}/${githubIds.length})`);
        })
        .catch(err => {
          completed++;
          failed++;
          console.error(`Failed to download avatar for ${githubId}:`, err.message);
        });
      
      promises.push(promise);
    });
    
    Promise.all(promises).then(() => {
      console.log('\nAvatar download summary:');
      console.log(`- Total processed: ${githubIds.length}`);
      console.log(`- Downloaded: ${downloaded}`);
      console.log(`- Skipped (recent): ${skipped}`);
      console.log(`- Failed: ${failed}`);
      console.log(`\nAvatar images saved to: ${avatarsDir}`);
      resolve();
    }).catch(reject);
  });
}

/**
 * Determine if an avatar should be downloaded based on age and existence
 * @param {string} githubId - GitHub username
 * @param {string} filePath - Path to the avatar file
 * @returns {boolean} - True if the avatar should be downloaded
 */
function shouldDownloadAvatar(githubId, filePath) {
  // Always download if force flag is set
  if (CONFIG.forceDownload) {
    return true;
  }
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return true;
  }
  
  // Check metadata for last update time
  const avatarMeta = metadata.avatars[githubId];
  if (!avatarMeta || !avatarMeta.lastUpdated) {
    return true;
  }
  
  // Check if avatar is older than max age
  const ageMs = Date.now() - avatarMeta.lastUpdated;
  return ageMs > CONFIG.maxAgeMs;
}

/**
 * Download a file from a URL to a local path
 * Handles redirects (302 status codes)
 */
function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, response => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        if (response.headers.location) {
          console.log(`Following redirect for ${url} to ${response.headers.location}`);
          return downloadFile(response.headers.location, outputPath)
            .then(resolve)
            .catch(reject);
        } else {
          reject(new Error(`Redirect with no location header for ${url}`));
          return;
        }
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}, status code: ${response.statusCode}`));
        return;
      }
      
      const fileStream = fs.createWriteStream(outputPath);
      response.pipe(fileStream);
      
      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });
      
      fileStream.on('error', err => {
        fs.unlink(outputPath, () => {}); // Delete the file if there was an error
        reject(err);
      });
    });
    
    request.on('error', reject);
    
    // Set a timeout of 10 seconds
    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error(`Request timeout for ${url}`));
    });
  });
}
