import PreloadWebpackPlugin from "@vue/preload-webpack-plugin";
import CompressionPlugin from "compression-webpack-plugin";
import CssMinimizerPlugin from "css-minimizer-webpack-plugin";
import Dotenv from "dotenv-webpack";
import fastGlob from "fast-glob";
import HtmlWebpackPlugin from "html-webpack-plugin";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import { createRequire } from "module";
import path from "path";
import { PurgeCSSPlugin } from "purgecss-webpack-plugin";
import TerserPlugin from "terser-webpack-plugin";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const { ProvidePlugin } = require("webpack");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.PRODUCTION === "1";

const htmlTemplates = [
  "index.html",
  "account.html",
  "user_manual.html",
  "dev_dashboard.html",
  "vendor.html",
  "rfq.html",
  "verification_email.html",
  "company_email.html",
  "email_verified.html",
  "error.html",
  "procurement.html",
  "quotation.html",
  "item.html",
  "dashboard.html",
  "report.html",
  "report_drk.html",
  "users.html",
];

const plugins = [
  ...htmlTemplates.map(
    (template) =>
      new HtmlWebpackPlugin({
        template: `./src/templates/${template}`,
        filename: template,
        inject: template === "index.html",
      })
  ),
  new MiniCssExtractPlugin({
    filename: "static/style/bundle.[contenthash].css",
  }),
  new ProvidePlugin({
    $: "jquery",
    jQuery: "jquery",
  }),
  new Dotenv({
    path: ".env",
  }),
  new PreloadWebpackPlugin({
    rel: "preload",
    as(entry) {
      if (/\.(woff2|woff|ttf|eot)$/.test(entry)) return "font";
      if (/\.(png|jpe?g|gif|svg|webp)$/.test(entry)) return "image";
      return undefined;
    },
    includeHtmlNames: ["index.html", "error.html"],
    include: "allAssets",
    crossorigin: "anonymous",
  }),
];

if (isProduction) {
  plugins.push(
    new PurgeCSSPlugin({
      paths: fastGlob.sync(`${path.join(__dirname, "src")}/**/*`, {
        nodir: true,
      }),
    }),
    new PreloadWebpackPlugin({
      rel: "preload",
      as(entry) {
        if (/\.(woff2|woff|ttf|eot)$/.test(entry)) return "font";
        if (/\.(png|jpe?g|gif|svg|webp)$/.test(entry)) return "image";
        return undefined;
      },
      includeHtmlNames: ["index.html", "error.html"],
      include: "allAssets",
      crossorigin: "anonymous",
    }),
    new CompressionPlugin({
      algorithm: "brotliCompress",
    })
  );
}

export default {
  mode: isProduction ? "production" : "development",
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
    filename: "static/js/bundle.[contenthash].js",
    clean: true,
    publicPath: isProduction ? "/dist/" : "/",
  },
  module: {
    rules: [
      {
        test: /\.(scss)$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: "css-loader",
          },
          {
            loader: "postcss-loader",
            options: {
              postcssOptions: {
                plugins: function () {
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
        test: /\.css$/,
        use: [
          isProduction ? MiniCssExtractPlugin.loader : "style-loader",
          "css-loader",
        ],
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg|ico)$/,
        type: "asset/resource",
        generator: {
          filename: "static/assets/[hash][ext][query]",
        },
        use: [
          {
            loader: "image-webpack-loader",
            options: {
              mozjpeg: {
                progressive: true,
                quality: 65,
              },
              optipng: {
                enabled: false,
              },
              pngquant: {
                quality: [0.65, 0.9],
                speed: 4,
              },
              gifsicle: {
                interlaced: false,
              },
              webp: {
                quality: 75,
              },
            },
          },
        ],
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        type: "asset/resource",
        generator: {
          filename: "static/assets/[name][ext]",
        },
      },
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  plugins,
  optimization: {
    minimize: isProduction,
    minimizer: [
      new TerserPlugin({
        parallel: true,
      }),
      new CssMinimizerPlugin(),
    ],
    splitChunks: false,
    usedExports: true,
  },
  resolve: {
    extensions: [".ts", ".js"],
    fallback: {
      os: false,
      crypto: false,
      buffer: false,
      stream: false,
      path: false,
      process: false,
      vm: false,
    },
    alias: {
      "mdb-ui-kit": path.resolve(__dirname, "node_modules/mdb-ui-kit"),
    },
  },
  devtool: isProduction ? false : "source-map",
  devServer: {
    devMiddleware: { writeToDisk: true },
    static: path.join(__dirname, "dist"),
    hot: true,
    open: false,
    port: 8081,
  },
};
