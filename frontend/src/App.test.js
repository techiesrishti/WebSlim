import { render, screen } from '@testing-library/react';
import App from './App';

test('renders WebSlim app shell', () => {
  render(<App />);
  // Basic smoke assertions for the main shell (avoid ambiguous text like WebSlim)
  expect(screen.getByText(/Website Analyzer/i)).toBeInTheDocument();
});


