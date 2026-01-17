import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    bin: 'src/bin.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node18',
  splitting: false,
  treeshake: true,
  external: ['inquirer', 'ora', 'chalk', 'cli-table3', 'commander', 'open', 'yaml', 'nanoid'],
});
