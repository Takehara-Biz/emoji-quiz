import { defineConfig } from "vite";

export default defineConfig({
  // 相対パスで出力し、どの静的ホスティングのサブパスでも動くようにする
  base: "./",
});
