// Import React first to ensure it's available for component mocks
const React = require('react');
global.React = React;

// Setup test environment variables
process.env.NODE_ENV = 'test';
process.env.VITE_API_BASE_URL = 'http://localhost:8000';

// Polyfill TextEncoder/TextDecoder for Jest
const { TextEncoder, TextDecoder } = require('util');

if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder;
}
if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = TextDecoder;
}

// Mock import.meta for Jest
if (typeof globalThis.import === 'undefined') {
  globalThis.import = {};
}
if (typeof globalThis.import.meta === 'undefined') {
  globalThis.import.meta = {
    env: {
      VITE_API_BASE_URL: process.env.VITE_API_BASE_URL
    }
  };
}

// Mock marked library for Jest
jest.mock('marked', () => ({
  marked: {
    parse: jest.fn((markdown) => `<p>${markdown}</p>`)
  }
}));

// Mock API services
jest.mock('@/services/api', () => ({
  getAdvice: jest.fn(() => Promise.resolve({
    pattern_name: 'Test Pattern',
    score: 85,
    advice_html: '<p>Test advice</p>'
  }))
}));

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(() => jest.fn())
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock UI components
jest.mock('@/components/UI/button', () => ({
  Button: ({ children, onClick, className }) => (
    React.createElement('button', { onClick, className }, children)
  )
}));

jest.mock('@/components/UI/input', () => ({
  Input: ({ placeholder, onChange }) => (
    React.createElement('input', { placeholder, onChange })
  )
}));

jest.mock('@/components/UI/label', () => ({
  Label: ({ children }) => React.createElement('label', null, children)
}));

jest.mock('@/components/UI/dialog', () => ({
  Dialog: ({ children, open }) => open ? React.createElement('div', null, children) : null,
  DialogContent: ({ children }) => React.createElement('div', null, children),
  DialogHeader: ({ children }) => React.createElement('div', null, children),
  DialogTitle: ({ children }) => React.createElement('h2', null, children)
}));

jest.mock('@/components/UI/textarea', () => ({
  Textarea: ({ placeholder }) => React.createElement('textarea', { placeholder })
}));

jest.mock('@/components/UI/select', () => ({
  Select: ({ children, onValueChange }) => React.createElement('div', { 'data-testid': 'select' }, children),
  SelectContent: ({ children }) => React.createElement('div', null, children),
  SelectItem: ({ children, value }) => React.createElement('option', { value }, children),
  SelectTrigger: ({ children }) => React.createElement('button', null, children),
  SelectValue: ({ placeholder }) => React.createElement('span', null, placeholder)
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Settings: () => React.createElement('div', null, 'Settings'),
  LayoutDashboard: () => React.createElement('div', null, 'LayoutDashboard'),
  StickyNote: () => React.createElement('div', null, 'StickyNote'),
  Upload: () => React.createElement('div', null, 'Upload'),
  Send: () => React.createElement('div', null, 'Send'),
  X: () => React.createElement('div', null, 'X'),
  TrendingUp: () => React.createElement('div', null, 'TrendingUp'),
  TrendingDown: () => React.createElement('div', null, 'TrendingDown')
}));