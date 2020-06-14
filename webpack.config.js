const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

const config = {
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  mode: "production",
  devServer: {
    contentBase: './dist',
    host:'0.0.0.0',
    port:8080,
    liveReload: false
  },
  resolve: {
    extensions: [ '.tsx', '.ts', '.js' ],
    alias: {
      // "@classes": path.resolve(__dirname, "src", "classes")
    }
  },
  entry: {
    bundle: './src/index.ts'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
  },
  plugins: [
      new CopyPlugin({
        patterns: [
          {from: 'public', to: '', }
        ]
      })
  ]
};

module.exports = (env, argv) => {
  config.devtool = argv.mode === 'development' ? 'inline-source-map' : false;
  return config;
};
