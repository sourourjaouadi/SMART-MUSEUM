// Test-only helper: Node exposes Web Storage globals by default only from
// v25. Install a minimal in-memory sessionStorage for older supported Node
// runtimes (20.19+/22.12+/24) so session tests behave like the browser.
if (typeof globalThis.sessionStorage === 'undefined') {
  const values = new Map();
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      get length() { return values.size; },
      key: (index) => [...values.keys()][index] ?? null,
      getItem: (key) => (values.has(String(key)) ? values.get(String(key)) : null),
      setItem: (key, value) => { values.set(String(key), String(value)); },
      removeItem: (key) => { values.delete(String(key)); },
      clear: () => { values.clear(); },
    },
  });
}
