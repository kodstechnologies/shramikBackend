import { s3Client } from "./s3-credentials.js";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

/**
 * Delete a file from AWS S3
 * @param {string} key - S3 object key
 * @returns {Promise<Object>} Deletion result with status
 */
export const deleteObject = async (key) => {
    try {
        console.log("key", key);
        const params = {
            Bucket: process.env.AWS_S3_BUCKET,
            Key: key,
        };

        const command = new DeleteObjectCommand(params);
        const data = await s3Client.send(command);

        if (data.$metadata.httpStatusCode !== 204) {
            return { status: 400, data };
        }
        return { status: 204 };
    } catch (err) {
        console.error(err);
    }
};
