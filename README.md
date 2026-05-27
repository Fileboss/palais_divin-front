# Palais Divin — Frontend

SvelteKit frontend for [palaisdivin.lepgu.fr](https://palaisdivin.lepgu.fr), a restaurant rating web app focused on Toulouse.

## Stack

- **SvelteKit 2** + **Svelte 5** (runes mode)
- **TypeScript** (strict)
- **Tailwind CSS v4** + `@tailwindcss/forms` + `@tailwindcss/typography`
- **Paraglide-JS** for i18n (base: `fr` · also: en, es, de, zh, ko, ja)

## Developing

```sh
npm install
npm run dev
```

## Testing

```sh
npm run test:unit   # vitest (unit + component)
npm run test:e2e    # playwright e2e
npm run test        # full suite
```

## Building

```sh
npm run build
npm run preview     # preview the production build locally
```

## Recreate scaffold

```sh
npx sv@0.15.3 create --template minimal --types ts --add prettier eslint vitest="usages:unit,component" playwright tailwindcss="plugins:typography,forms" paraglide="languageTags:fr, en, es, de, zh, ko, ja+demo:no" --install npm palais-front
```
