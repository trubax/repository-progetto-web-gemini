export interface Review {
  id: string;
  serviceId: string;
  reviewerId: string;
  providerId: string;
  rating: number; // 1-5 stars
  comment: string;
  metrics: {
    communication: number; // 1-5
    quality: number; // 1-5
    timeliness: number; // 1-5
    value: number; // 1-5
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceMetrics {
  averageRating: number;
  totalReviews: number;
  metrics: {
    communication: number;
    quality: number;
    timeliness: number;
    value: number;
  };
}

export interface ServiceMatch {
  score: number; // 0-100
  factors: {
    distance: number; // km
    categoryMatch: boolean;
    skillsMatch: number; // percentage
    ratingScore: number; // 0-5
    availabilityMatch: boolean;
  };
  service: Service;
  provider: {
    id: string;
    demographics: {
      ageGroup: string;
      country: string;
      location: {
        latitude: number;
        longitude: number;
      };
    };
    metrics: ServiceMetrics;
  };
}
