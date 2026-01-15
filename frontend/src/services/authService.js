import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from './firebase';

/**
 * Iniciar sesión con email y contraseña
 */
export const loginWithEmail = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    return { success: false, error: getErrorMessage(error.code) };
  }
};

/**
 * Cerrar sesión
 */
export const logout = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Observar cambios en el estado de autenticación
 */
export const onAuthChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};

/**
 * Obtener el usuario actual
 */
export const getCurrentUser = () => {
  return auth.currentUser;
};

/**
 * Mensajes de error en español
 */
const getErrorMessage = (errorCode) => {
  const errorMessages = {
    'auth/invalid-email': 'El correo electrónico no es válido.',
    'auth/user-disabled': 'Esta cuenta ha sido deshabilitada.',
    'auth/user-not-found': 'No existe una cuenta con este correo electrónico.',
    'auth/wrong-password': 'Contraseña incorrecta.',
    'auth/operation-not-allowed': 'Operación no permitida.',
    'auth/invalid-credential': 'Credenciales inválidas. Verifica tu email y contraseña.',
    'auth/too-many-requests': 'Demasiados intentos fallidos. Intenta más tarde.',
  };

  return errorMessages[errorCode] || 'Error desconocido. Intenta nuevamente.';
};
