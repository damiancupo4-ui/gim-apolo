export {};

declare global {
  interface Window {
    electronAPI: {
      loadGymData: () => Promise<any>;
      saveGymData: (data: any) => Promise<boolean>;
      getDataPath: () => Promise<string>;
    };
  }
}