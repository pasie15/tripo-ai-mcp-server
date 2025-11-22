import axios, { AxiosInstance } from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import { CreateTaskResponse, GetTaskResponse, UploadResponse } from './types.js';

export class TripoApi {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.TRIPO_API_KEY || '';
    if (!this.apiKey) {
      console.warn('TRIPO_API_KEY is not set. API calls requiring authentication will fail.');
    }

    this.client = axios.create({
      baseURL: 'https://api.tripo3d.ai/v2/openapi',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
    };
  }

  async createTask(payload: any): Promise<CreateTaskResponse> {
    try {
      const response = await this.client.post('/task', payload);
      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new Error(`Tripo API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  async getTask(taskId: string): Promise<GetTaskResponse> {
    try {
      const response = await this.client.get(`/task/${taskId}`);
      return response.data;
    } catch (error: any) {
       if (error.response) {
        throw new Error(`Tripo API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  async uploadFile(filePath: string): Promise<UploadResponse> {
    try {
      const formData = new FormData();
      formData.append('file', fs.createReadStream(filePath));

      // Axios instance headers are JSON by default, let form-data handle the content type
      const response = await axios.post('https://api.tripo3d.ai/v2/openapi/upload', formData, {
        headers: {
          ...this.getHeaders(),
          ...formData.getHeaders(),
        },
      });
      return response.data;
    } catch (error: any) {
       if (error.response) {
        throw new Error(`Tripo API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }
}
