import React, { useState } from 'react';
import { LogIn, Lock, User } from 'lucide-react';
import { Input, Button } from '../components/UI';
import { apiCall } from '../api';

const LoginPage = ({ onLogin }) => {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      // Отправляем login и password на сервер
      const response = await apiCall('/login', 'POST', { login, password });
      if (response.success) {
        onLogin(response.user);
      } else {
        setError(response.message || 'Ошибка входа');
      }
    } catch (err) { 
      setError(err.message || 'Ошибка входа'); 
    } 
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 animate-fade-in">
      <div className="w-full max-w-[400px]">
        {/* Логотип */}
        <div className="flex justify-center mb-10">
          <img 
            src="images/proboot.png" 
            alt="ProBoot Logo" 
            className="h-14 w-auto object-contain drop-shadow-sm" 
          />
        </div>

        <div className="bg-white rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100 p-10">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-4 bg-red-50 text-red-600 text-[10px] rounded-2xl text-center font-black uppercase border border-red-100 animate-shake">
                {error}
              </div>
            )}
            
            <div className="space-y-3">
              <Input 
                value={login} 
                onChange={e => setLogin(e.target.value)} 
                placeholder="Логин" 
                icon={User}
                autoFocus 
              />
              
              <Input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="Пароль" 
                icon={Lock}
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full h-14 text-sm font-black uppercase tracking-widest shadow-lg shadow-blue-100 mt-2" 
              disabled={loading}
              icon={LogIn}
            >
              {loading ? 'Вход...' : 'Войти'}
            </Button>
          </form>
          
          <div className="text-center mt-10 text-[9px] font-black text-slate-300 uppercase tracking-widest">
            ProBoot APP • v1.2.0
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;