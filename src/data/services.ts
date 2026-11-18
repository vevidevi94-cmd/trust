export type CategoryKey = 'instagram' | 'facebook' | 'telegram' | 'youtube';

export type IconKind =
  | 'instagram'
  | 'facebook'
  | 'telegram'
  | 'youtube'
  | 'bluetick';

export interface PriceTier {
  q: string;
  p: number;
}

export interface ServiceItem {
  id: string;
  name: string;
  icon: IconKind;
  link: string;
  descLines: string[];
  prices: PriceTier[];
  isSpecial?: boolean;
  provider_service?: string;
}

export interface CategoryMeta {
  key: CategoryKey;
  label: string;
  title: string;
  icon: IconKind;
}

export type OrderStatus = 'pending' | 'in progress' | 'completed' | 'canceled';

export interface OrderItem {
  id: number;
  order_id: string;
  service: string;
  pack: string;
  price: number;
  amount: number;
  link: string;
  status: OrderStatus | string;
  date: string;
  uid: string;
  paymentId?: string;
  paymentScreenshot?: string;
  hasPaymentScreenshot?: boolean;
}

export type PaymentRequestStatus = 'pending' | 'approved' | 'wrong_payment';

export interface PaymentFundRequest {
  id: string;
  uid: string;
  amount: number;
  app: string;
  screenshot?: string;
  hasScreenshot?: boolean;
  status: PaymentRequestStatus;
  adminMessage?: string;
  createdAt: number;
  date: string;
}

export interface SupportMessage {
  id: string;
  from: 'You' | 'Admin';
  issue?: string;
  message: string;
  image?: string | null;
  time: number;
}

export const CATEGORIES: CategoryMeta[] = [
  { key: 'instagram', label: 'INSTAGRAM', title: 'Instagram Services', icon: 'instagram' },
  { key: 'facebook', label: 'FACEBOOK', title: 'Facebook Services', icon: 'facebook' },
  { key: 'telegram', label: 'Telegram', title: 'Telegram Services', icon: 'telegram' },
  { key: 'youtube', label: 'YouTube', title: 'YouTube Services', icon: 'youtube' },
];

export const SERVICE_CATALOG: Record<CategoryKey, ServiceItem[]> = {
  instagram: [
    {
      id: 'ig-bluetik',
      name: 'BLUE TIK WITH 500K FOLLOWER',
      icon: 'bluetick',
      link: 'Enter Your Instagram Link',
      descLines: [
        'LIFETIME BLUE TIK ✅',
        'FAST DELIVERY ✅',
        '🇮🇳500K FOLLOWER FREE 🆓',
      ],
      prices: [{ q: 'BLUE TIK WITH 500K FOLLOWER', p: 100 }],
      isSpecial: true,
    },
    {
      id: 'ig-reels-1rs',
      name: '1rs = 1k Reels Views',
      icon: 'instagram',
      link: 'Enter Your Reels Link',
      descLines: [
        '⚡ 1rs = 1000 Reels Views',
        '✅ 100% Real & Non Drop',
        '⏰ Start Time: 0-1 Min [Fast]',
        '🔥 Speed: 1m/day',
        '',
        'Only Reel Link - Post Link Not Allowed',
      ],
      provider_service: '6288',
      prices: [
        { q: '1K Reels Views', p: 1 },
        { q: '2K Reels Views', p: 2 },
        { q: '5K Reels Views', p: 5 },
        { q: '10K Reels Views', p: 10 },
      ],
    },
    {
      id: 'ig-indian-follower',
      name: 'INDIAN FOLLOWER 🇮🇳',
      icon: 'instagram',
      link: 'Enter Your Instagram Link',
      descLines: ['Lifetime Follow ✅', 'Non Drop 💧', 'Lifetime Refill 🔄'],
      prices: [
        { q: '10K Instagram Followers', p: 30 },
        { q: '20K Instagram Followers', p: 50 },
        { q: '30K Instagram Followers', p: 80 },
        { q: '50K Instagram Followers', p: 100 },
      ],
    },
    {
      id: 'ig-indian-like',
      name: 'INDIAN LIKE 🇮🇳',
      icon: 'instagram',
      link: 'Enter Post / Reels Link',
      descLines: ['Lifetime Like ❤️'],
      prices: [
        { q: '1K Indian Likes', p: 30 },
        { q: '5K Indian Likes', p: 50 },
        { q: '10K Indian Likes', p: 80 },
        { q: '50K Indian Likes', p: 100 },
      ],
    },
    {
      id: 'ig-story-views',
      name: 'INDIAN STORY VIEWS 🇮🇳',
      icon: 'instagram',
      link: 'Enter Story Link',
      descLines: ['Real Story Views 👁️'],
      prices: [
        { q: '10K Story Views', p: 30 },
        { q: '50K Story Views', p: 50 },
        { q: '100K Story Views', p: 80 },
        { q: '1M Story Views', p: 100 },
      ],
    },
  ],
  facebook: [
    {
      id: 'fb-page-likes',
      name: 'FB PAGE LIKES',
      icon: 'facebook',
      link: 'Enter Page Link',
      descLines: ['Indian Page Likes 🇮🇳'],
      prices: [
        { q: '1K Page Likes', p: 30 },
        { q: '5K Page Likes', p: 50 },
        { q: '10K Page Likes', p: 80 },
        { q: '50K Page Likes', p: 100 },
      ],
    },
    {
      id: 'fb-post-likes',
      name: 'FB POST LIKES',
      icon: 'facebook',
      link: 'Enter Post Link',
      descLines: ['Real Likes ❤️'],
      prices: [
        { q: '1K Post Likes', p: 30 },
        { q: '5K Post Likes', p: 50 },
        { q: '10K Post Likes', p: 80 },
        { q: '50K Post Likes', p: 100 },
      ],
    },
    {
      id: 'fb-followers',
      name: 'FB FOLLOWERS',
      icon: 'facebook',
      link: 'Enter Profile Link',
      descLines: ['Profile Followers'],
      prices: [
        { q: '1K Followers', p: 30 },
        { q: '5K Followers', p: 50 },
        { q: '10K Followers', p: 80 },
        { q: '50K Followers', p: 100 },
      ],
    },
  ],
  telegram: [
    {
      id: 'tg-members',
      name: 'Telegram Members',
      icon: 'telegram',
      link: 'Enter Channel/Group Link',
      descLines: ['Indian Members • Non Drop'],
      prices: [
        { q: '1K Members', p: 30 },
        { q: '5K Members', p: 50 },
        { q: '10K Members', p: 80 },
        { q: '50K Members', p: 100 },
      ],
    },
    {
      id: 'tg-views',
      name: 'Telegram Views',
      icon: 'telegram',
      link: 'Enter Post Link',
      descLines: ['Post Views'],
      prices: [
        { q: '1K Views', p: 30 },
        { q: '10K Views', p: 50 },
        { q: '100K Views', p: 80 },
        { q: '1M Views', p: 100 },
      ],
    },
    {
      id: 'tg-reactions',
      name: 'Telegram Reactions',
      icon: 'telegram',
      link: 'Enter Post Link',
      descLines: ['Positive Reactions'],
      prices: [
        { q: '1K Reactions', p: 30 },
        { q: '5K Reactions', p: 50 },
        { q: '10K Reactions', p: 80 },
        { q: '50K Reactions', p: 100 },
      ],
    },
  ],
  youtube: [
    {
      id: 'yt-subs',
      name: 'YouTube Subscribers',
      icon: 'youtube',
      link: 'Enter Channel Link',
      descLines: ['Monetizable Subs • Non Drop'],
      prices: [
        { q: '1K Subs', p: 30 },
        { q: '5K Subs', p: 50 },
        { q: '10K Subs', p: 80 },
        { q: '50K Subs', p: 100 },
      ],
    },
    {
      id: 'yt-likes',
      name: 'YouTube Like',
      icon: 'youtube',
      link: 'Enter Video Link',
      descLines: ['Real Likes 👍'],
      prices: [
        { q: '1K Likes', p: 30 },
        { q: '5K Likes', p: 50 },
        { q: '10K Likes', p: 80 },
        { q: '50K Likes', p: 100 },
      ],
    },
    {
      id: 'yt-views',
      name: 'YouTube Views',
      icon: 'youtube',
      link: 'Enter Video Link',
      descLines: ['High Retention Views 👁️'],
      prices: [
        { q: '10K Views', p: 30 },
        { q: '50K Views', p: 50 },
        { q: '100K Views', p: 80 },
        { q: '1M Views', p: 100 },
      ],
    },
  ],
};

export const TELEGRAM_SUPPORT_URL = 'https://t.me/Iamkillerb';
export const TELEGRAM_HANDLE = '@Iamkillerb';
export const POSTER_IMAGE_PATH = '/assets/aistudio/poster_518c6229.jpg';
export const MIN_ADD_FUND = 1;
