# ikanban

iKanban is a multi-agent coding workspace powered by [OpenCode](https://opencode.ai). It is built for driving, reviewing, and coordinating parallel agent work across projects, with session management, diff review and project-aware navigation in one place.

**Bilibili Video** [why do it](https://www.bilibili.com/video/BV1t9AhztEjX/) [v0.1](https://www.bilibili.com/video/BV1W3Pgz8ExJ/) [v0.2](https://www.bilibili.com/video/BV1ZNP1znEn5/) [v0.2.11 how to use](https://www.bilibili.com/video/BV1Y9wMzKE2b/?vd_source=7c4f5b1516707ddaefcbbf124fa84a48)

<details>
  <summary>UI Screenshots</summary>

  <img width="3258" height="1460" alt="Image" src="https://github.com/user-attachments/assets/2dc21dcc-124e-4a89-9577-357ebe30b8f0" />

  <img width="3258" height="1460" alt="Image" src="https://github.com/user-attachments/assets/b3cc7c31-0b9c-45ac-98d8-90178af31e2f" />
</details>

## Quick Start

### Option 1: Use the hosted app (recommended)

Open: https://isomoes.github.io/ikanban

Start OpenCode with CORS enabled for GitHub Pages:

```bash
opencode serve --port <PORT> --cors https://isomoes.github.io
```

Then add your server URL in settings: `http://localhost:<PORT>`.

### Option 2: Run locally with npx

```bash
npx ikanban-web@latest                        # Start on port 3000
npx ikanban-web@latest --port 8080            # Custom port
OPENCODE_URL=http://myserver:4096 npx ikanban-web@latest  # External OpenCode server
```

## Acknowledgments

- Inspired by and thanks to the [openchamber](https://github.com/btriapitsyn/openchamber) project.
- [opencode web UI](https://github.com/anomalyco/opencode/tree/dev/packages/app)

## Star History

<a href="https://star-history.com/#isomoes/ikanban&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=isomoes/ikanban&type=Date&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=isomoes/ikanban&type=Date" />
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=isomoes/ikanban&type=Date" />
  </picture>
</a>
