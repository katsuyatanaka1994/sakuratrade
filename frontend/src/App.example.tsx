import React from 'react';
import { TradesPage } from './pages/TradesPage';
import './index.css';

// 使用例：App.tsxでの統合
function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto">
        <TradesPage />
      </div>
    </div>
  );
}

export default App;