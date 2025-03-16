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

/**
 * Get the avatar URL for a GitHub user
 * 
 * @param {string} githubId - GitHub username
 * @returns {string} - URL to the avatar image
 */
export function getAvatarUrl(githubId) {
  return `${AVATAR_DIR}/${githubId}.png`;
}

/**
 * Check if an avatar needs to be refreshed
 * This function is used by the server-side cron job
 * 
 * @param {string} githubId - GitHub username
 * @returns {boolean} - True if the avatar needs to be refreshed
 */
export function needsRefresh(githubId) {
  try {
    // This function would be implemented on the server side
    // to check file modification times and determine if refresh is needed
    return true;
  } catch (error) {
    console.error(`Error checking avatar refresh for ${githubId}:`, error);
    return true;
  }
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
