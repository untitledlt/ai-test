import { describe, expect, it } from 'vitest';
import { createImageGenTask, createInputImage } from './image-gen-utils';

describe('createImageGenTask', () => {
  it('creates a blank task with no model and not excluded', () => {
    const task = createImageGenTask();
    expect(task).toEqual({ id: expect.any(String), model: '', excluded: false });
  });

  it('gives each task a unique id', () => {
    const a = createImageGenTask();
    const b = createImageGenTask();
    expect(a.id).not.toBe(b.id);
  });
});

describe('createInputImage', () => {
  it('creates an input image entry with the given data URL and file name', () => {
    const image = createInputImage('data:image/jpeg;base64,AAA', 'photo.jpg');
    expect(image).toEqual({ id: expect.any(String), dataUrl: 'data:image/jpeg;base64,AAA', fileName: 'photo.jpg' });
  });

  it('gives each input image a unique id', () => {
    const a = createInputImage('data:image/jpeg;base64,AAA');
    const b = createInputImage('data:image/jpeg;base64,AAA');
    expect(a.id).not.toBe(b.id);
  });
});
