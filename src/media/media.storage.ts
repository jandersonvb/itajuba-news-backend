import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';

/**
 * Keeps uploaded files on local disk, in MEDIA_DIR (default `uploads/`). In production this
 * directory must be a persistent volume; swap this class for object storage (S3, R2) to scale out.
 */
@Injectable()
export class MediaStorage {
  private readonly dir = resolve(process.env.MEDIA_DIR || 'uploads');

  async save(filename: string, data: Buffer) {
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.path(filename), data, { flag: 'wx' });
  }

  async exists(filename: string) {
    try {
      return (await stat(this.path(filename))).isFile();
    } catch {
      return false;
    }
  }

  read(filename: string) {
    return createReadStream(this.path(filename));
  }

  async remove(filename: string) {
    await rm(this.path(filename), { force: true });
  }

  /** `basename` keeps every file inside the directory even if a name slips past validation. */
  private path(filename: string) {
    return join(this.dir, basename(filename));
  }
}
