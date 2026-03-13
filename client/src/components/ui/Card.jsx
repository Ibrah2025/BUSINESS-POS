import React from 'react';

export default function Card({ title, children, onClick, className = '' }) {
  const Component = onClick ? 'button' : 'div';
  return (
    <Component
      onClick={onClick}
      className={`
        bg-white rounded-xl shadow-sm border border-gray-100 p-4 w-full text-left
        ${onClick ? 'cursor-pointer hover:shadow-md active:scale-[0.99] transition-all' : ''}
        ${className}
      `}
    >
      {title && <h3 className="text-sm font-semibold text-gray-700 mb-2">{title}</h3>}
      {children}
    </Component>
  );
}
