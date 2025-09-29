import React from 'react';
import { Button } from './UI/button';

interface FilterButtonProps {
  hasActive: boolean;
  onOpen: () => void;
}

export const FilterButton: React.FC<FilterButtonProps> = ({ hasActive, onOpen }) => {
  console.log('FilterButton component rendered, hasActive:', hasActive);
  
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('FilterButton clicked, calling onOpen');
    onOpen();
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      className="relative flex items-center gap-2 hover:bg-gray-50"
    >
      {/* Filter Icon */}
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z"
        />
      </svg>
      
      <span>フィルター</span>
      
      {/* Active Indicator */}
      {hasActive && (
        <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />
      )}
    </Button>
  );
};