import { randomUUID } from './uuid';

export type ImageGenTask = {
  id: string;
  model: string;
  excluded?: boolean;
  aspectRatio?: string;
  resolution?: string;
};

export function createImageGenTask(): ImageGenTask {
  return { id: randomUUID(), model: '', excluded: false };
}

export type InputImage = { id: string; dataUrl: string; fileName?: string };

export function createInputImage(dataUrl: string, fileName?: string): InputImage {
  return { id: randomUUID(), dataUrl, fileName };
}
