const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const webpack = require("webpack");
const Dotenv = require("dotenv-webpack");
const dotenv = require("dotenv");
const PreloadWebpackPlugin = require("@vue/preload-webpack-plugin");

dotenv.config();
const isProduction = process.env.PRODUCTION === "1";

const htmlTemplates = [
  "index.html",
  "login.html",
  "register.html",
  "dev_dashboard.html",
  "vendor.html",
  "profile.html",
  "rfq.html",
  "verification_email.html",
  "company_email.html",
  "email_verified.html",
  "error.html",
  "procurement.html",
  "item.html",
  "dashboard.html",
  "report.html",
  "purchase.html",
];

module.exports = {
  mode: "development", // Change to 'production' when you're ready to deploy
  entry: {
    entry: "./src/js/index.ts",
  },
  ignoreWarnings: [
    {
      module: /sass-loader/,
      message: /Deprecation Warning on line/,
    },
    {
      message: /deprecation/i,
    },
  ],
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "static/js/bundle.js", // Outputs index.bundle.js, about.bundle.js
    clean: true, // Clean the dist folder before each build
    publicPath: isProduction ? "/dist/" : "/",
  },
  module: {
    rules: [
      {
        test: /\.(scss)$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: "css-loader", // translates CSS into CommonJS modules
          },
          {
            loader: "postcss-loader", // Run post css actions
            options: {
              postcssOptions: {
                plugins: function () {
                  // post css plugins, can be exported to postcss.config.js
                  return [require("precss"), require("autoprefixer")];
                },
                silent: true,
                warnings: false,
              },
            },
          },
          {
            loader: "sass-loader",
            options: {
              sassOptions: {
                quietDeps: true,
              },
            },
          },
        ],
      },
      {
        test: /\.css$/, // Match .css files
        use: [
          MiniCssExtractPlugin.loader, // Extract CSS to separate file
          "css-loader", // Resolves CSS imports
        ],
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg|ico)$/, // Match image files
        type: "asset/resource", // This handles images as resources
        generator: {
          filename: "static/assets/[hash][ext][query]", // Define path and naming convention for images
        },
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        type: "asset/resource",
        generator: {
          filename: "static/assets/[name][ext]", // Customize the path as needed
        },
      },
      {
        test: /\.ts$/, // Add TypeScript loader
        use: "ts-loader", // Use ts-loader to handle TypeScript files
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    ...htmlTemplates.map(
      (template) =>
        new HtmlWebpackPlugin({
          template: `./src/templates/${template}`,
          filename: template,
          inject: template === "index.html",
        })
    ),
    new MiniCssExtractPlugin({
      filename: "static/style/bundle.css", // Outputs index.css, about.css
    }),
    new webpack.ProvidePlugin({
      process: "process/browser", // Automatically provide the process polyfill
    }),
    new webpack.ProvidePlugin({
      $: "jquery",
      jQuery: "jquery",
    }),
    new Dotenv({
      path: ".env", // Adjust the path to your .env file
    }),
    new PreloadWebpackPlugin({
      rel: "preload", // Use preload
      as(entry) {
        if (/\.(woff2|woff|ttf|eot)$/.test(entry)) return "font"; // Preload fonts
        if (/\.(png|jpe?g|gif|svg|webp)$/.test(entry)) return "image"; // Preload images
        return undefined; // Skip other asset types
      },
      includeHtmlNames: ["index.html", "error.html"],
      include: "allAssets",
      crossorigin: "anonymous",
    }),
  ],
  resolve: {
    extensions: [".ts", ".js"],
    fallback: {
      os: require.resolve("os-browserify/browser"),
      crypto: require.resolve("crypto-browserify"),
      buffer: require.resolve("buffer/"),
      stream: require.resolve("stream-browserify"),
      path: require.resolve("path-browserify"),
      process: require.resolve("process/browser"),
      vm: require.resolve("vm-browserify"),
    },
  },
  devtool: "source-map", // Generate source maps for easier debugging
  devServer: {
    devMiddleware: { writeToDisk: true },
    static: path.join(__dirname, "dist"),
    hot: true, // Enable hot module replacement
    open: false, // Open browser automatically
    port: 8081, // Port for the dev server
  },
};
