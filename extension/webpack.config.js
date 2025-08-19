const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  return {
    entry: {
      background: './src/background/index.ts',
      'content/gmail': './src/content/gmail.ts',
      'content/outlook': './src/content/outlook.ts',
      'popup/index': './src/popup/index.tsx',
      'options/index': './src/options/index.tsx'
    },
    
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true
    },
    
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/
        },
        {
          test: /\.css$/,
          use: [
            isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
            'css-loader'
          ]
        },
        {
          test: /\.(png|jpg|jpeg|gif|svg)$/,
          type: 'asset/resource',
          generator: {
            filename: 'assets/[name].[hash][ext]'
          }
        }
      ]
    },
    
    resolve: {
      extensions: ['.tsx', '.ts', '.js', '.jsx'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
      }
    },
    
    plugins: [
      new CopyWebpackPlugin({
        patterns: [
          {
            from: 'public',
            to: '.',
            globOptions: {
              ignore: ['**/manifest.json']
            }
          },
          {
            from: 'public/manifest.json',
            to: 'manifest.json'
          },
          {
            from: 'src/content/*.css',
            to: 'content/[name][ext]'
          }
        ]
      }),
      
      new HtmlWebpackPlugin({
        template: './src/popup/index.html',
        filename: 'popup/index.html',
        chunks: ['popup/index']
      }),
      
      new HtmlWebpackPlugin({
        template: './src/options/index.html',
        filename: 'options/index.html',
        chunks: ['options/index']
      }),
      
      ...(isProduction ? [
        new MiniCssExtractPlugin({
          filename: '[name].css'
        })
      ] : [])
    ],
    
    devtool: isProduction ? false : 'cheap-module-source-map',
    
    optimization: {
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all'
          }
        }
      }
    }
  };
};
