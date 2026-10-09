import {useCallback, useEffect, useRef, useState} from 'react';
import {demoForThisTab, getConfigSource, parseConfig, sameConfig, type ConfigState, type ConfigValues} from '../config/lumenConfig';

export type LumenConfig = {
  state: ConfigState;
  /** The raw values (development extras such as `dev.now` included). */
  values: ConfigValues;
  /** Re-reads the settings; resolves to the new state. */
  reload(): Promise<ConfigState>;
};

/**
 * Reads the settings from `window.lumen.config` (or the development fallback)
 * and follows changes made on the phone while the app is open.
 */
export function useLumenConfig(): LumenConfig {
  const [state, setState] = useState<ConfigState>({status: 'loading'});
  const [values, setValues] = useState<ConfigValues>({});
  const reloadRef = useRef<() => Promise<ConfigState>>(() => Promise.resolve({status: 'loading'}));

  useEffect(() => {
    const source = getConfigSource();
    let alive = true;
    const apply = (next: ConfigValues): ConfigState => {
      const parsed = parseConfig(next, demoForThisTab());
      if (alive) {
        setValues(next);
        setState(previous => (sameConfig(previous, parsed) ? previous : parsed));
      }
      return parsed;
    };
    const read = () => source.get().then(apply, () => apply({}));
    reloadRef.current = read;
    void read();
    const unsubscribe = source.subscribe(next => (next ? void apply(next) : void read()));
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const reload = useCallback(() => reloadRef.current(), []);
  return {state, values, reload};
}
