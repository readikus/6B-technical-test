import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Home from '../app/page';

describe('Home page', () => {
  it('renders the page', () => {
    // Arrange & Act
    render(<Home />);

    // Assert
    expect(screen.getByRole('heading')).toBeDefined();
  });
});
