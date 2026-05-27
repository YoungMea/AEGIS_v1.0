export interface SessionUserDto {
  id: string;
  uid: string;
  phone: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: number;
}

export type DashboardSection =
  | "database"
  | "add"
  | "find"
  | "chat"
  | "owlSight"
  | "wing"
  | "hawkEye"
  | "news"
  | "support"
  | "profile"
  | "activity";

export interface UserSearchResult {
  id: string;
  uid: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: number;
}
