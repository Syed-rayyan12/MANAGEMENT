export interface UserPayload {
  id: string;
  email: string;
  role: 'PM' | 'TL' | 'EXECUTIVE' | 'PRODUCTION';
}

export interface SignupRequest {
  email: string;
  password: string;
  role: 'PM' | 'TL' | 'EXECUTIVE' | 'PRODUCTION';
  name?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user: {
      id: string;
      email: string;
      role: string;
      name: string;
    };
    token: string;
  };
}
