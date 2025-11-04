import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { getStatusLabels, syncAllData, SyncError } from "../services/sync";

const STATUS = getStatusLabels();
const INITIAL_STATUS = "Aguardando sincronizacao";

export const SyncContext = createContext({
  sync: async () => {},
  syncing: false,
  status: INITIAL_STATUS,
  lastSyncAt: null,
  error: null,
});

export function SyncProvider({ children }) {
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState(INITIAL_STATUS);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem("@lastSyncAt");
      if (stored) setLastSyncAt(stored);
    })();
  }, []);

  const sync = useCallback(
    async ({ silent } = {}) => {
      setSyncing(true);
      setError(null);
      setStatus(STATUS.CHECKING_CONNECTION);

      try {
        const result = await syncAllData({
          onStatus: setStatus,
        });
        setLastSyncAt(result.timestamp);
        return result;
      } catch (err) {
        const message =
          err instanceof SyncError
            ? err.message
            : "Nao foi possivel sincronizar os dados.";

        setStatus(message);
        setError(err);

        if (!silent) {
          throw err;
        }

        return null;
      } finally {
        setSyncing(false);
      }
    },
    []
  );

  const value = useMemo(
    () => ({
      sync,
      syncing,
      status,
      lastSyncAt,
      error,
    }),
    [sync, syncing, status, lastSyncAt, error]
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

