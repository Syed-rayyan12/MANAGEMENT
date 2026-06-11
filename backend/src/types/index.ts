export interface UserPayload {
  id: string;
  email: string;
  role: 'PM' | 'TL' | 'EXECUTIVE' | 'PRODUCTION';
  teamIds: string[]; // IDs of teams the user is a member of
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
      username: string;
      email: string;
      role: string;
      name: string;
      avatar: string | null;
      specialization: string | null;
      teams: { id: string; slug: string; name: string }[];
    };
    token: string;
  };
}
