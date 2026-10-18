# Nutmeg (codename)

Simple, accessible arcade football for the browser, inspired by the 1990s classics,
with cartoon low-poly players under modern lighting and weather.

**Status:** pre-production. Specs are being written, and the first build is an art-direction look-test.

- 📄 Specs: [docs/specs](docs/specs/README.md)
- 🎮 Play the latest build: https://doig80.github.io/fc94/ (published from `main`)
- 🐞 Feedback: open an issue (Bug / Playtest feedback / Idea)

## Look-test

Compare the two candidate art styles (Stylised vs Toon) across day/dusk/night and clear/rain/snow.
Settings are in the URL, so you can share a view, e.g. `?look=toon&time=night&weather=rain&camera=broadcast`.

## Development

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm test         # unit tests
pnpm build        # production build in dist/
```

See [CLAUDE.md](CLAUDE.md) for all commands and architecture rules.

## Licence

Code: [MIT](LICENSE). Third-party assets keep their own licences, listed in [assets/LICENSES.md](assets/LICENSES.md).
