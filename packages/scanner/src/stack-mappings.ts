/**
 * Detection mapping tables used by detectStack to identify frameworks,
 * backends, ORMs, styling solutions, and notable libraries from package.json.
 */

export interface FrameworkMapping {
  /** Package name to look for in dependencies. */
  dep: string;
  /** Name to use in the StackItem. */
  name: string;
  /** If any of these deps are present, skip this mapping. */
  excludeDeps?: string[];
}

export const FRAMEWORK_MAPPINGS: FrameworkMapping[] = [
  { dep: 'next', name: 'nextjs' },
  { dep: 'expo', name: 'expo' },
  { dep: 'react-native', name: 'react-native', excludeDeps: ['expo'] },
  { dep: '@angular/core', name: 'angular' },
  { dep: '@sveltejs/kit', name: 'sveltekit' },
  { dep: 'svelte', name: 'svelte', excludeDeps: ['@sveltejs/kit', 'astro'] },
  { dep: 'astro', name: 'astro' },
  { dep: '@remix-run/react', name: 'remix' },
  { dep: 'nuxt', name: 'nuxt' },
  { dep: 'vue', name: 'vue', excludeDeps: ['nuxt'] },
  { dep: 'gatsby', name: 'gatsby' },
  { dep: 'solid-js', name: 'solidjs' },
  { dep: '@builder.io/qwik', name: 'qwik' },
  { dep: 'electron', name: 'electron' },
  { dep: '@tauri-apps/api', name: 'tauri' },
  {
    dep: 'react',
    name: 'react',
    excludeDeps: ['next', '@remix-run/react', 'gatsby', 'expo'],
  },
];

export const BACKEND_MAPPINGS: Array<{ dep: string; name: string }> = [
  { dep: '@nestjs/core', name: 'nestjs' },
  { dep: 'express', name: 'express' },
  { dep: 'fastify', name: 'fastify' },
  { dep: 'koa', name: 'koa' },
  { dep: 'hono', name: 'hono' },
  { dep: '@supabase/supabase-js', name: 'supabase' },
  { dep: 'firebase', name: 'firebase' },
  { dep: 'convex', name: 'convex' },
];

export const ORM_MAPPINGS: Array<{ dep: string; name: string }> = [
  { dep: '@prisma/client', name: 'prisma' },
  { dep: 'prisma', name: 'prisma' },
  { dep: 'drizzle-orm', name: 'drizzle' },
  { dep: 'typeorm', name: 'typeorm' },
  { dep: 'sequelize', name: 'sequelize' },
  { dep: 'mongoose', name: 'mongoose' },
  { dep: 'kysely', name: 'kysely' },
  { dep: '@mikro-orm/core', name: 'mikro-orm' },
];

export const STYLING_MAPPINGS: Array<{ dep: string; name: string }> = [
  { dep: 'tailwindcss', name: 'tailwindcss' },
  { dep: 'styled-components', name: 'styled-components' },
  { dep: '@emotion/react', name: 'emotion' },
  { dep: 'sass', name: 'sass' },
  { dep: '@vanilla-extract/css', name: 'vanilla-extract' },
  { dep: 'unocss', name: 'unocss' },
  { dep: '@pandacss/dev', name: 'panda-css' },
  { dep: 'nativewind', name: 'nativewind' },
];

export const LIBRARY_MAPPINGS: Array<{ deps: string[]; name: string }> = [
  // Validation
  { deps: ['zod'], name: 'zod' },
  // API
  { deps: ['@trpc/server'], name: 'trpc' },
  { deps: ['@tanstack/react-query'], name: 'react-query' },
  { deps: ['@apollo/client'], name: 'apollo' },
  { deps: ['urql'], name: 'urql' },
  { deps: ['graphql'], name: 'graphql' },
  // State management
  { deps: ['@reduxjs/toolkit'], name: 'redux-toolkit' },
  { deps: ['zustand'], name: 'zustand' },
  { deps: ['jotai'], name: 'jotai' },
  { deps: ['recoil'], name: 'recoil' },
  { deps: ['mobx'], name: 'mobx' },
  { deps: ['xstate'], name: 'xstate' },
  { deps: ['valtio'], name: 'valtio' },
  // Forms
  { deps: ['react-hook-form'], name: 'react-hook-form' },
  { deps: ['formik'], name: 'formik' },
  // HTTP
  { deps: ['axios'], name: 'axios' },
  // Auth
  { deps: ['next-auth'], name: 'next-auth' },
  { deps: ['@auth/core'], name: 'auth-js' },
  { deps: ['@clerk/nextjs'], name: 'clerk' },
  { deps: ['lucia'], name: 'lucia' },
  // Dates
  { deps: ['date-fns'], name: 'date-fns' },
  { deps: ['dayjs'], name: 'dayjs' },
  { deps: ['luxon'], name: 'luxon' },
  // i18n
  { deps: ['i18next'], name: 'i18next' },
  { deps: ['next-i18next'], name: 'next-i18next' },
  // Payments
  { deps: ['stripe'], name: 'stripe' },
  // Realtime
  { deps: ['socket.io'], name: 'socket.io' },
  // Testing utilities
  { deps: ['@testing-library/react'], name: 'testing-library' },
  { deps: ['msw'], name: 'msw' },
  { deps: ['storybook', '@storybook/react'], name: 'storybook' },
  // Bundlers
  { deps: ['vite'], name: 'vite' },
  { deps: ['webpack'], name: 'webpack' },
  { deps: ['esbuild'], name: 'esbuild' },
  { deps: ['@rspack/core'], name: 'rspack' },
  // Monorepo
  { deps: ['nx'], name: 'nx' },
  { deps: ['lerna'], name: 'lerna' },
];

export const LOCK_FILE_MAP: Array<{ file: string; name: string }> = [
  { file: 'pnpm-lock.yaml', name: 'pnpm' },
  { file: 'yarn.lock', name: 'yarn' },
  { file: 'bun.lockb', name: 'bun' },
  { file: 'package-lock.json', name: 'npm' },
];
