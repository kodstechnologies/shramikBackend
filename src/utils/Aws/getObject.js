import { s3Client } from "./s3-credentials.js";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Get a pre-signed URL for a private S3 object
 * @param {string} key - S3 object key
 * @param {number} expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
 * @returns {Promise<string>} Pre-signed URL
 */
export const getObject = async (key, expiresIn = 3600) => {
    try {
        const params = {
            Bucket: process.env.AWS_S3_BUCKET,
            Key: key,
        };

        const command = new GetObjectCommand(params);
        const data = await s3Client.send(command);
        const url = await getSignedUrl(s3Client, command, { expiresIn });

        console.log(data);
        return url;
    } catch (err) {
        console.error(err);
    }
};
