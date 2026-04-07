const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: {
    app: './src/renderer/scripts/app.ts',
    auth: './src/renderer/scripts/auth.ts',
  },
  target: 'web',
  output: {
    path: path.resolve(__dirname, 'dist/renderer'),
    filename: 'scripts/[name].bundle.js',
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
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'src/renderer/index.html', to: 'index.html' },
        { from: 'src/renderer/login.html', to: 'login.html' },
        { from: 'src/renderer/styles', to: 'styles' },
      ],
    }),
  ],
};
