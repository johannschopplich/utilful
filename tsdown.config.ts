import type { UserConfig, UserConfigFn } from 'tsdown/config'
import { defineConfig } from 'tsdown/config'

const config: UserConfig | UserConfigFn = defineConfig({
  entry: [
    'src/index.ts',
    'src/array.ts',
    'src/csv.ts',
    'src/defu.ts',
    'src/emitter.ts',
    'src/json.ts',
    'src/module.ts',
    'src/object.ts',
    'src/path.ts',
    'src/result.ts',
    'src/string.ts',
    'src/types.ts',
  ],
  dts: true,
  unbundle: true,
})

export default config
