import OSS from 'ali-oss';

let client: OSS | null = null;

const PLACEHOLDER_VALUES = ['', 'your-access-key-id', 'your-access-key-secret'];

function isOssConfigured(): boolean {
  const id = process.env.OSS_ACCESS_KEY_ID || '';
  const secret = process.env.OSS_ACCESS_KEY_SECRET || '';
  return !PLACEHOLDER_VALUES.includes(id) && !PLACEHOLDER_VALUES.includes(secret);
}

function getClient(): OSS {
  if (!client) {
    const config: OSS.Options = {
      region: process.env.OSS_REGION || 'oss-cn-hangzhou',
      accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
      bucket: process.env.OSS_BUCKET || 'academic-ether-files',
      secure: true,
      authorizationV4: true,
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
  if (!isOssConfigured()) {
    throw new Error('OSS 未配置：请在 .env 中设置有效的 OSS_ACCESS_KEY_ID 和 OSS_ACCESS_KEY_SECRET');
  }
  const oss = getClient();

  const url = await oss.signatureUrlV4('PUT', expiresSeconds, {
    headers: {
      'Content-Type': contentType || 'application/octet-stream',
      'Content-Disposition': 'inline',
    },
  }, objectKey);

  return { uploadUrl: url, objectKey, expiresIn: expiresSeconds };
}

/**
 * Generate a presigned URL for download (GET method).
 */
export async function generatePresignedDownloadUrl(
  objectKey: string,
  expiresSeconds = 3600
): Promise<string> {
  if (!isOssConfigured()) {
    throw new Error('OSS 未配置：请在 .env 中设置有效的 OSS_ACCESS_KEY_ID 和 OSS_ACCESS_KEY_SECRET');
  }
  const oss = getClient();
  return oss.signatureUrlV4('GET', expiresSeconds, {}, objectKey);
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
 * Fetch an object's content and headers from OSS.
 */
export async function getObjectContent(objectKey: string): Promise<{ body: Buffer; contentType: string }> {
  if (!isOssConfigured()) {
    throw new Error('OSS 未配置：请在 .env 中设置有效的 OSS_ACCESS_KEY_ID 和 OSS_ACCESS_KEY_SECRET');
  }
  const oss = getClient();
  const result = await oss.get(objectKey);
  return {
    body: result.content as Buffer,
    contentType: result.res?.headers?.['content-type'] as string || 'application/octet-stream',
  };
}

/**
 * Sanitize a path segment for use in OSS key (remove dangerous chars).
 */
function safePathSegment(name: string): string {
  return name
    .replace(/\.\./g, '_')
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim() || 'unknown';
}

/**
 * Build an object key using names and file ID for readability.
 * Format: file-center/{activityName}/{folderPath}/{fileId}_{originalFilename}
 */
export function buildObjectKey(activityName: string, folderPath: string, fileId: number, filename: string): string {
  const safeActivity = safePathSegment(activityName);
  const safePath = safePathSegment(folderPath);
  const safeName = filename.replace(/[/\\]/g, '_');
  return `file-center/${safeActivity}/${safePath}/${fileId}_${safeName}`;
}
