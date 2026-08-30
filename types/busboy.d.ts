declare module "busboy" {
  import type { IncomingHttpHeaders } from "node:http";
  import type { Readable, Writable } from "node:stream";

  interface BusboyConfig {
    headers: IncomingHttpHeaders;
    limits?: { files?: number; fileSize?: number; fields?: number };
  }

  interface FileInfo {
    filename: string;
    encoding: string;
    mimeType: string;
  }

  interface BusboyFileStream extends Readable {
    truncated: boolean;
    on(event: "limit", listener: () => void): this;
    on(event: "data", listener: (chunk: Uint8Array) => void): this;
  }

  interface Busboy extends Writable {
    on(event: "file", listener: (name: string, stream: BusboyFileStream, info: FileInfo) => void): this;
    on(event: "close", listener: () => void): this;
    on(event: "error", listener: (error: Error) => void): this;
  }

  export default function busboy(config: BusboyConfig): Busboy;
}
