# Continue Claybound in a new ChatGPT chat

This folder is an editable snapshot of the source currently behind:

- Site: `https://claybound.moritzgrassy91.chatgpt.site`
- Site slug: `claybound`
- Exported source commit: `055982edaddad51a77448c0294d575810c95a7b8`

The existing Site identity is retained in `.openai/hosting.json`. Do not create a replacement Site or change its `project_id`.

## Suggested prompt for the new chat

> Use @Sites to continue editing my existing Site with the slug `claybound`. I have attached the editable source export. Reuse the existing `project_id` from `.openai/hosting.json`; do not create a new Site. First inspect the current implementation and then make the changes I request. Preserve all existing levels, assets, editor features, and save compatibility unless I explicitly ask otherwise. When finished, deploy the update to the same Claybound Site.

Attach `claybound-editable-source.zip` to that chat alongside the prompt.

## Local development

```bash
npm ci
npm run dev
```

The deployed app is the static content in `dist/`. Run the full automated gameplay checks with:

```bash
npm run check
```

See `README.md`, `DESIGN.md`, `CAVERN-GAMEPLAY.md`, and the other design notes for the current implementation and verification history.
