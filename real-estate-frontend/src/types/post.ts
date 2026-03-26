export interface PostImage {
  url: string;
  position: number;
}

export interface Post {
  id: number;
  title: string;
  city: string;
  district: string;
  ward: string;
  address: string;
  description: string;
  price: number;
  area: number;
  direction?: string | null;

  postedAt?: string | null;
  createdAt?: string | null; 

  isVip?: boolean;
  images?: PostImage[];
}