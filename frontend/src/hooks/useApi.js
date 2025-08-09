import { useState } from 'react';

export function useApi(apiFunc) {
  const [state, setState] = useState({
    data: null,
    error: null,
    isLoading: false,
  });

  const execute = async (...args) => {
    setState({ data: null, error: null, isLoading: true });
    try {
      const responseData = await apiFunc(...args);
      setState({ data: responseData, error: null, isLoading: false });
      return { success: true, data: responseData };
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'An unknown error occurred.';
      setState({ data: null, error: errorMessage, isLoading: false });
      return { success: false, error: errorMessage };
    }
  };

  return { ...state, execute };
}