import { createContext, useContext, useState } from 'react';
import api from '../api/client.js';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('hr_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const login = async (username, password) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await api.post('/api/login', { username, password });
      if (!data.success) {
        throw new Error(data.message || 'Invalid credentials');
      }
      const payload = {
        user_id: data.user_id,
        username: data.username,
        role: data.role,
      };
      setUser(payload);
      localStorage.setItem('hr_user', JSON.stringify(payload));
      return payload;
    } catch (err) {
      setError(err.message || 'Unable to login');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post('/api/logout');
    } catch (err) {
      console.warn('Logout request failed (continuing):', err.message);
    } finally {
      setUser(null);
      localStorage.removeItem('hr_user');
    }
  };

  const value = {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    error,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
