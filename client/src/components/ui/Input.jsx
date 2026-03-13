import React, { useState } from 'react';

export default function Input({
  label,
  type = 'text',
  value,
  onChange,
  error,
  prefix,
  placeholder,
  disabled = false,
  className = '',
  ...rest
}) {
  const [showPassword, setShowPassword] = useState(false);
  const inputType = type === 'password' && showPassword ? 'text' : type;

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      )}
      <div className={`
        flex items-center rounded-lg border bg-white transition-colors
        ${error ? 'border-red-400 ring-1 ring-red-400' : 'border-gray-300 focus-within:border-green-500 focus-within:ring-1 focus-within:ring-green-500'}
        ${disabled ? 'bg-gray-100 opacity-60' : ''}
      `}>
        {prefix && (
          <span className="pl-3 text-gray-500 text-sm select-none whitespace-nowrap">{prefix}</span>
        )}
        <input
          type={inputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 px-3 py-2.5 text-sm bg-transparent outline-none rounded-lg min-w-0"
          {...rest}
        />
        {type === 'password' && (
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            className="px-3 text-gray-400 hover:text-gray-600"
            tabIndex={-1}
          >
            {showPassword ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9.27-3.11-11-7.5a11.72 11.72 0 013.168-4.477M6.343 6.343A9.97 9.97 0 0112 5c5 0 9.27 3.11 11 7.5a11.7 11.7 0 01-4.168 4.477M6.343 6.343L3 3m3.343 3.343l2.829 2.829M17.657 17.657L21 21m-3.343-3.343l-2.829-2.829M9.878 9.878a3 3 0 004.243 4.243" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-.274.86-.653 1.674-1.124 2.424M12 19c-1.657 0-3.22-.39-4.604-1.076" />
              </svg>
            )}
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
