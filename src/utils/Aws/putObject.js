import { s3Client } from "./s3-credentials.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import path from "path";

/**
 * Upload file to AWS S3
 * @param {Buffer} fileBuffer - File buffer from multer
 * @param {string} folder - Folder path (e.g., 'aadhaar', 'profile', 'resume')
 * @param {string} originalFilename - Original filename for extension
 * @param {string} contentType - MIME type of the file
 * @returns {Promise<Object>} Upload result with url and key
 */
export const putObject = async (fileBuffer, folder, originalFilename, contentType) => {
    try {
        // Generate unique filename with timestamp
        const ext = path.extname(originalFilename) || "";
        const safeName = path.basename(originalFilename, ext)
            .replace(/[^a-zA-Z0-9]/g, "_")
            .substring(0, 50);
        const timestamp = Date.now();
        const fileName = `shramik/${folder}/${safeName}-${timestamp}${ext}`;

        const params = {
            Bucket: process.env.AWS_S3_BUCKET,
            Key: fileName,
            Body: fileBuffer,
            ContentType: contentType,
        };

        const command = new PutObjectCommand(params);
        const data = await s3Client.send(command);

        if (data.$metadata.httpStatusCode !== 200) {
            throw new Error("Failed to upload file to S3");
        }

        // Construct the public URL
        const url = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

        return { url, key: fileName };
    } catch (err) {
        console.error("Error uploading file to S3:", err);
        throw err;
    }
};
