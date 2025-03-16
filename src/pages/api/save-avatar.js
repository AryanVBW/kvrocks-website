/**
 * API endpoint to save avatar images
 * This endpoint handles saving avatars uploaded from the client
 */

import fs from 'fs';
import path from 'path';
import { IncomingForm } from 'formidable';

// Disable the default body parser to handle form data
export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Handle avatar upload and save to disk
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Create avatars directory if it doesn't exist
    const avatarsDir = path.join(process.cwd(), 'static', 'img', 'avatars');
    if (!fs.existsSync(avatarsDir)) {
      fs.mkdirSync(avatarsDir, { recursive: true });
    }

    // Parse the incoming form data
    const form = new IncomingForm({
      uploadDir: avatarsDir,
      keepExtensions: true,
      maxFileSize: 5 * 1024 * 1024, // 5MB limit
    });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error('Error parsing form:', err);
        return res.status(500).json({ error: 'Failed to process upload' });
      }

      // Get the uploaded file and GitHub ID
      const avatarFile = files.avatar?.[0];
      const githubId = fields.githubId?.[0];

      if (!avatarFile || !githubId) {
        return res.status(400).json({ error: 'Missing avatar file or GitHub ID' });
      }

      // Create the final path for the avatar
      const finalPath = path.join(avatarsDir, `${githubId}.png`);

      // Rename the temp file to the final path
      fs.renameSync(avatarFile.filepath, finalPath);

      // Update metadata file
      const metadataPath = path.join(avatarsDir, 'metadata.json');
      let metadata = { avatars: {}, lastUpdate: Date.now() };

      // Read existing metadata if it exists
      if (fs.existsSync(metadataPath)) {
        try {
          const data = fs.readFileSync(metadataPath, 'utf8');
          metadata = JSON.parse(data);
        } catch (error) {
          console.error('Error reading metadata:', error);
        }
      }

      // Update metadata for this avatar
      metadata.avatars[githubId] = {
        lastUpdated: Date.now(),
        path: finalPath
      };

      // Save metadata
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

      return res.status(200).json({ success: true });
    });
  } catch (error) {
    console.error('Error handling avatar upload:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
