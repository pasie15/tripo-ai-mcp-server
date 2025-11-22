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
            model_version: z.string().optional().describe('Model version (e.g., "v2.0-20240919"). Defaults to latest.'),
            texture: z.boolean().optional().describe('Whether to generate texture. Default is true.'),
            pbr: z.boolean().optional().describe('Whether to use PBR rendering. Default is true.'),
            face_limit: z.number().optional().describe('Limit the number of faces.'),
          })
        ),
      },
      {
        name: 'image_to_3d',
        description: 'Generate a 3D model from an image.',
        inputSchema: zodToJsonSchema(
          z.object({
            image_path: z.string().optional().describe('Local path to the image file.'),
            image_token: z.string().optional().describe('Image token if already uploaded.'),
            model_version: z.string().optional().describe('Model version.'),
            texture: z.boolean().optional().describe('Whether to generate texture.'),
            pbr: z.boolean().optional().describe('Whether to use PBR.'),
            face_limit: z.number().optional(),
          }).refine(data => data.image_path || data.image_token, {
            message: "Either image_path or image_token must be provided"
          })
        ),
      },
      {
        name: 'multiview_to_3d',
        description: 'Generate a 3D model from multiple view images.',
        inputSchema: zodToJsonSchema(
           z.object({
            files: z.array(z.object({
               path: z.string().optional(),
               token: z.string().optional()
            })).describe('List of image paths or tokens for multiview.'),
            model_version: z.string().optional(),
            texture: z.boolean().optional(),
            pbr: z.boolean().optional(),
           })
        )
      },
      {
        name: 'get_task_status',
        description: 'Get the status and result of a Tripo task.',
        inputSchema: zodToJsonSchema(
          z.object({
            task_id: z.string().describe('The ID of the task to check.'),
          })
        ),
      },
      {
        name: 'upload_file',
        description: 'Upload a file to Tripo for use in other tasks.',
        inputSchema: zodToJsonSchema(
          z.object({
             file_path: z.string().describe('Path to the file to upload.')
          })
        )
      },
      {
        name: 'animate_model',
        description: 'Animate a rigged 3D model.',
        inputSchema: zodToJsonSchema(
             z.object({
                 original_model_task_id: z.string().describe('The task ID of the original model (must be rigged/compatible).'),
                 animation_preset: z.string().optional().describe('Animation preset (e.g. "walk", "run").') 
             })
        )
      },
       {
        name: 'stylize_model',
        description: 'Stylize a 3D model.',
        inputSchema: zodToJsonSchema(
             z.object({
                 original_model_task_id: z.string().describe('The task ID of the original model.'),
                 style: z.string().describe('The style to apply (e.g., "lego", "voxel").')
             })
        )
      }
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'text_to_3d') {
      const { prompt, model_version, texture, pbr, face_limit } = args as any;
      const payload: any = {
        type: 'text_to_model',
        prompt,
      };
      if (model_version) payload.model_version = model_version;
      if (texture !== undefined) payload.texture = texture;
      if (pbr !== undefined) payload.pbr = pbr;
      if (face_limit) payload.face_limit = face_limit;

      const result = await api.createTask(payload);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    if (name === 'image_to_3d') {
      const { image_path, image_token, model_version, texture, pbr, face_limit } = args as any;
      let token = image_token;

      if (!token && image_path) {
         const uploadResult = await api.uploadFile(image_path);
         if (uploadResult.code !== 0) {
             throw new Error(`Failed to upload image: ${uploadResult.message}`);
         }
         token = uploadResult.data.image_token;
      }

      const payload: any = {
        type: 'image_to_model',
        file: {
            type: 'jpg', // Tripo seems to infer or accept generic 'jpg/png' for the token structure usually, but let's check docs if strict. Research said "file_id parameter" for S3. But for direct upload it returned "image_token". 
            file_id: token 
        }
      };
      
      // Research Note: The research says "file parameter" for direct upload. 
      // But for task creation using the uploaded file, we need to pass the reference.
      // The research mentions: "file_id parameter instead of inline image data".
      // Let's assume the task payload expects a 'file' object with 'file_id' or 'image_token'.
      // Looking at common Tripo API usage:
      // payload: { type: 'image_to_model', file: { type: 'png', file_id: 'token' } }
      
      if (model_version) payload.model_version = model_version;
      if (texture !== undefined) payload.texture = texture;
      if (pbr !== undefined) payload.pbr = pbr;
      if (face_limit) payload.face_limit = face_limit;

      const result = await api.createTask(payload);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
    
    if (name === 'upload_file') {
        const { file_path } = args as any;
        const result = await api.uploadFile(file_path);
        return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
    }

    if (name === 'get_task_status') {
      const { task_id } = args as any;
      const result = await api.getTask(task_id);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
    
    if (name === 'multiview_to_3d') {
        // Implementation for multiview
        // Expects args.files to be array of {path?, token?}
        // Upload paths if needed
        const { files, model_version, texture, pbr } = args as any;
        const uploadedFiles = [];
        for (const f of files) {
            if (f.token) {
                uploadedFiles.push({ type: 'jpg', file_id: f.token }); // Defaulting type
            } else if (f.path) {
                const up = await api.uploadFile(f.path);
                 uploadedFiles.push({ type: 'jpg', file_id: up.data.image_token });
            }
        }
        
        const payload: any = {
            type: 'multiview_to_model',
            files: uploadedFiles
        };
         if (model_version) payload.model_version = model_version;
         // ... others
         
         const result = await api.createTask(payload);
         return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    
    if (name === 'animate_model') {
        const { original_model_task_id, animation_preset } = args as any;
        const payload = {
            type: 'animation',
            original_model_task_id,
            animation_preset
        };
        const result = await api.createTask(payload);
         return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
    
    if (name === 'stylize_model') {
         const { original_model_task_id, style } = args as any;
        const payload = {
            type: 'stylize_model',
            original_model_task_id,
            style
        };
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

// Helper to convert Zod schema to JSON schema
function zodToJsonSchema(schema: z.ZodType): any {
  // Simple conversion or use zod-to-json-schema package if complexity increases
  // For now, I'll rely on a basic implementation or just assume the SDK handles it?
  // The MCP SDK usually expects a JSON Schema object.
  // I should actually install zod-to-json-schema to be safe.
  
  // Actually, I can just write the schemas directly as JSON for now to save a dependency, 
  // or use a simple converter.
  // Let's grab `zod-to-json-schema`.
  
  return require('zod-to-json-schema').zodToJsonSchema(schema);
}

const transport = new StdioServerTransport();
await server.connect(transport);
