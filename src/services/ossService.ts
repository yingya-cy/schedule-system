import OSS from 'ali-oss';

let client: OSS | null = null;

function getClient(): OSS {
  if (!client) {
    const config: OSS.Options = {
      region: process.env.OSS_REGION || 'oss-cn-hangzhou',
      accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
      bucket: process.env.OSS_BUCKET || 'academic-ether-files',
      secure: true,
    };
    if (process.env.OSS_ENDPOINT) {
      config.endpoint = process.env.OSS_ENDPOINT;
    }
    client = new OSS(config);
  }
  return client;
}

/**
 * Generate a presigned URL for direct upload (PUT method).
 * The client uploads the file directly to OSS using this URL.
 */
export async function generatePresignedUploadUrl(
  objectKey: string,
  contentType?: string,
  expiresSeconds = 3600
): Promise<{ uploadUrl: string; objectKey: string; expiresIn: number }> {
  const oss = getClient();

  const url = await oss.signatureUrlV4({
    method: 'PUT',
    key: objectKey,
    expires: expiresSeconds,
    headers: {
      ...(contentType ? { 'Content-Type': contentType } : {}),
    },
  });

  return { uploadUrl: url, objectKey, expiresIn: expiresSeconds };
}

/**
 * Generate a presigned URL for download (GET method).
 */
export async function generatePresignedDownloadUrl(
  objectKey: string,
  expiresSeconds = 3600
): Promise<string> {
  const oss = getClient();
  return oss.signatureUrlV4({
    method: 'GET',
    key: objectKey,
    expires: expiresSeconds,
  });
}

/**
 * Build the public OSS URL for a stored object.
 */
export function getObjectUrl(objectKey: string): string {
  const bucket = process.env.OSS_BUCKET || 'academic-ether-files';
  const region = process.env.OSS_REGION || 'oss-cn-hangzhou';
  const endpoint = process.env.OSS_ENDPOINT;
  if (endpoint) {
    return `${endpoint}/${objectKey}`;
  }
  return `https://${bucket}.${region}.aliyuncs.com/${objectKey}`;
}

/**
 * Build an object key from folder context and filename.
 */
export function buildObjectKey(activityId: number, folderId: number, filename: string): string {
  const ts = Date.now();
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `file-center/${activityId}/${folderId}/${ts}_${safeName}`;
}
