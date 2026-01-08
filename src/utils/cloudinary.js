/**
 * AWS S3 Storage Utilities
 * (Replaces Cloudinary - kept function names for backward compatibility)
 */

import { putObject } from "./Aws/putObject.js";
import { deleteObject } from "./Aws/deleteObject.js";
import { getObject } from "./Aws/getObject.js";

/**
 * Upload file to AWS S3 (replaces uploadToCloudinary)
 * @param {Buffer} fileBuffer - File buffer from multer
 * @param {string} folder - S3 folder path (e.g., 'aadhaar', 'profile', 'resume')
 * @param {string} resourceType - Unused, kept for compatibility
 * @param {string} originalFilename - Original filename for extension
 * @param {string} contentType - MIME type of the file
 * @returns {Promise<Object>} Upload result with secure_url and public_id for compatibility
 */
export const uploadToCloudinary = async (fileBuffer, folder, resourceType = "auto", originalFilename = "file", contentType = "application/octet-stream") => {
  try {
    const result = await putObject(fileBuffer, folder, originalFilename, contentType);

    // Return in Cloudinary-compatible format for backward compatibility
    return {
      secure_url: result.url,
      public_id: result.key,
      url: result.url,
    };
  } catch (error) {
    console.error("S3 upload error:", error);
    throw error;
  }
};

/**
 * Delete file from AWS S3 (replaces deleteFromCloudinary)
 * @param {string} publicId - S3 object key (or full URL)
 * @param {string} resourceType - Unused, kept for compatibility
 * @returns {Promise<Object>} Deletion result
 */
export const deleteFromCloudinary = async (publicId, resourceType = "image") => {
  try {
    // If it's a full S3 URL, extract the key
    let key = publicId;
    if (publicId && publicId.includes("amazonaws.com/")) {
      key = publicId.split("amazonaws.com/")[1];
    }

    return await deleteObject(key);
  } catch (error) {
    console.error("S3 delete error:", error);
    throw error;
  }
};

/**
 * Get S3 URL from key (replaces getCloudinaryUrl)
 * @param {string} publicId - S3 object key or full URL
 * @param {Object} options - Unused, kept for compatibility
 * @returns {string} S3 URL
 */
export const getCloudinaryUrl = (publicId, options = {}) => {
  if (!publicId) return null;

  // If it's already a full URL, return it
  if (publicId.startsWith("http")) {
    return publicId;
  }

  // Construct S3 URL from key
  return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${publicId}`;
};

/**
 * Get a pre-signed URL for private S3 objects
 * @param {string} key - S3 object key
 * @param {number} expiresIn - URL expiration in seconds
 * @returns {Promise<string>} Pre-signed URL
 */
export const getSignedS3Url = async (key, expiresIn = 3600) => {
  return await getObject(key, expiresIn);
};

// Export S3 utilities directly for new code
export { putObject as uploadToS3 } from "./Aws/putObject.js";
export { deleteObject as deleteFromS3 } from "./Aws/deleteObject.js";
export { getObject as getFromS3 } from "./Aws/getObject.js";
