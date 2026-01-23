import React from 'react';

export const Input = ({ label, icon: Icon, error, className = '', ...props }) => {
    return (
        <div className={`flex flex-col gap-1.5 ${className}`}>
            {label && <label className="text-sm font-bold text-gray-700 ml-1">{label}</label>}
            <div className="relative">
                {Icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Icon size={18} /></div>}
                <input 
                    className={`w-full h-11 bg-gray-50 border rounded-xl px-4 text-gray-900 font-medium outline-none focus:ring-2 focus:bg-white transition-all
                    ${Icon ? 'pl-10' : ''} 
                    ${error ? 'border-red-300 focus:ring-red-100' : 'border-gray-200 focus:border-blue-500 focus:ring-blue-100'}`}
                    {...props} 
                />
            </div>
            {error && <span className="text-xs text-red-500 font-bold ml-1">{error}</span>}
        </div>
    );
};