import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

function Hello() {
  return <h1>vitest-ok</h1>;
}

describe('web test infra', () => {
  it('renders a component via RTL', () => {
    render(<Hello />);
    expect(screen.getByText('vitest-ok')).toBeTruthy();
  });
});
