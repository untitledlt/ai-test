import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/render';
import { ImagePicker } from './image-picker';
import type { InputImage } from '../lib/image-gen-utils';

vi.mock('../lib/image-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/image-utils')>()),
  resampleImage: vi.fn().mockResolvedValue('data:image/jpeg;base64,AAA'),
}));

describe('ImagePicker', () => {
  it('shows a placeholder when there are no images', () => {
    renderWithProviders(<ImagePicker images={[]} onChange={() => {}} />);
    expect(screen.getByText('No images yet')).toBeInTheDocument();
  });

  it('adds a resampled image from a chosen file', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<ImagePicker images={[]} onChange={onChange} />);

    const file = new File(['fake-bytes'], 'bike.webp', { type: 'image/webp' });
    const input = screen.getByLabelText('Add image') as HTMLInputElement;
    await user.upload(input, file);

    await vi.waitFor(() =>
      expect(onChange).toHaveBeenCalledWith([
        expect.objectContaining({ dataUrl: 'data:image/jpeg;base64,AAA', fileName: 'bike.webp' }),
      ]),
    );
  });

  it('adds a resampled image pasted from the clipboard', async () => {
    const onChange = vi.fn();
    renderWithProviders(<ImagePicker images={[]} onChange={onChange} />);

    const file = new File(['fake-bytes'], 'screenshot.png', { type: 'image/png' });
    fireEvent.paste(window, {
      clipboardData: { items: [{ type: 'image/png', getAsFile: () => file }] },
    });

    await vi.waitFor(() =>
      expect(onChange).toHaveBeenCalledWith([
        expect.objectContaining({ dataUrl: 'data:image/jpeg;base64,AAA', fileName: 'screenshot.png' }),
      ]),
    );
  });

  it('ignores a paste that has no image data', async () => {
    const onChange = vi.fn();
    renderWithProviders(<ImagePicker images={[]} onChange={onChange} />);

    fireEvent.paste(window, {
      clipboardData: { items: [{ type: 'text/plain', getAsFile: () => null }] },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('stops listening for paste after unmount', async () => {
    const onChange = vi.fn();
    const { unmount } = renderWithProviders(<ImagePicker images={[]} onChange={onChange} />);
    unmount();

    const file = new File(['fake-bytes'], 'screenshot.png', { type: 'image/png' });
    fireEvent.paste(window, {
      clipboardData: { items: [{ type: 'image/png', getAsFile: () => file }] },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('removes an image when its remove button is clicked', async () => {
    const user = userEvent.setup();
    const images: InputImage[] = [{ id: '1', dataUrl: 'data:image/jpeg;base64,AAA', fileName: 'a.jpg' }];
    const onChange = vi.fn();
    renderWithProviders(<ImagePicker images={images} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /remove/i }));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('opens a full-size dialog when an image thumbnail is clicked', async () => {
    const user = userEvent.setup();
    const images: InputImage[] = [{ id: '1', dataUrl: 'data:image/jpeg;base64,AAA', fileName: 'a.jpg' }];
    renderWithProviders(<ImagePicker images={images} onChange={() => {}} />);

    await user.click(screen.getByRole('button', { name: /view larger/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('img', { name: 'a.jpg' })).toHaveAttribute(
      'src',
      'data:image/jpeg;base64,AAA',
    );
  });

  it('moves an image down when its move-down button is clicked', async () => {
    const user = userEvent.setup();
    const images: InputImage[] = [
      { id: '1', dataUrl: 'data:image/jpeg;base64,AAA', fileName: 'a.jpg' },
      { id: '2', dataUrl: 'data:image/jpeg;base64,BBB', fileName: 'b.jpg' },
    ];
    const onChange = vi.fn();
    renderWithProviders(<ImagePicker images={images} onChange={onChange} />);

    await user.click(screen.getAllByRole('button', { name: /move down/i })[0]);

    expect(onChange).toHaveBeenCalledWith([images[1], images[0]]);
  });
});
