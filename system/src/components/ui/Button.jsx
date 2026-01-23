import React from 'react';
import { Loader2 } from 'lucide-react';

export const Button = ({ children, onClick, variant = 'primary', icon: Icon, isLoading, className = '', ...props }) => {
    const baseStyle = "h-11 px-4 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none";
    
    const variants = {
        primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200",
        success: "bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-200",
        danger: "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100",
        secondary: "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50",
        ghost: "bg-transparent text-gray-500 hover:bg-gray-100"
    };

    return (
        <button 
            onClick={onClick} 
            className={`${baseStyle} ${variants[variant]} ${className}`}
            disabled={isLoading}
            {...props}
        >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : Icon && <Icon size={20} />}
            {children}
        </button>
    );
};