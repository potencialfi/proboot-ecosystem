import React, { useState } from 'react';
import { LogIn, Lock, User } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { apiCall } from '../api';

const LoginPage = ({ onLogin }) => {
    const [formData, setFormData] = useState({ login: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Отправляем только логин/пароль. Сервер сам найдет компанию.
            const data = await apiCall('/auth/login', 'POST', formData);
            
            if (data.success) {
                // Сохраняем все данные, включая companyId, который вернул сервер
                localStorage.setItem('proboot_user', JSON.stringify(data));
                onLogin(data); 
            }
        } catch (err) {
            setError(err.message || 'Ошибка входа');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md p-8 rounded-3xl shadow-xl animate-fade-in">
                <div className="text-center mb-8">
                    <img src="/images/proboot.png" alt="Proboot" className="h-12 mx-auto mb-4 opacity-90" />
                    <h1 className="text-2xl font-bold text-gray-900">Вход в систему</h1>
                    <p className="text-gray-500 mt-2">Введите свои данные для доступа</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <Input 
                        label="Логин" 
                        icon={User}
                        value={formData.login}
                        onChange={e => setFormData({...formData, login: e.target.value})}
                        placeholder="Ваш логин"
                        autoFocus
                    />
                    
                    <Input 
                        label="Пароль" 
                        type="password"
                        icon={Lock}
                        value={formData.password}
                        onChange={e => setFormData({...formData, password: e.target.value})}
                        placeholder="••••••"
                    />

                    {error && <div className="p-3 bg-red-50 text-red-600 text-sm font-bold rounded-xl text-center">{error}</div>}

                    <Button type="submit" className="w-full" isLoading={loading} icon={LogIn}>
                        Войти
                    </Button>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;