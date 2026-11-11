import PouchDB from 'pouchdb-browser';
import type {
  AgentRecord,
  AppSettings,
  CustomModel,
  DecisionRecord,
  ExtractRecord,
  ImageGenRecord,
  ProviderProfile,
} from './types';

export const db = new PouchDB('ai-test-agent');

export type AnyDoc =
  | AgentRecord
  | ProviderProfile
  | AppSettings
  | CustomModel
  | DecisionRecord
  | ImageGenRecord
  | ExtractRecord;

export async function getDoc<T extends AnyDoc>(id: string): Promise<T | null> {
  try {
    return (await db.get(id)) as unknown as T;
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

export async function putDoc<T extends AnyDoc>(doc: T): Promise<T> {
  const response = await db.put(doc as unknown as PouchDB.Core.PutDocument<Record<string, unknown>>);
  return { ...doc, _rev: response.rev };
}

export async function removeDoc(doc: { _id: string; _rev?: string }): Promise<void> {
  if (!doc._rev) return;
  await db.remove(doc._id, doc._rev);
}

export async function allDocsByPrefix<T extends AnyDoc>(prefix: string): Promise<T[]> {
  const result = await db.allDocs({
    include_docs: true,
    startkey: prefix,
    endkey: `${prefix}￰`,
  });
  return result.rows
    .map((row) => row.doc)
    .filter((doc): doc is PouchDB.Core.ExistingDocument<Record<string, unknown>> => doc != null) as unknown as T[];
}

function isNotFound(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'status' in err && (err as { status: unknown }).status === 404;
}
