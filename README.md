# Tripo AI MCP Server

This is a Model Context Protocol (MCP) server for the [Tripo3D AI](https://www.tripo3d.ai/) API. It allows AI assistants to interact with Tripo's 3D generation capabilities.

## Features

- **Text to 3D**: Generate 3D models from text prompts.
- **Image to 3D**: Generate 3D models from images (supports local paths with auto-upload).
- **Multiview to 3D**: Generate 3D models from multiple view images.
- **Animation**: Animate rigged models.
- **Stylization**: Apply styles to models.
- **Task Status**: Check the status of generation tasks.

## Installation

```bash
npm install -g tripo-ai-mcp-server
```

## Configuration

You need a Tripo3D API key. You can set it in a `.env` file or pass it as an environment variable `TRIPO_API_KEY`.

## Usage

Start the server:

```bash
tripo-ai-mcp-server
```

### Tools

- `text_to_3d`: Create a 3D model from text.
- `image_to_3d`: Create a 3D model from an image.
- `multiview_to_3d`: Create a 3D model from multiview images.
- `get_task_status`: Check task status.
- `upload_file`: Upload a file manually.
- `animate_model`: Animate a model.
- `stylize_model`: Stylize a model.

## Development

1. Clone the repo.
2. `npm install`
3. `npm run build`
4. `node dist/index.js`

## License

ISC
