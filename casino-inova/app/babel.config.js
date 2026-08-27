module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Tem que ser o ÚLTIMO plugin da lista — exigência do Reanimated.
    plugins: ['react-native-reanimated/plugin'],
  };
};
