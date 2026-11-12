import { createContext, useContext, useEffect, useState } from 'react';
import * as authApi from '../api/authApi';
import axiosClient from '../api/axiosClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      const storedUser = JSON.parse(stored);
      setUser(storedUser);
      refreshProfile();
    }
    setLoading(false);
  }, []);

  async function refreshProfile() {
    if (!localStorage.getItem('accessToken')) return;
    try {
      const { data } = await axiosClient.get('/users/me');
      updateUser({
        avatarUrl: data.data.avatar_url,
        bio: data.data.bio,
        schoolOrOrg: data.data.school_or_org,
      });
    } catch {
      // Keep the stored login profile available if the API is temporarily unavailable.
    }
  }

  async function login(email, password) {
    const { data } = await authApi.login(email, password);
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    await refreshProfile();
  }

  async function register(payload) {
    const { data } = await authApi.register(payload);
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    await refreshProfile();
  }

  function logout() {
    localStorage.clear();
    setUser(null);
  }

  function updateUser(updates) {
    setUser((currentUser) => {
      const updatedUser = { ...currentUser, ...updates };
      if (Object.keys(updates).every((key) => currentUser?.[key] === updates[key])) {
        return currentUser;
      }
      localStorage.setItem('user', JSON.stringify(updatedUser));
      return updatedUser;
    });
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
