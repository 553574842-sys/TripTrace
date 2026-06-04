import fs from 'fs';
import path from 'path';

const serverRoot = path.resolve(__dirname, '../..');

export function getDataRoot(): string {
  return path.resolve(process.env.TRIPTRACE_DATA_ROOT || path.join(serverRoot, 'data'));
}

export function getUploadsRoot(): string {
  return path.resolve(process.env.TRIPTRACE_UPLOAD_ROOT || path.join(serverRoot, 'uploads'));
}

export function getDataDir(name: string): string {
  return path.join(getDataRoot(), name);
}

export function getUploadDir(name: string): string {
  return path.join(getUploadsRoot(), name);
}

export function ensureWritableDir(dir: string): string {
  fs.mkdirSync(dir, { recursive: true });
  fs.accessSync(dir, fs.constants.R_OK | fs.constants.W_OK);
  return dir;
}
