export interface SessionUserDto {
  id: string;
  uid: string;
  phone: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: number;
}

export type DashboardSection = "database" | "add" | "find" | "news" | "support";

export interface UserSearchResult {
  id: string;
  uid: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: number;
}
