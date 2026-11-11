import { describe, expect, it, vi } from 'vitest';
import { useLocation } from 'react-router-dom';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/render';
import { Toolbar } from './toolbar';

describe('Toolbar', () => {
  it('navigates to /decision from the app menu', async () => {
    const user = userEvent.setup();
    function Location() { return <output aria-label="Route">{useLocation().pathname}</output>; }
    renderWithProviders(<><Toolbar name="Untitled" onNew={() => {}} onSave={() => {}} onSaveAs={() => {}} /><Location /></>);
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Structured decisions' }));
    expect(screen.getByLabelText('Route')).toHaveTextContent('/decision');
  });

  it('opens a menu with every action and nav item from the hamburger trigger', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Toolbar name="Untitled" onNew={() => {}} onSave={() => {}} onSaveAs={() => {}} />,
    );

    await user.click(screen.getByRole('button', { name: 'Menu' }));

    for (const label of ['New', 'Load', 'Save', 'Save as', 'Home', 'Chat & prompt testing', 'Structured decisions', 'Image generation', 'Structured extraction', 'Settings']) {
      expect(screen.getByRole('menuitem', { name: label })).toBeInTheDocument();
    }
  });

  it('calls onNew when the New menu item is selected', async () => {
    const user = userEvent.setup();
    const onNew = vi.fn();
    renderWithProviders(<Toolbar name="Untitled" onNew={onNew} onSave={() => {}} onSaveAs={() => {}} />);

    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'New' }));

    expect(onNew).toHaveBeenCalled();
  });

  it('calls onSave when the Save menu item is selected', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderWithProviders(<Toolbar name="Untitled" onNew={() => {}} onSave={onSave} onSaveAs={() => {}} />);

    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Save' }));

    expect(onSave).toHaveBeenCalled();
  });

  it('calls onSaveAs when the Save as menu item is selected', async () => {
    const user = userEvent.setup();
    const onSaveAs = vi.fn();
    renderWithProviders(<Toolbar name="Untitled" onNew={() => {}} onSave={() => {}} onSaveAs={onSaveAs} />);

    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Save as' }));

    expect(onSaveAs).toHaveBeenCalled();
  });
});
