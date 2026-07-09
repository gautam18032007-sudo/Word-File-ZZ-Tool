declare module "pizzip" {
  interface FileOptions {
    compression?: string;
    compressionOptions?: Record<string, unknown>;
  }

  interface File {
    asText(): string;
    asArrayBuffer(): ArrayBuffer;
    asUint8Array(): Uint8Array;
    asBinary(): string;
  }

  interface GenerateOptions {
    type: "nodebuffer" | "blob" | "arraybuffer" | "uint8array" | "base64" | "binarystring";
    compression?: "DEFLATE" | "STORE";
    compressionOptions?: { level: number };
    streamFiles?: boolean;
    comment?: string;
    mimeType?: string;
    platform?: "DOS" | "UNIX";
  }

  class PizZip {
    constructor(data?: Buffer | ArrayBuffer | Uint8Array | string);
    file(name: string): File | null;
    file(name: string, data: string | Buffer | Uint8Array): this;
    folder(name: string): PizZip;
    files: Record<string, File & { name: string; dir: boolean }>;
    generate(options: GenerateOptions & { type: "nodebuffer" }): Buffer;
    generate(options: GenerateOptions & { type: "blob" }): Blob;
    generate(options: GenerateOptions & { type: "base64" }): string;
    generate(options: GenerateOptions): Buffer | Blob | string;
  }

  export = PizZip;
}
