import type { WallAttachment } from './learningWall';

// Keep File objects in memory. Never serialize large binary payloads into Firestore.
const files = new Map<string, File>();
export function rememberWallFile(file: File): WallAttachment {
  const id = crypto.randomUUID();
  files.set(id, file);
  return { id, kind: 'file', name: file.name, size: file.size, url: `wall-local:${id}` };
}
export function pendingWallFile(item: WallAttachment): File | undefined {
  const file = files.get(item.id);
  return item.url === `wall-local:${item.id}` && file?.name === item.name && file.size === item.size ? file : undefined;
}
export function forgetWallFile(id: string): void { files.delete(id); }
