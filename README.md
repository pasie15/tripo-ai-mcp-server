# Tripo AI MCP Server

This is a Model Context Protocol (MCP) server for the [Tripo3D AI](https://www.tripo3d.ai/) API. It allows AI assistants to interact with Tripo's 3D generation capabilities.

## Features

- **Text to 3D**: Generate 3D models from text prompts.
- **Image to 3D**: Generate 3D models from images (supports local paths, URLs, or pre-uploaded tokens).
- **Multiview to 3D**: Generate 3D models from multiple view images (local paths, URLs, or tokens).
- **Refine Model**: Improve the quality of a draft model.
- **Stylization**: Apply styles (lego, voxel, voronoi, minecraft) to a model.
- **Texture Model**: Re-texture an existing model, optionally guided by a text or image prompt.
- **Convert Model**: Export a model to a different format (GLTF, FBX, OBJ, STL, USDZ, 3MF).
- **Animation workflow**: Check riggability → rig a model → retarget a preset animation.
- **Task Status**: Check the status and retrieve output URLs of any generation task.
- **Upload File**: Upload a local image file and receive a reusable file token.

## Installation

```bash
npm install -g tripo-ai-mcp-server
```

## Configuration

You need a Tripo3D API secret. You can set it in a `.env` file or pass it as an environment variable `TRIPO_API_SECRET`.

## Client Configuration

### Claude Desktop

Add the following to your `claude_desktop_config.json` (usually found at `%APPDATA%\Claude\claude_desktop_config.json` on Windows or `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "tripo-ai": {
      "command": "npx",
      "args": [
        "-y",
        "tripo-ai-mcp-server"
      ],
      "env": {
        "TRIPO_API_SECRET": "your_api_secret_here"
      }
    }
  }
}
```

## Usage

Start the server:

```bash
tripo-ai-mcp-server
```

### Tools

- `text_to_3d`: Generate a 3D model from a text description.
- `image_to_3d`: Generate a 3D model from an image (local path, URL, or pre-uploaded token).
- `multiview_to_3d`: Generate a 3D model from multiple view images.
- `get_task_status`: Check task status and retrieve output model URLs.
- `upload_file`: Upload a local image file and receive a reusable file token.
- `refine_model`: Refine a draft model to improve quality.
- `animate_prerigcheck`: Check whether a model is suitable for rigging.
- `rig_model`: Rig a model so it can be animated.
- `retarget_animation`: Apply a preset animation to a rigged model.
- `stylize_model`: Apply a visual style to a model (lego, voxel, voronoi, minecraft).
- `convert_model`: Convert a model to a different file format (GLTF, FBX, OBJ, STL, USDZ, 3MF).
- `texture_model`: Generate new textures for an existing model.

## Development

1. Clone the repo.
2. `npm install`
3. `npm run build`
4. `node dist/index.js`

## Publishing to npm

A GitHub Actions workflow (`.github/workflows/publish.yml`) automatically publishes the package to npm whenever a new GitHub Release is created.

**One-time setup:**

1. Generate an npm **Automation** token at [npmjs.com](https://www.npmjs.com) → Avatar → Access Tokens → Generate New Token → Automation.
2. Add it as a repository secret in GitHub: Settings → Secrets and variables → Actions → New repository secret → name it `NPM_TOKEN`.

**To release a new version:**

1. Bump `"version"` in `package.json`.
2. Commit and push.
3. Create a new GitHub Release (tag it with the version, e.g. `v1.1.0`). The workflow triggers automatically and publishes to npm.

## License

ISC
