import { render, screen } from '@testing-library/react';
import React from 'react';

describe('React smoke test', () => {
  function Ok() {
    return <button>ok</button>;
  }

  it('react smoke', () => {
    render(<Ok />);
    expect(screen.getByRole('button', { name: 'ok' })).toBeInTheDocument();
  });
});
