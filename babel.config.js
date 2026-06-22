module.exports = function (api) {
    api.cache(true);
    return {
        presets: ['babel-preset-expo'],
        plugins: [
            ['module:react-native-dotenv', {
                moduleName: '@env',
                path: '.env',
                safe: false,
                allowUndefined: true,
            }],
            // Reanimated's plugin MUST be listed last so it transforms worklets
            // after every other plugin has run.
            'react-native-reanimated/plugin',
        ],
    };
};
