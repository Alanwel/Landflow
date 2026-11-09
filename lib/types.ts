export const LAND_TYPES = [
  "residential",
  "commercial",
  "agricultural",
  "industrial",
] as const;

export type LandType = (typeof LAND_TYPES)[number];

export const REGIONS = [
  "Kampala",
  "Wakiso",
  "Mukono",
  "Jinja",
  "Mbale",
  "Mbarara",
  "Gulu",
  "Fort Portal",
] as const;

export type Region = (typeof REGIONS)[number];

export type ListingStatus = "active" | "sold" | "rented" | "hidden";

export interface Seller {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  location: string;
  region: string;
  land_type: string;
  status: ListingStatus;
  seller_id: string;
  created_at: string;
  seller?: Seller | null;
  /** The first photo of the listing, if it has one. */
  coverUrl?: string | null;
}

/** One picture attached to a listing. */
export interface ListingPhoto {
  id: string;
  listingId: string;
  storagePath: string;
  url: string;
  sortOrder: number;
  createdAt: string;
}

export interface OperatorStats {
  listings: number;
  active: number;
  sold: number;
  hidden: number;
  enquiries: number;
  newEnquiries: number;
  sellers: number;
  photos: number;
}

/** A person, as the admin panel sees them. */
export interface AdminUser {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  isOperator: boolean;
  isAdmin: boolean;
  isBanned: boolean;
  bannedReason: string | null;
  bannedAt: string | null;
  createdAt: string;
  listingCount: number;
  enquiryCount: number;
}

export interface AdminStats extends OperatorStats {
  users: number;
  banned: number;
}

export interface ListingFilters {
  query?: string;
  region?: string;
  land_type?: string;
  max_price?: number;
}
