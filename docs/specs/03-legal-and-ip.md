# 03 — Legal & IP

**Status:** Draft — awaiting review

> Not legal advice. These are working rules to keep a free public release low-risk.

## Naming (open decision D3)

- **"Nutmeg" is the project codename.** The repository keeps its original name `fc94`, which is never
  shown in the game. The old codename "FC94" was dropped because "FC" plus "94" evokes both _EA Sports FC_ and
  _FIFA International Soccer (1994)_, which are trademarks of EA / FIFA.
- Before public release we pick a distinctive name and check it against trademark databases
  (EUIPO, USPTO, WIPO) and app/game stores.
- The public game, store pages and marketing never use "FIFA", "EA", "EA Sports FC" or similar marks,
  except for a factual "inspired by 90s arcade football" statement.

## Teams, players, competitions

- **Fictional** national teams with invented names, flags, crests and kits. No real flags or federation crests.
- **Fictional** player names, generated so they don't collide with real players.
- No real stadium names, competition names ("World Cup", "Euro", "Champions League") or trophy designs.
  Use generic terms ("World Tournament", "Continental Cup").
- No likenesses of real people.

## Third-party assets

Every third-party file is recorded in `assets/LICENSES.md` with source URL, author, licence, and date.

| Source                                           | Licence      | Allowed                                      | Notes                                        |
| ------------------------------------------------ | ------------ | -------------------------------------------- | -------------------------------------------- |
| Kenney, Quaternius, Poly Haven, ambientCG        | CC0          | Yes                                          | Attribution appreciated, not required        |
| Mixamo animations/characters                     | Adobe terms  | Yes, inside the game                         | Don't offer raw files as a separate download |
| CC-BY assets                                     | CC-BY        | Yes, with credits screen                     | Credit in-game and in README                 |
| CC-BY-NC / -ND, "editorial use", unknown licence | —            | **No**                                       |                                              |
| AI-generated assets                              | Tool's terms | Yes if the terms allow commercial/public use | Record tool + date                           |

Fonts: SIL Open Font License or similar only. Audio: CC0/CC-BY or self-made.

## Code

- The repository is **public**. Code is licensed **MIT** (`LICENSE`); third-party assets keep their own
  licences (`assets/LICENSES.md`). Never commit secrets or assets whose licence forbids redistribution.
- Dependencies must use permissive licences (MIT, Apache-2.0, BSD). Babylon.js is Apache-2.0.

## Privacy

- No accounts, no tracking cookies in v1. Settings stored locally in the browser.
- If analytics are ever added: privacy-friendly and cookieless, mentioned in a privacy note.
