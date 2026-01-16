import React from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X, Check, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';

export const Button = ({ children, onClick, variant = 'primary', size = 'md', icon: Icon, className = '', disabled, ...props }) => {
  const variantClass = `btn-${variant}`;
  const sizeClass = `btn-${size}`;
  return (
    <button onClick={disabled ? undefined : onClick} className={`btn ${variantClass} ${sizeClass} ${className}`} disabled={disabled} {...props}>
      {disabled ? <Loader2 className="animate-spin" /> : Icon && <Icon strokeWidth={2.5} />}
      {children}
    </button>
  );
};

export const Input = ({ label, icon: Icon, className = '', ...props }) => (
  <div className="input-wrapper">
    {label && <label className="text-label">{label}</label>}
    <div className="input-container">
      {Icon && <Icon className="input-icon" />}
      <input className={`input-field ${Icon ? 'pl-10' : ''} ${className}`} {...props} />
    </div>
  </div>
);

export const Select = ({ label, children, className = '', ...props }) => (
  <div className="input-wrapper">
    {label && <label className="text-label">{label}</label>}
    <div className="input-container">
      <select className={`input-field appearance-none cursor-pointer ${className}`} {...props}>
        {children}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">▼</div>
    </div>
  </div>
);

export const PageHeader = ({ title, subtitle, children }) => (
  <div className="page-header-card">
    <div className="page-header-group">
      <h1 className="text-h1">{title}</h1>
      {subtitle && <p className="text-subtitle">{subtitle}</p>}
    </div>
    <div className="page-header-actions">{children}</div>
  </div>
);

export const Modal = ({ isOpen, onClose, title, children, footer }) => {
  if (!isOpen) return null;
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-wrapper" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button onClick={onClose} className="modal-close"><X/></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
};

export const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;
  return (
    <div className="flex justify-center items-center gap-3 py-4 shrink-0">
      <button onClick={() => onPageChange(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className="p-2 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-50"><ChevronLeft/></button>
      <span className="font-medium text-gray-600 text-sm">Стр. {currentPage} из {totalPages}</span>
      <button onClick={() => onPageChange(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="p-2 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-50"><ChevronRight/></button>
    </div>
  );
};

export const Toast = ({ message, type = 'success', onClose }) => {
  return createPortal(
    <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl animate-slide-down border-2 ${type === 'error' ? 'bg-white border-red-100 text-red-700' : 'bg-white border-gray-100 text-gray-800'}`}>
        {type === 'success' ? <div className="bg-green-100 p-1.5 rounded-full text-green-600"><Check className="w-4 h-4"/></div> : <div className="bg-red-100 p-1.5 rounded-full text-red-600"><AlertCircle className="w-4 h-4"/></div>}
        <span className="font-bold text-sm">{message}</span>
        <button onClick={onClose} className="opacity-50 hover:opacity-100 ml-2"><X className="w-5 h-5"/></button>
    </div>,
    document.body
  );
};

export const ImportResultModal = ({ result, onClose }) => {
  if (!result) return null;
  return (
    <Modal isOpen={true} onClose={onClose} title="Импорт" footer={<Button onClick={onClose} variant="secondary">Закрыть</Button>}>
      <div className="text-center space-y-3">
        <div className="text-5xl mb-2">{result.success ? '🎉' : '⚠️'}</div>
        <p className="text-lg font-bold text-gray-800">{result.message}</p>
        {result.details && <pre className="text-left text-xs bg-slate-50 p-3 rounded-lg border border-gray-100 overflow-auto max-h-40">{JSON.stringify(result.details, null, 2)}</pre>}
      </div>
    </Modal>
  );
};