const path = require('path');

module.exports = {
  mode: 'development',
  entry: {
    main: './src/main/main.ts',
    preload: './src/preload/preload.ts',
  },
  target: 'electron-main',
  output: {
    path: path.resolve(__dirname, 'dist/main'),
    filename: '[name].js',
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: { loader: 'ts-loader', options: { transpileOnly: true } },
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  node: {
    __dirname: false,
    __filename: false,
  },
  externals: {
    'electron-store': 'commonjs electron-store',
    'archiver': 'commonjs archiver',
    'electron-log': 'commonjs electron-log',
  },
};
