/**
 * Stub AuthContext — remplace l'auth Base44 (OAuth).
 * L'application utilise son propre système PIN-based (AppLogin.jsx + localStorage).
 * Ce contexte passe directement à l'app sans vérification Base44.
 */
import React, { createContext, useContext } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  return (
    <AuthContext.Provider value={{
      user: null,
      isAuthenticated: true,   // bypass — auth handled by PIN system
      isLoadingAuth: false,
      isLoadingPublicSettings: false,
      authError: null,
      appPublicSettings: null,
      logout: () => {},
      navigateToLogin: () => {},
      checkAppState: () => {},
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
