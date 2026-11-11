/** Provider profiles and connection settings stay on this device. The sync URL
 * can contain database credentials; remote settings must not redirect local sync.
 * Check IDs as well as types so deletion tombstones are excluded too.
 */
export function shouldSyncDocument(doc: {
  _id?: string;
  type?: string;
  apiKey?: unknown;
  syncRemoteURL?: unknown;
}): boolean {
  return !doc._id?.startsWith('provider:') && doc._id !== 'app-settings'
    && doc.type !== 'provider' && doc.type !== 'settings'
    && !('apiKey' in doc) && !('syncRemoteURL' in doc);
}
