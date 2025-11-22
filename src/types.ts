export interface TripoTask {
  task_id: string;
  type: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled' | 'unknown';
  input?: any;
  output?: {
    model?: string;
    base_model?: string;
    render_image?: string;
    pbr_model?: string;
    [key: string]: any;
  };
  progress?: number;
  created_at?: number;
  error_message?: string;
}

export interface CreateTaskResponse {
  code: number;
  data: TripoTask;
  message: string;
}

export interface GetTaskResponse {
  code: number;
  data: TripoTask;
  message: string;
}

export interface UploadResponse {
  code: number;
  data: {
    image_token: string;
  };
  message: string;
}
