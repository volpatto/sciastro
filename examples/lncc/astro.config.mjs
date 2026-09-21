import { defineConfig } from 'astro/config';
import sciastro from 'sciastro';
export default defineConfig({
  integrations: [sciastro({
    styles: ['./src/styles/custom.css'],
    components: { sections: { 'project-note': './src/components/ProjectNote.astro' } },
  })],
});
