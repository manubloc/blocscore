# Contributing to blocscore

Thanks for your interest in improving blocscore! 🧗

## Development setup

Requires Node.js 18+.

```bash
npm install
npm run dev        # http://localhost:5173
```

Before opening a pull request, make sure the production build passes:

```bash
npm run build
```

## How to contribute

1. **Fork** the repository and create a feature branch:
   `git checkout -b feature/my-change`
2. Make your change. The whole app lives in `src/App.jsx`; gym/demo data is in `src/seed.js`.
3. Keep the style consistent with the surrounding code (plain React, no extra dependencies unless discussed first).
4. Run `npm run build` to confirm everything compiles.
5. **Commit** with a clear message and open a **pull request** describing what and why.

## Reporting bugs / ideas

Open an issue with steps to reproduce (for bugs) or a short description of the feature/idea.
Screenshots help a lot for UI topics.

## Notes

- The app is bilingual (DE/EN). If you add user-facing text, add both languages to the `STR` dictionary in `src/App.jsx`.
- Persistence goes through `src/storage.js`. If you build a backend adapter (e.g. Supabase), keep the same `get / set / delete / list` interface so the rest of the app stays unchanged.

By contributing, you agree that your contributions will be licensed under the GNU GPLv3.
