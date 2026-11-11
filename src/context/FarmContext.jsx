import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { farms as fallbackFarms } from '../data/farms';
import { iotApi } from '../components/api/iotApi';

const FarmContext = createContext(null);

export function FarmProvider({ children }) {
  const [farms, setFarms] = useState(fallbackFarms);
  const [events, setEvents] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [assurance, setAssurance] = useState({ protectedFarms: 0, confirmedIrrigations: 0, openIncidents: 0, assuranceRate: 100 });
  const [product, setProduct] = useState({ name: 'FarmGuard', category: 'Irrigation Assurance' });
  const [telemetryPipeline, setTelemetryPipeline] = useState({ mode: 'direct', mqttConnected: false, anomalies: [] });
  const [selectedFarmId, setSelectedFarmId] = useState(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refreshTimer = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const snapshot = await iotApi.snapshot();
      setFarms(snapshot.farms);
      setEvents(snapshot.events || []);
      setIncidents(snapshot.incidents || []);
      setAssurance(snapshot.assurance || {});
      setProduct(snapshot.product || {});
      setTelemetryPipeline(snapshot.telemetryPipeline || { mode: 'direct', mqttConnected: false, anomalies: [] });
      setConnected(true);
      setError('');
    } catch (requestError) {
      setConnected(false);
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialRefresh = setTimeout(refresh, 0);
    const source = new EventSource(iotApi.streamUrl);
    // Throttle, not debounce: resetting the timer on every event starves the
    // refresh when simulator + ESP32 + incident events arrive back to back.
    const scheduleRefresh = () => {
      if (refreshTimer.current) return;
      refreshTimer.current = setTimeout(() => {
        refreshTimer.current = null;
        refresh();
      }, 150);
    };
    source.addEventListener('connected', () => setConnected(true));
    source.addEventListener('snapshot-invalidated', scheduleRefresh);
    source.addEventListener('event', scheduleRefresh);
    source.onerror = () => setConnected(false);

    return () => {
      clearTimeout(refreshTimer.current);
      clearTimeout(initialRefresh);
      source.close();
    };
  }, [refresh]);

  const selectedFarm = useMemo(
    () => farms.find((farm) => farm.id === selectedFarmId) || null,
    [farms, selectedFarmId]
  );
  const setSelectedFarm = useCallback((farm) => setSelectedFarmId(farm?.id || null), []);

  const runAction = useCallback(async (action) => {
    setError('');
    try {
      await action();
      await refresh();
    } catch (actionError) {
      setError(actionError.message);
      throw actionError;
    }
  }, [refresh]);

  const history = useMemo(
    () => Object.fromEntries(farms.map((farm) => [farm.id, farm.history || []])),
    [farms]
  );

  // Real ESP32 farms are controlled over MQTT; simulated farms keep the incident workflow.
  const hardwareControl = (farm, action) => {
    if (farm?.source !== 'hardware') {
      setError('Pump control is only available for farms connected to a real ESP32. Use Simulation Center for simulated farms.');
      return Promise.resolve();
    }
    return runAction(() => iotApi.hardwareCommand(farm.code, action));
  };

  return (
    <FarmContext.Provider value={{
      farms, setFarms, events, setEvents, incidents, assurance, product, telemetryPipeline, selectedFarm, setSelectedFarm, history,
      connected, loading, error, refresh,
      startAckTimeoutScenario: (farmCode) => runAction(() => iotApi.startAckTimeout(farmCode)),
      startSilentFailureScenario: (farmCode) => runAction(() => iotApi.startSilentFailure(farmCode)),
      restoreController: (farmCode) => runAction(() => iotApi.restoreController(farmCode)),
      retryIncident: (incidentId) => runAction(() => iotApi.retryIncident(incidentId)),
      resetScenario: (farmCode) => runAction(() => iotApi.resetScenario(farmCode)),
      toggleMode: (farm) => hardwareControl(farm, farm?.autoMode ? 'MANUAL' : 'AUTO'),
      togglePump: (farm) => hardwareControl(farm, farm?.pump ? 'OFF' : 'ON')
    }}>
      {children}
    </FarmContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFarm() {
  const context = useContext(FarmContext);
  if (!context) throw new Error('useFarm must be used inside FarmProvider');
  return context;
}
