import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		// adapter-node: the app is a BFF (it owns the OIDC flow and proxies /api/* with the
		// caller's bearer token), so it must run as a Node server — not as static output.
		// Deployed as a container behind Caddy; see the Deployment section in CLAUDE.md.
		adapter: adapter()
	}
};

export default config;
