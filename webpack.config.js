const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
  mode: "development", // Change to 'production' when you're ready to deploy
  optimization: {
    splitChunks: {
      chunks: "all", // Split both JavaScript and CSS
    },
  },
  entry: {
    login: "./src/js/login.js", // Entry for index.html
    register: "./src/js/register.js", // Entry for about.html
    dev_dashboard: "./src/js/dev_dashboard.js",
    mgr_dashboard: "./src/js/mgr_dashboard.js",
    vendor_management: "./src/js/vendor_management.js",
    vendor_add: "./src/js/vendor_add.js",
    profile: "./src/js/profile.js",
    exec_dashboard: "./src/js/exec_dashboard.js",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "js/[name].bundle.js", // Outputs index.bundle.js, about.bundle.js
    clean: true, // Clean the dist folder before each build
  },
  optimization: {
    splitChunks: {
      chunks: "all", // Automatically split shared code
      minChunks: 2, // If a module is used in at least 2 entry points, extract it
    },
  },
  module: {
    rules: [
      {
        test: /\.scss$/, // Match .scss files
        use: [
          MiniCssExtractPlugin.loader, // Extract CSS to separate file
          "css-loader", // Resolves CSS imports
          "sass-loader", // Compiles SCSS to CSS
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
        test: /\.(png|jpg|jpeg|gif|svg)$/, // Match image files
        type: "asset/resource", // This handles images as resources
        generator: {
          filename: "assets/[hash][ext][query]", // Define path and naming convention for images
        },
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        type: "asset/resource",
        generator: {
          filename: "assets/[name][ext][query]", // Customize the path as needed
        },
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./src/templates/login.html", // Template
      filename: "./index.html", // Output file
      chunks: ["login"], // Inject the corresponding JS and CSS for the index page
    }),
    new HtmlWebpackPlugin({
      template: "./src/templates/register.html", // Template
      filename: "./register.html", // Output file
      chunks: ["register"], // Inject the corresponding JS and CSS for the index page
    }),
    new HtmlWebpackPlugin({
      template: "./src/templates/dev_dashboard.html", // Template
      filename: "./dev_dashboard.html", // Output file
      chunks: ["dev_dashboard"], // Inject the corresponding JS and CSS for the index page
    }),
    new HtmlWebpackPlugin({
      template: "./src/templates/mgr_dashboard.html", // Template
      filename: "./mgr_dashboard.html", // Output file
      chunks: ["mgr_dashboard"], // Inject the corresponding JS and CSS for the index page
    }),
    new HtmlWebpackPlugin({
      template: "./src/templates/vendor_management.html", // Template
      filename: "./vendor_management.html", // Output file
      chunks: ["vendor_management"], // Inject the corresponding JS and CSS for the index page
    }),
    new HtmlWebpackPlugin({
      template: "./src/templates/vendor_add.html", // Template
      filename: "./vendor_add.html", // Output file
      chunks: ["vendor_add"], // Inject the corresponding JS and CSS for the index page
    }),
    new HtmlWebpackPlugin({
      template: "./src/templates/profile.html", // Template
      filename: "./profile.html", // Output file
      chunks: ["profile"], // Inject the corresponding JS and CSS for the index page
    }),
    new HtmlWebpackPlugin({
      template: "./src/templates/exec_dashboard.html", // Template
      filename: "./exec_dashboard.html", // Output file
      chunks: ["exec_dashboard"], // Inject the corresponding JS and CSS for the index page
    }),
    new MiniCssExtractPlugin({
      filename: "style/[name].css", // Outputs index.css, about.css
    }),
  ],
  devtool: "source-map", // Generate source maps for easier debugging
  devServer: {
    devMiddleware: { writeToDisk: true },
    static: path.join(__dirname, "dist"),
    hot: true, // Enable hot module replacement
    open: true, // Open browser automatically
    port: 8081, // Port for the dev server
  },
};
