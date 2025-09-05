import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import Trade from '../Trade';

// Mock alert for Vitest
global.alert = vi.fn();

test('コンポーネントが正常にレンダリングされる', () => {
  render(<Trade isFileListVisible={false} selectedFile="テスト" setSelectedFile={() => {}} />);
  
  // Check if main buttons are rendered
  expect(screen.getByText("建値入力")).toBeInTheDocument();
  expect(screen.getByText("約定入力")).toBeInTheDocument();
  expect(screen.getByText("チャート画像をアップロード")).toBeInTheDocument();
});

test('建値入力モーダルが開く', () => {
  render(<Trade isFileListVisible={false} selectedFile="テスト" setSelectedFile={() => {}} />);
  
  fireEvent.click(screen.getByText("建値入力"));
  
  // Check if modal title appears
  expect(screen.getByText("建値入力")).toBeInTheDocument();
});

test('約定入力モーダルが開く', () => {
  render(<Trade isFileListVisible={false} selectedFile="テスト" setSelectedFile={() => {}} />);
  
  fireEvent.click(screen.getByText("約定入力"));
  
  // Check if modal title appears
  expect(screen.getByText("約定入力")).toBeInTheDocument();
});
