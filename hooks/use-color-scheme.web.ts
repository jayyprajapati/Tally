// Web-specific shim that locks the app to light mode.
export function useColorScheme() {
  return 'light' as const;
}
