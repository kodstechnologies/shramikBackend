import multer from "multer";
import { uploadToCloudinary, getCloudinaryUrl } from "../utils/cloudinary.js";

// Map field names to Cloudinary folders
const FIELD_TO_FOLDER = {
  aadhaarCard: "aadhaar",
  profilePhoto: "profile",
  resume: "resume",
  experienceCertificate: "experience",
  documents: "documents",
};

// Determine resource type based on MIME type
const getResourceType = (mimetype) => {
  if (mimetype.startsWith("image/")) {
    return "image";
  }
  if (mimetype === "application/pdf" || mimetype.includes("document") || mimetype.includes("word")) {
    return "raw"; // PDFs and documents as raw files
  }
  return "auto"; // Let Cloudinary auto-detect
};

// Configure multer to use memory storage (for Cloudinary upload)
const storage = multer.memoryStorage();

// File filter - Accept all file types
// Set ACCEPT_ALL_FILES=false in .env to restrict to specific types
const fileFilter = (req, file, cb) => {
  // Option to accept all file types (useful for mobile apps with various file types)
  const acceptAllFiles = process.env.ACCEPT_ALL_FILES === "true";

  if (acceptAllFiles) {
    // Accept all file types
    cb(null, true);
    return;
  }

  // Otherwise, use allowed MIME types list
  const allowedMimes = [
    // Images - Common formats
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/avif", // AVIF format
    "image/bmp",
    "image/tiff",
    "image/tif",
    "image/svg+xml",
    "image/svg",
    "image/heic", // iOS HEIC
    "image/heif", // High Efficiency Image Format
    "image/x-icon",
    "image/vnd.microsoft.icon",
    "image/x-png",
    "image/x-citrix-png",
    "image/x-pcx",
    "image/x-portable-pixmap",
    "image/x-portable-bitmap",
    "image/x-portable-graymap",
    "image/x-portable-anymap",
    "image/x-rgb",
    "image/x-xbitmap",
    "image/x-xpixmap",
    "image/x-xwindowdump",
    "image/x-photoshop",
    "image/x-cmu-raster",
    "image/x-freehand",
    "image/x-pict",
    // Documents - Office and text
    "application/pdf",
    "application/msword", // .doc
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
    "application/vnd.ms-excel", // .xls
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "application/vnd.ms-powerpoint", // .ppt
    "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
    "application/vnd.oasis.opendocument.text", // .odt
    "application/vnd.oasis.opendocument.spreadsheet", // .ods
    "application/vnd.oasis.opendocument.presentation", // .odp
    "application/rtf",
    "application/vnd.visio", // .vsd
    "application/vnd.ms-visio.drawing",
    "application/vnd.ms-visio.stencil",
    "application/vnd.ms-visio.template",
    "text/plain",
    "text/csv",
    "text/html",
    "text/xml",
    "text/css",
    "text/javascript",
    "text/markdown",
    "text/yaml",
    "text/x-yaml",
    // Archives and compressed files
    "application/zip",
    "application/x-zip-compressed",
    "application/x-rar-compressed",
    "application/x-rar",
    "application/x-7z-compressed",
    "application/x-tar",
    "application/x-gzip",
    "application/gzip",
    "application/x-bzip",
    "application/x-bzip2",
    "application/x-compress",
    "application/x-compressed",
    "application/x-lzma",
    "application/x-lzh",
    "application/x-lzx",
    "application/x-stuffit",
    "application/x-stuffitx",
    // Video files
    "video/mp4",
    "video/mpeg",
    "video/quicktime", // .mov
    "video/x-msvideo", // .avi
    "video/x-ms-wmv", // .wmv
    "video/x-flv", // .flv
    "video/webm",
    "video/3gpp",
    "video/3gpp2",
    "video/x-matroska", // .mkv
    "video/x-ms-asf",
    "video/x-ms-wm",
    "video/x-ms-wmx",
    "video/x-ms-wvx",
    // Audio files
    "audio/mpeg",
    "audio/mp3",
    "audio/x-mpeg-3",
    "audio/mp4",
    "audio/x-m4a",
    "audio/x-aac",
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/webm",
    "audio/ogg",
    "audio/x-ogg",
    "audio/flac",
    "audio/x-flac",
    "audio/aac",
    "audio/x-aiff",
    "audio/basic",
    "audio/midi",
    "audio/x-midi",
    "audio/mid",
    "audio/x-mid",
    "audio/x-midi-file",
    "audio/amr",
    "audio/amr-wb",
    // Fonts
    "font/ttf",
    "font/otf",
    "font/woff",
    "font/woff2",
    "application/font-woff",
    "application/font-woff2",
    "application/x-font-ttf",
    "application/x-font-otf",
    "application/x-font-woff",
    "application/x-font-woff2",
    // CAD and design files
    "application/x-autocad",
    "application/acad",
    "application/x-dwg",
    "image/vnd.dwg",
    "image/x-dwg",
    "application/x-dxf",
    "image/vnd.dxf",
    "application/x-illustrator",
    "application/postscript",
    "application/x-eps",
    "image/x-eps",
    // Code and development files
    "application/json",
    "application/xml",
    "text/x-java-source",
    "text/x-python",
    "text/x-c",
    "text/x-c++",
    "text/x-csharp",
    "text/x-php",
    "text/x-ruby",
    "text/x-perl",
    "text/x-shellscript",
    "application/x-sh",
    "application/x-bsh",
    // Database files
    "application/x-sqlite3",
    "application/x-sql",
    "application/x-dbf",
    "application/x-msaccess",
    // Generic binary (fallback for unknown types)
    "application/octet-stream",
    "application/x-binary",
    "application/binary",
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    // More helpful error message
    cb(
      new Error(
        `Invalid file type: ${file.mimetype || "unknown"}. ` +
        `To accept all file types, set ACCEPT_ALL_FILES=true in environment variables.`
      ),
      false
    );
  }
};

// Configure multer
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file limit
    fieldSize: 50 * 1024 * 1024, // 50MB for non-file fields (like JSON strings in form-data)
    fieldNameSize: 100, // Max field name size
    fields: 20, // Max number of non-file fields
    files: 10, // Max number of file fields
  },
});

// Middleware for single file uploads
export const uploadSingle = (fieldName) => upload.single(fieldName);

// Middleware for multiple file uploads
export const uploadMultiple = (fieldName, maxCount = 5) =>
  upload.array(fieldName, maxCount);

// Middleware for multiple fields
export const uploadFields = (fields) => upload.fields(fields);

/**
 * Middleware to upload files to Cloudinary after multer processes them
 * This should be used after uploadFields/uploadSingle/uploadMultiple
 */
export const uploadToCloudinaryMiddleware = async (req, res, next) => {
  try {
    // Handle single file
    if (req.file) {
      // Validate file has buffer
      if (!req.file.buffer) {
        throw new Error(
          `File "${req.file.fieldname}" has no buffer. ` +
          `Make sure you're sending actual file data via multipart/form-data, not file paths as strings. ` +
          `In Flutter, use MultipartFile.fromPath() instead of adding paths to request.fields.`
        );
      }

      const folder = FIELD_TO_FOLDER[req.file.fieldname] || "documents";
      const resourceType = getResourceType(req.file.mimetype);

      const result = await uploadToCloudinary(
        req.file.buffer,
        folder,
        resourceType
      );

      // Store Cloudinary URL and public_id in file object
      req.file.cloudinaryUrl = result.secure_url;
      req.file.publicId = result.public_id;
      req.file.url = result.secure_url; // For backward compatibility
    }

    // Handle multiple files
    if (req.files) {
      for (const fieldname in req.files) {
        const files = Array.isArray(req.files[fieldname])
          ? req.files[fieldname]
          : [req.files[fieldname]];

        for (const file of files) {
          // Validate file has buffer
          if (!file.buffer) {
            throw new Error(
              `File "${fieldname}" has no buffer. ` +
              `Make sure you're sending actual file data via multipart/form-data, not file paths as strings. ` +
              `In Flutter, use MultipartFile.fromPath() instead of adding paths to request.fields.`
            );
          }

          const folder = FIELD_TO_FOLDER[fieldname] || "documents";
          const resourceType = getResourceType(file.mimetype);

          const result = await uploadToCloudinary(
            file.buffer,
            folder,
            resourceType
          );

          // Store Cloudinary URL and public_id in file object
          file.cloudinaryUrl = result.secure_url;
          file.publicId = result.public_id;
          file.url = result.secure_url; // For backward compatibility
        }
      }
    }

    next();
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    next(error);
  }
};

/**
 * Helper to get file URL (Cloudinary URL or local path for backward compatibility)
 * @param {string|Object} filePathOrFile - File path string or file object with cloudinaryUrl
 * @returns {string|null} File URL
 */
export const getFileUrl = (filePathOrFile) => {
  if (!filePathOrFile) return null;

  // If it's a file object with cloudinaryUrl (from Cloudinary upload)
  if (typeof filePathOrFile === "object" && filePathOrFile.cloudinaryUrl) {
    return filePathOrFile.cloudinaryUrl;
  }

  // If it's already a URL (Cloudinary URL stored in DB)
  if (typeof filePathOrFile === "string" && filePathOrFile.startsWith("http")) {
    return filePathOrFile;
  }

  // If it's a file object with url property
  if (typeof filePathOrFile === "object" && filePathOrFile.url) {
    return filePathOrFile.url;
  }

  // If it's a file object with path (local file - for backward compatibility)
  if (typeof filePathOrFile === "object" && filePathOrFile.path) {
    // In production/Vercel, this shouldn't happen, but handle it gracefully
    // Return the path as-is (might be a relative path from old uploads)
    return filePathOrFile.path;
  }

  // If it's a string path (local file - for backward compatibility)
  if (typeof filePathOrFile === "string") {
    // If it's already a full URL, return it
    if (filePathOrFile.startsWith("http")) {
      return filePathOrFile;
    }
    // Otherwise, it's a local path (shouldn't happen in production)
    return filePathOrFile;
  }

  return null;
};
