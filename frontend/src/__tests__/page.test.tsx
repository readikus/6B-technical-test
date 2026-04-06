import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Home from '../app/page';

describe('Home page', () => {
  it('renders the page heading', () => {
    // Arrange & Act
    render(<Home />);

    // Assert
    expect(screen.getByRole('heading', { name: /sixbee healthtech/i })).toBeDefined();
  });

  it('renders the booking form', () => {
    // Arrange & Act
    render(<Home />);

    // Assert
    expect(screen.getByRole('button', { name: /book appointment/i })).toBeDefined();
  });
});
