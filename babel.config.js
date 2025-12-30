module.exports = function (api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
    // Expo Router is now included via babel-preset-expo; keep Reanimated plugin at the end
    plugins: ['react-native-reanimated/plugin'],
  };
};
