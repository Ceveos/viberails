/** Display names for framework identifiers. */
export const FRAMEWORK_NAMES: Record<string, string> = {
  nextjs: 'Next.js',
  remix: 'Remix',
  nuxt: 'Nuxt',
  sveltekit: 'SvelteKit',
  astro: 'Astro',
  vite: 'Vite',
  gatsby: 'Gatsby',
  express: 'Express',
  fastify: 'Fastify',
  hono: 'Hono',
};

/** Display names for styling libraries. */
export const STYLING_NAMES: Record<string, string> = {
  tailwindcss: 'Tailwind CSS',
  'css-modules': 'CSS Modules',
  'styled-components': 'styled-components',
  emotion: 'Emotion',
  sass: 'Sass',
};

/** Display names for notable libraries. */
export const LIBRARY_NAMES: Record<string, string> = {
  'react-query': 'React Query',
  'tanstack-query': 'TanStack Query',
  zod: 'Zod',
  trpc: 'tRPC',
  prisma: 'Prisma',
  drizzle: 'Drizzle',
};

/** Display names for directory roles. */
export const ROLE_DESCRIPTIONS: Record<string, string> = {
  pages: 'Pages / Routes',
  components: 'Components',
  hooks: 'Hooks',
  utils: 'Utilities',
  types: 'Type definitions',
  tests: 'Tests',
  styles: 'Styles',
  api: 'API routes',
  config: 'Configuration',
};
