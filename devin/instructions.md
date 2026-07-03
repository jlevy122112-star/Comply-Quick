# Comply-Quick: Operational Guardrails

These rules are enforced across the entire build lifecycle. All contributors (human and AI) must comply.

---

## 1. TypeScript Strict Type Compliance

- `strict: true` is set in `tsconfig.json` and must never be disabled.
- No implicit `any` types. Every variable, parameter, return value, and prop must be explicitly typed or inferable without `any`.
- Do not use `as any`, `@ts-ignore`, or `@ts-expect-error` to suppress type errors.
- Do not use `getattr`, `setattr`, or bracket-notation property access as a substitute for proper typing.
- All API responses, props, and state must have corresponding type definitions in `src/types/`.

## 2. Tailwind CSS: Clean, Responsive, Mobile-First

- All styling uses Tailwind CSS utility classes. No inline `style` attributes or external CSS modules (except `globals.css` for base config).
- Design mobile-first: start with base (mobile) styles, then layer `sm:`, `md:`, `lg:`, `xl:` breakpoints.
- Components must be visually correct and usable at all standard breakpoints (320px through 1440px+).
- No hard-coded pixel widths on layout containers. Use relative/responsive units and Tailwind's sizing scale.

## 3. Modular, Single-Responsibility Component Design

- Each component file exports exactly one component with a single, well-defined purpose.
- Components live in `src/components/` organized by domain (e.g., `ui/`, `layout/`, `forms/`, `dashboard/`).
- Shared utility functions go in `src/lib/`. Custom hooks go in `src/hooks/`.
- No god-components. If a component exceeds ~150 lines, decompose it.
- Favor composition over inheritance. Use props and children for flexibility.

## 4. File Path Constraint

**ABSOLUTE CONSTRAINT:** Never use parentheses in any file or directory path.

- Forbidden: `src/app/(auth)/login/page.tsx`, `src/app/(marketing)/page.tsx`
- Allowed: `src/app/auth/login/page.tsx`, `src/app/marketing/page.tsx`
- Use flat folder names or private folders (prefixed with `_`) for organizational grouping.
- This rule applies to all directories, files, imports, and references without exception.

## 5. General Standards

- All imports at the top of the file. No dynamic imports inside functions unless code-splitting is intentional.
- Use the `@/*` path alias (mapped to `./src/*`) for all internal imports.
- Never commit secrets, API keys, or credentials. Use `.env.local` for local secrets.
- Follow Next.js App Router conventions: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `route.ts`.
- Use `PageProps` and `LayoutProps` type helpers for route component props (globally available, no import needed).
- ESLint must pass (`npm run lint`) before any commit.
