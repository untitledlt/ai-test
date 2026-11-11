import type { BatchTask, MultipleResultsSnapshot } from '../types';

export type AgentRecord = {
  _id: string;
  _rev?: string;
  type: 'record';
  name: string;
  content: string;
  multipleTasks?: BatchTask[];
  multipleCallCount?: number;
  multipleTestSuite?: string;
  multipleResultsHistory?: MultipleResultsSnapshot[];
  /** @deprecated pre-history single-snapshot field; migrated on read, see lib/multiple-call-utils.ts */
  multipleResults?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProviderProfile = {
  _id: string;
  _rev?: string;
  type: 'provider';
  label: string;
  serverURL: string;
  apiKey: string;
  createdAt: string;
  updatedAt: string;
};

export type AppSettings = {
  _id: 'app-settings';
  _rev?: string;
  type: 'settings';
  activeProviderId: string | null;
  syncRemoteURL?: string;
  syncEnabled?: boolean;
};

export type CustomModel = {
  _id: string;
  _rev?: string;
  type: 'model';
  value: string;
  createdAt: string;
};

export type DecisionRecord = {
  _id: string;
  _rev?: string;
  type: 'decision';
  name: string;
  /** JSON string of { state, questions, tasks, callCount } */
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type ImageGenRecord = {
  _id: string;
  _rev?: string;
  type: 'image-gen';
  name: string;
  /** JSON string of { prompt, inputImages, tasks, callCount } */
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type ExtractRecord = {
  _id: string;
  _rev?: string;
  type: 'extract';
  name: string;
  /** JSON string of { instructions, schema, inputImages, tasks, callCount } */
  content: string;
  createdAt: string;
  updatedAt: string;
};
