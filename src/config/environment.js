const ENV = {
  dev: {
    API_URL: "https://dev.api.brasilsync.com.br",
    ENV_NAME: "Development",
  },
  prod: {
    API_URL: "https://api.brasilsync.com.br",
    ENV_NAME: "Production",
  },
};

// Detecta se está em modo desenvolvimento
const getEnvVars = () => {
  if (__DEV__) return ENV.dev; // Emulador, Expo Go, etc.
  return ENV.prod; // Build final / produção
};

export default getEnvVars();

