import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/index.js',
      format: 'cjs',
      exports: 'named',
      sourcemap: true
    },
    {
      file: 'dist/index.mjs',
      format: 'esm',
      sourcemap: true
    }
  ],
  plugins: [
    json(),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: true,
      declarationDir: 'dist'
    }),
    resolve({
      browser: false,
      preferBuiltins: true
    }),
    commonjs()
  ],
  // 将所有 Node.js 内置模块和 redis 标记为外部依赖
  external: [
    'redis',
    'node:http',
    'node:crypto',
    'content-type',
    'raw-body',
    '@modelcontextprotocol/sdk/types.js',
    'zod',
  ]
};