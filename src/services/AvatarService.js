/**
 * Avatar Service
 * Handles loading and caching of GitHub avatars
 * Implements a fallback mechanism and automatic updates
 */

// Cache expiration time (1 week in milliseconds)
const CACHE_EXPIRATION = 7 * 24 * 60 * 60 * 1000;

// Default avatar path
const DEFAULT_AVATAR = '/img/default-avatar.png';

// Avatar directory path
const AVATAR_DIR = '/img/avatars';

// Metadata storage key
const METADATA_KEY = 'avatar_metadata';

// Flag to track if we've already checked for updates in this session
let updatesChecked = false;

/**
 * Get the avatar URL for a GitHub user
 * 
 * @param {string} githubId - GitHub username
 * @returns {string} - URL to the avatar image
 */
export function getAvatarUrl(githubId) {
  // Add a cache-busting timestamp parameter if we're in a browser environment
  if (typeof window !== 'undefined') {
    const metadata = getMetadata();
    const timestamp = metadata.avatars[githubId]?.lastUpdated || Date.now();
    return `${AVATAR_DIR}/${githubId}.png?t=${timestamp}`;
  }
  return `${AVATAR_DIR}/${githubId}.png`;
}

/**
 * Get metadata from localStorage
 * @returns {Object} - Metadata object
 */
function getMetadata() {
  if (typeof window === 'undefined') {
    return { avatars: {}, lastCheck: 0 };
  }
  
  try {
    const data = localStorage.getItem(METADATA_KEY);
    return data ? JSON.parse(data) : { avatars: {}, lastCheck: 0 };
  } catch (error) {
    console.error('Error reading avatar metadata:', error);
    return { avatars: {}, lastCheck: 0 };
  }
}

/**
 * Save metadata to localStorage
 * @param {Object} metadata - Metadata object to save
 */
function saveMetadata(metadata) {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(METADATA_KEY, JSON.stringify(metadata));
  } catch (error) {
    console.error('Error saving avatar metadata:', error);
  }
}

/**
 * Check if an avatar needs to be refreshed
 * 
 * @param {string} githubId - GitHub username
 * @returns {boolean} - True if the avatar needs to be refreshed
 */
export function needsRefresh(githubId) {
  const metadata = getMetadata();
  const avatar = metadata.avatars[githubId];
  
  // If no metadata or last update time, it needs refresh
  if (!avatar || !avatar.lastUpdated) {
    return true;
  }
  
  // Check if avatar is older than cache expiration
  const age = Date.now() - avatar.lastUpdated;
  return age > CACHE_EXPIRATION;
}

/**
 * Handle image loading error
 * Falls back to default avatar if the image fails to load
 * 
 * @param {Event} event - The error event
 */
export function handleAvatarError(event) {
  const target = event.currentTarget;
  if (target) {
    // Prevent infinite loop of error events
    target.onerror = null;
    
    // Set default avatar as fallback
    target.src = DEFAULT_AVATAR;
  }
}

/**
 * Download an avatar from GitHub
 * @param {string} githubId - GitHub username
 * @returns {Promise<boolean>} - Promise resolving to true if successful
 */
async function downloadAvatar(githubId) {
  try {
    // Create a unique URL for the avatar to avoid caching issues
    const avatarUrl = `https://github.com/${githubId}.png?size=128&t=${Date.now()}`;
    
    // Fetch the avatar
    const response = await fetch(avatarUrl);
    if (!response.ok) throw new Error(`Failed to fetch avatar: ${response.status}`);
    
    // Get the blob data
    const blob = await response.blob();
    
    // Create a FormData object to send to our server
    const formData = new FormData();
    formData.append('avatar', blob, `${githubId}.png`);
    formData.append('githubId', githubId);
    
    // Send to our server endpoint that will save the file
    const saveResponse = await fetch('/api/save-avatar', {
      method: 'POST',
      body: formData
    });
    
    if (!saveResponse.ok) throw new Error(`Failed to save avatar: ${saveResponse.status}`);
    
    // Update metadata
    const metadata = getMetadata();
    metadata.avatars[githubId] = {
      lastUpdated: Date.now(),
      path: `${AVATAR_DIR}/${githubId}.png`
    };
    saveMetadata(metadata);
    
    return true;
  } catch (error) {
    console.error(`Error downloading avatar for ${githubId}:`, error);
    return false;
  }
}

/**
 * Check and update avatars if needed
 * This is called automatically when the app loads
 * @param {Array} githubIds - List of GitHub usernames to check
 */
export async function checkAndUpdateAvatars(githubIds) {
  // Only check once per session
  if (updatesChecked || typeof window === 'undefined') return;
  updatesChecked = true;
  
  const metadata = getMetadata();
  
  // Check if we've checked recently (within last day)
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  if (metadata.lastCheck && (now - metadata.lastCheck < dayMs)) {
    console.log('Avatar check skipped - checked recently');
    return;
  }
  
  // Update last check time
  metadata.lastCheck = now;
  saveMetadata(metadata);
  
  console.log(`Checking ${githubIds.length} avatars for updates...`);
  
  // Process avatars in the background
  setTimeout(async () => {
    let updated = 0;
    
    for (const githubId of githubIds) {
      if (needsRefresh(githubId)) {
        const success = await downloadAvatar(githubId);
        if (success) updated++;
      }
    }
    
    console.log(`Avatar update complete. Updated ${updated} avatars.`);
  }, 2000); // Delay to not impact page load performance
}

/**
 * Get avatar component props
 * Use this to consistently apply avatar settings across the application
 * 
 * @param {string} githubId - GitHub username
 * @param {string} altText - Alt text for the image
 * @param {number} size - Size of the avatar in pixels
 * @returns {Object} - Props for the avatar image
 */
export function getAvatarProps(githubId, altText, size = 64) {
  return {
    src: getAvatarUrl(githubId),
    alt: altText || githubId,
    width: size,
    height: size,
    onError: handleAvatarError,
    loading: 'lazy', // Use lazy loading for better performance
  };
}
