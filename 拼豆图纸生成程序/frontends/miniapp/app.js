// WeChat Mini Program — App Entry
App({
  onLaunch() {
    console.log('[Perler] Mini Program launched');
    // Store global data
    this.globalData = {
      engineReady: false,
      wasmModule: null,
      paletteData: null,
      userInfo: null,
    };
  },

  onShow() {
    // App shown
  },

  onHide() {
    // App hidden
  },

  globalData: {
    engineReady: false,
    wasmModule: null,
    paletteData: null,
  },
});
