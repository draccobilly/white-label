export type CampaignLiveDonation = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  paidAt: string | null;
};

export type CampaignLiveReply = {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export type CampaignLiveComment = {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
  replies: CampaignLiveReply[];
};

export type CampaignLiveSnapshot = {
  currentAmount: number;
  goalAmount: number;
  supporterCount: number;
  currency: string;
  percent: number;
  donations: CampaignLiveDonation[];
  comments: CampaignLiveComment[];
};
