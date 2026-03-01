# Contributing to enfusion-mcp

Thanks for your interest in contributing! This project is actively maintained and community contributions are welcome.

## Before You Start

Please **open an issue before submitting a PR** for anything beyond small bug fixes. This saves everyone time — we can discuss approach, scope, and whether it fits the project direction before you write code.

## Getting Started

```bash
git clone https://github.com/Articulated7/enfusion-mcp.git
cd enfusion-mcp
npm install
npm run build
npm test
```

You'll need **Node.js 20+** and **Arma Reforger Tools** (via Steam) if you want to test the live Workbench tools (`wb_*`).

## Ways to Contribute

- **Bug reports** — Use the bug report issue template. Include your OS, Node version, and steps to reproduce.
- **Feature requests** — Use the feature request template. Describe the modding use case it enables.
- **API index improvements** — If a class is missing or incorrectly indexed, open an issue with details.
- **New mod patterns** — If you've built something reusable, a new pattern template is a great contribution.
- **Documentation** — README improvements, wiki additions, and clearer install instructions are always welcome.

## Pull Request Guidelines

- Keep PRs focused — one feature or fix per PR
- Make sure `npm test` passes (187 tests)
- Make sure `npm run build` succeeds with no TypeScript errors
- Add or update tests for new functionality
- Follow the existing code style — TypeScript strict mode is enabled

## Reporting Issues

Use the issue templates provided. For bugs, the more detail the better — Arma Reforger modding setups vary a lot between users.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
