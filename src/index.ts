#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { TripoApi } from './api.js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

const api = new TripoApi();

const server = new Server(
  {
    name: 'tripo-ai-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Returns the image type string expected by the Tripo API based on file extension.
function getImageType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  if (ext === 'jpeg') return 'jpg';
  if (['jpg', 'png', 'webp'].includes(ext)) return ext;
  return 'jpg';
}

// Builds the file reference object for a single image input.
// Accepts a local file path (auto-uploads), a URL, or an existing file token.
async function resolveFileRef(
  filePath?: string,
  fileToken?: string,
  fileUrl?: string
): Promise<{ type: string; file_token?: string; url?: string }> {
  if (fileToken) {
    return { type: 'jpg', file_token: fileToken };
  }
  if (fileUrl) {
    return { type: 'jpg', url: fileUrl };
  }
  if (filePath) {
    const uploadResult = await api.uploadFile(filePath);
    if (uploadResult.code !== 0) {
      throw new Error(`Failed to upload image: ${uploadResult.message}`);
    }
    return { type: getImageType(filePath), file_token: uploadResult.data.image_token };
  }
  throw new Error('No image source provided: supply image_path, image_url, or image_token.');
}

// Tool Implementations

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'text_to_3d',
        description: 'Generate a 3D model from a text description.',
        inputSchema: zodToJsonSchema(
          z.object({
            prompt: z.string().describe('The text description of the 3D model.'),
            negative_prompt: z.string().optional().describe('Text describing what to avoid in the 3D model.'),
            model_version: z.string().optional().describe(
              'Model version to use. Available versions: "v2.5-20250123" (default), "v3.0-20250812", "v3.1-20260211", "Turbo-v1.0-20250506", "v2.0-20240919", "v1.4-20240625".'
            ),
            texture: z.boolean().optional().describe('Whether to generate texture. Default is true.'),
            pbr: z.boolean().optional().describe('Whether to generate PBR materials. Default is true.'),
            face_limit: z.number().int().optional().describe('Maximum number of faces in the generated mesh.'),
            texture_quality: z.enum(['standard', 'detailed']).optional().describe('Quality of the texture. Default is "standard".'),
            geometry_quality: z.enum(['standard', 'detailed']).optional().describe('Quality of the geometry. Default is "standard".'),
            quad: z.boolean().optional().describe('Whether to generate a quad mesh instead of triangles. Default is false.'),
            auto_size: z.boolean().optional().describe('Whether to automatically determine real-world model size. Default is false.'),
          })
        ),
      },
      {
        name: 'image_to_3d',
        description: 'Generate a 3D model from a single image. Provide the image as a local file path, a publicly accessible URL, or a pre-uploaded file token.',
        inputSchema: zodToJsonSchema(
          z.object({
            image_path: z.string().optional().describe('Local filesystem path to the image file. The file will be uploaded automatically.'),
            image_url: z.string().optional().describe('Publicly accessible URL of the image.'),
            image_token: z.string().optional().describe('Pre-uploaded image file token returned by the upload_file tool.'),
            model_version: z.string().optional().describe(
              'Model version to use. Available versions: "v2.5-20250123" (default), "v3.0-20250812", "v3.1-20260211", "Turbo-v1.0-20250506", "v2.0-20240919", "v1.4-20240625".'
            ),
            texture: z.boolean().optional().describe('Whether to generate texture. Default is true.'),
            pbr: z.boolean().optional().describe('Whether to generate PBR materials. Default is true.'),
            face_limit: z.number().int().optional().describe('Maximum number of faces in the generated mesh.'),
            texture_quality: z.enum(['standard', 'detailed']).optional().describe('Quality of the texture. Default is "standard".'),
            geometry_quality: z.enum(['standard', 'detailed']).optional().describe('Quality of the geometry. Default is "standard".'),
            texture_alignment: z.enum(['original_image', 'geometry']).optional().describe('How to align texture to the model. Default is "original_image".'),
            orientation: z.enum(['default', 'align_image']).optional().describe('Orientation of the generated model. Default is "default".'),
            quad: z.boolean().optional().describe('Whether to generate a quad mesh. Default is false.'),
            auto_size: z.boolean().optional().describe('Whether to automatically determine real-world model size. Default is false.'),
          }).refine(data => data.image_path || data.image_url || data.image_token, {
            message: 'At least one of image_path, image_url, or image_token must be provided.',
          })
        ),
      },
      {
        name: 'multiview_to_3d',
        description: 'Generate a 3D model from multiple view images (front, back, side, etc.). Each image can be a local file path, a URL, or a pre-uploaded file token.',
        inputSchema: zodToJsonSchema(
          z.object({
            files: z.array(
              z.object({
                path: z.string().optional().describe('Local filesystem path to the image file.'),
                url: z.string().optional().describe('Publicly accessible URL of the image.'),
                token: z.string().optional().describe('Pre-uploaded image file token.'),
              })
            ).min(1).describe('List of view images. Each entry must supply at least one of: path, url, or token.'),
            model_version: z.string().optional().describe(
              'Model version to use. Available versions: "v2.5-20250123" (default), "v3.0-20250812", "v3.1-20260211", "v2.0-20240919".'
            ),
            texture: z.boolean().optional().describe('Whether to generate texture. Default is true.'),
            pbr: z.boolean().optional().describe('Whether to generate PBR materials. Default is true.'),
            face_limit: z.number().int().optional().describe('Maximum number of faces in the generated mesh.'),
            texture_quality: z.enum(['standard', 'detailed']).optional().describe('Quality of the texture. Default is "standard".'),
            geometry_quality: z.enum(['standard', 'detailed']).optional().describe('Quality of the geometry. Default is "standard".'),
          })
        ),
      },
      {
        name: 'get_task_status',
        description: 'Get the current status and result of any Tripo task. Poll this after creating a task to check progress and retrieve the output model URLs.',
        inputSchema: zodToJsonSchema(
          z.object({
            task_id: z.string().describe('The task ID returned when the task was created.'),
          })
        ),
      },
      {
        name: 'upload_file',
        description: 'Upload a local image file to Tripo and receive a file token. Use the returned token in image_to_3d or multiview_to_3d instead of re-uploading the same file.',
        inputSchema: zodToJsonSchema(
          z.object({
            file_path: z.string().describe('Absolute or relative path to the image file to upload.'),
          })
        ),
      },
      {
        name: 'refine_model',
        description: 'Refine a draft 3D model to improve its quality. Use the task ID from a previous text_to_3d or image_to_3d task.',
        inputSchema: zodToJsonSchema(
          z.object({
            draft_model_task_id: z.string().describe('The task ID of the draft model to refine.'),
          })
        ),
      },
      {
        name: 'animate_prerigcheck',
        description: 'Check whether a 3D model is suitable for rigging and animation. Run this before rig_model to confirm compatibility.',
        inputSchema: zodToJsonSchema(
          z.object({
            original_model_task_id: z.string().describe('The task ID of the model to check.'),
          })
        ),
      },
      {
        name: 'rig_model',
        description: 'Rig a 3D model so it can be animated. The model must first pass the animate_prerigcheck. Use retarget_animation afterwards to apply a specific animation.',
        inputSchema: zodToJsonSchema(
          z.object({
            original_model_task_id: z.string().describe('The task ID of the model to rig.'),
            rig_type: z.enum(['biped', 'quadruped', 'hexapod', 'octopod', 'avian', 'serpentine', 'aquatic', 'others'])
              .optional()
              .describe('Skeleton type that matches the model. Default is "biped".'),
            out_format: z.enum(['glb', 'fbx']).optional().describe('Output format for the rigged model. Default is "glb".'),
          })
        ),
      },
      {
        name: 'retarget_animation',
        description: 'Apply a preset animation to a rigged 3D model. The model must have been rigged with rig_model first.',
        inputSchema: zodToJsonSchema(
          z.object({
            original_model_task_id: z.string().describe('The task ID of the rigged model.'),
            animation: z.string().describe(
              'Animation to apply. Use a preset string such as "preset:idle", "preset:walk", "preset:run", "preset:jump", "preset:slash", "preset:shoot", "preset:hurt", "preset:fall", "preset:dive", "preset:climb", "preset:turn", "preset:quadruped:walk", "preset:hexapod:walk".'
            ),
            out_format: z.enum(['glb', 'fbx']).optional().describe('Output format. Default is "glb".'),
            bake_animation: z.boolean().optional().describe('Whether to bake the animation into the mesh. Default is true.'),
          })
        ),
      },
      {
        name: 'stylize_model',
        description: 'Apply a visual style transformation to an existing 3D model.',
        inputSchema: zodToJsonSchema(
          z.object({
            original_model_task_id: z.string().describe('The task ID of the model to stylize.'),
            style: z.enum(['lego', 'voxel', 'voronoi', 'minecraft']).describe('The style to apply to the model.'),
            block_size: z.number().int().optional().describe('Block size used for voxel-like styles (e.g. "lego", "voxel", "minecraft"). Default is 80.'),
          })
        ),
      },
      {
        name: 'convert_model',
        description: 'Convert an existing 3D model to a different file format (e.g. FBX, OBJ, STL, USDZ).',
        inputSchema: zodToJsonSchema(
          z.object({
            original_model_task_id: z.string().describe('The task ID of the model to convert.'),
            format: z.enum(['GLTF', 'USDZ', 'FBX', 'OBJ', 'STL', '3MF']).describe('Target output format.'),
            quad: z.boolean().optional().describe('Whether to generate a quad mesh. Default is false.'),
            face_limit: z.number().int().optional().describe('Maximum number of faces in the output mesh.'),
            texture_size: z.number().int().optional().describe('Texture resolution in pixels. Default is 4096.'),
            texture_format: z.enum(['BMP', 'DPX', 'HDR', 'JPEG', 'OPEN_EXR', 'PNG', 'TARGA', 'TIFF', 'WEBP'])
              .optional()
              .describe('Format for exported textures. Default is "JPEG".'),
            scale_factor: z.number().optional().describe('Scale factor applied to the model. Default is 1.0.'),
            flatten_bottom: z.boolean().optional().describe('Whether to flatten the bottom of the model. Default is false.'),
            pivot_to_center_bottom: z.boolean().optional().describe('Move pivot point to the center-bottom of the model. Default is false.'),
            with_animation: z.boolean().optional().describe('Whether to include animation data in the export. Default is true.'),
            fbx_preset: z.enum(['blender', 'mixamo', '3dsmax']).optional().describe('FBX export preset. Only relevant when format is "FBX". Default is "blender".'),
          })
        ),
      },
      {
        name: 'texture_model',
        description: 'Generate new textures for an existing 3D model, optionally guided by a text or image prompt.',
        inputSchema: zodToJsonSchema(
          z.object({
            original_model_task_id: z.string().describe('The task ID of the model to texture.'),
            texture: z.boolean().optional().describe('Whether to generate a texture. Default is true.'),
            pbr: z.boolean().optional().describe('Whether to generate PBR materials. Default is true.'),
            texture_quality: z.enum(['standard', 'detailed']).optional().describe('Quality of the texture. Default is "standard".'),
            texture_alignment: z.enum(['original_image', 'geometry']).optional().describe('How to align the texture. Default is "original_image".'),
            text_prompt: z.string().optional().describe('Text prompt to guide texture generation.'),
            image_prompt_path: z.string().optional().describe('Local path to an image that guides texture style.'),
            image_prompt_url: z.string().optional().describe('URL of an image that guides texture style.'),
            image_prompt_token: z.string().optional().describe('Pre-uploaded token of an image that guides texture style.'),
            model_version: z.string().optional().describe('Model version to use. Available: "v2.5-20250123" (default), "v3.0-20250812".'),
          })
        ),
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'text_to_3d') {
      const { prompt, negative_prompt, model_version, texture, pbr, face_limit, texture_quality, geometry_quality, quad, auto_size } = args as any;
      const payload: any = { type: 'text_to_model', prompt };
      if (negative_prompt) payload.negative_prompt = negative_prompt;
      if (model_version) payload.model_version = model_version;
      if (texture !== undefined) payload.texture = texture;
      if (pbr !== undefined) payload.pbr = pbr;
      if (face_limit !== undefined) payload.face_limit = face_limit;
      if (texture_quality) payload.texture_quality = texture_quality;
      if (geometry_quality) payload.geometry_quality = geometry_quality;
      if (quad !== undefined) payload.quad = quad;
      if (auto_size !== undefined) payload.auto_size = auto_size;

      const result = await api.createTask(payload);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    if (name === 'image_to_3d') {
      const { image_path, image_url, image_token, model_version, texture, pbr, face_limit, texture_quality, geometry_quality, texture_alignment, orientation, quad, auto_size } = args as any;

      const fileRef = await resolveFileRef(image_path, image_token, image_url);
      const payload: any = { type: 'image_to_model', file: fileRef };
      if (model_version) payload.model_version = model_version;
      if (texture !== undefined) payload.texture = texture;
      if (pbr !== undefined) payload.pbr = pbr;
      if (face_limit !== undefined) payload.face_limit = face_limit;
      if (texture_quality) payload.texture_quality = texture_quality;
      if (geometry_quality) payload.geometry_quality = geometry_quality;
      if (texture_alignment) payload.texture_alignment = texture_alignment;
      if (orientation) payload.orientation = orientation;
      if (quad !== undefined) payload.quad = quad;
      if (auto_size !== undefined) payload.auto_size = auto_size;

      const result = await api.createTask(payload);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    if (name === 'multiview_to_3d') {
      const { files, model_version, texture, pbr, face_limit, texture_quality, geometry_quality } = args as any;
      const resolvedFiles = [];
      for (const f of files) {
        resolvedFiles.push(await resolveFileRef(f.path, f.token, f.url));
      }

      const payload: any = { type: 'multiview_to_model', files: resolvedFiles };
      if (model_version) payload.model_version = model_version;
      if (texture !== undefined) payload.texture = texture;
      if (pbr !== undefined) payload.pbr = pbr;
      if (face_limit !== undefined) payload.face_limit = face_limit;
      if (texture_quality) payload.texture_quality = texture_quality;
      if (geometry_quality) payload.geometry_quality = geometry_quality;

      const result = await api.createTask(payload);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    if (name === 'get_task_status') {
      const { task_id } = args as any;
      const result = await api.getTask(task_id);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    if (name === 'upload_file') {
      const { file_path } = args as any;
      const result = await api.uploadFile(file_path);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    if (name === 'refine_model') {
      const { draft_model_task_id } = args as any;
      const payload = { type: 'refine_model', draft_model_task_id };
      const result = await api.createTask(payload);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    if (name === 'animate_prerigcheck') {
      const { original_model_task_id } = args as any;
      const payload = { type: 'animate_prerigcheck', original_model_task_id };
      const result = await api.createTask(payload);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    if (name === 'rig_model') {
      const { original_model_task_id, rig_type, out_format } = args as any;
      const payload: any = { type: 'animate_rig', original_model_task_id };
      if (rig_type) payload.rig_type = rig_type;
      if (out_format) payload.out_format = out_format;
      const result = await api.createTask(payload);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    if (name === 'retarget_animation') {
      const { original_model_task_id, animation, out_format, bake_animation } = args as any;
      const payload: any = { type: 'animate_retarget', original_model_task_id, animation };
      if (out_format) payload.out_format = out_format;
      if (bake_animation !== undefined) payload.bake_animation = bake_animation;
      const result = await api.createTask(payload);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    if (name === 'stylize_model') {
      const { original_model_task_id, style, block_size } = args as any;
      const payload: any = { type: 'stylize_model', original_model_task_id, style };
      if (block_size !== undefined) payload.block_size = block_size;
      const result = await api.createTask(payload);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    if (name === 'convert_model') {
      const { original_model_task_id, format, quad, face_limit, texture_size, texture_format, scale_factor, flatten_bottom, pivot_to_center_bottom, with_animation, fbx_preset } = args as any;
      const payload: any = { type: 'convert_model', original_model_task_id, format };
      if (quad !== undefined) payload.quad = quad;
      if (face_limit !== undefined) payload.face_limit = face_limit;
      if (texture_size !== undefined) payload.texture_size = texture_size;
      if (texture_format) payload.texture_format = texture_format;
      if (scale_factor !== undefined) payload.scale_factor = scale_factor;
      if (flatten_bottom !== undefined) payload.flatten_bottom = flatten_bottom;
      if (pivot_to_center_bottom !== undefined) payload.pivot_to_center_bottom = pivot_to_center_bottom;
      if (with_animation !== undefined) payload.with_animation = with_animation;
      if (fbx_preset) payload.fbx_preset = fbx_preset;
      const result = await api.createTask(payload);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    if (name === 'texture_model') {
      const { original_model_task_id, texture, pbr, texture_quality, texture_alignment, text_prompt, image_prompt_path, image_prompt_url, image_prompt_token, model_version } = args as any;
      const payload: any = { type: 'texture_model', original_model_task_id };
      if (texture !== undefined) payload.texture = texture;
      if (pbr !== undefined) payload.pbr = pbr;
      if (texture_quality) payload.texture_quality = texture_quality;
      if (texture_alignment) payload.texture_alignment = texture_alignment;
      if (model_version) payload.model_version = model_version;

      if (text_prompt || image_prompt_path || image_prompt_url || image_prompt_token) {
        const texturePrompt: any = {};
        if (text_prompt) texturePrompt.text = text_prompt;
        if (image_prompt_path || image_prompt_url || image_prompt_token) {
          texturePrompt.image = await resolveFileRef(image_prompt_path, image_prompt_token, image_prompt_url);
        }
        payload.texture_prompt = texturePrompt;
      }

      const result = await api.createTask(payload);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
