declare module 'ali-oss' {
  namespace OSS {
    interface Options {
      region?: string;
      accessKeyId?: string;
      accessKeySecret?: string;
      bucket?: string;
      secure?: boolean;
      endpoint?: string;
      authorizationV4?: boolean;
      stsToken?: string;
      refreshSTSToken?: () => Promise<{ accessKeyId: string; accessKeySecret: string; stsToken: string }>;
      refreshSTSTokenInterval?: number;
      timeout?: number;
      retryMax?: number;
      signatureVersion?: string;
      authorizationV4Options?: { region: string; bucket: string };
    }
  }

  class OSS {
    constructor(options: OSS.Options);
    put(objectName: string, file: Buffer | string, options?: Record<string, unknown>): Promise<{ name: string; url: string; res: unknown }>;
    get(objectName: string, file?: string, options?: Record<string, unknown>): Promise<{ content: Buffer; res: { status: number; headers: Record<string, string> } }>;
    signatureUrl(objectName: string, options?: Record<string, unknown>): string;
    signatureUrlV4(method: string, expiresSeconds: number, options: { headers?: Record<string, string> }, objectKey?: string): Promise<string>;
    generateObjectUrl(objectName: string, baseUrl?: string): string;
    head(objectName: string, options?: Record<string, unknown>): Promise<{ res: { status: number; headers: Record<string, string> } }>;
    delete(objectName: string, options?: Record<string, unknown>): Promise<{ res: unknown }>;
    list(query?: Record<string, unknown>, options?: Record<string, unknown>): Promise<{ objects: Array<{ name: string; url: string; size: number; lastModified: string }>; prefixes: string[]; nextMarker: string | null; isTruncated: boolean }>;
  }

  export = OSS;
}

declare module 'multer' {
  import { Request } from 'express';

  interface File {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
  }

  interface Multer {
    (options?: {
      storage?: StorageEngine;
      limits?: { fileSize?: number };
      fileFilter?: (req: Request, file: File, cb: (error: Error | null, acceptFile: boolean) => void) => void;
    }): any;
    memoryStorage(): StorageEngine;
    diskStorage(options: { destination: string; filename?: (req: Request, file: File, cb: (error: Error | null, filename: string) => void) => void }): StorageEngine;
  }

  interface StorageEngine {
    _handleFile: any;
    _removeFile: any;
  }

  const multer: Multer;
  export default multer;
}
