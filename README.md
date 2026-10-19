# Nutmeg (codename)

Simple, accessible arcade football for the browser, inspired by the 1990s classics,
with cartoon low-poly players under modern lighting and weather.

**Status:** pre-production. Specs are being written, and the first build is an art-direction look-test.

- 📄 Specs: [docs/specs](docs/specs/README.md)
- 🎮 Play the latest build: https://doig80.github.io/fc94/ (published from `main`)
- 🐞 Feedback: open an issue (Bug / Playtest feedback / Idea)

## Play

The main page is the vertical-slice match: 5-a-side against the CPU on the keyboard (`H` shows the controls).
Settings are in the URL, e.g. `?weather=rain&time=night&camera=broadcast`.

- `?mode=looktest`: the art-direction look-test (Stylised chosen)
- `?mode=physics`: top-down physics sandbox (debug view)

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
